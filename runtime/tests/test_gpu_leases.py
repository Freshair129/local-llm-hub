import asyncio
import threading
from datetime import UTC, datetime

import httpx
import pytest
from local_llm_hub.api import create_app
from local_llm_hub.errors import HubError
from local_llm_hub.gpu_leases import (
    AcquireGpuLease,
    GpuLeaseManager,
    GpuTelemetry,
    parse_nvidia_smi_csv,
    read_nvidia_smi_telemetry,
)
from pydantic import ValidationError

GPU_UUID = 'GPU-test-0'


class FakeTelemetry:
    def __init__(self, devices: tuple[GpuTelemetry, ...] | None = None) -> None:
        self.devices = devices or (GpuTelemetry(GPU_UUID, 'Mock GPU', 7000, 8192),)

    async def __call__(self) -> tuple[GpuTelemetry, ...]:
        return self.devices


def acquire_payload(owner_id: str = 'fluxnode', minimum_free_vram_mb: int = 6000) -> dict[str, object]:
    return {'owner_id': owner_id, 'application': 'FluxNode', 'operation': 'generate',
            'gpu_uuid': GPU_UUID, 'minimum_free_vram_mb': minimum_free_vram_mb}


def release_payload(owner_id: str, now: float) -> dict[str, object]:
    return {'owner_id': owner_id, 'provider_release_receipt': {
        'provider': 'comfy', 'workload_id': 'workflow-123', 'status': 'idle_confirmed',
        'verified_at': datetime.fromtimestamp(now, tz=UTC).isoformat(),
    }}


def test_nvidia_smi_parser_accepts_realistic_csv_and_fails_closed() -> None:
    devices = parse_nvidia_smi_csv('GPU-test-0, Mock GPU, 7000, 8192\n')
    assert devices == (GpuTelemetry(GPU_UUID, 'Mock GPU', 7000, 8192),)
    for invalid in ('', 'GPU-test-0, Mock GPU, N/A, 8192',
                    'GPU-test-0, Mock GPU, 9000, 8192',
                    'GPU-test-0, Mock GPU, 1000'):
        with pytest.raises(RuntimeError):
            parse_nvidia_smi_csv(invalid)


async def test_canceled_telemetry_read_stops_only_its_mock_child(monkeypatch) -> None:
    class MockProcess:
        def __init__(self) -> None:
            self.returncode = None
            self.killed = False
            self.calls = 0
            self.communicate_started = asyncio.Event()

        async def communicate(self) -> tuple[bytes, bytes]:
            self.calls += 1
            if self.calls == 1:
                self.communicate_started.set()
                await asyncio.Future()
            return b'', b''

        def kill(self) -> None:
            self.killed = True
            self.returncode = -9

    process = MockProcess()
    monkeypatch.setattr('local_llm_hub.gpu_leases.shutil.which', lambda _: 'mock-nvidia-smi')

    async def create_mock_process(*_args, **_kwargs) -> MockProcess:
        return process

    monkeypatch.setattr('local_llm_hub.gpu_leases.asyncio.create_subprocess_exec', create_mock_process)
    read = asyncio.create_task(read_nvidia_smi_telemetry())
    await process.communicate_started.wait()
    read.cancel()
    with pytest.raises(asyncio.CancelledError):
        await read
    assert process.killed is True


def test_acquire_request_requires_positive_strict_threshold() -> None:
    with pytest.raises(ValidationError):
        AcquireGpuLease.model_validate({**acquire_payload(), 'minimum_free_vram_mb': 0})
    with pytest.raises(ValidationError):
        AcquireGpuLease.model_validate({**acquire_payload(), 'minimum_free_vram_mb': '6000'})


