---
id: PKT-FR-021-HUB-SERVICE
fr_id: FR-021
layer: service
version: 0.2.0
status: active
superseded_by: null
interface: LOCKED
---

# Deny-first native and MCP tools implementation packet

## 1. Statement
Implement deny-first native and mcp tools within the approved harness boundary.

## 2. Acceptance criteria
H12 H13 H14 H15 H16 H23 H24; expected outcomes are specified in [H01-H30](../architecture/IMPLEMENTATION-PLAN.md). Add focused regression tests before implementation.

## 3. Relevant SDD
[Target architecture](../architecture/TARGET-ARCHITECTURE.md) and [FR-021](../requirements/FR-021-tool-permissions.md); only the matching subsystem applies.

## 4. API and schemas
PermissionPolicy.authorize(identity: ExecutionIdentity, name: str) -> None; ToolRegistry.execute(name: str, arguments: dict[str,Any], execution: ToolContext) -> ToolResult; MCPAdapter.list_tools / call_tool / close. Typed DTOs and error codes follow the target. Establish schema definitions before service logic.

## 5. Business and security rules
Single runtime process; deny-first; bounded deadlines and output; no secret/prompt logging; no model loading implied by session creation.

## 6. Guard rails and CMP
runtime/local_llm_hub/_windows_shell.py; runtime/local_llm_hub/permissions.py; runtime/local_llm_hub/tools.py; runtime/local_llm_hub/mcp.py; related focused runtime tests; package bootstrap __init__.py; acceptance and user documentation for this unit. Preserve ADR-100, existing IPC signatures and original checkout WIP. No adjacent reformatting.

## 7. Current CMP code
New runtime modules do not exist at baseline 12e84fc. Existing Rust send_chat_message calls commands::chat::execute_chat. Existing UAT defects and exact source lines are captured in [RCA-001](../../.brain/rca/RCA-001-UAT-EVIDENCE.md).

## 8. Target integration test
TC-HUB-MOCK-001: authenticated HTTP API -> agent -> router -> deterministic provider. Also run the packet's focused failure/isolation tests. Rollback: disable the opt-in service bridge; preserve memory and legacy source.

## 9. Token ceiling and ordering
8,000 tokens per implementation unit; split internal work without changing locked contracts. Configuration schemas first; then registry/routing, memory/permission boundaries, execution driver, API. Single writer per file.

## Version diff
New bounded packet under user approval dated 2026-10-03. No closure claimed until its tests and documentation checks pass.
