# ADR-009: Feature Gap Remediation, Client-Side Preflight Token Counting, and Ephemeral LAN Security

| Field | Value |
|---|---|
| **ADR ID** | `ADR-009` |
| **Title** | Feature Gap Remediation, Client-Side Preflight Token Counting, and Ephemeral LAN Security |
| **Status** | Accepted |
| **Date** | 2026-10-02 |
| **Author** | Boss / Antigravity SWE |
| **Relates to** | [GAP-001](../GAP-ANALYSIS.md), [FEAT-023](../domains/inference-gateway/features/FEAT-023-chat-preflight-token-counter.md), [FEAT-024](../domains/network-distribution/features/FEAT-024-lan-ephemeral-pin-auth.md), [FEAT-025](../domains/model-management/features/FEAT-025-model-tag-taxonomy-filter.md) |

---

## 1. Context & Problem Statement

จากการประเมินใน [GAP-001](../GAP-ANALYSIS.md) ระบบ Local LLM Hub มีความสมบูรณ์ด้าน backend core และการทดสอบ 100% แต่ยังมีประเด็นด้าน User Experience, Safety และ LAN Security ที่ต้องตัดสินใจเชิงสถาปัตยกรรม (Architectural Decisions) ก่อนพัฒนาเข้าสู่ Phase 6 (P2 Roadmap):
1. **Preflight Context Overflow in Chat**: ผู้ใช้ที่พิมพ์ prompt ขนาดยาวหรือวาง code snippet ในหน้า Chat อาจส่งข้อความเกิน Context Window (เช่น 4K หรือ 8K) ส่งผลให้ LLM ตอบผิดพลาดหรือตัดตอนโดยไม่แจ้งเตือนล่วงหน้า
2. **Open LAN Sharing Exposure**: ปัจจุบัน Built-in Axum HTTP Streamer อนุญาตให้อุปกรณ์ใน subnet เดียวกันดาวน์โหลดไฟล์โมเดลขนาด 20GB-50GB ได้โดยไม่มีการยืนยันตัวตน หากรันบนเครือข่ายสำนักงานหรือ Wi-Fi สาธารณะ อาจเกิดการแอบดูดไฟล์จน bandwidth ตัน
3. **Model Library Discovery**: คลังโมเดลมีขนาดใหญ่กว่า 50 รายการ หากไม่มี Tag Taxonomy ผู้ใช้จะค้นหาโมเดลสำหรับงานเฉพาะทาง (เช่น Coding vs Reasoning) ได้ยาก

---

## 2. Decision 1: Token Counting Architecture (Client-Side BPE-Heuristic vs WASM Tiktoken)

### Options Considered:
| ตัวเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **Option A: WASM Tiktoken / Tokenizers** | แม่นยำ 100% ตาม vocabulary ของแต่ละโมเดล | เพิ่ม bundle size กว่า 4MB-8MB และต้องโหลด vocab แยกตามตระกูลโมเดล (Llama, Qwen, Gemma) |
| **Option B: Pure Backend IPC Tokenizer** | ไม่เพิ่ม bundle size ใน UI | ต้องยิง IPC ทุก keystroke หรือ debounce ทำให้เปลือง CPU |
| **Option C: Hybrid Client-Side BPE Heuristic + Async IPC** *(Selected)* | Real-time 0ms latency, zero bundle overhead, อัปเดตทันทีขณะพิมพ์ | ค่าที่แสดงล่วงหน้ามีความคลาดเคลื่อน ±5-8% แต่เพียงพอต่อการเตือน safety warning |

### Decision:
เลือก **Option C (Hybrid BPE-Heuristic)**:
- ใช้ JavaScript regex heuristic ในการคำนวณ real-time:
  - ภาษาอังกฤษ / Code: ~3.8-4 ตัวอักษรต่อ 1 token
  - ภาษาไทย / Unicode / CJK: ~1.5-2.0 ตัวอักษรต่อ 1 token
- แสดงสถานะเป็น Visual Gauge: 
  - 🟢 **Safe** (< 70% of context length)
  - 🟡 **Warning** (70% - 90%)
  - 🔴 **Danger / Overflow Warning** (> 90%)

---

## 3. Decision 2: Ephemeral PIN Authentication for LAN Model Streamer

### Options Considered:
| ตัวเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **Option A: Full User Accounts & JWT** | ควบคุมสิทธิ์ได้ระดับ user | ซับซ้อนเกินไป ขัดต่อปรัชญา Local Privacy & Zero-Setup Desktop Tool |
| **Option B: Fixed Password ใน Settings** | ตั้งค่าง่าย | ลืมปิด password อาจถูก brute-force ได้ในระยะยาว |
| **Option C: Ephemeral 4-Digit PIN & Timed Session Token** *(Selected)* | ใช้งานง่าย, ไม่ต้องสร้าง database, ปลอดภัยบน dynamic LAN | ต้องแชร์ PIN ใหม่เมื่อเริ่มเปิด session |

### Decision:
เลือก **Option C (Ephemeral 4-Digit PIN)**:
- เมื่อผู้ใช้กดเปิด "Start LAN Share" ระบบจะสุ่ม PIN 4 หลัก (เช่น `8392`) เก็บใน `AtomicU32` ของ Axum AppState
- ผู้ใช้ปลายทางสามารถใส่ PIN บน Web Portal หรือสแกน QR Code ที่ฝัง parameter `?pin=8392`
- เซิร์ฟเวอร์ตรวจสอบผ่าน HTTP Query Parameter หรือ Header `X-Stream-PIN`
- ป้องกัน Brute-force: ล็อก 60 วินาทีหากใส่ PIN ผิดติดต่อกัน 5 ครั้ง

---

## 4. Decision 3: Model Tag Taxonomy & Faceted Filter in Bento Grid

### Decision:
- กำหนด Tag Taxonomy 5 หมวดหมู่หลัก:
  1. `🏷️ Coding` (เช่น Qwen-Coder, DeepSeek-Coder, Aroow-Rust)
  2. `🧠 Reasoning` (เช่น Mellum2-Thinking, Qwen-Thinking)
  3. `💬 General Chat` (เช่น Llama-3-Instruct, Gemma-2-IT)
  4. `👁️ Vision & Multimodal` (เช่น Llama-3.2-Vision, Qwen2-VL)
  5. `📐 Lightweight & Edge` (<= 3B parameters)
- Tag Classification ทำงานแบบ In-Memory บน `UnifiedModel` โดยอนุมานจากชื่อและ metadata ไม่กระทบ Business Rules `BR-001` และ `BR-002`

---

## 5. Consequences & Compliance
- สถาปัตยกรรมยังคงปฏิบัติตาม **ADR-100 (Zero-Panic)** และ **ARCH-001 (Layer Separation)** อย่างเคร่งครัด
- ความเร็วในการโหลดหน้าต่าง Bento UI ยังคงอยู่ในเกณฑ์ < 16ms (60 FPS)
