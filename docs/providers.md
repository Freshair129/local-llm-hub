---
id: HUB-PROVIDER-GUIDE
version: 0.1.0
status: active
superseded_by: null
---

# Provider transport and API compatibility

The `Provider` protocol exposes `complete`, `health` and `close`. `MockProvider` runs without a GPU. `OpenAICompatibleProvider` posts nonstreaming text/tool requests to the configured base URL plus `/chat/completions`, probes `/models`, caps generation responses at 2 MB and normalizes failures without echoing upstream bodies. HTTP redirects and environment proxy inheritance are disabled. Credentials come from named environment variables.

Use an OpenAI-compatible endpoint from vLLM, Ollama, LM Studio, llama.cpp, SGLang, an external cloud service or the existing proxy. Configure each server's actual model name and verified capabilities. This is a transport implementation, not a claim that every server/model/version was tested. Cloud endpoints must declare `cloud: true`; agents also require `allow_cloud: true`. The operator owns correct endpoint classification; the router does not infer cloud status from IP addresses.

The public `/v1/chat/completions` subset accepts `model`, text-only `messages` with system/user/assistant roles, `temperature`, `max_tokens`, and `stream: false`. It returns a conventional completion envelope. Unknown fields, streaming, images, user-supplied tools, JSON response-format options and multiple choices are rejected. This raw completion route does not execute tools and does not allow cloud egress. Native configured agents provide tools, schema validation and explicitly authorized cloud use. Missing usage stays absent; TTFT and decode throughput are not invented from buffered requests.

Desktop integration is opt-in through `LOCAL_LLM_HUB_URL` and `LOCAL_LLM_HUB_TOKEN` in the Tauri process environment. The bridge accepts a loopback origin, ignores the legacy backend selector while enabled, and resolves the selected model through hub aliases. The old chat DTO still uses zero when usage is unavailable and an end-to-end token rate when supplied; those fields are not new benchmark measurements. With no URL, existing backend dispatch is unchanged. A configured but unavailable service produces an error. New IPC `run_hub_agent(agentId, input, sessionId)` exposes the native agent route without changing the old chat signature.

Version diff: new provider and opt-in bridge contract; full OpenAI parity remains deferred.
