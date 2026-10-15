---
id: HUB-AGENT-GUIDE
version: 0.2.0
status: active
superseded_by: null
---

# Agents, sessions and context

`config/agents.yaml` declares role, model/alias or `auto`, project, policy, prompt, tools, capability requirements and optional object JSON Schema. Pydantic AI handles model/tool turns; JSON Schema is independently validated before structured output is accepted. Native clients cannot override definitions, policies, workspace roots or project identity.

Create a session with `POST /v1/agents/{agent_id}/sessions` (empty body). Run with `POST /v1/agents/{agent_id}/run` and `{"input":"...","session_id":"..."}`; omitting the session creates one. Replies contain request/session/agent/model IDs and output. Token usage is omitted when any model turn lacks real counts. Sessions are in memory, expire after one hour of inactivity, and allow one run at a time. Restart loses conversations; SQLite project/agent memory survives.

Root execution defaults: four active runs, at most 1,000 waiting runs/sessions, ten-second queue wait and 120-second overall deadline. A root and all children share limits of 16 logical model turns, 24 tool calls and 16 delegations. Provider retry attempts are additionally bounded by model policy and that deadline. Root depth is zero; three nested delegations are allowed. Child tools/policies/cloud egress are intersections of parent and child authority. Child context is discarded on completion; child session memory expires independently. Failed runs preserve earlier conversation history, but completed tool side effects are not transactional and are not rolled back.

The context manager keeps system instructions and the newest user turn, including its tool results. It evicts complete older turns and rejects dangling tool-call/result pairs. Its conservative UTF-8-byte estimator includes schemas, serialized content, an output reserve and 128 units of margin. It is not a model tokenizer. All configured model context sizes must be explicit. Oversized pinned context fails with `CONTEXT_LIMIT`. The `Summarizer` protocol is an extension point; automatic summarization is not implemented. Memory enters context only through an explicitly permitted retrieval tool.

Default mock directives: `echo:text`, `tool:{"name":"filesystem.read","arguments":{"path":"README.md"}}`, and `json:{"answer":42}`. They are interpreted only by the explicit mock provider. Mock results verify runtime contracts, not model quality.

Version diff: new bounded execution/session contract, replacing no existing desktop workflow.

## Shared GPU leases

The Hub exposes an advisory, serialized GPU lease for local clients that coordinate their own model providers. By default it binds to `127.0.0.1:8787`; every lease route uses the existing `Authorization: Bearer <LOCAL_LLM_HUB_TOKEN>` credential. Set that environment variable to the same random token used by the other Hub API clients. The token is shared by all local clients: `owner_id` identifies the lease claimant and prevents accidental cross-owner operations, but is not a separate per-client credential.

From the repository root, create a private token file once if `.env` does not exist:

```powershell
uv run --locked local-llm-hub init
```

Start the single-worker API:

```powershell
uv run --locked local-llm-hub serve
```

`init` will not overwrite an existing `.env`. The server reads the bearer token from that file and binds to the configured host/port. Existing installations can keep their current private token and proceed directly to `serve`.

The Hub reads fresh NVIDIA telemetry with `nvidia-smi --query-gpu=uuid,name,memory.free,memory.total --format=csv,noheader,nounits` when acquiring or checking status. It grants no lease when the command is missing, fails, times out, or returns malformed/inconsistent data. Acquisition also requires the requested GPU UUID to appear in that sample and its free VRAM to meet the caller's positive `minimum_free_vram_mb` threshold. The default heartbeat timeout is 30 seconds (`runtime.gpu_lease_heartbeat_timeout_seconds`); clients should renew more frequently, such as every 10 seconds.

Acquire with `POST /v1/gpu/leases/acquire`:

```json
{
  "owner_id": "fluxnode-worker-1",
  "application": "FluxNode",
  "operation": "generate",
  "gpu_uuid": "GPU-...",
  "minimum_free_vram_mb": 8192
}
```

