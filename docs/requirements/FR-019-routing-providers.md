---
id: FR-019
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
priority: P0
features: [CROSS-FEAT-002]
depends_on:
  - FR-018
---

# Provider routing and endpoint scheduling

Deliver the corresponding approved [target contracts](../architecture/TARGET-ARCHITECTURE.md) with acceptance criteria H03 H04 H05 H06 H07 H08 H11 H20 in the [acceptance plan](../architecture/IMPLEMENTATION-PLAN.md). No full OpenAI parity, public multi-tenancy, arbitrary sandbox claim or hidden cloud fallback.

## Interface lock

Provider.complete(request: InferenceRequest, model: ModelDefinition) -> InferenceResponse; ModelRouter.complete(request: RouteRequest) -> RoutedResponse; EndpointScheduler.lease(endpoint_id: str, timeout: float) -> AsyncContextManager[None]

Component scope: runtime/local_llm_hub/providers.py; runtime/local_llm_hub/router.py; runtime/local_llm_hub/context.py; runtime/local_llm_hub/scheduler.py. Tests live in runtime/tests/test_routing_providers.py and focused integration fixtures.

## Verification

Map the listed H criteria to executed deterministic tests, including failure paths. Record actual results in the verification report; source presence is not acceptance.

## Version diff

New requirement derived from the approved 0.2.0 architecture.
