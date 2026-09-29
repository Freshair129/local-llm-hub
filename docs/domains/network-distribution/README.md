# Domain: Network Distribution

| Field | Value |
|-------|-------|
| **Domain ID** | network-distribution |
| **Version** | 1.0.0 |
| **Status** | Active |
| **Owner** | Boss |
| **Created** | 2026-09-29 |

---

## Charter

Domain นี้รับผิดชอบ **การเผยแพร่และแชร์ไฟล์โมเดลขนาดใหญ่ผ่านเครือข่ายแลน (LAN Distribution)** — ให้บริการแชร์โฟลเดอร์โมเดลในเครื่อง (เช่น `d:\local-llm-hub\models` หรือไดรฟ์ภายนอก) ผ่าน Built-in HTTP Streamer พร้อมการรักษาความปลอดภัย (Directory Whitelisting & Path Traversal Prevention) และรองรับการดาวน์โหลดไฟล์ขนาด 2GB - 50GB แบบ Resumable ด้วย HTTP Range Requests (206 Partial Content)

---

## Owned Features

| Feature ID | Name | Status | Cross-domain? |
|------------|------|--------|---------------|
| FEAT-012 | LAN Model Streamer & Drive Sharing | Active | ✅ depends on backend-integration & model-management |

## Discovered Cross-Domain Features

| Feature ID | Name | Domain เจ้าของ | บทบาทของเรา |
|------------|------|----------------|-------------|
| CROSS-FEAT-001 | Unified Model Dashboard | model-management | ให้บริการปุ่มเปิด/ปิดแชร์โฟลเดอร์โมเดลและแสดง Shareable IP/QR บน Dashboard |

---

## Owned Requirements

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| [FR-010](../../requirements/FR-010-lan-sharing.md) | LAN Folder & Drive Sharing | P1 | Implemented & Verified |

## Referenced Requirements (owned by others)

| ID | Title | Domain เจ้าของ |
|----|-------|----------------|
| [FR-002](../../requirements/FR-002-model-aggregation.md) | Model Aggregation | model-management |
| [FR-009](../../requirements/FR-009-gguf-scanner.md) | GGUF File Scanner | backend-integration |
| [NFR-001](../../requirements/NFR-001-performance.md) | Performance SLA | observability |
| [NFR-002](../../requirements/NFR-002-reliability.md) | Reliability & Zero-Panic (ADR-100) | inference-gateway |

---

## Boundaries

```
IN SCOPE:
  - Local HTTP Streamer Daemon บน Local IP / LAN Subnet
  - HTTP Range Requests (206 Partial Content) สำหรับ Pause/Resume ดาวน์โหลด GGUF
  - ป้องกัน Directory / Path Traversal (`..`) 100%
  - บังคับใช้ Read-Only Mode ป้องกันการลบหรือเขียนทับไฟล์โมเดล
  - แสดง LAN Endpoint, Port, QR Code สำหรับอุปกรณ์อื่นในวงแลน

OUT OF SCOPE:
  - Public Internet Tunneling (เช่น Cloudflare Tunnels, ngrok) — มุ่งเน้น Local Privacy 100%
  - Multi-user RBAC / Authentication Complex
  - WebDAV / SMB Native Kernel Drivers (ใช้ HTTP Streamer น้ำหนักเบาใน Rust แทน)
```

---

## Key Data Produced

```rust
// Output ที่ domain นี้ produce และส่งต่อให้ UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanShareStatus {
    pub is_running: bool,
    pub port: u16,
    pub share_path: String,
    pub local_ip: String,
    pub active_streams: usize,
    pub read_only: bool,
}
```
