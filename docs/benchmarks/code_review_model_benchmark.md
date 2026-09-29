# 🏆 Official Benchmark Report: Local LLM Code Reviewers

**Target File:** `src/main.js` (Tauri v2 Desktop App)
**Methodology:** Tested **one-by-one** with strict GPU VRAM cleanup between models and **official Hugging Face Model Card settings**.
**Hardware:** NVIDIA GeForce RTX 3060 12GB (CUDA0)
**Date:** 2026-09-28T23:35:44.402Z

## 1. ผลการวัดประสิทธิภาพความเร็วและการจัดสรร VRAM

| โมเดลผู้เข้าแข่งขัน (Candidate) | HF Official Settings | ความเร็ว Gen (t/s) | ความเร็ว Prompt (t/s) | Tokens | เวลา (วิ) | การจัดสรร VRAM |
|---|---|:---:|:---:|:---:|:---:|:---:|
| 💎 **Google Gemma 4 12B Instruct (Unsloth UD)** | `temp=0.6, p=0.95, rep=1.1` | **35.8 t/s** | **107.1 t/s** | 1200 | **84.59s** | 8.05 GB VRAM |
| 💎 **Qwen 3.6 12B IQ-Ultra Thinking V2** | `temp=0.6, p=0.95, rep=1.1` | **41.9 t/s** | **1307.2 t/s** | 1146 | **56.29s** | 6.89 GB VRAM |
| 🌟 **Qwen 3.6 14B-A3B FableVibes** | `temp=0.6, p=0.95, rep=1.1` | **69.7 t/s** | **1253.0 t/s** | 1200 | **54.73s** | 8.61 GB VRAM |
| **JetBrains Mellum2 12B Thinking** | `temp=0.6, p=0.95, rep=1.1` | **130.2 t/s** | **1641.5 t/s** | 2048 | **44.80s** | 8.11 GB VRAM |
| **JetBrains Mellum2 12B Instruct** | `temp=0.6, p=0.95, rep=1.1` | **132.4 t/s** | 1875.5 t/s | 1200 | 18.42s | 8.11 GB VRAM |
| **Qwen 3.5 9B Sushi Coder RL** | `temp=0, p=1, rep=1` | **53.9 t/s** | 93.4 t/s | 1200 | 48.91s | 5.59 GB VRAM |
| **Aroow Rust Coder 9B (Systems)** | `temp=0.2, p=0.9, rep=1.05` | **53.2 t/s** | 202.6 t/s | 639 | 38.76s | 5.05 GB VRAM |
| **Qwythos 9B Claude-Mythos (Reasoning)** | `temp=0.6, p=0.95, rep=1.05` | **51.3 t/s** | 1267.3 t/s | 1200 | 51.62s | 5.59 GB VRAM |

## 2. การวิเคราะห์จุดเด่นของแต่ละโมเดล (Review Strengths & Specialization)

1. 🥇 **JetBrains Mellum2 12B Thinking (MoE 2.5B Active):**
   - **จุดเด่น:** ให้ผลการรีวิวในระดับสถาปัตยกรรม (Architectural Level) ละเอียดที่สุด สามารถตรวจจับเรื่อง Concurrency และ Race Condition ได้ดีเยี่ยม
   - **ความเร็ว:** รวดเร็วมากถึง **130.2 t/s** บน RTX 3060 CUDA (MoE 2.5B Active) และอ่าน Prompt เร็วถึง 1,641.5 t/s

2. ⚡ **JetBrains Mellum2 12B Instruct (MoE 2.5B Active):**
   - **จุดเด่น:** ชี้จุดบั๊กที่มีผลกับ User Experience โดยตรง เช่น State Corruption ในบล็อก try/catch, UI thread blocking จาก alert() และแนะนำโค้ดแก้ทันที
   - **ความเร็ว:** รวดเร็วมาก รันบน GPU ได้อย่างสมบูรณ์แบบ

