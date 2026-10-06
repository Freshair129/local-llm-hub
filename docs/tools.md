---
id: HUB-TOOLS-GUIDE
version: 0.1.0
status: active
superseded_by: null
---

# Structured tools and MCP

Each `ToolDefinition` has a name, input/output JSON Schemas, permission, handler and timeout. Grant checking happens independently of schema validation. Public API clients cannot invoke an arbitrary tool directly. Native definitions include filesystem read/write/list, literal grep, shell, HTTP, five memory operations and agent delegation. Dotted tool names map to double underscores on model transports; registration rejects collisions.

Filesystem reads are bounded, writes are limited to 64 KiB and atomically replace through a temporary file in an existing parent. List/grep examine at most 200 entries in the current directory; grep returns up to 50 matching lines, each capped at 500 characters, reading a bounded prefix of each regular file. It is deliberately not recursive or regular-expression search. Missing parents and protected paths fail. See [permissions](permissions.md) for trusted-root limitations.

Tool timeout defaults to ten seconds. Serialized tool results are limited to 16 KiB and carry truncation metadata when shortened. A preview is not the full tool result. Shell uses exact executable/argv grants, captures stdout/stderr/exit code, and does not invoke a shell interpreter implicitly. Its environment contains only required Windows system variables. HTTP supports GET/HEAD to exact configured origins; it checks resolved addresses, pins the selected address, preserves HTTPS SNI, refuses redirects, and bounds response reads.

`MCPAdapter` defines discovery, call and close; `register_mcp` installs namespaced definitions. It uses the same policy/schema/timeout/output checks as native tools, and discovery itself grants no authority. This checkpoint verifies a fake adapter. Shipping a network/stdio MCP transport, credential lifecycle and YAML discovery/configuration is deferred; embedding code owns adapter setup and teardown. Native tools have no MCP dependency.

Version diff: new native tool system and minimal optional MCP boundary.
