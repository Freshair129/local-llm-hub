---
id: FR-021
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.3.0
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

## Zuri P1 approved extension — 2026-10-06

0.2.0 -> 0.3.0: [CR-HUB-001](../plans/CR-HUB-001-zuri-agent-backend.md) and [SPEC-HUB-ZURI-001](../plans/SPEC-HUB-ZURI-001-agent-backend.md) extend the native client contract only. P1 permits typed inference controls, strict output boundary, opt-in request-bound evidence and capability discovery with offline tests. Existing signatures/permissions/chat subset remain; P2 live integration and P3 sidecar are deferred. The extension passed its [P1 offline checkpoint](../plans/HUB-ZURI-P1-VERIFICATION.md); this does not qualify live Zuri integration or sidecar packaging.
