# STD-004 — Batch-Based Development, Verification, and Release Management Standard

| Field | Value |
|---|---|
| **Standard ID** | STD-004 |
| **Title** | Batch-Based Development, Verification, and Release Management Standard |
| **Version** | 1.0.0 |
| **Status** | Active / Normative |
| **Author** | Boss & Antigravity Core Team |
| **Created** | 2026-09-30 |
| **Scope** | Repository-wide mandatory development, testing, and release workflow |
| **Normative References** | [STD-001](../standards/STD-001-documentation-architecture.md), [STD-003](../standards/STD-003-implementation-unit-and-packet.md), [ROADMAP-MVP.md](../ROADMAP-MVP.md) |

---

## 1. วัตถุประสงค์และที่มา (Scope & Motivation)

ในการพัฒนาซอฟต์แวร์ระบบ **Local LLM Hub** ซึ่งมีทั้งส่วนประกอบ Native Rust Backend, System Tray Lifecycle, และ Web Frontend การดำเนินการ Release (คอมไพล์ Production ด้วย LTO + สร้าง Windows MSI/NSIS Installers) ใช้เวลาในการประมวลผลสูง (3–5 นาทีต่อครั้ง)

หากมีการสร้าง Git Tag หรือรัน Release Build ทุกครั้งที่มีการแก้โค้ดย่อย (Micro-Update) จะก่อให้เกิดปัญหา:
1. **Developer Productivity Loss:** เสียเวลาในการรอ Build Installer ซ้ำซ้อนโดยไม่จำเป็น
2. **Git Tag Pollution:** เกิด Tag ย่อยกระจัดกระจาย ไร้ระเบียบ และยากต่อการบริหารจัดการเวอร์ชัน
3. **High Build Invalidation:** โค้ดที่ยังไม่นิ่งอาจถูกบรรจุลงใน Bundle ตัวติดตั้ง

มาตรฐาน **STD-004** นี้จึงถูกกำหนดขึ้นเพื่อบังคับใช้แนวทางการทำงานแบบ **Batch-Based Development & Milestone Release (รวมงานเป็นชุด แล้วจึงตัด Release)** เพื่อให้การพัฒนารวดเร็ว มีคุณภาพ และมีความเสถียรสูงสุด

---

