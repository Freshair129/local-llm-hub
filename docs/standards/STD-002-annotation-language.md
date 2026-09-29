# STD-002 — Source Code Annotation & Traceability Standard

| Field | Value |
|---|---|
| **Standard ID** | STD-002 |
| **Title** | Source Code Traceability Annotation Language Standard |
| **Version** | 1.0.0 |
| **Status** | Active / Normative |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **Scope** | Repository-wide mandatory code traceability standard |
| **Detailed Specification** | [ANN-001-annotation-language.md](../annotations/ANN-001-annotation-language.md) |

---

## 1. Scope & Purpose (ขอบเขตและวัตถุประสงค์)

มาตรฐานฉบับนี้กำหนดไวยากรณ์ (Syntax) และกฎการเขียน Annotation ใน Comment ของซอร์สโค้ดทุกภาษาในโปรเจกต์ เพื่อเชื่อมโยงชิ้นส่วนของโค้ดและเทสต์เข้ากับ Requirement ID โดยตรง ทำให้สามารถตรวจสอบย้อนกลับ (Traceability) ได้แบบอัตโนมัติ

---

## 2. ข้อกำหนดทางไวยากรณ์ (Core Syntax Rules)

### 2.1 ตำแหน่งของ Annotation
คอมเมนต์ `// trace:` ต้องวางอยู่ **ทันทีก่อนบรรทัดประกาศ** Function, Struct, Class หรือ Test Case โดยตรง ห้ามมีบรรทัดว่างคั่น

### 2.2 แท็กหลัก 3 ประเภท:
1. `// trace:implements <REQ-ID>` : ระบุว่าสัญลักษณ์นี้เป็นผู้ลงมือพัฒนาตามข้อกำหนด (เช่น `FR-001`)
2. `// trace:verifies <REQ-ID>` : ระบุว่าเทสต์เคสนี้ตรวจสอบข้อกำหนด (เช่น `FR-001`)
3. `// trace:depends-on <REQ-ID>` : ระบุการพึ่งพาข้อกำหนดอื่น

---

## 3. เอกสารอ้างอิงฉบับสมบูรณ์ (Normative Reference)

ดูรายละเอียดไวยากรณ์, Parser specification, และตัวอย่างครบทุกภาษาใน:  
➡️ **[ANN-001 — Annotation Language Specification](../annotations/ANN-001-annotation-language.md)**
