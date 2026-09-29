# FEAT-019: HuggingFace Cache Directory Junction Offloader

| Field | Value |
|-------|-------|
| **Feature ID** | FEAT-019 |
| **Domain** | Backend Integration & Storage |
| **Status** | Active |
| **Requirement** | [FR-017](../../../requirements/FR-017-huggingface-cache-offload.md) |
| **Component** | `src-tauri/src/commands/storage.rs` |
| **Reference** | `G:\.ollama_blobs_root\docs\CR-HuggingFace-Cache-Offload.md` |

---

## Overview

FEAT-019 extends the storage offloading capability from Ollama blobs ([FR-015](../../../requirements/FR-015-storage-symlink-offloader.md)) to HuggingFace hub caches. It enables redirecting `%USERPROFILE%\.cache\huggingface` to a high-capacity secondary storage path (such as `G:\.ollama_blobs_root\offload\huggingface-cache`) using native Windows NTFS Directory Junctions.

## Key Capabilities
1. **Cache Status Inspection**:
   - Detects whether `%USERPROFILE%\.cache\huggingface` is a regular folder or an established junction.
   - Calculates total cached gigabytes and model file counts.
2. **Atomic Junction Creation**:
   - Creates the destination folder structure on external storage.
   - Creates an NTFS Directory Junction (`mklink /J`) safely with pre-flight dry-run validation.
3. **Write-Through Verification**:
   - Writes a temporary verification probe file through the Drive C: source junction.
   - Confirms bidirectional read/write visibility on Drive G:.
   - Cleans up the test file atomically.
4. **Resilience & Zero Panic**:
   - Returns structured `Result<T, String>` to prevent application crashes on restricted permissions or unmounted external volumes.
