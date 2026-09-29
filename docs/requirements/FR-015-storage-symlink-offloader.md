# FR-015: Storage Offloader & Symlink Health Optimizer

## Status
- **Status**: Approved
- **Domain**: Storage & Model Management
- **Owner**: local-llm-hub core team
- **Traces To**: FEAT-017
- **Implements**: System Storage Optimization & Drive Space Recovery

---

## 1. Problem Statement
Local LLM weights (GGUF blobs) occupy tens to hundreds of gigabytes. By default, Ollama stores all blobs in `C:\Users\<user>\.ollama\models\blobs\`, rapidly exhausting high-performance primary OS drives (Drive C:). 

In `G:\.ollama_blobs_root`, an effective symlink offloading pattern was demonstrated to save over 18+ GB of C: space by relocating `sha256-*` files to secondary high-capacity drives (e.g., G: or O:) and leaving 0-byte Windows symlink pointers on C:.

However, that approach lacked:
1. Automated in-app detection of broken or orphaned symlinks.
2. A single-pane visual GUI with zero manual batch script editing.
3. Safe atomic file movement with integrity verification and rollback.
4. Unit and integration tests guaranteeing ADR-100 zero panics on missing paths.

---

## 2. Requirements

### 2.1 Functional Requirements
- **FR-015.1 (Root Auto-Discovery)**: The system MUST automatically identify default Ollama blob paths (`%USERPROFILE%\.ollama\models\blobs`) and discover candidate external storage roots on secondary drives (`G:\.ollama_blobs_root`, `O:\.ollama\models\blobs`, etc.).
- **FR-015.2 (Symlink & Storage Health Audit)**: The system MUST inspect all entries in the blob directory and report:
  - Total blobs count and total size in bytes.
  - Active valid symlinks pointing to external storage.
  - Broken/stale symlinks (pointing to non-existent files or unmounted drives).
  - Heavy real blobs on Drive C: (>100 MB) eligible for offload.
  - Total reclaimable space on Drive C: in bytes and gigabytes.
- **FR-015.3 (Safe Blob Relocation)**: The system MUST provide an atomic offload command that:
  - Verifies target storage directory exists and is writable.
  - Moves the candidate `sha256-*` blob file to the target directory.
  - Creates a Windows file symlink on Drive C: pointing to the moved blob.
  - Verifies symlink resolution before confirming success.
- **FR-015.4 (Zero Panic & Robust Error Reporting)**: In accordance with ADR-100, any missing path, permission denial, or disk I/O error MUST return a descriptive `Result<T, String>` without crashing or panicking.

---

## 3. Data Contracts

```typescript
export interface SymlinkHealth {
  checked_at: string;
  blob_pointer_root: string;
  storage_root: string;
  total_blob_count: number;
  symlink_count: number;
  bad_symlink_count: number;
  large_real_blob_count: number;
  large_real_blob_bytes: number;
  reclaimable_gb: number;
  issues: string[];
}

export interface OffloadResult {
  blob_hash: string;
  source_path: string;
  destination_path: string;
  bytes_freed: number;
  success: boolean;
  message: string;
}
```

---

## 4. Verification & Testing
- Unit test with mock filesystem:
  - Validates real blobs vs. symlink classification.
  - Detects broken symlinks correctly.
  - Calculates reclaimable bytes accurately.
- `cargo test --lib` MUST pass with 100% green coverage on storage commands.
