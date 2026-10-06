---
id: FR-018
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.3.0
priority: P0
features: [CROSS-FEAT-002]
---

# Configuration and model registry

Deliver the corresponding approved [target contracts](../architecture/TARGET-ARCHITECTURE.md) with acceptance criteria H01 H02 H09 in the [acceptance plan](../architecture/IMPLEMENTATION-PLAN.md). No full OpenAI parity, public multi-tenancy, arbitrary sandbox claim or hidden cloud fallback.

## Interface lock

load_config(directory: Path, environ: Mapping[str,str] | None) -> HubConfig; ModelRegistry.register(model: ModelDefinition) -> None; resolve(name: str) -> ModelDefinition

Component scope: runtime/local_llm_hub/config.py; runtime/local_llm_hub/models.py; runtime/local_llm_hub/registry.py; runtime/local_llm_hub/errors.py; pyproject.toml; uv.lock; config/*.yaml; .env.example; .gitignore. Tests live in runtime/tests/test_configuration_registry.py and focused integration fixtures.

## Verification

Map the listed H criteria to executed deterministic tests, including failure paths. Record actual results in the verification report; source presence is not acceptance.

## Version diff

New requirement derived from the approved 0.2.0 architecture.

## Zuri P1 approved extension — 2026-10-06

0.2.0 -> 0.3.0: [CR-HUB-001](../plans/CR-HUB-001-zuri-agent-backend.md) and [SPEC-HUB-ZURI-001](../plans/SPEC-HUB-ZURI-001-agent-backend.md) extend the native client contract only. P1 permits typed inference controls, strict output boundary, opt-in request-bound evidence and capability discovery with offline tests. Existing signatures/permissions/chat subset remain; P2 live integration and P3 sidecar are deferred. The extension passed its [P1 offline checkpoint](../plans/HUB-ZURI-P1-VERIFICATION.md); this does not qualify live Zuri integration or sidecar packaging.
