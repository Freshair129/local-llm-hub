# Appendix E — Risk Matrix

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Boss |
| **Created** | 2026-09-28 |

---

## Risk Register

| ID | Risk | Probability | Impact | Score | Mitigation |
|----|------|-------------|--------|-------|-----------|
| R-001 | Python ไม่ได้ติดตั้ง / LiteLLM ติดตั้งไม่สำเร็จ | High | Medium | 🟡 6 | ตรวจสอบ dependencies ตอน startup และแสดง setup guide |
| R-002 | nvidia-smi ไม่พบ (ไม่มี NVIDIA GPU) | Medium | Low | 🟢 3 | Graceful hide GPU panel, ใช้ sysinfo สำหรับ RAM อย่างเดียว |
| R-003 | Ollama API เปลี่ยน format ใน version ใหม่ | Low | High | 🟡 4 | Pin Ollama version ใน docs, version check ตอน probe |
| R-004 | HuggingFace rate limit บน unauthenticated requests | Medium | Medium | 🟡 4 | Cache model cards locally, แนะนำใส่ HF token |
| R-005 | LiteLLM process crash และ zombie process | Medium | High | 🔴 6 | Auto-restart logic, cleanup PID file ตอน app close |
| R-006 | GGUF scan บน large directory ช้ามาก | Low | Medium | 🟢 3 | Background thread, progress indicator, depth limit |
| R-007 | Tauri WebView2 ไม่ support บน Windows รุ่นเก่า | Low | High | 🟡 4 | Document minimum Windows version ใน README |
| R-008 | Port 4000 occupied โดย process อื่น | Medium | Medium | 🟡 4 | Allow custom port ใน settings, detect + suggest alternative |
| R-009 | Model card ขนาดใหญ่มากทำให้ render ช้า | Low | Low | 🟢 2 | Cap render size ที่ 500KB, lazy load images |
| R-010 | vLLM breaking API change | Low | Medium | 🟢 3 | Pin vLLM version ใน docs, ใช้ standard OpenAI compat interface |
| R-011 | VRAM Overflow บน RTX 3060 (12GB) | High | High | 🔴 9 | คัดสรร Sweet Spot (7.0-9.5GB), บังคับ keep_alive=0 eviction และเตือน VRAM 90% |
| R-012 | การดาวน์โหลดไฟล์โมเดล GGUF ข้ามแลนหลุดกลางคัน | Medium | High | 🔴 6 | บังคับใช้ HTTP 206 Range Requests ให้ Resume ดาวน์โหลดต่อได้ |
| R-013 | Path Traversal โจมตีเครื่องโฮสต์ผ่าน LAN Share | Medium | High | 🔴 6 | ตรวจสอบ Whitelist โฟลเดอร์, ปฏิเสธ path ที่มี `..` และบังคับใช้ Read-Only Mode |

**Score = Probability × Impact (1-3 scale each)**

## Mitigation Status

| Risk | Status | Owner | Evidence / Verification |
|------|--------|-------|---|
| R-001 | ✅ Mitigated | System Lead | `sidecar/litellm_proxy.py` fallback & docs |
| R-002 | ✅ Mitigated | System Lead | `commands/gpu.rs` sysinfo RAM fallback |
| R-005 | ✅ Mitigated | System Lead | `commands/proxy.rs` status polling & cleanup |
| R-011 | ✅ Mitigated | System Lead | `test_gpu_monitor.rs` & `MULTI_AGENT_WORKFLOW_SPEC.md` |
| R-012 | ✅ Mitigated | Network Lead | `tests/test_lan_share.rs::test_lan_range_byte_parsing` |
| R-013 | ✅ Mitigated | Security Lead| `tests/test_lan_share.rs::test_lan_directory_traversal_rejection` |
