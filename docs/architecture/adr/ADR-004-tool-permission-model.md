---
id: HUB-ADR-004
version: 0.3.0
status: active
superseded_by: null
decision_status: accepted
author: ATHER
date: 2026-10-03
risk: HIGH
---

# HUB-ADR-004: deny-first tool authorization with explicit host boundaries

## Context

The existing application has privileged storage, process, update and device commands. Those are desktop capabilities, not automatically safe agent tools. Model outputs, workspace files and remote MCP descriptions can be hostile.

## Proposed decision

Separate tool registration from authorization. Every native or MCP call validates input and checks the effective execution identity at the moment of use. Effective authority is the intersection of configured agent grants, project policy, parent delegation grants and run restrictions. No prompt, model response, request field or remote tool registration can grant itself authority.

Profiles `read-only`, `workspace`, `trusted`, and `admin` describe maximum available scope; they do not imply unrestricted tools. Default grants are empty. Shell and HTTP require explicit grants. Admin configuration is operator-owned and cannot be selected by an agent.

Filesystem tools check canonical configured roots, path components, parents and reparse/link escapes, including Windows-specific path forms. Writes are bounded and atomic where supported. Read/search/list limits constrain both work and output.

Shell accepts a validated executable/argument vector, bounded capture and an owned process tree with timeout/cancellation. It is off by default; a working directory is not OS isolation. Executable allowlisting alone cannot make a general interpreter or untrusted build script safe. Trusted execution policies must state that authority explicitly.

HTTP validates destination/method and resolved addresses, limits response bytes and prevents redirect-based policy bypass. Credentials are tool-specific and never inherited from the model provider. MCP uses the same policy checks and remains optional.

## Threat model and limits

The full threat model is in the [target](../TARGET-ARCHITECTURE.md). Local path policy defends ordinary traversal and link escape attempts, not a compromised host or arbitrary same-user code racing filesystem checks. Managed roots require trusted ownership; strong untrusted-code isolation needs a sandbox backend. This matches the distinction in the official [Harness workspace guidance](https://pydantic.dev/docs/ai/harness/).

Do not turn legacy updater, cache-offload, device-tuning, key-management or general `/api/invoke` commands into model-callable tools. Do not import existing development API credentials into the service.

## Alternatives considered and consequences

Trusting agent prompts, Tauri capabilities alone or inherited parent authority is rejected: none enforces per-tool argument and child scope. Universal OS sandboxing would give stronger isolation but is not claimed by the initial native tool implementation. Operators must opt into shell authority consciously in configuration.

Acceptance: H10, H12-H17, H21, H23-H24 in the [plan](../IMPLEMENTATION-PLAN.md). Tests exercise real path and process behavior in temporary roots, with unsupported OS cases explicitly skipped.

## Version diff

Historical proposal 0.1.0: no permissions, firewall rules or host credentials were changed.

Approval delta 0.1.0 → 0.2.0: user approved the design on 2026-10-03; implementation is authorized within these boundaries.

Implementation delta 0.2.0 -> 0.3.0: decision implemented within the [verified checkpoint](../VERIFICATION.md). Historical statements above describe the proposal date, not current implementation status.
