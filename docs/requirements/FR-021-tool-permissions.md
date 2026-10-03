---
id: FR-021
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
priority: P0
features: [CROSS-FEAT-002]
depends_on:
  - FR-018
  - FR-022
---

# Deny-first native and MCP tools

Deliver the corresponding approved [target contracts](../architecture/TARGET-ARCHITECTURE.md) with acceptance criteria H12 H13 H14 H15 H16 H23 H24 in the [acceptance plan](../architecture/IMPLEMENTATION-PLAN.md). No full OpenAI parity, public multi-tenancy, arbitrary sandbox claim or hidden cloud fallback.

## Interface lock

PermissionPolicy.authorize(identity: ExecutionIdentity, name: str) -> None; ToolRegistry.execute(name: str, arguments: dict[str,Any], execution: ToolContext) -> ToolResult; MCPAdapter.list_tools / call_tool / close

Component scope: runtime/local_llm_hub/permissions.py; runtime/local_llm_hub/tools.py; runtime/local_llm_hub/mcp.py. Tests live in runtime/tests/test_tool_permissions.py and focused integration fixtures.

## Verification

Map the listed H criteria to executed deterministic tests, including failure paths. Record actual results in the verification report; source presence is not acceptance.

## Version diff

New requirement derived from the approved 0.2.0 architecture.
