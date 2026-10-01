Feature Documentation: LAN Share (FEAT-012)1. Feature OverviewFEAT-012 เปิดโอกาสให้ผู้ใช้สามารถแชร์คลังโมเดลในเครื่อง (เช่น d:\local-llm-hub\models) ให้กับอุปกรณ์เครื่องอื่นใน Local Network (LAN) ได้ โดยผ่าน Built-in HTTP Streaming Server ใน Rust ที่รองรับ HTTP 206 Partial Content (Range Requests) ทำให้ไคลเอนต์สามารถดาวน์โหลดไฟล์ GGUF ขนาดมหึมา (หลายสิบ GB) ได้อย่างราบรื่นและสามารถหยุดชั่วคราชั่วคราวแล้วดาวน์โหลดต่อได้ (Resumable Download)2. Architecture & Request FlowsequenceDiagram
    participant UI as Frontend (src/main.js & share.js)
    participant Rust as Backend (commands/share.rs)
    participant Client as LAN Client (cURL / Browser / Worker)

    UI->>Rust: invoke('start_lan_share', { share_path, port, read_only: true })
    Rust->>Rust: Verify directory & bind TCP listener (e.g. 0.0.0.0:8088)
    Rust-->>UI: LanShareStatus { is_running: true, local_ip, port, ... }
    
    Client->>Rust: GET /models/mellum2-12b.gguf (Range: bytes=0-1048575)
    Rust->>Rust: Validate path (No '..' allowed)
    Rust-->>Client: HTTP 206 Partial Content (1MB chunk + Content-Range)
    
    UI->>Rust: invoke('stop_lan_share')
    Rust->>Rust: Abort background server task & release port
    Rust-->>UI: LanShareStatus { is_running: false }3. Verification & Test Coveragetests/test_lan_share.rs::test_lan_range_byte_parsing ✅ (ตรวจสอบ Range Header parser)tests/test_lan_share.rs::test_lan_directory_traversal_rejection ✅ (ป้องกัน Path Traversal ..)tests/test_lan_share.rs::test_lan_file_counter ✅ (นับจำนวนไฟล์โมเดลในโฟลเดอร์ที่แชร่)4. Related RequirementsFR-001: Unified Model DashboardFR-002: Backend IntegrationFR-003: Inference GatewayFR-004: Observability & TelemetryFR-005: Network DistributionFR-010: Auto-UpdaterFR-006: Data Contracts & State5. Implementation StatusComponentStatusEvidencestart_lan_share command✅ Implementedcommands/share.rs:211stop_lan_share command✅ Implementedcommands/share.rs:250HTTP 206 Range Support✅ Implementedqueries_nvidia_smi.rs:58Path Traversal Protection✅ Implementedscanner.rs:13Resumable Download✅ Implementedshare.js:1506. Usage ExampleStarting LAN Shareconst { invoke } = window.__TAURI__ || { invoke: async (cmd, args) => {} };

try {
  const result = await invoke('start_lan_share', {
    share_path: '/d:/local-llm-hub/models',
    port: 8088,
    read_only: true
  });
  
  console.log('LAN Share started:', result);
  // { is_running: true, local_ip: '192.168.1.15', port: 8088, ... }
} catch (error) {
  console.error('Failed to start LAN Share:', error);
}Stopping LAN Sharetry {
  const result = await invoke('stop_lan_share');
  console.log('LAN Share stopped:', result);
  // { is_running: false }
} catch (error) {
  console.error('Failed to stop LAN Share:', error);
}Downloading via BrowserNavigate to http://192.168.1.15:8088/models/mellum2-12b.ggufBrowser automatically handles Range RequestsLarge files download in chunks with resume capabilityDownloading via curl# Download first 1MB
curl -H "Range: bytes=0-1048575" http://192.168.1.15:8088/models/mellum2-12b.gguf -o chunk1.gguf

# Download next 1MB
curl -H "Range: bytes=1048576-2097151" http://192.168.1.15:8088/models/mellum2-12b.gguf -o chunk2.gguf

# Concatenate chunks (if needed)
cat chunk1.gguf chunk2.gguf > full.gguf7. Security ConsiderationsPath Traversal Prevention: All file paths are validated to prevent .. traversal attacksDirectory Binding: Server binds to 0.0.0.0 only when explicitly requestedRead-Only Mode: Default mode prevents accidental modification of shared filesPort Release: Ports are automatically released when share is stopped8. Performance OptimizationBuffered Streaming: Uses tokio::fs::File with bounded buffer to prevent OOM on 16GB systemsConcurrent Requests: Handles multiple simultaneous download requests efficientlyMinimal Memory Footprint: Stream processing ensures low memory usage regardless of file size9. TroubleshootingCommon IssuesPort Already in Use   - Error: EADDRINUSE: address already in use   - Solution: Stop existing share or use a different portPath Traversal Attempt   - Error:  forbidden path traversal attempt   - Solution: Ensure paths don't contain .. or absolute paths outside share directoryFile Not Found   - Error: 404 Not Found   - Solution: Verify file exists in the share path and name matches exactlyLoggingAll operations are logged with [WARN:telemetry] and [ERROR:telemetry] prefixesCheck console for detailed error messagesUse invoke('get_all_model_stats') to monitor system resource usage
