---
id: FR-018
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
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
