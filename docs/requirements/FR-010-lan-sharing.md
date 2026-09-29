---
id: FR-010
title: LAN Folder & Drive Sharing
domain: network-distribution
owner: Boss
status: draft
priority: P1
features:
  - FEAT-011
cross_domains:
  - backend-integration
  - model-management
implements_test:
  - TEST-010
---

# FR-010 — LAN Folder & Drive Sharing

## Statement

ระบบต้องสามารถแชร์โฟลเดอร์โมเดล (Models Directory) หรือไดรฟ์ที่กำหนดผ่านเครือข่ายวงแลน (Local Area Network - LAN) ได้ เพื่อให้อุปกรณ์ คอมพิวเตอร์เครื่องอื่น หรือ Worker Node ในวงเครือข่ายเดียวกันสามารถค้นหา เข้าถึง ดาวน์โหลด หรือสตรีมไฟล์โมเดลขนาดใหญ่ไปใช้งานได้อย่างปลอดภัย

## Acceptance Criteria

1. **WHEN** ผู้ใช้เปิดฟังก์ชัน LAN Share ใน UI **THEN** ระบบ SHALL สตาร์ต Built-in HTTP File & Model Server บน Local IP ประจำเครื่อง (เช่น `http://192.168.1.50:8088`) ภายในเวลาไม่เกิน 2 วินาที
2. **WHEN** บริการ LAN Share เริ่มทำงาน **THEN** ระบบ SHALL แสดง Network Interface IP, พอร์ตที่ให้บริการ, QR Code, และ Shareable URL บน UI อย่างชัดเจน
3. **WHEN** ผู้ใช้กำหนดไดเรกทอรีที่ต้องการแชร์ (เช่น `d:\local-llm-hub\models` หรือไดรฟ์ภายนอก) **THEN** ระบบ SHALL ให้บริการเฉพาะโฟลเดอร์ที่ได้รับอนุญาต (Whitelist) และป้องกันการเจาะระบบแบบ Directory / Path Traversal (`..`) 100%
4. **WHEN** ไคลเอนต์ในวงแลนดาวน์โหลดโมเดลขนาดใหญ่ (GGUF ขนาด 2GB - 50GB) **THEN** ระบบ SHALL รองรับ `HTTP Range Requests` (206 Partial Content) เพื่อให้สามารถ Pause/Resume การดาวน์โหลดได้โดยไม่ต้องเริ่มใหม่
5. **WHEN** เริ่มต้นแชร์ **THEN** ระบบ SHALL บังคับใช้ **Read-Only Mode** เป็นค่าเริ่มต้น (ป้องกันเครื่องภายนอกเขียนทับหรือลบไฟล์โมเดลในเครื่องโฮสต์)
6. **IF** ผู้ใช้เปิดการตั้งค่าความปลอดภัย (Access Token / PIN Protection) **THEN** ไคลเอนต์ภายนอกต้องส่ง Access Token หรือใส่รหัสผ่านก่อนเข้าถึงรายการโมเดล
7. **WHEN** ผู้ใช้กดปิด (Stop Sharing) หรือปิดแอปพลิเคชัน **THEN** ระบบ SHALL ปิด Listener Socket ทันทีและปล่อยพอร์ตคืนสู่ระบบปฏิบัติการอย่างสมบูรณ์

## Security & Architecture Constraints

- **Forbidden Paths:** ห้ามแชร์ไดเรกทอรีระดับระบบปฏิบัติการ เช่น `C:\Windows`, `C:\Program Files`, `C:\Users\{user}\AppData`
- **Network Protocol:** HTTP/1.1 & HTTP/2 รองรับ Chunked Transfer Encoding และ Range Requests
- **Discovery (Optional):** รองรับ mDNS / Zeroconf (เช่น `local-llm-hub.local:8088`) เพื่อให้เครื่องอื่นค้นหาเจอโดยไม่ต้องพิมพ์ IP เอง
- **Compliant with ADR-100:** Backend Service ใน Rust ต้องใช้ `Result<T, String>` และไม่มี `.unwrap()` / `panic!`

## Data Contract

### IPC Commands

```rust
// เปิดบริการแชร์
pub async fn start_lan_share(
    share_path: String,
    port: u16,
    token: Option<String>,
    read_only: bool,
) -> Result<LanShareStatus, String>;

// ปิดบริการแชร์
pub async fn stop_lan_share() -> Result<bool, String>;

// ดึงสถานะการแชร์ปัจจุบัน
pub async fn get_lan_share_status() -> Result<LanShareStatus, String>;
```

### Type Definition

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanShareStatus {
    pub is_active: bool,
    pub server_url: Option<String>,
    pub local_ip: Option<String>,
    pub port: u16,
    pub shared_path: String,
    pub active_connections: usize,
    pub bytes_sent: u64,
    pub read_only: bool,
}
```

## Traceability

```
FR-010
  ├── implements ← src-tauri/src/commands/share.rs::start_lan_share
  ├── implements ← src-tauri/src/commands/share.rs::stop_lan_share
  └── verified_by ← tests/lan_share_test.rs::test_lan_share_http_range_download
                  ← tests/lan_share_test.rs::test_lan_share_path_traversal_blocked
```
