# ADR-008: Typed Rust ↔ TypeScript IPC Contract Generation

| Field | Value |
|-------|-------|
| **ADR ID** | ADR-008 |
| **Status** | Accepted |
| **Date** | 2026-09-30 |
| **Author** | Boss / Core Architecture |
| **Domain** | Architecture & Framework Standards |
| **Related** | [ADR-001](ARCHITECTURE.md#adr-001-tauri-v2-เป็น-desktop-shell), [ADR-007](ADR-007-push-telemetry-events.md), [STD-003](../standards/STD-003-implementation-unit-and-packet.md) |

---

## 1. Context & Problem Statement

In Tauri desktop applications, the IPC boundary between the Rust core and the JavaScript/TypeScript frontend is the single primary interface seam. Historically, developers manually duplicated type definitions and string command names across both environments:
1. Writing the Rust `#[tauri::command]` function.
2. Registering it in `tauri::generate_handler![...]`.
3. Manually writing `invoke("command_name", { ... })` and matching TypeScript interfaces.

### The Drift Failure Mode
Because TypeScript `invoke<T>(...)` blindly trusts developer-declared types, the compiler cannot detect field divergence or missing data:
- **Silent Metric Dropping**: In legacy iterations, Rust added multi-GPU telemetry structures to snapshots, but the frontend interface omitted the field. Telemetry was sampled continuously by the backend while the UI silently rendered empty cards.
- **Dead / Unlinked Commands**: Commands registered in Rust handlers were orphaned when frontend refactoring removed their calls without triggering build-time warnings.
- **Documentation Desynchronization**: Command lists in specifications drifted from actual handler registries.

---

## 2. Decision

We establish Rust as the **Single Source of Truth** for the IPC contract:

1. **Contract Derivation (`specta` / `tauri-specta`)**:
   - All DTO structs crossing the IPC boundary derive `serde::Serialize`, `serde::Deserialize`, and `specta::Type`.
   - Command signatures and argument types generate typed TypeScript bindings automatically into `src/bindings.ts` (or `src/js/bindings.d.ts`).

2. **Unified Client Surface**:
   - Frontend components invoke typed command wrappers (e.g. `commands.getTelemetrySnapshot()`) instead of raw string literals (`invoke("get_telemetry_snapshot")`).

3. **CI & Preflight Drift Gate**:
   - Type verification and compile checks (`tsc --noEmit` and `cargo check`) run during preflight to guarantee that any modification to Rust structs or command signatures immediately raises a build error if the frontend does not adapt.

---

## 3. Options Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Option A: Automated Contract Codegen (`tauri-specta`)** | Eliminates entire classes of silent schema drift; generates typed client functions and TypeScript type definitions; errors caught at compile time. | Requires build step integration and dependency on `specta` derives. | **Accepted** |
| **Option B: Type-Only Generation (`ts-rs`)** | Lightweight, only generates interface types. | Leaves command names and parameter tuples unvalidated; command signature drift remains possible. | Rejected |
| **Option C: Manual Mirroring with Discipline** | Zero additional build dependencies. | Proven to fail in production with silent regressions and missing data fields. | Rejected |

---

## 4. Consequences & Guard Rails

- **No Manual String Invocations in Production**: New frontend modules must import typed client wrappers or validated contract definitions.
- **Security Boundary Intact**: Automated contract generation strictly defines serialization shapes; capability and permission enforcement (`capabilities/default.json`) remains governed explicitly and separately by security configurations.
- **Strict Compliance with ADR-100**: Every command signature in the generated contract strictly returns `Result<T, String>` to ensure predictable error handling.