async def test_gpu_lease_api_auth_threshold_heartbeat_and_receipted_release(config) -> None:
    now = [1_800_000_000.0]
    app = create_app(config, gpu_telemetry_reader=FakeTelemetry(), gpu_lease_clock=lambda: now[0])
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            assert (await client.get('/v1/gpu/leases/status')).status_code == 401
            assert (await client.post('/v1/gpu/leases/acquire', json=acquire_payload())).status_code == 401
            client.headers.update(headers)
            low = await client.post('/v1/gpu/leases/acquire', json=acquire_payload(minimum_free_vram_mb=8000))
            assert low.status_code == 409
            assert low.json()['error']['code'] == 'GPU_VRAM_INSUFFICIENT'

            acquired = await client.post('/v1/gpu/leases/acquire', json=acquire_payload())
            assert acquired.status_code == 201
            lease_id = acquired.json()['lease_id']
            assert acquired.json()['status'] == 'active'
            assert acquired.json()['free_vram_mb'] == 7000
            status = await client.get('/v1/gpu/leases/status')
            device = status.json()['devices'][0]
            assert status.json()['telemetry_available'] is True
            assert device['state'] == device['lease_state'] == 'active'
            assert device['lease_id'] == lease_id
            assert device['owner_id'] == 'fluxnode'

            foreign = await client.post(f'/v1/gpu/leases/{lease_id}/heartbeat', json={'owner_id': 'comfy'})
            assert foreign.status_code == 403
            heartbeat = await client.post(f'/v1/gpu/leases/{lease_id}/heartbeat', json={'owner_id': 'fluxnode'})
            assert heartbeat.status_code == 200
            assert heartbeat.json()['status'] == 'active'

            missing_receipt = await client.post(f'/v1/gpu/leases/{lease_id}/release', json={'owner_id': 'fluxnode'})
            assert missing_receipt.status_code == 422
            foreign_release = await client.post(f'/v1/gpu/leases/{lease_id}/release',
                json=release_payload('comfy', now[0]))
            assert foreign_release.status_code == 403
            released = await client.post(f'/v1/gpu/leases/{lease_id}/release',
                json=release_payload('fluxnode', now[0]))
            assert released.status_code == 200
            assert released.json()['status'] == 'released'

            duplicate = await client.post(f'/v1/gpu/leases/{lease_id}/release',
                json=release_payload('fluxnode', now[0]))
            assert duplicate.status_code == 200
            assert duplicate.json()['idempotent'] is True
            foreign_duplicate = await client.post(f'/v1/gpu/leases/{lease_id}/release',
                json=release_payload('comfy', now[0]))
            assert foreign_duplicate.status_code == 403
            late_heartbeat = await client.post(f'/v1/gpu/leases/{lease_id}/heartbeat',
                json={'owner_id': 'fluxnode'})
            assert late_heartbeat.status_code == 409
            next_lease = await client.post('/v1/gpu/leases/acquire',
                json=acquire_payload(owner_id='comfy'))
            assert next_lease.status_code == 201
            stale = await client.post(f"/v1/gpu/leases/{lease_id}/release",
                json=release_payload('fluxnode', now[0]))
            assert stale.status_code == 200
            assert stale.json()['idempotent'] is True
            still_active = await client.get('/v1/gpu/leases/status')
            assert still_active.json()['devices'][0]['owner_id'] == 'comfy'
    finally:
        await app.state.hub.close()


async def test_telemetry_failure_never_grants_or_reports_free(config) -> None:
    async def unavailable() -> tuple[GpuTelemetry, ...]:
        raise RuntimeError('synthetic telemetry failure')

    app = create_app(config, gpu_telemetry_reader=unavailable)
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
                headers=headers) as client:
            acquire = await client.post('/v1/gpu/leases/acquire', json=acquire_payload())
            assert acquire.status_code == 503
            assert acquire.json()['error']['code'] == 'GPU_TELEMETRY_UNAVAILABLE'
            status = await client.get('/v1/gpu/leases/status')
            assert status.status_code == 200
            assert status.json()['telemetry_available'] is False
            assert status.json()['devices'] == []
    finally:
        await app.state.hub.close()


async def test_concurrent_acquires_serialize_to_one_winner(config) -> None:
    app = create_app(config, gpu_telemetry_reader=FakeTelemetry())
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
                headers=headers) as client:
            first, second = await asyncio.gather(
                client.post('/v1/gpu/leases/acquire', json=acquire_payload('fluxnode')),
                client.post('/v1/gpu/leases/acquire', json=acquire_payload('comfy')),
            )
            assert sorted([first.status_code, second.status_code]) == [201, 409]
    finally:
        await app.state.hub.close()


async def test_status_and_leases_are_scoped_by_exact_gpu_uuid(config) -> None:
    telemetry = FakeTelemetry((
        GpuTelemetry('GPU-test-0', 'Mock GPU 0', 7000, 8192),
        GpuTelemetry('GPU-test-1', 'Mock GPU 1', 9000, 12288),
    ))
    app = create_app(config, gpu_telemetry_reader=telemetry)
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
                headers=headers) as client:
            payload = {**acquire_payload(), 'gpu_uuid': 'GPU-test-1', 'minimum_free_vram_mb': 8500}
            acquired = await client.post('/v1/gpu/leases/acquire', json=payload)
            assert acquired.status_code == 201
            status = await client.get('/v1/gpu/leases/status')
            devices = {device['gpu_uuid']: device for device in status.json()['devices']}
            assert devices['GPU-test-0']['state'] == 'free'
            assert devices['GPU-test-1']['state'] == 'active'
            filtered = await client.get('/v1/gpu/leases/status', params={'gpu_uuid': 'GPU-test-1'})
            assert [device['gpu_uuid'] for device in filtered.json()['devices']] == ['GPU-test-1']
    finally:
        await app.state.hub.close()


