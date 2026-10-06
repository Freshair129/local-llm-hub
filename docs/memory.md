---
id: HUB-MEMORY-GUIDE
version: 0.1.0
status: active
superseded_by: null
---

# Scoped memory

`MemoryStore` defines store/retrieve/search/update/delete/close. SQLite implements it with parameterized statements, a process lock, transactions and a schema version guard. Keys are unique within `(scope, project, owner)`. Store rejects duplicates; update/retrieve reject missing records. Search is bounded literal substring matching, including literal `%` and `_`, rather than SQL wildcard or vector search.

Tool namespaces derive from the execution identity, never caller-supplied project/owner IDs. Session owner is the session ID and entries expire after configured TTL; agent owner is its agent ID within the project; project memory is intentionally shared among authorized agents in that project. Values are limited to 64 KiB. Project/agent memory persists across service restart. Session expiry cleanup is lazy during subsequent database operations; no permanent conversation history is stored automatically.

State defaults to `.hub/memory.sqlite3`, outside the demo workspace and protected from filesystem tools. Back up with the service stopped or SQLite's backup mechanism. Preserve the file on runtime rollback. Future Postgres, Redis, vector, GenesisBlockDB and filesystem implementations can satisfy the protocol; none are bundled or represented as implemented.

Version diff: new local persistence independent of provider transport and temporary context.
