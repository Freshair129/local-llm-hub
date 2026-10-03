---
id: HUB-AGENT-GUIDE
version: 0.1.0
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
