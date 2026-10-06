# 🤖 Local LLM Hub

> **One Dashboard. All Your Local LLMs. No Duplicate Loads.**

Local LLM Hub เป็น desktop application (Tauri v2) ที่รวม LLM backend ทุกตัวบนเครื่องของคุณใน UI เดียว พร้อม deduplication engine, model card reader, GPU monitor, chat interface, และ LiteLLM unified proxy

เพิ่ม Python Agent Runtime แยกบริการ: model/capability registry, routing/fallback, isolated sessions, tools/permissions, SQLite memory และ authenticated API โดยเชื่อมกับ desktop แบบ opt-in รายละเอียดและข้อจำกัดอยู่ใน [verification report](docs/architecture/VERIFICATION.md)

## Agent runtime quick start

ใช้ Python 3.11+ และ uv จาก source checkout นี้ ไม่ต้องมี GPU สำหรับ mock mode:

```powershell
uv sync --locked
uv run --locked local-llm-hub init
uv run --locked local-llm-hub check
uv run --locked local-llm-hub serve
```

`init` สร้าง token ใน `.env` และไม่เขียนทับไฟล์เดิม บริการฟังที่ `127.0.0.1:8787` เปิด PowerShell อีกหน้าต่างใน checkout เดิมแล้วเรียก:

```powershell
$hubToken = (Get-Content .env | Where-Object { $_ -like 'LOCAL_LLM_HUB_TOKEN=*' }).Split('=', 2)[1]
$hubHeaders = @{ Authorization = "Bearer $hubToken" }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/v1/agents/assistant/run `
  -Headers $hubHeaders -ContentType application/json -Body '{"input":"echo:hello from hub"}'
```

ผลลัพธ์มี `output: hello from hub` และ model `mock-local` หากใช้ curl ให้ส่ง JSON เดียวกันไปที่ URL นี้พร้อม Bearer token เช่น `curl.exe --config -` เพื่อรับ header จาก stdin ตามตัวอย่างที่ทดสอบใน verification report

```powershell
uv run --locked local-llm-hub evaluate
uv run --locked pytest -q
```

Default agents: assistant/reviewer อ่านอย่างเดียว, coder เขียนได้เฉพาะ `workspace/`, orchestrator ส่งงานต่อด้วยสิทธิ์ที่ไม่เกินของตัวเอง และ structured ตรวจ JSON Schema ไม่มี shell หรือ HTTP grant ในค่าเริ่มต้น Mock evaluation เป็นการตรวจ runtime contract ไม่ใช่คะแนนคุณภาพ LLM

ดู [architecture](docs/architecture.md), [configuration](docs/configuration.md), [agent runtime](docs/agent-runtime.md), [permissions](docs/permissions.md) และ [deployment/testing](docs/local-deployment.md) สำหรับ real endpoints, API compatibility, Docker และ opt-in Tauri bridge

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗂️ **Unified Model Dashboard** | รวมโมเดลจาก Ollama, vLLM, HuggingFace, GGUF ใน list เดียว |
| 🔍 **Deduplication Engine** | ตรวจจับโมเดลที่เหมือนกันข้ามหลาย backend ไม่ให้โหลดซ้ำ |
| 📋 **Model Card Reader** | อ่าน README.md จาก HuggingFace หรือ local ดู license, tags, capabilities |
| ▶️ **Start / Stop Control** | Start/Stop โมเดลแต่ละ backend จาก UI โดยตรง |
| 📊 **GPU / RAM Monitor** | Real-time VRAM + RAM gauge อัปเดตทุก 2 วินาที |
| 💬 **Built-in Chat** | ทดสอบโมเดลตรงจาก UI ด้วย streaming response |
| 🔀 **LiteLLM Proxy** | Unified OpenAI-compatible endpoint บน `localhost:4000` |

---

## 🏗️ Architecture

```
Tauri v2 (Rust backend + WebView2 frontend)
    ↕ IPC
Rust Commands: probe, list, dedup, model card, GPU stats, LiteLLM sidecar
    ↕ HTTP
Backends: Ollama (:11434) | vLLM (:8000) | HuggingFace | GGUF (local)
    ↕
LiteLLM Proxy (:4000) — Unified OpenAI-compatible gateway
```

---

## 📋 Supported Backends

| Backend | Protocol | Auto-detect |
|---------|----------|-------------|
| **Ollama** | Ollama REST API | ✅ localhost:11434 |
| **vLLM** | OpenAI-compatible | ✅ Configurable URL |
| **HuggingFace TGI** | OpenAI-compatible | ✅ Configurable URL |
| **llama.cpp / GGUF** | File system scan | ✅ Configurable scan paths |

---

## 📦 Prerequisites

- **Windows** 10 v1803+ (WebView2 required)
- **Rust** 1.80+ — `rustup default stable`
- **Node.js** 18+ — for Tauri CLI
- **Python** 3.10+ — for LiteLLM sidecar
- **NVIDIA GPU** + nvidia-smi — for GPU monitoring (optional)

---

## 🚀 Getting Started

```powershell
# Clone / ไปที่ project directory
cd local-llm-hub

# Install Node dependencies
npm install

# Install Python dependencies (LiteLLM sidecar)
pip install litellm uvicorn pyyaml

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [PRD-SDD-v1.0.md](docs/PRD-SDD-v1.0.md) | Product Requirements + Software Design Document |
| [TASKS.md](docs/TASKS.md) | Implementation task list |
| [adr/ARCHITECTURE.md](docs/adr/ARCHITECTURE.md) | Architecture Decision Records |
| [appendices/A-api-spec.md](docs/appendices/A-api-spec.md) | Complete API specification |
| [appendices/C-ai-system.md](docs/appendices/C-ai-system.md) | AI System: backends, dedup, LiteLLM, model cards |
| [appendices/D-traceability.md](docs/appendices/D-traceability.md) | Requirements traceability matrix |
| [appendices/E-risk-matrix.md](docs/appendices/E-risk-matrix.md) | Risk assessment |
| [appendices/F-glossary.md](docs/appendices/F-glossary.md) | Glossary of terms |
| [Harness current-state audit](docs/architecture/CURRENT-STATE.md) | Source-backed audit and measured verification limits |
| [Harness target architecture](docs/architecture/TARGET-ARCHITECTURE.md) | Approved Python/Pydantic AI service design and five scoped ADRs |
| [Harness implementation plan](docs/architecture/IMPLEMENTATION-PLAN.md) | H01-H30 acceptance criteria and incremental scope |
| [Harness verification](docs/architecture/VERIFICATION.md) | Executed checks, version diff and remaining gaps |

The [UAT evidence RCA](.brain/rca/RCA-001-UAT-EVIDENCE.md) records the repaired false-PASS defect. Historical generated persona reports do not establish hardware/UI acceptance; the new harness uses executable assertions.

---

## 🔀 LiteLLM Proxy Usage

เมื่อ toggle LiteLLM ON ใน app, endpoint `http://localhost:4000` พร้อมใช้:

```bash
# List available models
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer sk-local-llm-hub"

# Chat with any model
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-local-llm-hub" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

---

## 📊 Deduplication Example

```
Ollama:  llama3.2:3b-instruct-q4_K_M   ──┐
                                           ├── canonical: "llama3.2 3b instruct"
GGUF:    Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf ──┘
                                              ⚠️ DUPLICATE DETECTED
                                              ✅ PREFERRED: Ollama (highest priority)
```

---

## 📝 License

MIT

---

*Built with ❤️ using Tauri v2, Rust, and Vanilla JS*
