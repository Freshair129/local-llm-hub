# trace:implements FR-022
import asyncio
import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Protocol

from .errors import HubError
from .models import StrictModel


@dataclass(frozen=True)
class Namespace:
    scope: Literal['session', 'project', 'agent']
    project: str
    owner: str
    expires_at: float | None = None

    def key(self) -> tuple[str, str, str]:
        return self.scope, self.project, self.owner


class MemoryRecord(StrictModel):
    key: str
    value: str
    updated_at: float


class MemoryStore(Protocol):
    async def store(self, namespace: Namespace, key: str, value: str) -> MemoryRecord: ...
    async def retrieve(self, namespace: Namespace, key: str) -> MemoryRecord: ...
    async def search(self, namespace: Namespace, query: str, limit: int = 20) -> list[MemoryRecord]: ...
    async def update(self, namespace: Namespace, key: str, value: str) -> MemoryRecord: ...
    async def delete(self, namespace: Namespace, key: str) -> bool: ...
    async def close(self) -> None: ...


class SQLiteMemory:
    def __init__(self, filename: Path) -> None:
        filename.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(filename, check_same_thread=False, timeout=5)
        self.lock = threading.Lock()
        version = self.connection.execute('PRAGMA user_version').fetchone()[0]
        if version not in (0, 1):
            self.connection.close()
            raise HubError('CONFIG_INVALID', 'Unsupported memory schema version')
        self.connection.execute('''CREATE TABLE IF NOT EXISTS memory (
            scope TEXT NOT NULL, project TEXT NOT NULL, owner TEXT NOT NULL,
            key TEXT NOT NULL, value TEXT NOT NULL, updated_at REAL NOT NULL, expires_at REAL,
            PRIMARY KEY (scope, project, owner, key))''')
        self.connection.execute('PRAGMA user_version=1')
        self.connection.commit()

    def _query(self, sql: str, args: tuple[Any, ...]) -> tuple[list[tuple[Any, ...]], int]:
        with self.lock, self.connection:
            self.connection.execute('DELETE FROM memory WHERE expires_at IS NOT NULL AND expires_at <= ?', (time.time(),))
            cursor = self.connection.execute(sql, args)
            return cursor.fetchall(), cursor.rowcount

    async def _write(self, namespace: Namespace, key: str, value: str, update: bool) -> MemoryRecord:
        if not key or len(key) > 200 or len(value.encode('utf-8')) > 65536:
            raise HubError('TOOL_INPUT_INVALID', 'Memory key/value exceeds bounds', 422)
        now = time.time()
        try:
            if update:
                _, count = await asyncio.to_thread(self._query,
                    'UPDATE memory SET value=?,updated_at=? WHERE scope=? AND project=? AND owner=? AND key=?',
                    (value, now, *namespace.key(), key))
                if count == 0:
                    raise HubError('MEMORY_NOT_FOUND', 'Memory record not found', 404)
            else:
                await asyncio.to_thread(self._query, 'INSERT INTO memory VALUES (?,?,?,?,?,?,?)',
                    (*namespace.key(), key, value, now, namespace.expires_at))
        except sqlite3.IntegrityError as error:
            raise HubError('MEMORY_CONFLICT', 'Memory key already exists', 409) from error
        return MemoryRecord(key=key, value=value, updated_at=now)

    async def store(self, namespace: Namespace, key: str, value: str) -> MemoryRecord:
        return await self._write(namespace, key, value, False)

    async def update(self, namespace: Namespace, key: str, value: str) -> MemoryRecord:
        return await self._write(namespace, key, value, True)

    async def retrieve(self, namespace: Namespace, key: str) -> MemoryRecord:
        rows, _ = await asyncio.to_thread(self._query,
            'SELECT key,value,updated_at FROM memory WHERE scope=? AND project=? AND owner=? AND key=?',
            (*namespace.key(), key))
        if not rows:
            raise HubError('MEMORY_NOT_FOUND', 'Memory record not found', 404)
        return MemoryRecord(key=rows[0][0], value=rows[0][1], updated_at=rows[0][2])

    async def search(self, namespace: Namespace, query: str, limit: int = 20) -> list[MemoryRecord]:
        rows, _ = await asyncio.to_thread(self._query,
            'SELECT key,value,updated_at FROM memory WHERE scope=? AND project=? AND owner=? '
            'AND (instr(value,?)>0 OR instr(key,?)>0) ORDER BY key LIMIT ?',
            (*namespace.key(), query, query, min(max(limit, 1), 100)))
        return [MemoryRecord(key=r[0], value=r[1], updated_at=r[2]) for r in rows]

    async def delete(self, namespace: Namespace, key: str) -> bool:
        _, count = await asyncio.to_thread(self._query,
            'DELETE FROM memory WHERE scope=? AND project=? AND owner=? AND key=?', (*namespace.key(), key))
        return count > 0

    async def close(self) -> None:
        def close() -> None:
            with self.lock:
                self.connection.close()
        await asyncio.to_thread(close)
