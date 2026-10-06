---
id: HUB-ADR-001
version: 0.3.0
status: active
superseded_by: null
decision_status: accepted
author: ATHER
date: 2026-10-03
risk: HIGH
---

# HUB-ADR-001: separate Python agent runtime with a replaceable execution adapter

## Context

The [audit](../CURRENT-STATE.md) identifies Tauri/Rust and vanilla JS as the primary desktop stack, an existing Python LiteLLM launcher, and independent Node agent scripts. Embedding a new agent framework in every path would duplicate session and authorization policy.

This ADR is scoped to the harness; it does not replace the existing desktop ADR-001 in [ARCHITECTURE](../../adr/ARCHITECTURE.md).

## Proposed decision

Add a separately runnable Python HTTP service. Keep desktop/device responsibilities in Rust. Introduce an `ExecutionDriver` boundary around Pydantic AI; the hub owns agent definitions, sessions, permission decisions, model routing and persistence contracts. Agent definitions are immutable; sessions hold independent context and task state.

Use Pydantic AI's typed loop and function tools. Evaluate individual Harness capabilities where they reduce code without bypassing hub policy. The official [Harness](https://pydantic.dev/docs/ai/harness/) is composable; its default Coder/workspace setup is not the permission model for this service. Pin tested versions and test the adapter using the documented [testing primitives](https://pydantic.dev/docs/ai/guides/testing/).

The desktop bridge is opt-in. Existing chat, proxy, telemetry and storage features stay available. Native agent endpoints call the service directly. Initial deployment has one service worker, bounded root runs and no durable session resumption.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| Implement the complete agent loop in Rust | Good packaging fit, but would recreate typed tools, validation and model-library integration requested from Pydantic AI. |
| Expand only the existing Node scripts | Preserves script language but leaves application-facing sessions and permissions to a new custom framework. |
| Replace the whole application with Python | Discards working desktop and hardware code without a migration benefit. |
| Enable the complete Coder harness by default | Does not establish the required deny-first, workspace and shell boundaries. |

## Consequences and verification

An additional local process and Python environment must be packaged and documented. A service failure must remain explicit and must not silently route native agent calls into a legacy path that lacks policy checks. Module boundaries and API contracts are in the [target](../TARGET-ARCHITECTURE.md).

Acceptance: H09-H11, H16-H19, H25-H26 in the [plan](../IMPLEMENTATION-PLAN.md). Rollback disables the bridge and stops the service while preserving memory.

## Version diff

Historical proposal 0.1.0: No legacy ADR is superseded; no agent library has been installed or runtime code changed.

Approval delta 0.1.0 → 0.2.0: user approved the design on 2026-10-03; implementation is authorized within these boundaries.

Implementation delta 0.2.0 -> 0.3.0: decision implemented within the [verified checkpoint](../VERIFICATION.md). Historical statements above describe the proposal date, not current implementation status.