## 2. ขั้นตอนการทำงาน 4 ระยะ (The 4-Phase Workflow Lifecycle)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Batch Planning (กำหนดชุดงาน & Scope ล่วงหน้า)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 2: Fast-Iterative Dev (พัฒนาบน Dev Mode / ห้าม Tag / ห้าม Build) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 3: Integration & Quality Gate (รัน Unit Tests + Browser E2E)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Phase 4: Milestone Release (ตัด Version + Tauri Build + Git Tag เดียว) │
└────────────────────────────────────────────────────────────────────────┘
```

---

### ระยะที่ 1: การวางแผนและกำหนดชุดงาน (Batch Planning & Scope Definition)
ก่อนเริ่มลงมือเขียนโค้ด ให้รวบรวมงานที่เกี่ยวข้องกันเป็น **1 ชุดงาน (Batch)**:
* **ขนาดชุดงาน:** ประกอบด้วย 2–5 รายการฟีเจอร์หรือการปรับปรุงที่เกี่ยวเนื่องกันในโดเมนเดียวกัน
* **การระบุเป้าหมาย:** กำหนดผลลัพธ์ที่คาดหวัง (Acceptance Criteria) ของทั้งชุดอย่างชัดเจน
* **การบันทึกสถานะ:** ตรวจสอบหรืออัปเดต Backlog ใน `docs/TASKS.md` หรือ `docs/ROADMAP-MVP.md`

---

### ระยะที่ 2: การพัฒนาแบบรวดเร็ว (Fast-Iterative Development)
ระหว่างการเขียนโค้ดและแก้ไขปรับปรุง:
* **รันบน Dev Server:** ใช้งาน Local UI Server (`node scripts/serve_ui.mjs` หรือ `cargo check`) เพื่อให้เห็นการเปลี่ยนแปลงทันที
* **บันทึก Commit ปกติ:** สามารถทำ Git Commit ย่อยเพื่อบันทึกประวัติการทำงานได้ด้วย Conventional Commits (เช่น `feat:`, `fix:`, `refactor:`)
* 🚫 **ข้อห้ามเด็ดขาดในระยะนี้:**
  * **ห้าม** สร้าง Git Tag (`git tag vX.Y.Z`) สำหรับการแก้ไขงานย่อย
  * **ห้าม** รันคำสั่งคอมไพล์ตัวติดตั้งขนาดเต็ม (`npx tauri build`) พร่ำเพรื่อ

---

### ระยะที่ 3: การตรวจสอบคุณภาพแบบรวบยอด (Integration & Quality Gate)
เมื่อพัฒนาฟีเจอร์ในชุดงานครบถ้วนแล้ว ให้ทำการตรวจสอบคุณภาพทั้งระบบพร้อมกัน:
1. **Rust Backend Test Suite:** รัน `cargo test --lib` เพื่อยืนยันว่า Unit Tests ทั้งหมดต้องผ่าน 100% (Zero Failure)
2. **Zero Mock Validation:** ตรวจสอบให้แน่ใจว่าไม่มี Mock Data หรือ Fallback สุ่มตัวเลขหลงเหลือในโค้ด
3. **UI / E2E Verification:** ทดสอบการทำงานจริงบนหน้าจอ ทั้งการแสดงผลและฟังก์ชันการโต้ตอบของผู้ใช้
4. **สรุปรายงานการทดสอบ:** จัดทำสรุปสั้นๆ ถึงผลการทดสอบทุกข้อในชุดงานให้ผู้ใช้ตรวจสอบ

---

### ระยะที่ 4: การตัดเวอร์ชันและปล่อยแพ็กเกจ (Milestone Release & Packaging)
เมื่อผู้ใช้ตรวจสอบและอนุมัติชุดงาน (User Milestone Approval):
1. **อัปเดตเวอร์ชัน:** ปรับเลขเวอร์ชันใน `Cargo.toml`, `package.json`, และ `src-tauri/tauri.conf.json` ให้สอดคล้องกัน (เช่น `v0.1.0` ➔ `v0.2.0`)
2. **คอมไพล์ Production Bundle เพียงครั้งเดียว:**
   ```bash
   npx tauri build --ci
   ```
   เพื่อสร้างไฟล์ติดตั้ง `NSIS Setup (.exe)`, `Windows MSI (.msi)`, และ `Portable Binary` ที่สมบูรณ์
3. **สร้าง Git Tag เดียวสำหรับทั้งชุดงาน:**
   ```bash
   git tag -a vX.Y.Z -m "Release vX.Y.Z: Summary of entire batch milestones"
   git push origin vX.Y.Z
   ```
4. **รายงานผลการส่งมอบ:** แจ้ง Path ไฟล์ติดตั้ง ขนาดไฟล์ และ Changelog ของทั้งชุดงานให้ผู้ใช้ทราบ

---

## 3. กฎเหล็กและข้อควรปฏิบัติ (Do's & Don'ts)

| หมวดหมู่ | ✅ สิ่งที่ต้องทำ (Do's) | ❌ สิ่งที่ห้ามทำ (Don'ts) |
|---|---|---|
| **การตั้ง Tag** | สร้าง Tag เฉพาะเมื่อจบ Milestone ใหญ่ที่มีการส่งมอบครบชุด | **ห้าม** สร้าง Tag ใหม่ทุกครั้งที่แก้บั๊ก 1 จุด หรือแก้ CSS/JS เล็กน้อย |
| **การ Build ติดตั้ง** | รัน `tauri build` เฉพาะใน Phase 4 เมื่อโค้ดทั้งชุดผ่านการเทสต์แล้ว | **ห้าม** รัน `tauri build` ขณะกำลังทดลองหรือแก้โค้ดทีละบรรทัด |
| **การทดสอบ** | ใช้ `cargo test --lib` และ Local Dev Server ในการทดสอบแบบรวดเร็ว | **ห้าม** ข้ามขั้นตอนการทดสอบก่อนส่งมอบงาน |
| **การแจ้งผู้ใช้** | รายงานผลการทำงานและความคืบหน้าของชุดงานเป็นระยะ | **ห้าม** ตัดรอบ Release โดยไม่ได้รับความเห็นชอบจากผู้ใช้ |

---

## 4. บันทึกประวัติเอกสาร (Revision History)

| Version | วันที่ | ผู้ปรับปรุง | สรุปการเปลี่ยนแปลง |
|---|---|---|---|
| `1.0.0` | 2026-09-30 | Boss & AI Assistant | ประกาศใช้มาตรฐาน Batch-Based Development & Milestone Release อย่างเป็นทางการ |
