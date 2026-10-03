---
id: HUB-ADR-003
version: 0.3.0
status: active
superseded_by: null
decision_status: accepted
author: ATHER
date: 2026-10-03
risk: HIGH
---

# HUB-ADR-003: capability filtering and endpoint-scoped bounded inference queues

## Context

Agents may share the same loaded model. An agent count is not a safe proxy for GPU concurrency. Existing worker registration and direct request paths do not supply an enforced shared endpoint queue.

## Proposed decision

Separate model registry, capability metadata, routing policy and scheduling. Register aliases against canonical logical model IDs, and give all models sharing capacity an explicit endpoint pool. Startup rejects inconsistent limits for that pool. Future policies use a small ranking interface; implement only deterministic least-loaded ranking plus explicit model selection and ordered fallbacks initially.

Every request first satisfies role, capabilities, context and egress constraints. Unknown capability metadata cannot satisfy a required feature. Then consider health and load. Distinguish no compatible model from compatible but unavailable models. A healthy busy endpoint queues requests; it does not automatically send them to a cloud model.

Queue and provider timeouts live inside an overall deadline. Queue length, attempts and fallback traversal are bounded. Release permits in all completion, failure and cancellation paths. Never hold an inference permit during a tool call, memory access or child delegation. Children share root execution budgets and initially run sequentially.

Retry only eligible inference transport failures. Revalidate capabilities, local/cloud permission and input budget on every fallback. Do not restart an agent run or replay tool side effects after a provider failure. Actual provider attempts update per-model and per-pool metrics.

## Alternatives considered

| Alternative | Limitation |
|---|---|
| One semaphore per agent | Several agents can overload the same GPU endpoint. |
| One semaphore per alias | Aliases bypass the intended shared limit. |
| Hold a permit for a complete agent run | A parent delegating to the same single-slot endpoint can deadlock. |
| Distributed queue, VRAM prediction and cost optimization immediately | Adds coordination without evidence it is needed for the single-process checkpoint. |

## Consequences and verification

One runtime worker/process is an explicit operational constraint. Independent hubs cannot share in-process limits. Inference timeout cancellation may not stop upstream GPU work immediately; a retry can consume additional capacity on a server that ignores cancellation.

Acceptance: H02-H08, H16-H17 and H20 in the [plan](../IMPLEMENTATION-PLAN.md), including synchronized concurrency tests rather than timing-only sleeps. The full algorithm is in the [target](../TARGET-ARCHITECTURE.md).

## Version diff

Historical proposal 0.1.0: No active model servers, loading policy or GPU settings are changed.

Approval delta 0.1.0 → 0.2.0: user approved the design on 2026-10-03; implementation is authorized within these boundaries.

Implementation delta 0.2.0 -> 0.3.0: decision implemented within the [verified checkpoint](../VERIFICATION.md). Historical statements above describe the proposal date, not current implementation status.
