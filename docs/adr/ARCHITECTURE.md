# Architecture Decision Records (ADRs)

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Created** | 2026-09-28 |
| **Author** | Boss |

---

## ADR-001: Tauri v2 เป็น Desktop Shell

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
ต้องการ desktop app ที่รัน local ได้, เข้าถึง filesystem, spawn processes, และมี native UI integration

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Tauri v2 (Rust) | ขนาดเล็ก (<10MB), secure, Rust backend | Rust learning curve |
| Electron | Ecosystem ใหญ่, familiar | Bundle size >100MB, memory หนัก |
| Web-only (localhost server) | Simple | ต้องแยก server process, no native integration |
| Python (PyQt/Tkinter) | Easy LiteLLM integration | UI clunky, distribution ยาก |

**Decision:** Tauri v2  
**Rationale:** ขนาดเล็ก, security model ดีกว่า Electron, Rust ทำ system calls ได้ตรง, IPC ชัดเจน

---

## ADR-002: Vanilla HTML/CSS/JS ไม่ใช้ Framework

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
ต้องเลือก frontend stack สำหรับ WebView2 ใน Tauri

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Vanilla JS | Zero dependency, full control, ไม่มี build step | More boilerplate |
| React/Vite | Component model, ecosystem | Bundle overhead, build step |
| Svelte | Compile-time, light output | Less familiar |
| Vue | Progressive, readable | Another dependency |

**Decision:** Vanilla HTML/CSS/JS  
**Rationale:** App ไม่ซับซ้อนพอที่จะต้องการ framework, ไม่มี build step = dev experience ดีกว่าสำหรับ Tauri, ไม่มี dependency hell

---

## ADR-003: LiteLLM เป็น Unified Proxy

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
ต้องการ unified endpoint สำหรับ route requests ไปยัง backend ต่างๆ

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| LiteLLM | Supports 100+ backends, active development, OpenAI-compat | Python dependency |
| Custom Rust proxy | No Python dep, fast | ต้องเขียน adapter ทุก backend |
| llama.cpp server only | Simple | จำกัดเฉพาะ GGUF |
| Ollama as proxy | User-friendly | ไม่รองรับ vLLM/HF natively |

**Decision:** LiteLLM Python sidecar  
**Rationale:** ไม่ต้องเขียน adapter ทุก backend เอง, LiteLLM ดูแล compatibility, OpenAI-compatible หมายความว่า user สามารถ point app อื่นมาใช้ได้ทันที

---

## ADR-004: Model Dedup Based on Name Normalization

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
โมเดลเดียวกันมีชื่อต่างกันใน backend ต่างกัน ต้องหา canonical identity

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| SHA256 of weights | Accurate | ต้อง hash ทั้งไฟล์ (ช้ามาก) |
| GGUF metadata hash | Accurate สำหรับ GGUF | ไม่ work กับ Ollama/vLLM |
| Name normalization + fuzzy match | Fast, no file access | อาจ false positive |
| HF Model ID matching | Accurate | ไม่ทุก backend มี HF ID |

**Decision:** Name normalization + regex  
**Rationale:** Fast, no I/O, work กับทุก backend. False positives ยอมรับได้เพราะ user เห็น badge และตัดสินใจเองได้

---

## ADR-005: nvidia-smi สำหรับ GPU Monitoring

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
ต้องการ VRAM/GPU stats บน Windows

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| nvidia-smi CLI | พร้อมใช้ทุก NVIDIA system | ต้อง parse text output |
| NVML Rust bindings | Direct API access | Complex setup, versioning |
| WMI (Windows) | Native Windows | NVIDIA-specific query ยาก |
| nvml-wrapper crate | Rust-native | เพิ่ม binary dependency |

**Decision:** nvidia-smi CSV output parsing  
**Rationale:** Simple, reliable, พร้อมใช้ทุก NVIDIA system ที่มี driver, ไม่ต้องการ additional dependency

---

## ADR-006: Hash-based Settings Persistence

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
ต้องการ persist backend config และ settings ระหว่าง app restart

**Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| JSON file ใน AppData | Simple, readable | ไม่ secure สำหรับ tokens |
| SQLite | Structured, queryable | Overkill |
| Tauri store plugin | Built-in, persistent | Limited to simple key-value |
| Windows Registry | Native | Complex API |

**Decision:** JSON file ใน AppData + Windows Credential Manager สำหรับ tokens  
**Rationale:** Config ปกติ (URLs, paths) เก็บใน JSON file อ่านง่าย, sensitive data (HF token) เก็บใน Credential Manager ผ่าน Tauri keychain plugin

---

## ADR-100: Code & Component Boundary Guard Rails

**Status:** Accepted  
**Date:** 2026-09-28

**Context:**  
ในการทำงานแบบ multi-agent packet implementation ต้องมี guard rails ที่เด็ดขาด เพื่อป้องกัน coder agent ทำโค้ดรั่วไหลข้าม boundary หรือสร้าง side effects

**Guard Rails Rules:**
1. **Strict Result<T, String> Error Handling**: ทุก Tauri command ต้อง return `Result<T, String>` ห้ามใช้ `panic!` หรือ `unwrap()` ใน production paths
2. **Memory Safety & Thread Safety**: Shared state ใน Rust ต้องถูกห่อหุ้มด้วย `tokio::sync::Mutex<AppState>` หรือ `std::sync::Arc` อย่างถูกต้อง
3. **No Direct Filesystem Access from UI**: Frontend ห้ามเรียก filesystem โดยตรง ต้องผ่าน Tauri IPC command เท่านั้น
4. **Token & Secret Protection**: ห้าม log API keys / HF tokens ลงใน stdout/stderr หรือไฟล์ log ธรรมดา
5. **Scoped Modifications**: โค้ดของแต่ละ packet แก้ไขได้เฉพาะไฟล์ใน component (CMP) ที่ประกาศไว้ใน packet เท่านั้น ห้ามแตะไฟล์นอกขอบเขต

---

## ARCH-001: Architectural Invariants & Layering Constraints

### §4 Layer Boundaries & Communication Guard Rails

```
┌────────────────────────────────────────────────────────┐
│  Layer 4: UI Presentation (Vanilla HTML / CSS / JS)     │
└───────────────────────────▲────────────────────────────┘
                            │ Tauri IPC (invoke / emit)
┌───────────────────────────▼────────────────────────────┐
│  Layer 3: Contract / Route (Tauri Command Handlers)    │
└───────────────────────────▲────────────────────────────┘
                            │ Rust In-Memory Function Calls
┌───────────────────────────▼────────────────────────────┐
│  Layer 2: Service Logic (Rust Domain Engines)          │
└───────────────────────────▲────────────────────────────┘
                            │ Rust Typed Structs / DTOs
┌───────────────────────────▼────────────────────────────┐
│  Layer 1: Schema / State (AppState, Data Models)       │
└────────────────────────────────────────────────────────┘
            │                                 │
     HTTP / CLI                        HTTP / SSE
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│ External LLM Backends │         │ Python LiteLLM Proxy  │
│ (Ollama, vLLM, GGUF)  │         │ Sidecar Process       │
└───────────────────────┘         └───────────────────────┘
```

1. **Downwards Dependency Only**: Layer ด้านบนเรียก Layer ด้านล่างได้เท่านั้น ห้าม Layer ล่าง import หรืออิง Layer บน
2. **IPC Isolation**: UI (Layer 4) ติดต่อ Rust Core (Layer 1-3) ผ่าน Tauri IPC `invoke()` เท่านั้น ห้ามมี custom WebSocket หรือ direct socket ยกเว้นกรณี LiteLLM SSE chat streaming ผ่าน HTTP client
3. **Sidecar Process Decoupling**: LiteLLM รันเป็น child process แยกเด็ดขาด ควบคุม lifecycle ด้วย `std::process::Child` ใน Rust Layer 2
4. **Data Isolation**: UI รับเฉพาะ `UnifiedModel` หรือ sanitized view models ไม่รับ raw JSON จาก external backend ตรงๆ