A `201` response contains `lease_id`, `status: "active"`, the canonical GPU UUID, observed free/total VRAM, acquisition time, heartbeat deadline, and timeout. Persist the returned lease ID with the owning client so it can renew or explicitly release the same lease.

Check `GET /v1/gpu/leases/status` or filter with `?gpu_uuid=GPU-...`. The response contains `telemetry_available`, `observed_at`, the configured timeout, and device entries with `state`, `lease_state`, `lease_id`, owner/application/operation metadata, threshold, VRAM values, deadline, and orphan reason. Retain `lease_id` with client state; status also returns it so an owner can resolve an orphan after losing its local copy. A `free` state means the Hub has no lease recorded for that GPU; it does not mean the physical GPU is idle. The VRAM numbers can include memory used by workloads that do not participate in this Hub coordinator. When telemetry is unavailable, status returns `telemetry_available: false`; it does not label GPUs `free`, and saved lease/orphan state remains visible.

Renew with `POST /v1/gpu/leases/{lease_id}/heartbeat` and `{"owner_id":"fluxnode-worker-1"}`. Only the recorded owner can renew an active lease. A missed deadline changes the lease to `orphaned`; late heartbeats cannot revive it. The Hub persists this state in the sibling `gpu-leases.sqlite3` file next to the configured runtime state database. On server startup every previously active lease becomes an orphan, because the Hub cannot know what happened to the provider while it was down. Orphaned leases block new acquisition until their owner explicitly resolves them.

Release with `POST /v1/gpu/leases/{lease_id}/release` only after independently verifying that the provider is idle and has released the workload:

```json
{
  "owner_id": "fluxnode-worker-1",
  "provider_release_receipt": {
    "provider": "comfy",
    "workload_id": "workflow-123",
    "status": "idle_confirmed",
    "verified_at": "2026-10-15T12:00:00Z"
  }
}
```

The Hub validates the receipt shape and timestamp, but does not query or independently authenticate provider receipts. The caller is responsible for checking provider state first; if that check is unknown or cleanup is incomplete, retain the lease and let it become or remain orphaned. A successful release removes the active lease and records a tombstone. A repeated release by the same owner returns the saved successful result with `idempotent: true`; a foreign owner receives `403`, and a stale heartbeat, orphaned/occupied lease, or insufficient VRAM receives `409`. A tombstone cannot release or change a later lease. Unavailable telemetry or lease storage fails closed with `503`.

The ownership boundary is explicit: the Hub records claims, reads VRAM telemetry, checks heartbeat deadlines, and validates the caller's release assertion. It never loads or unloads models, starts/stops/terminates a provider or workload, or treats disappearance from telemetry as proof of cleanup. Only participating clients honor the advisory lease; unrelated apps can still allocate GPU memory, which is why clients must use both lease state and fresh telemetry before starting work.

## Opt-in run evidence 0.1.0

With operator-configured `emit_run_evidence: true`, native RunResult additionally contains typed evidence bound to request/session/agent IDs, exact input hash, canonical schema hash, each dispatched provider attempt, current-run successful read hashes and raw final tool-argument hash. Otherwise the field is absent from the HTTP response. Structured final output must be one unambiguous output tool; mixed final/action responses are rejected before executing their actions.

Read hashes cover the returned read text after output bounds (or the returned preview when truncated), not a later file reread. Truncated inputs remain marked. Child or earlier-session reads never satisfy parent/current-run reads. Trace is per-run and limited by existing tool/model/candidate/retry budgets. A failed/cancelled run returns the existing error, no fabricated success evidence; collectors do not carry over to the next run.

Evidence includes relative authorized paths, not host roots or file contents. No raw prompt/provider content/token is added to logs. sent_settings records the adapter settings, not independently measured effective GPU settings; mock mode is still mock. Schema-valid unchanged copy can be runtime success and must still fail the client's editing review. See [spec](plans/SPEC-HUB-ZURI-001-agent-backend.md).

Version diff: 0.1.0 -> 0.2.0: document approved native Zuri P1 contract; live/sidecar readiness is not implied.
