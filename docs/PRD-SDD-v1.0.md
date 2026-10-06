# Local LLM Hub — Product Requirements & Software Design Document

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Boss (suanranger129@gmail.com) |
| **Created** | 2026-09-28 |
| **Last Updated** | 2026-09-28 |
| **Approved By** | — |

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-09-28 | Boss | Initial creation |

## Referenced Standards

- IEEE 29148-2018 (Requirements Engineering)
- IEEE 1016-2009 (Software Design Description)
- ISO/IEC 42001 (AI Management System)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Business Rules](#6-business-rules)
7. [Acceptance Criteria](#7-acceptance-criteria)
8. [Architecture Overview](#8-architecture-overview)
9. [Component Design](#9-component-design)
10. [Data Models](#10-data-models)
11. [API Interfaces](#11-api-interfaces)
12. [Error Handling](#12-error-handling)
13. [Security Considerations](#13-security-considerations)
14. [Testing Strategy](#14-testing-strategy)

---

# Layer 1 — Product Requirements

## 1. Executive Summary

**Local LLM Hub** เป็น desktop application (Tauri v2) ที่ทำหน้าที่เป็น **unified control plane** สำหรับจัดการ Large Language Model จากหลาย backend บนเครื่องเดียวกัน โดยไม่ต้องเปิดหลาย terminal หรือโหลดโมเดลซ้ำซ้อน

### ปัญหาที่แก้ไข

| ปัญหา | ปัจจุบัน | Local LLM Hub |
|-------|---------|---------------|
| โมเดลกระจายหลาย backend | เปิดหลาย terminal แยกกัน | Dashboard เดียวรวมทุก backend |
| โหลดโมเดลซ้ำ | ไม่รู้ว่า llama3.2 โหลดอยู่ใน Ollama แล้ว | Dedup engine ตรวจจับและแจ้งเตือน |
| ไม่รู้ข้อมูลโมเดล | ต้อง google หา model card | อ่าน Model Card จาก HuggingFace / local |
| ไม่มี unified endpoint | แต่ละ backend มี API format ต่างกัน | LiteLLM proxy รวมเป็น OpenAI-compatible |
| ไม่รู้ GPU/RAM ที่ใช้ | ต้องเปิด Task Manager แยก | Real-time GPU/RAM monitor |

### Vision Statement

> "หนึ่ง Dashboard รวมทุก LLM backend — เห็นทุกโมเดล ไม่โหลดซ้ำ คุยได้ทันที"

---

## 2. Goals & Non-Goals

### Goals ✅

- รวม **Ollama, vLLM, HuggingFace Transformers, llama.cpp/GGUF** ใน UI เดียว
- ตรวจจับและแสดง **duplicate models** ข้ามหลาย backend
- อ่านและแสดง **Model Card** (README.md จาก HuggingFace หรือ local)
- Start/Stop โมเดลแต่ละ backend จาก UI
- แสดง **GPU VRAM / RAM usage** แบบ real-time
- **Chat/Test** กับโมเดลตรงจาก UI ผ่าน LiteLLM proxy
- เปิด **LiteLLM** เป็น unified proxy (port 4000) สำหรับ app อื่นใช้ต่อ

### Non-Goals ❌

- ไม่รองรับ cloud LLM (OpenAI, Anthropic, Gemini) ในเวอร์ชัน 1.0
- ไม่มีระบบ fine-tuning หรือ training โมเดล
- ไม่มี multi-user / authentication
- ไม่รองรับ macOS / Linux ในเวอร์ชัน 1.0 (Windows เท่านั้น)
- ไม่รองรับ distributed/remote backends

---

## 3. User Stories

### US-001 — ภาพรวม Dashboard
**As a** developer ที่รัน LLM หลาย backend,  
**I want to** เห็นสถานะทุก backend และโมเดลทั้งหมดในหน้าเดียว,  
**So that** ฉันไม่ต้องสลับหลาย terminal เพื่อตรวจสอบ

### US-002 — ป้องกัน Duplicate Load
**As a** developer ที่มี RAM/VRAM จำกัด,  
**I want to** รู้ว่าโมเดลไหน load ซ้ำกันข้ามหลาย backend,  
**So that** ฉันหยุด backend ที่ซ้ำและประหยัด memory ได้

### US-003 — Model Card Reader
**As a** developer ที่ต้องการเลือกโมเดล,  
**I want to** ดูข้อมูล license, parameter count, quantization, และ use-case ของโมเดล,  
**So that** ฉันเลือกโมเดลที่เหมาะสมได้โดยไม่ต้องออกจาก app

### US-004 — Start/Stop Control
**As a** developer,  
**I want to** start/stop โมเดลหรือ backend service จาก UI,  
**So that** ฉันจัดการ resource ได้ง่ายโดยไม่ต้องพิมพ์ command

### US-005 — GPU/RAM Monitor
**As a** developer ที่มี GPU จำกัด,  
**I want to** เห็น VRAM ที่ใช้อยู่และ RAM usage แบบ real-time,  
**So that** ฉันวางแผนได้ว่าจะ load โมเดลเพิ่มได้อีกไหม

### US-006 — Chat Interface
**As a** developer ที่ต้องการทดสอบโมเดล,  
**I want to** คุยกับโมเดลใดก็ได้จาก UI โดยตรง,  
**So that** ฉันทดสอบ response quality ได้ทันทีโดยไม่ต้องเขียน code

### US-007 — LiteLLM Proxy
**As a** developer ที่มี app อื่นต้องการใช้ LLM,  
**I want to** เปิด unified API endpoint (OpenAI-compatible) ที่ route ไปยัง backend ที่เหมาะสม,  
**So that** app ของฉันเรียก `localhost:4000` ได้โดยไม่ต้อง hardcode backend แต่ละตัว

### US-008 — LAN Model & Drive Sharing
**As a** developer ที่มีอุปกรณ์หลายเครื่องในบ้าน/ออฟฟิศ (Laptop, Dev PC, Worker Node),  
**I want to** แชร์โฟลเดอร์โมเดลหรือไดรฟ์ผ่านเครือข่ายวงแลน (LAN) ด้วย HTTP File Streaming และ QR Code,  
**So that** เครื่องอื่นสามารถดึงหรือสตรีมโมเดลขนาดใหญ่ไปใช้งานได้โดยไม่ต้องดาวน์โหลดซ้ำจากอินเทอร์เน็ต

---

## 4. Functional Requirements

### FR-001 Backend Discovery
**WHEN** application เริ่มต้น **THEN** system SHALL probe ทุก backend URL ที่ configured และแสดงสถานะ online/offline

**WHEN** user กด Refresh **THEN** system SHALL re-probe ทุก backend ภายใน 5 วินาที

### FR-002 Model Aggregation
**WHEN** backend อยู่ใน online state **THEN** system SHALL ดึงรายการ models จาก backend นั้นและแสดงใน unified list

**WHEN** model list ได้รับ **THEN** system SHALL normalize model names และ fingerprint เพื่อตรวจจับ duplicates

### FR-003 Duplicate Detection
**WHEN** model ชื่อเดียวกัน (หลัง normalize) พบในมากกว่า 1 backend **THEN** system SHALL แสดง duplicate badge บนทั้งสองรายการ

**WHEN** duplicate ถูกตรวจพบ **THEN** system SHALL แนะนำ preferred backend ตาม priority: Ollama > vLLM > GGUF > HF

### FR-004 Model Card Display
**WHEN** user คลิกโมเดล **THEN** system SHALL เปิด model card drawer แสดงข้อมูล metadata

**WHEN** โมเดลอยู่ใน HuggingFace **THEN** system SHALL fetch README.md จาก HuggingFace API

**WHEN** โมเดลเป็น GGUF local file **THEN** system SHALL หา README.md หรือ modelcard.md ใน folder เดียวกัน

**IF** ไม่พบ model card **THEN** system SHALL แสดง basic metadata (size, quantization, path)

### FR-005 Model Control
**WHEN** user กด Start บนโมเดล Ollama **THEN** system SHALL ส่ง `ollama run {model}` command

**WHEN** user กด Stop บน running model **THEN** system SHALL ส่ง stop/unload command ไปยัง backend นั้น

### FR-006 GPU/RAM Monitoring
**WHEN** monitor page เปิดอยู่ **THEN** system SHALL poll nvidia-smi ทุก 2 วินาทีและ update gauges

**WHEN** VRAM usage เกิน 90% **THEN** system SHALL แสดง warning notification

### FR-007 Chat Interface
**WHEN** user เลือกโมเดลและพิมพ์ message **THEN** system SHALL ส่ง request ผ่าน LiteLLM proxy และ stream response

**WHEN** streaming response รับอยู่ **THEN** system SHALL render markdown ใน chat bubble แบบ real-time

### FR-008 LiteLLM Proxy Management
**WHEN** user เปิด LiteLLM toggle **THEN** system SHALL spawn Python sidecar ด้วย auto-generated config.yaml

**WHEN** LiteLLM พร้อม **THEN** system SHALL แสดง endpoint URL ที่ copy ได้ (`localhost:4000`)

**WHEN** backend config เปลี่ยน **THEN** system SHALL regenerate LiteLLM config และ restart sidecar

### FR-009 GGUF File Scanner
**WHEN** user กำหนด scan directory **THEN** system SHALL scan หาไฟล์ `.gguf` recursively และแสดงใน model list

### FR-010 LAN Folder & Drive Sharing
**WHEN** user เปิดใช้งาน LAN Share **THEN** system SHALL สตาร์ต HTTP File/Model Server บน Local IP ประจำเครื่องเพื่อแชร์ไดเรกทอรีโมเดลหรือไดรฟ์ที่กำหนด

**WHEN** อุปกรณ์ภายนอกในวงแลนดาวน์โหลดโมเดล **THEN** system SHALL รองรับ HTTP Range Requests (Resume download) และบังคับใช้ Read-Only Mode เป็นค่าเริ่มต้นเพื่อความปลอดภัย

### FR-024 VRAM Model Advisor & GPU Benchmark Comparison
**WHEN** ผู้ใช้เลือกขนาด VRAM หรือรุ่น GPU **THEN** system SHALL แสดง benchmark profiles ที่มีหลักฐาน provenance พร้อมแยกข้อมูลที่วัดจริงออกจากการประเมิน capacity

**WHEN** ผู้ใช้เลือก GPUs เปรียบเทียบ **THEN** system SHALL รองรับได้สูงสุด 6 variants แสดงช่องที่ไม่มีผลทดสอบ และตรวจว่า model weights, suite, runtime, options, stage และ seeds ตรงกันก่อนสรุปผลเปรียบเทียบ

**IF** เงื่อนไขข้างต้นไม่ตรงกันหรือมีการ offload **THEN** system SHALL แสดงข้อจำกัดและงด claim ผู้ชนะหรือ full-GPU capacity

---

## 5. Non-Functional Requirements

### NFR-001 Performance
- Application เริ่มต้น (cold start) ภายใน **3 วินาที**
- Backend probe timeout ไม่เกิน **5 วินาที** ต่อ backend
- Chat streaming latency (time to first token) ไม่เกิน **500ms** หลัง backend respond
- GPU stats refresh rate: **2 วินาที** (configurable 1-10s)
- Model list render ต้องรองรับ **500+ models** โดยไม่ jank (virtual scroll)

### NFR-002 Reliability
- ถ้า backend offline, app SHALL ยังทำงานได้ (graceful degradation)
- LiteLLM sidecar crash SHALL trigger auto-restart ไม่เกิน 3 ครั้ง
- ข้อมูล backend config SHALL persist ระหว่าง app restart

### NFR-003 Usability
- ทุก action มี loading state และ error feedback
- Dark mode เป็น default (developer audience)
- รองรับ keyboard navigation เต็มรูปแบบ
- Tooltip บน icon ทุกตัว

### NFR-004 Security
- ไม่ส่ง data ออก internet โดยไม่ขอ permission (except HuggingFace model card fetch)
- HF token เก็บใน OS secure store ไม่เก็บใน plaintext config

### NFR-005 Compatibility
- Windows 10 v1803+ (WebView2 required)
- NVIDIA GPU: nvidia-smi ต้องติดตั้ง
- Python 3.10+ สำหรับ LiteLLM sidecar

---

## 6. Business Rules

### BR-001 Backend Priority Order
เมื่อโมเดล duplicate ข้าม backend ให้ prefer ตาม order: **Ollama → vLLM → GGUF/llama.cpp → HuggingFace**

เหตุผล: Ollama มี memory management ดีที่สุดสำหรับ consumer GPU, vLLM เหมาะสำหรับ throughput สูง, GGUF ยืดหยุ่นที่สุด, HF ช้าที่สุดสำหรับ inference

### BR-002 Model Name Normalization
ชื่อโมเดลต้องผ่าน normalization ก่อน dedup:
1. lowercase ทั้งหมด
2. ลบ quantization suffix: `q4_k_m`, `q8_0`, `f16`, `gguf`, `ggml`
3. แทนที่ `_` และ `-` ด้วย space, trim
4. ลบ version tags: `:latest`, `:v1.0`

ตัวอย่าง: `Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf` → `meta llama 3.2 3b instruct`

### BR-003 LiteLLM Auto-Config
LiteLLM config.yaml ต้องถูก generate อัตโนมัติจาก detected backends:
- Ollama models → `ollama/{model_name}` prefix
- vLLM → `openai/{model_name}` ด้วย custom base_url
- GGUF → `llamacpp/{file_path}`

### BR-004 VRAM Warning Threshold
Warning แสดงเมื่อ VRAM usage > 90% ของ total VRAM ที่มี

---

## 7. Acceptance Criteria

### AC-001 Backend Discovery
- **Given** Ollama กำลัง run บน localhost:11434  
  **When** app เริ่มต้น  
  **Then** Ollama card แสดงสถานะ "Online" ภายใน 5 วินาที

- **Given** vLLM ไม่ได้ run  
  **When** app probe vLLM URL  
  **Then** vLLM card แสดงสถานะ "Offline" พร้อม error message

### AC-002 Duplicate Detection
- **Given** llama3.2:3b load ใน Ollama และ llama-3.2-3b.gguf อยู่ใน GGUF folder  
  **When** app aggregate models  
  **Then** ทั้งสองแสดง "Duplicate" badge สีเหลือง และ Ollama ถูก mark ว่า Preferred

### AC-003 Model Card
- **Given** user คลิก `llama3.2:3b` ใน Ollama  
  **When** drawer เปิด  
  **Then** drawer แสดง model card จาก `https://huggingface.co/meta-llama/Llama-3.2-3B` ภายใน 3 วินาที

### AC-004 Chat Streaming
- **Given** user เลือก model และพิมพ์ "Hello"  
  **When** ส่ง message  
  **Then** เห็น typing indicator แล้ว response stream เข้ามา character-by-character

### AC-005 GPU Monitor
- **Given** มี NVIDIA GPU  
  **When** เปิด Monitor page  
  **Then** เห็น VRAM gauge อัปเดตทุก 2 วินาที

### AC-006 LiteLLM Proxy
- **Given** Ollama มีโมเดล llama3.2:3b  
  **When** user toggle LiteLLM ON  
  **Then** `curl http://localhost:4000/v1/models` คืน model list ที่รวม llama3.2:3b

---

# Layer 2 — Software Design

## 8. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tauri v2 Application                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Frontend (WebView2)                     │   │
│  │                                                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │Dashboard │ │ Models   │ │  Chat    │ │ Monitor  │  │   │
│  │  │  Page    │ │  Page    │ │  Page    │ │  Page    │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │          JS Store (Reactive State)               │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └───────────────────────┬─────────────────────────────────┘   │
│                          │ Tauri IPC (invoke/emit)              │
│  ┌───────────────────────▼─────────────────────────────────┐   │
│  │                  Rust Backend                            │   │
│  │                                                         │   │
│  │  probe_backends()   list_all_models()   get_gpu_stats() │   │
│  │  read_model_card()  start_model()       stop_model()    │   │
│  │  start_litellm()    stop_litellm()      scan_gguf()     │   │
│  └───────┬──────────┬──────────┬──────────┬───────────────┘   │
│          │          │          │           │                    │
└──────────┼──────────┼──────────┼───────────┼────────────────────┘
           │          │          │           │
     ┌─────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌────▼────────┐
     │ Ollama │ │  vLLM  │ │  HF    │ │ LiteLLM     │
     │ :11434 │ │ :8000  │ │  API   │ │ sidecar     │
     └────────┘ └────────┘ └────────┘ │ :4000       │
                                       └─────────────┘
                                              │
                               ┌──────────────┼──────────┐
                               │              │          │
                         ┌─────▼──┐    ┌──────▼─┐ ┌────▼───┐
                         │ Ollama │    │  vLLM  │ │  GGUF  │
                         └────────┘    └────────┘ └────────┘
```

### Technology Decisions

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Tauri v2 (Rust) | ขนาดเล็ก, native performance, secure IPC |
| Frontend | Vanilla HTML/CSS/JS | ไม่ต้องการ framework overhead, full control |
| CSS | Dark glassmorphism design system | Developer aesthetic, modern look |
| HTTP Client (Rust) | `reqwest` (async) | Standard async HTTP สำหรับ Rust |
| State | Tauri `Mutex<AppState>` | Thread-safe shared state |
| LLM Proxy | LiteLLM Python sidecar | Mature, supports 100+ backends, OpenAI-compatible |
| GPU stats | nvidia-smi XML parsing | Standard tool ทุก NVIDIA GPU รองรับ |
| Model dedup | Rust string normalization | Zero-dependency, fast |

---

## 9. Component Design

### 9.1 Frontend Components

#### AppRouter (`src/js/app.js`)
- Handles client-side routing โดยใช้ hash-based navigation (`#/dashboard`, `#/models`, etc.)
- Mount/unmount pages dynamically
- Subscribe to global store updates

#### ReactiveStore (`src/js/store.js`)
```javascript
// State shape
{
  backends: {
    ollama: { status, url, models: [] },
    vllm: { status, url, models: [] },
    hf: { status, models: [] },
    gguf: { status, scanPath, models: [] }
  },
  aggregatedModels: [],   // merged + deduped
  duplicates: Set<canonical_name>,
  activeChats: [],
  gpuStats: { vram_used, vram_total, ram_used, ram_total, gpu_util },
  litellm: { running, pid, endpoint },
  settings: { ... }
}
```

#### ModelCard Component (`src/js/components/modelCard.js`)
- Slide-in drawer animation (right side)
- Parse HF YAML frontmatter (license, language, tags, base_model, datasets)
- Render markdown body ด้วย marked.js
- แสดง backend badges (Ollama, vLLM, GGUF)

#### ChatInterface (`src/js/pages/chat.js`)
- Model selector dropdown
- Message history (virtualized ถ้า > 100 messages)
- SSE (Server-Sent Events) streaming จาก LiteLLM `/v1/chat/completions`
- Markdown render บน assistant messages

#### GPUGauge (`src/js/components/gpuGauge.js`)
- SVG arc gauge, animated ด้วย CSS transitions
- Color bands: green (0-70%), yellow (70-90%), red (90-100%)
- แสดงตัวเลข GB / % พร้อมกัน

### 9.2 Rust Backend Commands

#### `probe_backends` → `ProbeResult[]`
```rust
// Ping แต่ละ backend URL ด้วย timeout 5s
// คืน status: Online/Offline + latency_ms
```

#### `list_all_models` → `UnifiedModel[]`
```rust
// 1. เรียก list จากทุก backend ที่ Online
// 2. normalize ชื่อแต่ละโมเดล
// 3. group by canonical name
// 4. mark duplicates
// คืน UnifiedModel[] sorted by canonical name
```

#### `read_model_card` → `ModelCard`
```rust
// ถ้า backend = HF/Ollama: fetch จาก HuggingFace API
// ถ้า backend = GGUF: อ่าน README.md ใน folder
// Parse YAML frontmatter
// คืน ModelCard { metadata, readme_html }
```

#### `get_gpu_stats` → `GpuStats`
```rust
// รัน: nvidia-smi --query-gpu=... --format=csv,noheader
// Parse output
// คืน vram_used_mb, vram_total_mb, gpu_util_pct, temp_c
```

#### `start_litellm` → `LiteLLMStatus`
```rust
// 1. Generate config.yaml จาก backend state
// 2. ตรวจสอบ python + litellm installed
// 3. spawn: python -m litellm --config config.yaml --port 4000
// 4. Wait health check บน /health
// คืน { running: true, pid, endpoint }
```

### 9.3 LiteLLM Sidecar (`sidecar/litellm_proxy.py`)

```python
# Auto-generates config based on ENV vars ที่ Tauri ส่งมา
# ENV: OLLAMA_URL, VLLM_URL, GGUF_MODELS (JSON array)
# เขียน config.yaml แล้ว start litellm server
```

---

## 10. Data Models

### UnifiedModel
```typescript
interface UnifiedModel {
  id: string;                    // unique across all backends
  canonical_name: string;        // normalized for dedup
  display_name: string;          // original name for display
  backend: 'ollama' | 'vllm' | 'hf' | 'gguf';
  status: 'loaded' | 'available' | 'downloading';
  is_duplicate: boolean;
  is_preferred: boolean;         // true ถ้า highest priority among duplicates
  duplicate_group: string | null;
  size_bytes: number | null;
  quantization: string | null;   // e.g. "Q4_K_M", "F16"
  parameter_count: string | null; // e.g. "3B", "70B"
  context_length: number | null;
  hf_repo_id: string | null;     // for model card fetch
  local_path: string | null;     // for GGUF
}
```

### ModelCard
```typescript
interface ModelCard {
  title: string;
  license: string | null;
  language: string[];
  tags: string[];
  base_model: string | null;
  datasets: string[];
  pipeline_tag: string | null;   // e.g. "text-generation"
  readme_markdown: string;
  readme_html: string;
  hf_url: string | null;
  fetched_at: string;            // ISO timestamp
}
```

### BackendConfig
```typescript
interface BackendConfig {
  ollama: { url: string; enabled: boolean; };
  vllm: { url: string; enabled: boolean; api_key: string | null; };
  hf: { enabled: boolean; token: string | null; cache_dir: string | null; };
  gguf: { enabled: boolean; scan_paths: string[]; };
}
```

### GpuStats
```typescript
interface GpuStats {
  timestamp: string;
  gpus: Array<{
    index: number;
    name: string;
    vram_used_mb: number;
    vram_total_mb: number;
    gpu_util_pct: number;
    temp_c: number;
    power_draw_w: number;
  }>;
  ram_used_gb: number;
  ram_total_gb: number;
}
```

---

## 11. API Interfaces

### Tauri IPC Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `probe_backends` | `BackendConfig` | `ProbeResult[]` | Ping ทุก backend |
| `list_all_models` | — | `UnifiedModel[]` | Aggregate + dedup models |
| `read_model_card` | `{ model_id, backend, hf_repo_id? }` | `ModelCard` | ดึง model card |
| `get_gpu_stats` | — | `GpuStats` | ดึง GPU/RAM stats |
| `start_model` | `{ model_id, backend }` | `{ success, error? }` | Load model |
| `stop_model` | `{ model_id, backend }` | `{ success, error? }` | Unload model |
| `start_litellm` | `BackendConfig` | `LiteLLMStatus` | Start LiteLLM sidecar |
| `stop_litellm` | — | `{ success }` | Stop LiteLLM sidecar |
| `scan_gguf` | `{ paths: string[] }` | `GgufFile[]` | Scan GGUF files |
| `save_settings` | `AppSettings` | `{ success }` | Persist settings |
| `load_settings` | — | `AppSettings` | Load persisted settings |

### LiteLLM Proxy API (forwarded จาก app)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `localhost:4000/v1/models` | GET | List ทุก models ที่ available |
| `localhost:4000/v1/chat/completions` | POST | Chat (streaming SSE) |
| `localhost:4000/health` | GET | Health check |

---

## 12. Error Handling

### Error Categories

| Category | Error | Handling |
|----------|-------|---------|
| Backend | Ollama offline | แสดง "Offline" badge, ไม่ block app |
| Backend | Connection timeout | Retry 1 ครั้ง, แล้ว mark offline |
| Model Card | HF API 404 | แสดง "Model card not found" ใน drawer |
| Model Card | Network error | แสดง cached version หรือ "Unavailable" |
| GPU | nvidia-smi not found | ซ่อน GPU panel, แสดง "GPU monitoring unavailable" |
| LiteLLM | Python not found | แสดง setup guide dialog |
| LiteLLM | Port 4000 occupied | แสดง error + suggest port change |
| LiteLLM | Crash | Auto-restart 3 ครั้ง, แล้ว show error |
| Chat | Stream interrupted | แสดง partial response + "Connection interrupted" |

### Error Message Format
```typescript
interface AppError {
  code: string;      // e.g. "OLLAMA_OFFLINE"
  message: string;   // Human-readable Thai/English
  detail: string;    // Technical detail for debugging
  action: string;    // แนะนำว่าทำอะไรได้บ้าง
}
```

---

## 13. Security Considerations

### SEC-001 Local-Only Default
- Application bind เฉพาะ `localhost` โดย default
- LiteLLM proxy ไม่ expose บน 0.0.0.0 โดยไม่ขอ permission

### SEC-002 HuggingFace Token Storage
- HF API token เก็บใน Windows Credential Manager ผ่าน Tauri keychain plugin
- ไม่เก็บใน plaintext ใน config file

### SEC-003 GGUF Path Validation
- Scan directory ต้อง validate ว่าไม่ใช่ system directory
- ไม่ execute GGUF files โดยตรง, เพียงอ่าน metadata

### SEC-004 LiteLLM Config Sanitization
- Backend URLs ต้อง validate format ก่อน inject เข้า config.yaml
- ป้องกัน path traversal ใน config generation

---

## 14. Testing Strategy

### Unit Tests (Rust)
- `normalize_model_name()` — test cases ครอบคลุม Ollama, HF, GGUF naming patterns
- `dedup_models()` — test duplicate detection ด้วย model sets จาก backends ต่างกัน
- `generate_litellm_config()` — test config generation

### Integration Tests
- Ollama mock server → test probe + list + start/stop
- vLLM mock server → test OpenAI-compatible API
- HF API mock → test model card fetch

### End-to-End Tests
- Full flow: launch app → detect Ollama → list models → open model card → chat

### Manual Test Checklist
- [x] App เริ่มต้น < 3s บน Windows 11
- [x] Ollama online/offline state เปลี่ยนแบบ real-time
- [x] Duplicate detection แสดงถูกต้องกับ llama3.2 ใน Ollama + GGUF
- [x] Model card drawer เปิด/ปิด smooth
- [x] Chat streaming ไม่ lag
- [x] GPU gauge update สม่ำเสมอ
- [x] LiteLLM start/stop ไม่มี orphan process
