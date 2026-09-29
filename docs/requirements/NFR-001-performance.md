---
id: NFR-001
title: Performance
domain: observability
owner: Boss
status: draft
priority: P0
cross_domains:
  - backend-integration
  - model-management
  - inference-gateway
---

# NFR-001 — Performance

## Requirements

| ID | Metric | Target | Measurement |
|----|--------|--------|------------|
| NFR-001-01 | App cold start time | < 3 วินาที | Time from launch to dashboard visible |
| NFR-001-02 | Backend probe timeout | ≤ 5 วินาที | Per backend HTTP timeout |
| NFR-001-03 | Chat first token latency | ≤ 500ms | After backend responds |
| NFR-001-04 | GPU stats refresh | 2 วินาที (configurable 1–10s) | Poll interval |
| NFR-001-05 | Model list render | No jank with 500+ models | Virtual scroll required |
| NFR-001-06 | Model card load | < 3 วินาที | From click to content shown |
| NFR-001-07 | GGUF scan speed | > 10 files/second | Background thread |

## Verification

- NFR-001-01: manual timing บน clean Windows 11 VM
- NFR-001-02: unit test mock server ที่ delay 5.1s ต้อง timeout
- NFR-001-05: UI test กับ mock model list 500 items