async def test_timeout_and_server_restart_persist_orphan_without_auto_release(config) -> None:
    now = [1_800_000_000.0]
    app = create_app(config, gpu_telemetry_reader=FakeTelemetry(), gpu_lease_clock=lambda: now[0])
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
            headers=headers) as client:
        acquired = await client.post('/v1/gpu/leases/acquire', json=acquire_payload())
        lease_id = acquired.json()['lease_id']
        now[0] += config.runtime.gpu_lease_heartbeat_timeout_seconds + 1
        status = await client.get('/v1/gpu/leases/status')
        assert status.json()['devices'][0]['state'] == 'orphaned'
        assert status.json()['devices'][0]['orphan_reason'] == 'heartbeat_timeout'
        heartbeat = await client.post(f'/v1/gpu/leases/{lease_id}/heartbeat', json={'owner_id': 'fluxnode'})
        assert heartbeat.status_code == 409
        blocked = await client.post('/v1/gpu/leases/acquire', json=acquire_payload('comfy'))
        assert blocked.status_code == 409
    await app.state.hub.close()

    restarted = create_app(config, gpu_telemetry_reader=FakeTelemetry(), gpu_lease_clock=lambda: now[0])
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url='http://test',
                headers=headers) as client:
            status = await client.get('/v1/gpu/leases/status')
            device = status.json()['devices'][0]
            assert device['state'] == 'orphaned'
            assert device['orphan_reason'] == 'heartbeat_timeout'
            blocked = await client.post('/v1/gpu/leases/acquire', json=acquire_payload('lalin'))
            assert blocked.status_code == 409
    finally:
        await restarted.state.hub.close()


async def test_orphan_requires_fresh_idle_receipt_before_reacquire(config) -> None:
    now = [1_800_000_000.0]
    app = create_app(config, gpu_telemetry_reader=FakeTelemetry(), gpu_lease_clock=lambda: now[0])
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
                headers=headers) as client:
            acquired = await client.post('/v1/gpu/leases/acquire', json=acquire_payload())
            lease_id = acquired.json()['lease_id']
            acquired_at = now[0]
            now[0] += config.runtime.gpu_lease_heartbeat_timeout_seconds + 1
            await client.get('/v1/gpu/leases/status')
            stale = await client.post(f'/v1/gpu/leases/{lease_id}/release',
                json=release_payload('fluxnode', acquired_at - 1))
            assert stale.status_code == 409
            assert (await client.get('/v1/gpu/leases/status')).json()['devices'][0]['state'] == 'orphaned'
            released = await client.post(f'/v1/gpu/leases/{lease_id}/release',
                json=release_payload('fluxnode', now[0]))
            assert released.status_code == 200
            assert (await client.post('/v1/gpu/leases/acquire',
                json=acquire_payload('comfy'))).status_code == 201
    finally:
        await app.state.hub.close()


async def test_restart_orphans_otherwise_live_persisted_lease(config) -> None:
    now = [1_800_000_000.0]
    first_app = create_app(config, gpu_telemetry_reader=FakeTelemetry(), gpu_lease_clock=lambda: now[0])
    headers = {'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=first_app), base_url='http://test',
                headers=headers) as client:
            acquired = await client.post('/v1/gpu/leases/acquire', json=acquire_payload())
            assert acquired.status_code == 201
    finally:
        await first_app.state.hub.close()

    restarted = create_app(config, gpu_telemetry_reader=FakeTelemetry(), gpu_lease_clock=lambda: now[0])
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url='http://test',
                headers=headers) as client:
            status = await client.get('/v1/gpu/leases/status')
            device = status.json()['devices'][0]
            assert device['state'] == 'orphaned'
            assert device['orphan_reason'] == 'server_restart'
    finally:
        await restarted.state.hub.close()


async def test_canceled_acquire_keeps_committed_state_until_timeout_orphaning(tmp_path) -> None:
    now = [1_800_000_000.0]
    reader = FakeTelemetry()
    manager = GpuLeaseManager(tmp_path / 'leases.sqlite3', reader, heartbeat_timeout_seconds=5,
                              clock=lambda: now[0])
    original_acquire = manager._acquire
    entered_worker = threading.Event()
    allow_store = threading.Event()
    finished_worker = threading.Event()

    def delayed_acquire(body: AcquireGpuLease, device: GpuTelemetry, at: float) -> dict[str, object]:
        entered_worker.set()
        allow_store.wait(timeout=5)
        try:
            return original_acquire(body, device, at)
        finally:
            finished_worker.set()

    manager._acquire = delayed_acquire
    request = asyncio.create_task(manager.acquire(AcquireGpuLease.model_validate(acquire_payload())))
    try:
        assert await asyncio.to_thread(entered_worker.wait, 3)
        request.cancel()
        with pytest.raises(asyncio.CancelledError):
            await request
    finally:
        allow_store.set()
    assert await asyncio.to_thread(finished_worker.wait, 3)

    state = await manager.status()
    assert state['devices'][0]['state'] == 'active'
    now[0] += 6
    state = await manager.status()
    assert state['devices'][0]['state'] == 'orphaned'
    with pytest.raises(HubError, match='GPU_LEASE_ORPHANED'):
        await manager.acquire(AcquireGpuLease.model_validate(acquire_payload('comfy')))
