# FR-017: HuggingFace Cache Directory Junction Offloader

## Status
- **Status**: Approved
- **Domain**: Storage & Backend Integration
- **Owner**: local-llm-hub core team
- **Traces To**: [FEAT-019](../domains/backend-integration/features/FEAT-019-hf-cache-junction-offload.md)
- **Implements**: HuggingFace Primary Drive C: Space Recovery & Directory Junction Automation
- **Origin Reference**: `G:\.ollama_blobs_root\docs\CR-HuggingFace-Cache-Offload.md`

---

## 1. Problem Statement

Machine learning workflows frequently utilize HuggingFace libraries (`transformers`, `diffusers`, `huggingface_hub`). By default, HuggingFace downloads model checkpoints and tokenizers into:
```
%USERPROFILE%\.cache\huggingface\hub
```
On Windows systems, this cache resides entirely on the primary OS drive (Drive C:), rapidly consuming dozens to hundreds of gigabytes. While environment variables like `HF_HOME` exist, setting them globally across various development environments, virtual environments, and GUI desktop processes is fragile and inconsistent.

Using a native **Windows NTFS Directory Junction** (`mklink /J`) allows redirecting `%USERPROFILE%\.cache\huggingface` to secondary high-capacity storage (e.g. `G:\.ollama_blobs_root\offload\huggingface-cache` or `O:\offload\huggingface-cache`) transparently at the filesystem driver level without needing environment variable modifications or breaking existing software.

---

## 2. Requirements

### 2.1 Functional Requirements

- **FR-017.1 (Cache Location Audit)**: The system MUST audit the status of `%USERPROFILE%\.cache\huggingface` and report:
  - Whether the path exists.
  - Whether it is a standard directory or an active NTFS Directory Junction (`LinkType = Junction`).
  - Current resolved target path on external storage.
  - Total consumed disk space and model file count within the cache.

- **FR-017.2 (Safe Junction Provisioning)**: The system MUST provide an automated junction offloading action that:
  - Allows dry-run preview mode before mutating filesystem links.
  - Verifies target storage volume exists, is writable, and has sufficient capacity.
  - Ensures the target directory exists (e.g. `G:\.ollama_blobs_root\offload\huggingface-cache`).
  - If the source directory already contains real data on Drive C:, requires user confirmation or migrates files safely before creating the junction.
  - Creates the directory junction using Windows filesystem APIs (`CreateSymbolicLink` with junction flag or `mklink /J`).

- **FR-017.3 (Write-Through Verification & Rollback)**: After establishing the junction, the system MUST:
  - Write a transient verification probe file through the Drive C: source path.
  - Verify that the probe file is immediately visible through the target path on Drive G: (or secondary storage).
  - Delete the verification probe file before marking the operation as successful.
  - If verification fails, cleanly roll back the junction and report a descriptive error without crashing (ADR-100 zero panic).

- **FR-017.4 (Zero Environment Tampering)**: The junction offload MUST operate purely at the filesystem junction level without altering `HF_HOME` or system environment variables.

---

## 3. Data Contracts

```typescript
export interface HuggingFaceCacheStatus {
  source_path: string;
  target_path: string;
  is_junction: boolean;
  resolved_target: string | null;
  total_size_bytes: number;
  total_size_gb: number;
  file_count: number;
  is_healthy: boolean;
  message: string;
}

export interface JunctionOperationResult {
  success: boolean;
  source_path: string;
  target_path: string;
  dry_run: boolean;
  verification_passed: boolean;
  message: string;
}
```

---

## 4. Verification & Testing

- **Unit Tests**: Mock filesystem paths to verify junction detection and safe error handling on non-existent or read-only targets.
- **Integration Tests**: Verify that `HuggingFaceCacheStatus` correctly distinguishes between regular directories and NTFS junctions.
