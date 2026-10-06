---
id: HUB-PERMISSIONS-GUIDE
version: 0.1.0
status: active
superseded_by: null
---

# Permission and threat boundary

The intended operator is a trusted local user. Model output, retrieved text, tool arguments and remote responses are untrusted data. The service token authorizes its configured agents; this is not tenant isolation or a per-user authorization service. Keep the runtime on loopback. CORS is disabled, execution/catalog/diagnostic APIs require bearer auth, request bodies are capped at 256 KiB, and logs contain identifiers/error codes rather than prompts, tool results or credentials. Use TLS and an authenticating reverse proxy if explicitly deploying across hosts; no such deployment was performed here.

Policies are deny-first: read-only cannot grant writes; workspace permits explicit file/memory writes; trusted is required for exact shell argv and HTTP origins. Admin is reserved and rejected for agents. An agent receives only its listed tools that its policy grants. Delegation also intersects every ancestor policy and tool set, project scope and cloud permission. The default orchestrator can delegate read-only work to coder, but cannot grant its child's write tools.

Native file tools reject absolute, drive/UNC/device, parent traversal, alternate stream, protected `.git`/`.env`/runtime-state paths and symlink/reparse traversal. Project roots must exist. These checks assume operator-owned directories without concurrent adversarial filesystem mutation. They are not an OS sandbox: another same-user process can race path checks, create hard links or change executable contents. Keep secrets outside granted roots. Shell commands are trusted programs with their normal OS authority; allowed argv does not confine their internal file/network access. Do not grant shells/interpreters or mutable scripts to untrusted agents.

Windows shell supervision establishes a [Windows Job Object](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) before launching the approved executable, retaining a kill-on-close handle in the supervisor. Normal child processes are terminated on timeout or supervisor exit, including after an intermediate parent exits. POSIX uses a process group. This owns normal tool subprocess lifetimes; it is not containment against hostile native code using external brokers or escaped sessions. Synchronous local filesystem I/O and SQLite work cannot be forcibly interrupted safely mid-system-call; byte/entry limits bound work, but OS stalls can exceed application deadlines. Cancellation does not roll back already completed writes.

HTTP requires explicit exact origins and denies redirect chains, metadata/link-local/multicast/unspecified addresses and private DNS results except explicit local literal addresses/localhost. Redirects never widen authority. The operator is responsible for endpoint/provider configuration and secret file ACLs. SQLite is not encrypted.

Version diff: new threat model; no claim of arbitrary-code sandboxing or public service readiness.
