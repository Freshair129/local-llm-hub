# Appendix A — API Specification

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **Parent Doc** | [PRD-SDD-v1.0.md](../PRD-SDD-v1.0.md) |

---

## A.1 Tauri IPC Command Reference

ทุก command เรียกจาก frontend ผ่าน `window.__TAURI__.invoke(command, args)`

### `probe_backends`

**Purpose:** ตรวจสอบ online/offline status ของทุก backend

**Input:**
```typescript
interface ProbeInput {
  config: BackendConfig; // URL ของแต่ละ backend
}
```

**Output:**
```typescript
interface ProbeResult {
  backend: 'ollama' | 'vllm' | 'hf' | 'gguf';
  status: 'online' | 'offline' | 'error';
  latency_ms: number | null;
  version: string | null;
  error_message: string | null;
}
// returns ProbeResult[]
```

**Example:**
```javascript
const results = await invoke('probe_backends', { config: appConfig });
// [
//   { backend: 'ollama', status: 'online', latency_ms: 12, version: '0.6.1' },
//   { backend: 'vllm', status: 'offline', latency_ms: null, error_message: 'Connection refused' }
// ]
```

---

### `list_all_models`

**Purpose:** ดึงรายการโมเดลทั้งหมดจากทุก backend ที่ online + dedup

**Input:** ไม่มี (ใช้ AppState ปัจจุบัน)

**Output:**
```typescript
interface UnifiedModel {
  id: string;
  canonical_name: string;
  display_name: string;
  backend: 'ollama' | 'vllm' | 'hf' | 'gguf';
  status: 'loaded' | 'available' | 'downloading';
  is_duplicate: boolean;
  is_preferred: boolean;
  duplicate_group: string | null;
  size_bytes: number | null;
  quantization: string | null;
  parameter_count: string | null;
  context_length: number | null;
  hf_repo_id: string | null;
  local_path: string | null;
  tags: string[];
}
// returns UnifiedModel[]
```

---

### `get_duplicate_groups`

**Purpose:** ดึงรายการกลุ่มโมเดลที่ซ้ำซ้อนกันข้าม Backend พร้อมระบุ Preferred Backend ตาม BR-001

**Input:** ไม่มี

**Output:**
```typescript
interface DuplicateInfo {
  canonical_name: string;
  preferred_backend: string;
  instances: UnifiedModel[];
}
// returns DuplicateInfo[]
```

---

### `scan_directory_for_gguf`

**Purpose:** สแกนโฟลเดอร์หาไฟล์ `.gguf` และถอดรหัสอ่าน metadata จาก binary header โดยไม่ต้องโหลด weights

**Input:**
```typescript
interface ScanGgufArgs {
  path: string; // absolute directory path
}
```

**Output:** `UnifiedModel[]` (เฉพาะโมเดล GGUF ที่พบใหม่)

---

### `get_model_card`

**Purpose:** ดึง Model Card ข้อมูล Markdown และ Metadata ของโมเดล

**Input:**
```typescript
interface GetModelCardArgs {
  model_id: string;
  backend: string; // 'ollama' | 'vllm' | 'hf' | 'gguf'
  local_path?: string;
}
```

**Output:**
```typescript
interface ModelCardInfo {
  id: string;
  title: string;
  license?: string;
  parameters?: string;
  source: string;
  readme_markdown: string;
}
```

---

### `start_model` / `stop_model`

**Purpose:** สั่งให้ Backend โหลดโมเดลเข้าหน่วยความจำ (Keep-Alive) หรือคืนค่าหน่วยความจำ (Unload VRAM)

**Input:**
```typescript
interface ModelControlArgs {
  backend: string;    // 'ollama' | 'vllm' | 'gguf'
  model_name: string;
}
```

**Output:** `string` (ข้อความยืนยันผลการทำงาน เช่น `"Model unloaded successfully"`)

---

### `get_hardware_telemetry`

**Purpose:** ดึงข้อมูลการใช้ VRAM, RAM, อุณหภูมิ GPU และ Load ปัจจุบัน (ทุก 2 วินาที)

**Input:** ไม่มี

**Output:**
```typescript
interface HardwareTelemetry {
  gpu_available: boolean;
  gpu_name: string;
  vram_used_mb: u64;
  vram_total_mb: u64;
  vram_pct: f32;
  gpu_temp_c: u32;
  gpu_util_pct: u32;
  ram_used_mb: u64;
  ram_total_mb: u64;
  ram_pct: f32;
}
```

---

### `send_chat_message`

**Purpose:** ส่งข้อความแชทไปยังโมเดลท้องถิ่นแบบ Real-time พร้อมวัด TPS และ Token Usage

**Input:**
```typescript
interface ChatRequest {
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>;
  backend: string;
  temperature?: number;
  max_tokens?: number;
}
```

