---
id: HUB-DOCKER-CAPACITY-UNBLOCK
version: 0.3.0
status: active
superseded_by: null
date: 2026-10-05
author: ATHER
complexity: C-2
risk: MEDIUM
approval: user approved exact cache purge and Docker continuation on 2026-10-05
---

# Restore host capacity before approved container acceptance

Parent: [approved acceptance repair](HUB-ACCEPTANCE-REPAIR.md), R5. Peer: [deployment procedure](../local-deployment.md). This proposal adds one explicitly bounded cache deletion; it does not change application code or relocate Ubuntu.

## Initial evidence and scope

Read-only checks on 2026-10-05 find C: free space at 590,536,704 bytes (563 MiB), Ubuntu WSL2 stopped, and its 5,104,467,968-byte VHD on C:. O: has approximately 2.25 TB free, but it does not back the current distro. The lack of Docker storage headroom remains the container prerequisite blocker.

| Item | Verified location and size | Proposed action |
|---|---|---|
| pip HTTP download cache | `C:\Users\freshair\AppData\Local\pip\cache`; 4,718,264,350 observed file bytes; pip reports 1,012 HTTP files and 4,718.3 MB | Purge this exact cache after approval |
| pip locally built wheels | Same cache; pip reports zero wheels and zero bytes | None currently present; recheck before purge |
| uv/npm caches | Symlink/junction targets on G: | Preserve; deleting them would not reclaim C: capacity |
| Cargo/Rust toolchains, Temp and project environments | Not approved cleanup targets | Preserve |
| Ubuntu VHD | `C:\Users\freshair\AppData\Local\wsl\{c6c003bb-1e97-4a62-aa53-1a750d38eb57}\ext4.vhdx` | Preserve in place |

No active Python/pip/uv install/download/wheel command was found by the process snapshot. This is a point-in-time check and will be repeated before action. The pip cache root is a normal directory, not a reparse point. Logical cache bytes are not a guarantee of reclaimed physical space; measure free space afterwards.

## Proposed execution and verification

1. Recheck the exact cache root/reparse status, pip cache inventory and active installer processes. Stop if ownership/path or active-use conditions change.
2. Purge only this cache with the installed Python/pip command:

   ```powershell
   & 'C:\Users\freshair\AppData\Local\Programs\Python\Python313\python.exe' -m pip --cache-dir 'C:\Users\freshair\AppData\Local\pip\cache' cache purge
   ```

3. Capture pip's removed-file count, remaining cache size and actual C: free-space delta. This deletes downloaded HTTP cache entries, not installed packages or virtual environments. A future pip operation may need to download these entries again; no automatic reinstall or download is part of this purge.
4. Reassess host capacity and Docker package/image requirements. Continue the already approved R5 install/build/auth/health/unprivileged-user/memory-restart acceptance only if capacity is sufficient. Cache removal is not proof that Docker acceptance can finish; stop if headroom is still inadequate.
5. Preserve test evidence and volumes, stop task-owned services, and update the verification report with actual results.

## Acceptance and limits

The approved amendment was limited to the exact pip cache and measurement of actual host-space recovery. Those cache criteria are met; the separate R5 result below is based on its own container receipt.

### Executed outcome, 2026-10-05

- The approved cache was purged after rechecking its path and active use. Pip reported 1,012 HTTP files removed (4,718.3 MB), zero remaining HTTP files and zero built wheels. Measured C: free space increased from 4,575,105,024 to 9,295,990,784 bytes, a 4,720,885,760-byte delta. The separate increase before the purge was not attributed to this work.
- Docker CE/CLI 29.8.2, containerd 2.3.6, Buildx 0.37.1 and Compose 5.6.0 were installed from the official Docker repository into the existing Ubuntu 26.04 WSL2 distribution. The C:-backed VHD was not moved. At final recheck its size was 6,333,399,040 bytes and C: had 7,608,295,424 free bytes. WSL reported 1,020,666,478,592 guest-available bytes; that virtual guest value is not host free space.
- The bounded CPU-mock acceptance passed 8/8. Receipt: `.hub/container/20261005T090831Z-ef4243c8.json`, SHA-256 `FD4D45F3B840BC7A72D0CD7B686926C99771B80E59CB3F37C37FE722D9006ED5`. It records the image ID and tested Compose/Dockerfile/runner hashes. Checks include auth, catalog/chat, non-root/read-only/capability/loopback controls, Linux symlink rejection and project memory after restart.
- Compose down removed the task's container/network, retained `hub-state` and `hub-workspace` volumes and image, and left Docker socket/service/containerd inactive and disabled. Port 8787 had zero Linux listeners and no Windows listener. Pip cache remains at zero bytes. No Docker auto-start, Windows firewall change or distro relocation was made.
- The Windows true-symlink fixture remains SKIP because the host privilege is unavailable; Linux symlink escape rejection passed. This does not prove GPU inference, real-model routing, live MCP or streaming.

The exact cache-recovery objective and approved R5 Docker objective are satisfied. The separate Windows-only symlink skip and deferred runtime modes remain explicit limitations.

## Version diff

New draft 0.1.0: narrow, evidence-backed pip cache cleanup proposal to unblock the existing container task. Inspection only has run; no cache was removed. Await user approval before executing the purge.

0.1.0 -> 0.2.0: approval received and the exact pip cache purged. Receipt: .hub/fix-triage/pip-cache-purge.json. Removed 1,012 files, pip reports zero remaining HTTP/wheel cache; host free space rose from 4,575,105,024 to 9,295,990,784 bytes (4,720,885,760 bytes measured delta). The pre-purge free-space increase from the previous inspection was external to this task. Continue approved R5 capacity/package checks; no distro move or other cleanup.

0.2.0 -> 0.3.0: finish the approved Docker build/auth/security/memory-restart acceptance, verify named-volume preservation and service shutdown, and record measured final capacity plus the remaining Windows-only symlink limitation.