3. 🍣 **Qwen 3.5 9B Sushi Coder RL (Reinforcement Learning Tuned):**
   - **จุดเด่น:** Setting ทางการบน HF แนะนำ `temperature: 0.0` ให้คำตอบแบบ Deterministic สูงมาก จับประเด็นเรื่อง Null Safety และการประกาศตัวแปรอย่างแม่นยำ

4. 🦀 **Aroow Rust Coder 9B (Systems & IPC Specialist):**
   - **จุดเด่น:** เชี่ยวชาญการมองหาความเสี่ยงตรงรอยต่อของ IPC Commands ระหว่าง Rust Backend และ JavaScript Frontend

5. 🧠 **Qwythos 9B Claude-Mythos (1M Context Distill):**
   - **จุดเด่น:** สไตล์การเขียนคำอธิบายเป็นธรรมชาติ มีการจัดลำดับหัวข้อและวิเคราะห์เชิงลึกคล้ายตระกูล Claude

6. 🌟 **Qwen 3.6 14B-A3B FableVibes (MoE 3B Active):**
   - **จุดเด่น:** โมเดลขนาด 14B รันบน RTX 3060 ได้อย่างราบรื่น (ใช้ VRAM 8.61 GB) วิเคราะห์ปัญหาเรื่อง Input Sanitization, Error Masking และ Race Condition ของปุ่มกดได้อย่างละเอียด
   - **ความเร็ว:** ทำได้ถึง **69.7 t/s** (Prompt: **1,253.0 t/s**) ด้วยเทคนิค MoE 3B Active + MXFP4

7. 🧠 **Qwen 3.6 12B IQ-Ultra Thinking V2 (Dense 12B):**
   - **จุดเด่น:** ใช้ VRAM 6.89 GB รันบน RTX 3060 ด้วยความเร็วสม่ำเสมอที่ **41.9 t/s** (Prompt เร็วถึง **1,307.2 t/s**)
   - **ความคมชัด:** โดดเด่นด้านการวิเคราะห์ความสอดคล้องของ Event Handlers และ Lifecycle

8. 💎 **Google Gemma 4 12B Instruct (Unsloth UD-Q4_K_XL):**
   - **จุดเด่น:** รีวิวได้ตรงจุดเชิงวิศวกรรมซอฟต์แวร์ระดับ Senior มากที่สุด ชี้ปัญหาเรื่อง `main.js` กำลังกลายเป็น "God Object" แนะนำ State Container แบบรวมศูนย์ และตักเตือนเรื่อง Hardcoded path `'models/gguf'`
   - **ความเร็ว:** รันที่ **35.8 t/s** (VRAM: 8.05 GB) ด้วยน้ำหนักเต็มพิกัด Dense 12B แท้ๆ

## 3. สรุปโมเดลที่ทำหน้าที่รีวิวโค้ดได้ดีที่สุด (Final Verdict)

- 🏆 **อันดับ 1 สำหรับรีวิวระดับสถาปัตยกรรมเชิงลึก (Best Architectural Reviewer):** `JetBrains Mellum2 12B Thinking` (เร็วถึง 130.2 t/s และคิดลึกที่สุด)
- ⚡ **อันดับ 1 สำหรับรีวิวแก้บั๊กเร่งด่วน (Fastest & Most Practical):** `JetBrains Mellum2 12B Instruct` (เร็วสุด 132.4 t/s ใน 18 วิ)
- 💎 **อันดับ 1 สำหรับคำแนะนำเชิง Best Practices & Clean Code (Best Senior Engineering Critique):** `Google Gemma 4 12B Instruct (Unsloth)`
- 🌟 **อันดับ 1 สำหรับโมเดลขนาดใหญ่สุดที่ VRAM รับไหว (Best Large Model on 12GB):** `Qwen 3.6 14B-A3B FableVibes` (รันได้ 69.7 t/s)
