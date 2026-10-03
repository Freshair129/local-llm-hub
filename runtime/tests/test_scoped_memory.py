# trace:verifies FR-022
import time

import pytest
from local_llm_hub.errors import HubError
from local_llm_hub.memory import Namespace, SQLiteMemory


async def test_crud_isolation_literal_search_and_reopen(tmp_path) -> None:
    filename = tmp_path / 'memory.sqlite3'
    store = SQLiteMemory(filename)
    a, b = Namespace('agent', 'p', 'a'), Namespace('agent', 'p', 'b')
    await store.store(a, 'note', 'literal % and _')
    assert (await store.retrieve(a, 'note')).value == 'literal % and _'
    with pytest.raises(HubError, match='MEMORY_NOT_FOUND'):
        await store.retrieve(b, 'note')
    assert len(await store.search(a, '%')) == 1
    assert await store.search(b, '') == []
    await store.update(a, 'note', 'changed')
    await store.close()
    store = SQLiteMemory(filename)
    assert (await store.retrieve(a, 'note')).value == 'changed'
    assert await store.delete(a, 'note')
    assert not await store.delete(a, 'note')
    await store.store(Namespace('session', 'p', 'expired', time.time() - 1), 'old', 'value')
    assert await store.search(Namespace('session', 'p', 'expired'), '') == []
    await store.close()
