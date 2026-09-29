---
id: FR-013
title: Prompt Presets & System Persona Registry
domain: inference-gateway
owner: Boss
status: implemented
priority: P1
features:
  - FEAT-015
cross_domains:
  - observability
implements_test:
  - TC-FEAT-015-INTEG
---

# FR-013: Prompt Presets & System Persona Registry

## 1. Description
คลังรวบรวม System Prompts และ Persona เฉพาะทาง สำหรับตั้งค่าบริบทให้โมเดลท้องถิ่นแสดงความสามารถเฉพาะด้านได้อย่างเต็มศักยภาพ ทั้งในโหมด Playground Chat และ Multi-Model Arena

## 2. Acceptance Criteria (AC)
- **AC-1**: มี Persona อย่างน้อย 5 บทบาทครอบคลุม:
  - `General Assistant`: ผู้ช่วยทั่วไป
  - `Senior Rust Architect`: เชี่ยวชาญ Tauri v2, Tokio, และ ADR-100 zero panics
  - `Glassmorphic UI Specialist`: เชี่ยวชาญ Modern CSS, glassmorphism, micro-interactions
  - `ADR-100 Code Auditor`: ตรวจจับบั๊ก, memory safety, path traversal
  - `High-Throughput Coder`: สร้างโค้ดตรงไปตรงมา ปราศจากคำพร่ำเพ้อ
- **AC-2**: เชื่อมต่อเข้ากับตัวเลือก Persona Dropdown ในหน้า Arena และ Playground
- **AC-3**: รองรับการส่ง System Prompt เข้าสู่ payload คำสั่ง `send_chat_message`

## 3. Traceability
- **Persona Registry**: [`src/js/personas.js`](../../src/js/personas.js)
- **Arena Integration**: [`src/js/arena.js`](../../src/js/arena.js)
