---
id: HUB-CONFIGURATION-GUIDE
version: 0.2.0
status: active
superseded_by: null
---

# Configuration

Run `uv run --locked local-llm-hub init` once to create a private `.env` containing a random token, then `uv run --locked local-llm-hub check`. Init refuses to overwrite a file. If `.env` already exists, set `LOCAL_LLM_HUB_TOKEN` there or in the process environment to a random value of at least 16 characters. Process environment overrides `.env`. Never commit the token. POSIX permissions are set to owner-only; Windows operators should restrict the file's ACL.

| File | Contents |
|---|---|
| `config/models.yaml` | Named endpoint pools, model IDs/aliases/roles, capability metadata, explicit context sizes, fallbacks, retry/timeout settings |
| `config/agents.yaml` | Declarative definitions, prompts, tools, policies, projects, child allowlists and optional output schemas |
| `config/permissions.yaml` | Workspace roots, modes, grants, exact command argv and HTTP origins |
| `config/runtime.yaml` | Listen/auth/state settings and execution/queue/session/output limits |

Startup rejects duplicate YAML keys, unknown fields, missing environment references, malformed definitions, credential values embedded in YAML, invalid roots, missing references, fallback cycles and unsafe policy combinations. Models/agents use mapping keys as IDs. `${VARIABLE}` expands from the environment; endpoint credentials use `api_key_env`. Capability `null` is unknown. A healthy HTTP response does not promote capabilities to true.

For real inference, copy the four files into ignored `config/private/`, replace its models file using `config/examples/models.openai.yaml`, and update workspace/state paths: relative paths resolve against that config directory, not the current shell. Set `LOCAL_MODEL_BASE_URL`, `LOCAL_MODEL_API_KEY`, `LOCAL_MODEL_NAME`, and `LOCAL_MODEL_CONTEXT_LENGTH` privately. If a local server needs no key, remove `api_key_env`. Verify the model's capabilities before setting them true. Agents with unknown required capabilities will fail closed until configured correctly.

Start with `uv run --locked local-llm-hub --config config/private serve`. Add another endpoint/model in YAML to register it at next startup. Cloud routes require both endpoint `cloud: true` and agent `allow_cloud: true`; mark external services accurately. Model-level concurrency, if provided, must match its endpoint limit. Do not start multiple workers against a shared limited endpoint and assume per-process semaphores coordinate globally.

Version diff: new centralized portable config and secret references; legacy sidecar config is independent.

## Native client contract 0.2.0 — approved Zuri P1

Optional agent configuration `inference_settings` contains strict finite numeric temperature (0..2, default 0.2), top_p (>0..1 or unset), presence_penalty (-2..2 or unset), and reasoning_effort (`none` or unset). Optional endpoint `supported_inference_settings` lists only top_p/presence_penalty/reasoning_effort with default empty. Config loading checks all configured candidates and fallbacks; routing rechecks the selected endpoint before dispatch. Unsupported settings fail rather than disappear. Agent `emit_run_evidence` is a strict boolean, false by default. These are operator settings, not native run request overrides.

Example agent fragment after endpoint support has been verified:

```yaml
inference_settings:
  temperature: 1.0
  top_p: 0.95
  presence_penalty: 1.5
  reasoning_effort: none
emit_run_evidence: true
```

Endpoint declaration is not runtime proof that the provider honored settings. P1 does not send top_k or num_ctx; model/server controls require separate evidence. No existing config file or provider default was switched by P1. [Full contract](plans/SPEC-HUB-ZURI-001-agent-backend.md).

Version diff: 0.1.0 -> 0.2.0: document approved native Zuri P1 contract; live/sidecar readiness is not implied.
