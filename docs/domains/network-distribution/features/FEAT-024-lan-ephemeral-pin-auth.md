# FEAT-024: Ephemeral PIN & QR Code Pairing for LAN Streamer

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-024` |
| **Domain** | Network Distribution |
| **Status** | Planned (Phase 6 / P2 Roadmap) |
| **Requirements** | [FR-010](../../../requirements/FR-010-lan-sharing.md), [NFR-002](../../../requirements/NFR-002-reliability.md) |
| **ADR Reference** | [ADR-009](../../../adr/ADR-009-feature-gap-remediation-and-p2-roadmap.md) |
| **Target Components** | [`src-tauri/src/commands/share.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/share.rs), [`src/index.html`](file:///d:/local-llm-hub/src/index.html) (`view-share`) |

---

## 1. Overview

FEAT-024 เพิ่มชั้นความปลอดภัยให้กับระบบแชร์โมเดลในวงแลน (LAN Model Streamer) เพื่อป้องกันการดาวน์โหลดไฟล์โมเดลขนาดใหญ่โดยไม่ได้รับอนุญาตในเครือข่ายที่มีผู้ใช้งานร่วมกัน:
1. **Dynamic Ephemeral PIN**: เมื่อกด Start Share ระบบจะสุ่ม PIN 4 หลัก (เช่น `7249`) และกำหนดระยะเวลาหมดอายุ (Session Expiry 30 นาที)
2. **QR Code Quick Pairing**: สร้างภาพ QR Code ที่ฝังลิงก์พร้อม token parameters เช่น `http://192.168.1.35:8080/portal?pin=7249` ให้อุปกรณ์เคลื่อนที่สแกนเข้าถึงหน้าดาวน์โหลดได้ทันที
3. **Axum Middleware Verification**:
   - ตรวจสอบผ่าน Query Parameter `?pin=XXXX` หรือ Header `X-Stream-PIN`
   - หาก PIN ไม่ถูกต้อง จะคืนค่า HTTP 401 Unauthorized
   - บล็อก IP ชั่วคราว 60 วินาทีหากพยายาม brute-force ผิดเกิน 5 ครั้ง

---

## 2. Technical Contracts & IPC Interface

```rust
pub struct LanShareConfig {
    pub port: u16,
    pub require_pin: bool,
    pub custom_dir: Option<String>,
}

pub struct LanShareInfo {
    pub is_active: bool,
    pub ip_addresses: Vec<String>,
    pub port: u16,
    pub active_pin: Option<String>,
    pub qr_svg_data: Option<String>,
}
```