**Output:**
```typescript
interface ChatResponse {
  role: string;
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration_ms: number;
  tps: number;
}
```

---

### `generate_proxy_config` / `get_proxy_status`

**Purpose:** สร้างไฟล์คอนฟิก `config.yaml` รวมโมเดลทุกตัวให้ LiteLLM Proxy และตรวจสอบสถานะพอร์ต 4000

**Input:**
```typescript
// generate_proxy_config
{ output_path: string }

// get_proxy_status
{ config_path: string }
```

**Output:**
```typescript
interface ProxyStatus {
  is_running: boolean;
  port: number; // default: 4000
  active_models_count: number;
  config_file_exists: boolean;
}
```

---

### `start_lan_share` / `stop_lan_share` / `get_lan_share_status`

**Purpose:** เปิด/ปิด Built-in HTTP Model Streaming Server สำหรับแชร์ไฟล์ข้ามวงแลน (รองรับ HTTP 206 Range Requests)

**Input:**
```typescript
// start_lan_share
{ root_path: string, port?: number }

// stop_lan_share
{}

// get_lan_share_status
{ current_path: string, port?: number }
```

**Output:**
```typescript
interface LanShareStatus {
  is_running: boolean;
  port: number;
  share_path: string;
  local_ip: string;
  active_streams: number;
  read_only: boolean;
}
```

---

### `record_task_stat` / `get_all_model_stats`

**Purpose:** บันทึกและดึงสถิติความเร็วการประมวลผล (TPS, Token Count, ความสำเร็จ) ของโมเดลแต่ละตัว

**Output:** `HashMap<string, ModelStats>`

---

### `pull_model` (FR-012)

**Purpose:** สั่งให้ Ollama หรือ Backend ทำการ Pull / ดาวน์โหลดโมเดลเข้าเครื่องผ่าน API

**Input:**
```typescript
{ model_name: string }
```

**Output:**
```typescript
Result<string, string> // e.g. "Model 'qwen2.5-coder:7b' successfully downloaded/pulled."
```

---

### `get_app_version` (FR-014)

**Purpose:** ดึงข้อมูลเวอร์ชันปัจจุบัน แพลตฟอร์ม และ Release Channel ของแอป

**Output:**
```typescript
interface AppVersionInfo {
  current_version: string;
  app_name: string;
  target_platform: string;
  release_channel: string;
  git_commit: string;
  build_date: string;
}
```

---

### `check_for_updates` (FR-014)

**Purpose:** ตรวจสอบอัปเดตเวอร์ชันใหม่จาก Manifest หรือ Remote Releases API

**Input:**
```typescript
{ endpoint_override?: string }
```

**Output:**
```typescript
interface UpdateCheckResult {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string | null;
  published_at: string | null;
  is_critical: boolean;
}
```

---

### `apply_update` (FR-014)

**Purpose:** ดาวน์โหลดและเตรียม Staging ไฟล์อัปเดตเพื่อพร้อมสำหรับการ Restart

**Input:**
```typescript
{ download_url: string }
```

**Output:**
```typescript
Result<string, string>
```

---

## A.2 LiteLLM Proxy API

LiteLLM expose OpenAI-compatible API บน configured port (default: 4000)

### List Models

```
GET http://localhost:4000/v1/models
Authorization: Bearer sk-local-llm-hub

Response 200:
{
  "object": "list",
  "data": [
    {
      "id": "llama3.2:3b",
      "object": "model",
      "created": 1748000000,
      "owned_by": "ollama"
    },
    ...
  ]
}
```

### Chat Completion (Streaming)

```
POST http://localhost:4000/v1/chat/completions
Authorization: Bearer sk-local-llm-hub
Content-Type: application/json

{
  "model": "llama3.2:3b",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true,
  "temperature": 0.7,
  "max_tokens": 2048
}

Response (SSE stream):
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hi"},"index":0}]}
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":" there"},"index":0}]}
data: [DONE]
```

### Health Check

```
GET http://localhost:4000/health

Response 200:
{ "status": "healthy" }
```

---

## A.3 External APIs Used

### HuggingFace Hub API

```
GET https://huggingface.co/{org}/{model}/raw/main/README.md
Authorization: Bearer {HF_TOKEN}    # Optional for public models

GET https://huggingface.co/api/models/{org}/{model}
# Returns model metadata JSON
```

### Ollama API

```
GET  http://localhost:11434/api/tags          # List models
POST http://localhost:11434/api/generate      # Load + generate
POST http://localhost:11434/api/chat          # Chat
POST http://localhost:11434/api/show          # Model info
POST http://localhost:11434/api/generate      # Unload: keep_alive=0
GET  http://localhost:11434/api/ps            # Running models
```

### vLLM / OpenAI-Compatible

```
GET  http://{vllm_url}/v1/models
POST http://{vllm_url}/v1/chat/completions
GET  http://{vllm_url}/health
```
