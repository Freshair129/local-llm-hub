"""Persistent, advisory GPU leases for clients that coordinate their own providers.

The Hub only records lease ownership and reads GPU telemetry. It never loads or
unloads a model, nor does it start, stop, or terminate a provider or workload.
"""

from __future__ import annotations

import asyncio
import csv
import io
import os
import re
import shutil
import sqlite3
import subprocess
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, TypeVar
from uuid import uuid4

from pydantic import Field, StrictInt, field_validator

from .errors import HubError
from .models import StrictModel

_IDENTIFIER = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$')
_MEMORY_VALUE = re.compile(r'^[0-9]+$')
_SCHEMA_VERSION = 1
T = TypeVar('T')


@dataclass(frozen=True)
class GpuTelemetry:
    gpu_uuid: str
    name: str
    free_vram_mb: int
    total_vram_mb: int


GpuTelemetryReader = Callable[[], Awaitable[Sequence[GpuTelemetry]]]


class AcquireGpuLease(StrictModel):
    owner_id: str = Field(min_length=1, max_length=128, strict=True)
    application: str = Field(min_length=1, max_length=128, strict=True)
    operation: str = Field(min_length=1, max_length=128, strict=True)
    gpu_uuid: str = Field(min_length=1, max_length=128, pattern=r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$', strict=True)
    minimum_free_vram_mb: StrictInt = Field(gt=0)


class HeartbeatGpuLease(StrictModel):
    owner_id: str = Field(min_length=1, max_length=128, strict=True)


class ProviderReleaseReceipt(StrictModel):
    provider: str = Field(min_length=1, max_length=128, strict=True)
    workload_id: str = Field(min_length=1, max_length=256, strict=True)
    status: Literal['idle_confirmed']
    verified_at: datetime

    @field_validator('verified_at')
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError('verified_at must include a timezone')
        return value.astimezone(UTC)


class ReleaseGpuLease(StrictModel):
    owner_id: str = Field(min_length=1, max_length=128, strict=True)
    provider_release_receipt: ProviderReleaseReceipt


def _canonical_gpu_uuid(value: str) -> str:
    if not _IDENTIFIER.fullmatch(value):
        raise HubError('INVALID_GPU_UUID', 'GPU UUID has an unsupported format', 422)
    return value.upper()


def _iso_time(value: float) -> str:
    return datetime.fromtimestamp(value, tz=UTC).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def parse_nvidia_smi_csv(output: str) -> tuple[GpuTelemetry, ...]:
    """Parse the fixed nvidia-smi query; every malformed row invalidates the sample."""
    devices: list[GpuTelemetry] = []
    seen: set[str] = set()
    try:
        rows = csv.reader(io.StringIO(output), skipinitialspace=True)
        for row in rows:
            if not row or all(not cell.strip() for cell in row):
                continue
            if len(row) != 4:
                raise ValueError('wrong field count')
            gpu_uuid, name, free_text, total_text = (cell.strip() for cell in row)
            canonical = _canonical_gpu_uuid(gpu_uuid)
            if canonical in seen or not name:
                raise ValueError('duplicate UUID or empty name')
            if not _MEMORY_VALUE.fullmatch(free_text) or not _MEMORY_VALUE.fullmatch(total_text):
                raise ValueError('invalid memory value')
            free, total = int(free_text), int(total_text)
            if total <= 0 or free > total:
                raise ValueError('inconsistent memory values')
            seen.add(canonical)
            devices.append(GpuTelemetry(gpu_uuid, name, free, total))
    except (csv.Error, ValueError, OverflowError) as error:
        raise RuntimeError('GPU telemetry output was malformed') from error
    if not devices:
        raise RuntimeError('GPU telemetry returned no devices')
    return tuple(devices)


async def read_nvidia_smi_telemetry(timeout_seconds: float = 2.0) -> tuple[GpuTelemetry, ...]:
    """Read NVIDIA memory telemetry without starting or changing any GPU workload."""
    executable = shutil.which('nvidia-smi')
    if executable is None:
        raise RuntimeError('nvidia-smi was not found')
    creation_flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000) if os.name == 'nt' else 0
    process = await asyncio.create_subprocess_exec(
        executable,
        '--query-gpu=uuid,name,memory.free,memory.total',
        '--format=csv,noheader,nounits',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        creationflags=creation_flags,
    )
    try:
        stdout, _stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except asyncio.CancelledError:
        if process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
        try:
            await asyncio.shield(process.communicate())
        except (ProcessLookupError, RuntimeError):
            pass
        raise
    except TimeoutError as error:
        # Only the Hub's short-lived telemetry command is stopped; provider processes are never touched.
        if process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
        await asyncio.shield(process.communicate())
        raise RuntimeError('nvidia-smi telemetry timed out') from error
    if process.returncode != 0:
        raise RuntimeError('nvidia-smi telemetry command failed')
    return parse_nvidia_smi_csv(stdout.decode('utf-8', errors='strict'))


