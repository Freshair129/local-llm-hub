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

## Opt-in run evidence 0.1.0

With operator-configured `emit_run_evidence: true`, native RunResult additionally contains typed evidence bound to request/session/agent IDs, exact input hash, canonical schema hash, each dispatched provider attempt, current-run successful read hashes and raw final tool-argument hash. Otherwise the field is absent from the HTTP response. Structured final output must be one unambiguous output tool; mixed final/action responses are rejected before executing their actions.

Read hashes cover the returned read text after output bounds (or the returned preview when truncated), not a later file reread. Truncated inputs remain marked. Child or earlier-session reads never satisfy parent/current-run reads. Trace is per-run and limited by existing tool/model/candidate/retry budgets. A failed/cancelled run returns the existing error, no fabricated success evidence; collectors do not carry over to the next run.

Evidence includes relative authorized paths, not host roots or file contents. No raw prompt/provider content/token is added to logs. sent_settings records the adapter settings, not independently measured effective GPU settings; mock mode is still mock. Schema-valid unchanged copy can be runtime success and must still fail the client's editing review. See [spec](plans/SPEC-HUB-ZURI-001-agent-backend.md).

Version diff: 0.1.0 -> 0.2.0: document approved native Zuri P1 contract; live/sidecar readiness is not implied.
