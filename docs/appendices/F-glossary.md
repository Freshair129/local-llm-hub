# Appendix F — Glossary

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Created** | 2026-09-28 |

---

## Terms

| Term | Definition |
|------|-----------|
| **Backend** | Service ที่ทำ LLM inference (Ollama, vLLM, HF, llama.cpp) |
| **Canonical Name** | ชื่อโมเดลที่ผ่าน normalization แล้ว ใช้สำหรับ deduplication |
| **GGUF** | GPT-Generated Unified Format — file format สำหรับ quantized LLM weights ที่ใช้โดย llama.cpp |
| **Deduplication (Dedup)** | กระบวนการตรวจจับโมเดลที่เหมือนกันข้ามหลาย backend |
| **LiteLLM** | Open-source Python library/proxy ที่แปลง backend ต่างๆ เป็น OpenAI-compatible API |
| **Model Card** | เอกสาร README ของโมเดลที่บอก license, capabilities, limitations |
| **nvidia-smi** | NVIDIA System Management Interface — CLI tool สำหรับ query GPU status |
| **OpenAI-compatible** | API ที่มี format เหมือน OpenAI API (`/v1/chat/completions`) ทำให้ client เดิมใช้ได้ทันที |
| **Probe** | การ ping HTTP endpoint เพื่อตรวจสอบว่า backend online/offline |
| **Quantization** | การลด precision ของ model weights (เช่น FP32→INT4) เพื่อลด VRAM ที่ใช้ |
| **Sidecar** | Process แยกที่ Tauri spawn และ manage lifecycle ให้ (LiteLLM Python process) |
| **SSE** | Server-Sent Events — protocol สำหรับ streaming text จาก server ไปยัง browser |
| **Tauri IPC** | Inter-Process Communication ระหว่าง WebView frontend และ Rust backend ใน Tauri |
| **VRAM** | Video RAM — memory บน GPU ที่ใช้ load model weights |
| **WebView2** | Windows component ที่ Tauri ใช้ render frontend (based on Chromium) |
| **HTTP Range Requests** | กลไก HTTP 206 Partial Content สำหรับสตรีมและดาวน์โหลดไฟล์ GGUF ขนาดใหญ่แบบ Pause/Resume |
| **MoE** | Mixture-of-Experts — สถาปัตยกรรมโมเดลที่มีพารามิเตอร์รวมสูงแต่เปิดใช้เฉพาะ Active Experts (เช่น Mellum2 12B/2.5B) |
| **TPS** | Tokens Per Second — ความเร็วในการสร้างข้อความคำตอบของโมเดล |
| **TTFT** | Time To First Token — เวลาแฝงตั้งแต่ส่ง Prompt จนโมเดลเริ่มสตรีมโทเค็นแรกกลับมา |

## Abbreviations

| Abbrev | Full Form |
|--------|-----------|
| HF | HuggingFace |
| LLM | Large Language Model |
| API | Application Programming Interface |
| IPC | Inter-Process Communication |
| GPU | Graphics Processing Unit |
| RAM | Random Access Memory |
| PRD | Product Requirements Document |
| SDD | Software Design Document |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| BR | Business Rule |
| AC | Acceptance Criteria |
| ADR | Architecture Decision Record |
| STD | Engineering Standard |
| ANN | Code Annotation Language Specification |
| MoE | Mixture-of-Experts |