class GpuLeaseManager:
    """Serialize lease changes and persist all ownership transitions in SQLite."""

    def __init__(
        self,
        database_path: Path,
        telemetry_reader: GpuTelemetryReader | None = None,
        heartbeat_timeout_seconds: float = 30,
        clock: Callable[[], float] = time.time,
    ) -> None:
        if heartbeat_timeout_seconds <= 0:
            raise ValueError('heartbeat timeout must be positive')
        self.database_path = database_path
        self.telemetry_reader = telemetry_reader or read_nvidia_smi_telemetry
        self.heartbeat_timeout_seconds = heartbeat_timeout_seconds
        self.clock = clock
        self._started = False
        self._start_lock = asyncio.Lock()
        self._operation_lock = asyncio.Lock()

    def _connect(self) -> sqlite3.Connection:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute('PRAGMA busy_timeout=5000')
        return connection

    def _initialize_and_orphan(self, now: float) -> None:
        connection = self._connect()
        try:
            version = connection.execute('PRAGMA user_version').fetchone()[0]
            if version not in (0, _SCHEMA_VERSION):
                raise sqlite3.DatabaseError('unsupported GPU lease schema')
            connection.execute('''CREATE TABLE IF NOT EXISTS gpu_leases (
                gpu_uuid TEXT PRIMARY KEY,
                lease_id TEXT NOT NULL UNIQUE,
                owner_id TEXT NOT NULL,
                application TEXT NOT NULL,
                operation TEXT NOT NULL,
                minimum_free_vram_mb INTEGER NOT NULL,
                state TEXT NOT NULL CHECK (state IN ('active', 'orphaned')),
                acquired_at REAL NOT NULL,
                heartbeat_at REAL NOT NULL,
                heartbeat_deadline REAL NOT NULL,
                orphaned_at REAL,
                orphan_reason TEXT
            )''')
            connection.execute('''CREATE TABLE IF NOT EXISTS gpu_lease_releases (
                lease_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                gpu_uuid TEXT NOT NULL,
                released_at REAL NOT NULL,
                provider TEXT NOT NULL,
                workload_id TEXT NOT NULL,
                receipt_verified_at TEXT NOT NULL
            )''')
            connection.execute('PRAGMA user_version=1')
            connection.execute('BEGIN IMMEDIATE')
            connection.execute('''UPDATE gpu_leases SET state='orphaned', orphaned_at=?,
                orphan_reason='server_restart' WHERE state='active' ''', (now,))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    async def start(self) -> None:
        if self._started:
            return
        async with self._start_lock:
            if self._started:
                return
            try:
                await asyncio.to_thread(self._initialize_and_orphan, self.clock())
            except (OSError, sqlite3.Error) as error:
                raise HubError('GPU_LEASE_STORE_UNAVAILABLE', 'GPU lease state is unavailable', 503) from error
            self._started = True

    async def _telemetry(self) -> tuple[GpuTelemetry, ...]:
        try:
            sample = tuple(await self.telemetry_reader())
            if not sample:
                raise RuntimeError('empty telemetry sample')
            seen: set[str] = set()
            for device in sample:
                canonical = _canonical_gpu_uuid(device.gpu_uuid)
                if (canonical in seen or not device.name or device.free_vram_mb < 0 or
                        device.total_vram_mb <= 0 or device.free_vram_mb > device.total_vram_mb):
                    raise RuntimeError('invalid telemetry sample')
                seen.add(canonical)
            return sample
        except Exception as error:
            raise HubError('GPU_TELEMETRY_UNAVAILABLE', 'GPU telemetry is unavailable; no lease can be granted', 503) from error

    async def _store_call(self, function: Callable[..., T], *args: object) -> T:
        try:
            return await asyncio.to_thread(function, *args)
        except (OSError, sqlite3.Error) as error:
            raise HubError('GPU_LEASE_STORE_UNAVAILABLE', 'GPU lease state is unavailable', 503) from error

    def _expire_due(self, now: float) -> int:
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            cursor = connection.execute('''UPDATE gpu_leases SET state='orphaned', orphaned_at=?,
                orphan_reason='heartbeat_timeout' WHERE state='active' AND heartbeat_deadline<=?''', (now, now))
            connection.commit()
            return cursor.rowcount
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    async def expire_due_leases(self) -> int:
        """Persist timeout orphaning; safe to call periodically and from CPU-only tests."""
        await self.start()
        return await self._store_call(self._expire_due, self.clock())

    def _acquire(self, body: AcquireGpuLease, device: GpuTelemetry, now: float) -> dict[str, object]:
        canonical = _canonical_gpu_uuid(body.gpu_uuid)
        deadline = now + self.heartbeat_timeout_seconds
        lease_id = uuid4().hex
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT * FROM gpu_leases WHERE gpu_uuid=?', (canonical,)).fetchone()
            if row is not None:
                if row['state'] == 'active' and row['heartbeat_deadline'] <= now:
                    connection.execute('''UPDATE gpu_leases SET state='orphaned', orphaned_at=?,
                        orphan_reason='heartbeat_timeout' WHERE gpu_uuid=?''', (now, canonical))
                    connection.commit()
                    raise HubError('GPU_LEASE_ORPHANED', 'The prior lease timed out and requires explicit cleanup', 409)
                if row['state'] == 'orphaned':
                    connection.commit()
                    raise HubError('GPU_LEASE_ORPHANED', 'An orphaned lease requires explicit cleanup', 409)
                connection.commit()
                raise HubError('GPU_ALREADY_LEASED', 'GPU already has an active lease', 409)
            if device.free_vram_mb < body.minimum_free_vram_mb:
                connection.commit()
                raise HubError('GPU_VRAM_INSUFFICIENT', 'Fresh free VRAM is below the requested minimum', 409,
                    details={'minimum_free_vram_mb': body.minimum_free_vram_mb,
                             'observed_free_vram_mb': device.free_vram_mb})
            connection.execute('''INSERT INTO gpu_leases (
                gpu_uuid,lease_id,owner_id,application,operation,minimum_free_vram_mb,state,
                acquired_at,heartbeat_at,heartbeat_deadline,orphaned_at,orphan_reason
            ) VALUES (?,?,?,?,?,?,'active',?,?,?,NULL,NULL)''',
                (canonical, lease_id, body.owner_id, body.application, body.operation,
                 body.minimum_free_vram_mb, now, now, deadline))
            connection.commit()
            return {'lease_id': lease_id, 'status': 'active', 'gpu_uuid': device.gpu_uuid,
                'free_vram_mb': device.free_vram_mb, 'total_vram_mb': device.total_vram_mb,
                'acquired_at': _iso_time(now), 'heartbeat_deadline': _iso_time(deadline),
                'heartbeat_timeout_seconds': self.heartbeat_timeout_seconds}
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    async def acquire(self, body: AcquireGpuLease) -> dict[str, object]:
        await self.start()
        async with self._operation_lock:
            sample = await self._telemetry()
            canonical = _canonical_gpu_uuid(body.gpu_uuid)
            device = next((item for item in sample if _canonical_gpu_uuid(item.gpu_uuid) == canonical), None)
            if device is None:
                raise HubError('GPU_DEVICE_NOT_FOUND', 'GPU UUID is not present in the fresh telemetry sample', 404)
            return await self._store_call(self._acquire, body, device, self.clock())

    def _heartbeat(self, lease_id: str, body: HeartbeatGpuLease, now: float) -> dict[str, object]:
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT * FROM gpu_leases WHERE lease_id=?', (lease_id,)).fetchone()
            if row is None:
                released = connection.execute('SELECT owner_id FROM gpu_lease_releases WHERE lease_id=?',
                                              (lease_id,)).fetchone()
                connection.commit()
                if released is not None:
                    raise HubError('GPU_LEASE_ALREADY_RELEASED', 'Released leases cannot be renewed', 409)
                raise HubError('GPU_LEASE_NOT_FOUND', 'GPU lease was not found', 404)
            if row['owner_id'] != body.owner_id:
                connection.commit()
                raise HubError('GPU_LEASE_OWNER_MISMATCH', 'GPU lease belongs to another owner', 403)
            if row['state'] == 'orphaned':
                connection.commit()
                raise HubError('GPU_LEASE_ORPHANED', 'An orphaned lease cannot be renewed', 409)
            if row['heartbeat_deadline'] <= now:
                connection.execute('''UPDATE gpu_leases SET state='orphaned', orphaned_at=?,
                    orphan_reason='heartbeat_timeout' WHERE lease_id=?''', (now, lease_id))
                connection.commit()
                raise HubError('GPU_LEASE_ORPHANED', 'The lease timed out and requires explicit cleanup', 409)
            deadline = now + self.heartbeat_timeout_seconds
            connection.execute('UPDATE gpu_leases SET heartbeat_at=?,heartbeat_deadline=? WHERE lease_id=?',
                               (now, deadline, lease_id))
            connection.commit()
            return {'lease_id': lease_id, 'status': 'active', 'gpu_uuid': row['gpu_uuid'],
                'heartbeat_deadline': _iso_time(deadline),
                'heartbeat_timeout_seconds': self.heartbeat_timeout_seconds}
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    async def heartbeat(self, lease_id: str, body: HeartbeatGpuLease) -> dict[str, object]:
        await self.start()
        if not _IDENTIFIER.fullmatch(lease_id):
            raise HubError('GPU_LEASE_NOT_FOUND', 'GPU lease was not found', 404)
        async with self._operation_lock:
            return await self._store_call(self._heartbeat, lease_id, body, self.clock())

    def _release(self, lease_id: str, body: ReleaseGpuLease, now: float) -> dict[str, object]:
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT * FROM gpu_leases WHERE lease_id=?', (lease_id,)).fetchone()
            if row is None:
                released = connection.execute('SELECT * FROM gpu_lease_releases WHERE lease_id=?',
                                              (lease_id,)).fetchone()
                connection.commit()
                if released is not None and released['owner_id'] != body.owner_id:
                    raise HubError('GPU_LEASE_OWNER_MISMATCH', 'GPU lease belongs to another owner', 403)
                if released is not None:
                    return {'lease_id': lease_id, 'status': 'released', 'idempotent': True,
                        'released_at': _iso_time(released['released_at']),
                        'provider_release_receipt': {
                            'provider': released['provider'],
                            'workload_id': released['workload_id'],
                            'status': 'idle_confirmed',
                            'verified_at': released['receipt_verified_at'],
                        }}
                raise HubError('GPU_LEASE_NOT_FOUND', 'GPU lease was not found', 404)
            if row['owner_id'] != body.owner_id:
                connection.commit()
                raise HubError('GPU_LEASE_OWNER_MISMATCH', 'GPU lease belongs to another owner', 403)
            receipt = body.provider_release_receipt
            if receipt.verified_at.timestamp() < row['acquired_at']:
                connection.commit()
                raise HubError('GPU_RELEASE_RECEIPT_STALE', 'Provider receipt predates this lease', 409)
            if receipt.verified_at.timestamp() > now + 60:
                connection.commit()
                raise HubError('GPU_RELEASE_RECEIPT_INVALID', 'Provider receipt timestamp is in the future', 422)
            verified_at = receipt.verified_at.isoformat(timespec='milliseconds').replace('+00:00', 'Z')
            connection.execute('''INSERT INTO gpu_lease_releases
                (lease_id,owner_id,gpu_uuid,released_at,provider,workload_id,receipt_verified_at)
                VALUES (?,?,?,?,?,?,?)''',
                (lease_id, body.owner_id, row['gpu_uuid'], now, receipt.provider, receipt.workload_id, verified_at))
            connection.execute('DELETE FROM gpu_leases WHERE lease_id=?', (lease_id,))
            connection.commit()
            return {'lease_id': lease_id, 'status': 'released', 'idempotent': False,
                'released_at': _iso_time(now),
                'provider_release_receipt': receipt.model_dump(mode='json')}
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    async def release(self, lease_id: str, body: ReleaseGpuLease) -> dict[str, object]:
        await self.start()
        if not _IDENTIFIER.fullmatch(lease_id):
            raise HubError('GPU_LEASE_NOT_FOUND', 'GPU lease was not found', 404)
        async with self._operation_lock:
            return await self._store_call(self._release, lease_id, body, self.clock())

    def _status(self, sample: tuple[GpuTelemetry, ...] | None, now: float,
                requested_uuid: str | None) -> dict[str, object]:
        connection = self._connect()
        try:
            connection.execute('BEGIN IMMEDIATE')
            connection.execute('''UPDATE gpu_leases SET state='orphaned', orphaned_at=?,
                orphan_reason='heartbeat_timeout' WHERE state='active' AND heartbeat_deadline<=?''', (now, now))
            rows = {row['gpu_uuid']: dict(row) for row in connection.execute('SELECT * FROM gpu_leases')}
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

        snapshot = {_canonical_gpu_uuid(device.gpu_uuid): device for device in sample or ()}
        keys = set(snapshot) | set(rows)
        if requested_uuid is not None:
            canonical_requested = _canonical_gpu_uuid(requested_uuid)
            keys &= {canonical_requested}
        devices: list[dict[str, object]] = []
        for key in sorted(keys):
            telemetry = snapshot.get(key)
            lease = rows.get(key)
            if telemetry is None:
                state = 'orphaned' if lease and lease['state'] == 'orphaned' else 'unknown'
            else:
                state = lease['state'] if lease is not None else 'free'
            devices.append({
                'gpu_uuid': telemetry.gpu_uuid if telemetry else key,
                'name': telemetry.name if telemetry else None,
                'state': state,
                'lease_state': lease['state'] if lease else None,
                'lease_id': lease['lease_id'] if lease else None,
                'owner_id': lease['owner_id'] if lease else None,
                'application': lease['application'] if lease else None,
                'operation': lease['operation'] if lease else None,
                'minimum_free_vram_mb': lease['minimum_free_vram_mb'] if lease else None,
                'free_vram_mb': telemetry.free_vram_mb if telemetry else None,
                'total_vram_mb': telemetry.total_vram_mb if telemetry else None,
                'heartbeat_deadline': _iso_time(lease['heartbeat_deadline']) if lease else None,
                'orphan_reason': lease['orphan_reason'] if lease else None,
            })
        return {'telemetry_available': sample is not None,
            'observed_at': _iso_time(now) if sample is not None else None,
            'heartbeat_timeout_seconds': self.heartbeat_timeout_seconds,
            'devices': devices}

    async def status(self, gpu_uuid: str | None = None) -> dict[str, object]:
        await self.start()
        requested_uuid = _canonical_gpu_uuid(gpu_uuid) if gpu_uuid is not None else None
        async with self._operation_lock:
            try:
                sample = await self._telemetry()
            except HubError:
                sample = None
            return await self._store_call(self._status, sample, self.clock(), requested_uuid)
