---
id: HUB-ROUTER-GUIDE
version: 0.1.0
status: active
superseded_by: null
---

# Routing and health

`ModelRegistry` rejects duplicate IDs and aliases before changing its state. Config loading resolves endpoints, agents and fallback references, rejects fallback cycles, and requires declared context length. Capabilities are tri-state: only `true` satisfies a requirement; `false` and unknown do not. A tool-bearing turn automatically requires tool calling. Structured agent output additionally requires structured output.

Explicit model IDs/aliases are tried first. `auto` starts with models matching the agent role, ranked by `(active + queued) / endpoint limit`, then configured numeric priority and ID. Explicit fallback chains are flattened without duplicate attempts. Disabled, incompatible, known unavailable or unpermitted cloud candidates are excluded. Unknown health permits a first attempt; failed endpoints are revisited by periodic health probes. No suitable model returns a normalized capability or availability error.

Concurrency belongs to endpoint IDs. Give aliases/models served by the same capacity pool the same endpoint ID; two separately named endpoints cannot infer that they share a GPU. Each endpoint has a bounded queue, deadline and semaphore. Full queue returns `MODEL_BUSY`; expired wait returns `MODEL_TIMEOUT`. Cancellation releases counters and permits. Transient transport errors, timeouts, 429 and 5xx may retry with short exponential backoff or use fallback; authorization, malformed responses and other nonretryable errors fail immediately. Failure counts represent dispatched attempts, not queue failures.

Unauthenticated `/health` is process liveness only. Authenticated `/v1/health`, `/models`, `/v1/models` and `/models/{id}/health` expose configured catalogs and observed status, last successful generation, request latency, active/queued requests and failure count. Latency includes queue/provider time for the successful attempt. `/models` probing checks endpoint reachability only; it does not verify every model is loaded or prove capabilities. A probe never becomes a successful-generation timestamp.

`RoutingPolicy` and `CapabilityProbe` are extension interfaces. Round robin, VRAM/cost scheduling, automatic capability discovery and distributed admission are deferred.

Version diff: new owned routing boundary alongside the original backend discovery.
