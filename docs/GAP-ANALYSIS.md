# Master Gap Analysis & Architecture Remediation (GAP-001)

| Field | Value |
|---|---|
| **Document ID** | `GAP-001` |
| **Document Type** | Comprehensive Engineering Gap Analysis |
| **System** | Local LLM Hub (Tauri v2 + Rust Core + Vanilla Bento UI) |
| **Date** | October 2, 2026 |
| **Standard** | SWE-AI-BENCH-STD v2.0 & SWE 5-Tier Architecture |
| **Status** | Active & Baselined |
| **Detailed Report** | [`docs/reports/feature-gap-analysis-refinement-report.md`](reports/feature-gap-analysis-refinement-report.md) |

---

## 1. Executive Summary

เอกสารนี้รวบรวมผลการตรวจสอบช่องว่าง (**Gap Analysis**) เชิงลึกของระบบ **Local LLM Hub** ทั้งหมด ครอบคลุมทั้ง 5 โดเมนหลัก โดยทำการตรวจสอบเปรียบเทียบ 4 มิติ:
1. **Requirements Coverage**: ข้อกำหนด `FR-001` ถึง `FR-017` และ `NFR-001` - `NFR-002`
2. **Feature Specification Completeness**: เอกสารใน `docs/domains/*/features/`
3. **Source Code Implementation**: ใน `src-tauri/` (Rust) และ `src/js/` (Bento Shell)
4. **Verification & Test Coverage**: ชุดทดสอบ Unit Tests และ Integration Tests (63/63 Tests Passing)

---

## 2. Gap Identification Matrix

จากการวิเคราะห์ทั้งระบบ ได้จำแนกประเภทช่องว่างและระดับความสำคัญออกเป็น 4 ด้าน:

| หมวดหมู่ (Category) | รหัสช่องว่าง | รายละเอียดช่องว่างที่ตรวจพบ | ระดับความสำคัญ | การจัดการและสถานะ |
|---|:---:|---|:---:|---|
| **Documentation** | `GAP-DOC-01` | ขาดเอกสาร Feature Specification รายละเอียดในโดเมน `model-management` และ `inference-gateway` แม้โค้ดจะรันได้จริง 100% | Medium | ✅ **Resolved**: เขียนและเชื่อมโยงครบทั้ง 8 ฟีเจอร์ |
| **Documentation** | `GAP-DOC-02` | ขาดเอกสาร Feature Specification ของ `FEAT-001`, `FEAT-002`, `FEAT-004`, `FEAT-014`, `FEAT-015` ใน `backend-integration` | Medium | ✅ **Resolved**: เขียนและเชื่อมโยงครบทุกฟีเจอร์ |
| **UI & UX Safety** | `GAP-UX-01` | หน้าต่าง Chat Playground ยังไม่มีตัวนับ Context Length Token Indicator ก่อนกดส่ง ทำให้ผู้ใช้ไม่รู้ว่า prompt เกิน context หรือไม่ | High (P2) | 📋 **Roadmap P2**: ออกแบบ [`FEAT-023`](domains/inference-gateway/features/FEAT-023-chat-preflight-token-counter.md) |
| **Security & Network** | `GAP-SEC-01` | ระบบ LAN Sharing เปิดให้ดาวน์โหลดโมเดลได้แบบ Read-Only แต่ยังไม่มีตัวเลือกรหัสผ่านชั่วคราว (Ephemeral PIN) ป้องกันอุปกรณ์ไม่พึงประสงค์ในหอพัก/ออฟฟิศ | Medium (P2) | 📋 **Roadmap P2**: ออกแบบ [`FEAT-024`](domains/network-distribution/features/FEAT-024-lan-ephemeral-pin-auth.md) |
| **Information Architecture**| `GAP-IA-01` | หน้ารายการโมเดล (Unified Catalog) มีโมเดลมากกว่า 50 รายการ แต่ยังไม่มีการจัดหมวดหมู่ Tag Taxonomy (Coding, Thinking, Vision, General) | Medium (P2) | 📋 **Roadmap P2**: ออกแบบ [`FEAT-025`](domains/model-management/features/FEAT-025-model-tag-taxonomy-filter.md) |
| **Observability Alert** | `GAP-OBS-01` | ระบบมี Sensor 102+ channels แต่ยังไม่มี Proactive Audio/Visual Toast แจ้งเตือนเมื่อ GPU Hotspot อุณหภูมิสูงเกิน 88°C | Low (P2) | 📋 **Roadmap P2**: บรรจุใน Phase 6.2 |

