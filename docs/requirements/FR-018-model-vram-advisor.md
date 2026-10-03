# FR-018 — VRAM Model Advisor & GPU Benchmark Comparison

| Field | Value |
|---|---|
| ID | FR-018 |
| Domain | model-management |
| Owner | Boss |
| Priority | P1 |
| Status | Implemented; local tests and browser verification passed (one observed GPU) |
| Feature | [FEAT-GPU-MODEL-ADVISOR](../features/FEAT-GPU-MODEL-ADVISOR.md) |

## Statement

ระบบต้องแสดงผลทดสอบโมเดลโดยแยกตาม GPU, model weights/quantization, benchmark suite และ inference profile ให้ผู้ใช้เลือก VRAM เพื่อดูผลอ้างอิง และเปรียบเทียบ GPU พร้อมกันได้สูงสุด 6 variants

## Acceptance Criteria

1. เปิด Model Advisor จาก model-management navigation และแสดงผลจากรายงานที่ตรวจสอบ provenance ได้ โดยไม่มี inference request
2. ผู้ใช้กรองผลตามช่วง/ค่ากำหนด VRAM, โมเดล, quantization, benchmark และ stage ได้; สถานะระบุผลวัดจริง, ผลอ้างอิง capacity, offload, failed promotion หรือหลักฐานไม่พอ
3. ผู้ใช้เลือก GPU variant ซ้ำไม่ได้ และเลือกได้ไม่เกิน 6; ช่องที่ไม่มีผลทดสอบแสดง "ยังไม่มีผลทดสอบ" โดยไม่แสดงค่า 0 แทน null
4. ระบบเปรียบเทียบ metric ข้าม GPU เฉพาะเมื่อ exact weight identity, suite/test hashes, runtime, options, thinking mode, stage และ seeds ตรงกัน; เมื่อไม่ตรง ให้แสดงข้อแตกต่างและงด winner/speedup claim
5. ทุกผลแสดง pass count พร้อม denominator, sample count, duration, tokens/s, peak device VRAM, GPU/offload status, test date และ link/path หลักฐานตามที่มี; unknown ต้องเป็น null/label unknown
6. Recommendation แยกความจุออกจากคุณภาพ; ห้ามใช้ผล CPU/GPU offload หรือ weight file size เพียงอย่างเดียวตัดสินว่า profile รันเต็ม GPU ได้
7. หน้าใช้งานได้ที่ขนาดหน้าต่าง 1200×800 และ 900×600 พร้อม keyboard navigation และ horizontal scrolling สำหรับ 6 คอลัมน์

## Traceability

- UI: `src/index.html#view-model-advisor`, `src/js/model_advisor.js`, `src/styles.css`
- Ingestion: `scripts/export_benchmark_catalog_sources.mjs`, then `scripts/build_benchmark_catalog.mjs`
- Catalog: `src/data/benchmark_catalog.json`, `src/data/gpu_catalog.json`
- Verification: `eval/tests/benchmark_catalog.test.mjs`, `eval/tests/model_advisor.test.mjs`
