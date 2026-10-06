---
id: CROSS-FEAT-002
version: 0.3.0
status: active
superseded_by: null
owner: Boss
approval: user approved 2026-10-03
---

# Local LLM Agent Harness

Implement the approved [architecture](../architecture/TARGET-ARCHITECTURE.md) and [H01-H30 criteria](../architecture/IMPLEMENTATION-PLAN.md). Requirements FR-018 through FR-023 own configuration, routing, agents, tools, memory and API/evaluation respectively. Existing desktop control-plane contracts remain intact.

Version diff: new approved cross-domain feature.

## Zuri P1 approved extension — 2026-10-06

0.2.0 -> 0.3.0: [CR-HUB-001](../plans/CR-HUB-001-zuri-agent-backend.md) and [SPEC-HUB-ZURI-001](../plans/SPEC-HUB-ZURI-001-agent-backend.md) extend the native client contract only. P1 permits typed inference controls, strict output boundary, opt-in request-bound evidence and capability discovery with offline tests. Existing signatures/permissions/chat subset remain; P2 live integration and P3 sidecar are deferred. The extension passed its [P1 offline checkpoint](../plans/HUB-ZURI-P1-VERIFICATION.md); live Zuri integration and sidecar packaging remain NOT_RUN.