---

## 3. Detailed Domain Status Audit

### 3.1 Domain 1: Backend Integration
- **Requirements**: `FR-001`, `FR-005`, `FR-009`, `FR-012`, `FR-014`, `FR-015`, `FR-017`
- **Current State**:
  - `probe_backends`: ทดสอบและเชื่อมต่อ Ollama (`11434`), vLLM (`8000`), GGUF Filesystem, และ HuggingFace Hub Local Cache
  - `scan_directory_for_gguf`: อ่าน binary magic bytes `0x47, 0x47, 0x55, 0x46` พร้อม parse metadata โดยไม่กิน RAM
  - `execute_blob_offload`: สร้าง NTFS directory junctions (`mklink /J`) ย้ายโฟลเดอร์ blob หลายสิบกิกะไบต์ไปยังไดรฟ์สำรองอย่างปลอดภัย
- **Test Coverage**: 17 Tests Passing (100% Green)

### 3.2 Domain 2: Model Management
- **Requirements**: `FR-002`, `FR-003`, `FR-004`, `FR-011`
- **Current State**:
  - `aggregate_models`: ดึงรายการโมเดลทุก backend แบบ concurrent ผ่าน `tokio::join!`
  - `dedup_models`: บังคับใช้ Business Rules `BR-001` (Priority: Ollama > GGUF > vLLM > HF) และ `BR-002` (Normalized Base Names)
  - `arena.js`: ทดสอบเปรียบเทียบโมเดลคู่ Side-by-Side พร้อมวัด throughput และ TTFT
  - `stats.js`: คำนวณ Token ROI เทียบกับ OpenAI GPT-4o pricing ($2.50/$10.00 ต่อ 1M tokens)
- **Test Coverage**: 12 Tests Passing (100% Green)

### 3.3 Domain 3: Inference Gateway
- **Requirements**: `FR-007`, `FR-008`, `FR-013`
- **Current State**:
  - `generate_litellm_config`: สร้าง `config.yaml` อัตโนมัติ mapping ทุกลิงก์เข้าสู่ unified port `4000`
  - `execute_chat`: รองรับ multi-backend routing พร้อม streaming chunks และ telemetry logging
- **Test Coverage**: 8 Tests Passing (100% Green)

### 3.4 Domain 4: Observability & Telemetry
- **Requirements**: `FR-006`, `FR-016`, `NFR-001`
- **Current State**:
  - `nvidia-smi` poller แบบ Asynchronous, ป้องกันการบล็อก UI
  - C# Sidecar `lhm-sidecar.exe` รายงาน 102+ deep sensors (12 Core Threads, LPC Voltages, VRM, SSD)
  - 3D Hardware Digital Twin (Three.js WebGL) หมุนพัดลมและแสดงฮีทไปป์ตามความร้อนจริง
- **Test Coverage**: 15 Tests Passing (100% Green)

### 3.5 Domain 5: Network Distribution
- **Requirements**: `FR-010`
- **Current State**:
  - `axum` HTTP server บนพอร์ต 8080 รองรับ HTTP 206 Partial Content (Range Requests) สำหรับ resume ดาวน์โหลดไฟล์ 40GB+
  - ป้องกัน Path Traversal (`..`) 100%
- **Test Coverage**: 5 Tests Passing (100% Green)

---

## 4. Remediation & Action Plan

1. **Immediate Action (Phase 6.1)**:
   - บันทึก Architecture Decision Record (`ADR-009`) รองรับ Preflight Token Counter, Ephemeral PIN Auth และ Model Tagging
   - สร้าง Feature Specifications: `FEAT-023`, `FEAT-024`, `FEAT-025`
   - ปรับปรุง Master Development Roadmap (`docs/ROADMAP.md`)
2. **Traceability**: ผูกโยงเอกสารทั้งหมดเข้าสู่ `docs/.doc-graph.json`
