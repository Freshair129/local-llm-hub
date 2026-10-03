---
id: HUB-ADR-002
version: 0.3.0
status: active
superseded_by: null
decision_status: accepted
author: ATHER
date: 2026-10-03
risk: MEDIUM
---

# HUB-ADR-002: project-owned provider contract and compatible HTTP transport

## Context

Existing direct inference switches between native Ollama and vLLM in Rust, while scripts implement Ollama requests separately. Logical model identity, endpoint capacity and provider wire formats are currently mixed. See the [audit](../CURRENT-STATE.md).

## Proposed decision

Define project-owned `InferenceRequest`, `InferenceResponse`, `ModelDefinition`, `ProbeResult` and typed provider failures. The provider boundary implements asynchronous completion and health checks. Neither memory nor filesystem tools belong in providers.

First adapters are a deterministic mock and OpenAI-compatible chat transport. Configure vLLM, Ollama's compatible API, LM Studio, llama.cpp, SGLang, compatible cloud APIs or an existing LiteLLM proxy through explicit endpoint/model definitions. Each server must pass the same contract tests; compatibility is not inferred from its brand name. Native non-compatible cloud SDKs remain future adapters.

Keep upstream model names separate from logical IDs/aliases. Normalize the base URL exactly once and do not duplicate `/v1`. Credentials are injected from named environment variables; redaction covers configuration validation and provider failures. Mock configuration is explicitly labeled and never silently replaces a failed real model.

Provider/SDK retries are disabled when the router owns attempts, avoiding multiplied retry budgets. The [Pydantic OpenAI provider documentation](https://pydantic.dev/docs/ai/models/openai/) describes independent SDK retry behavior and custom provider/client configuration.

An internal Pydantic model adapter sends every inference step through the hub router; library-specific message and exception conversions remain in that adapter. Request cancellation reaches the HTTP client, and bounded malformed/oversized responses fail explicitly.

## Alternatives considered

- Provider-specific code in the agent runtime: rejected because adding an engine would change execution semantics.
- Mandatory LiteLLM for every request: rejected because local compatible endpoints should work without another process; existing proxy support remains optional.
- Expose Pydantic AI objects as native API/persistence contracts: rejected because it couples callers and stored data to framework releases.

## Consequences and verification

The compatibility endpoint initially supports documented text completions only. Agent-internal tool-call messages require separate provider adapter contract tests. Unknown usage stays absent; unsupported fields are errors rather than silently dropped values.

Acceptance: H01-H02, H04-H05, H08, H19, H22 and H30 in the [plan](../IMPLEMENTATION-PLAN.md). New provider-specific features must be declared and tested before registration grants a capability.

## Version diff

Historical proposal 0.1.0: Existing Rust inference and legacy LiteLLM clients remain unchanged at this checkpoint.

Approval delta 0.1.0 → 0.2.0: user approved the design on 2026-10-03; implementation is authorized within these boundaries.

Implementation delta 0.2.0 -> 0.3.0: decision implemented within the [verified checkpoint](../VERIFICATION.md). Historical statements above describe the proposal date, not current implementation status.
