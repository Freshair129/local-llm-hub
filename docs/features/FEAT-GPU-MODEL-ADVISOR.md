# Model Advisor & GPU Benchmark Comparison

| Field | Value |
|---|---|
| ID | FEAT-GPU-MODEL-ADVISOR |
| Version | 1.0.2 |
| Date | 2026-10-04 (Asia/Bangkok) |
| Status | Implemented; local UI verification passed |
| Complexity / risk | C-2 / MEDIUM |
| Owner | model-management; observability supplies hardware evidence |

## 1. User intent and approval boundary

เพิ่มหน้าแนะนำโมเดลตาม VRAM ดูผลทดสอบโมเดลแยกตามรุ่นการ์ดจอ และเปรียบเทียบการ์ดจอพร้อมกันสูงสุด 6 รุ่น ตามคำยืนยันของผู้ใช้ คำว่า 6 ช่องหมายถึงการ์ดจอ ไม่ใช่จำนวน benchmark suites หรือการโหลดโมเดลพร้อมกัน

ผู้ใช้อนุมัติสเปกและขอบเขต implementation เมื่อ 2026-10-04 ก่อนเริ่มแก้โค้ดตาม AGENTS R5/SOP

## 2. Parent and peer alignment

- Parent: [PRD-SDD](../PRD-SDD-v1.0.md) — unified model management and hardware visibility.
- Architecture: [ADR-001/002](../adr/ARCHITECTURE.md) — existing Tauri shell and Vanilla HTML/CSS/JS.
- Parent evaluation contract: [SPEC-EVAL-002](../benchmarks/SPEC-EVAL-002-evaluation-hardening.md) — evidence-backed gates and explicit benchmark scope.
- Peer: [Unified Dashboard](CROSS-FEAT-001-unified-model-dashboard.md), [FR-006](../requirements/FR-006-gpu-monitor.md), [FR-011 Arena](../requirements/FR-011-model-arena.md), [FEAT-029](../domains/observability/features/FEAT-029-hw-telemetry-benchmark-logger.md).
- Existing model/API contracts: [Appendix B](../appendices/B-data-models.md). This feature adds a packaged report contract; it does not change UnifiedModel or inference IPC.

## 3. Verified current state

- `src/main.js` switches `.view-panel` sections using `data-view`; add one page within the current Model Management navigation.
- `src/js/stats.js` mixes seeded historical statistics and localStorage execution counters. Neither those counters nor `src/model_stats.json` provides sufficient GPU/suite/profile provenance for this comparison. Keep existing Analytics behavior; do not treat its success counters as validated benchmark scores.
- `src-tauri/tauri.conf.json` packages `../src`. Raw `eval/reports` is outside the packaged frontend; the new page needs a compact derived asset under `src/data`.
- The 13 `manifest.json` files inspected under `eval/reports/runs` identify RTX 5060 Ti with 16311 MiB reported device memory. The 16GB product label and reported MiB must remain distinguishable.
- [Latest tuning confirmation summary](../../eval/catalog_sources/TUNING-5060TI-2026-10-04/confirmation/summary.json) contains the sanitized measured profile results. Calibration and confirmation cohorts must remain separate.
- Older documentation mentions RTX 3060; a target-hardware label alone is insufficient to attribute a result to that GPU. Import other GPU results only when run evidence supports attribution.

## 4. Advisor page

Navigation label: **Model Advisor**. Page heading: **เลือกโมเดลให้เหมาะกับ GPU**.

### A. Select hardware and workload

- VRAM capacity presets: 4 / 6 / 8 / 12 / 16 / 24 / 32 / 48 GiB and a positive custom capacity. Label binary units explicitly; normalize product-capacity labels separately.
- GPU selector distinguishes model, desktop/laptop variant where known, and VRAM variant. Two variants with different memory are separate entries.
- A compact GPU catalog includes verified product metadata and source links, including cards without benchmark results. Numeric performance fields come only from measured runs. Product metadata must be checked against official sources before shipping the catalog.
- Filters: model name, quantization, suite/task set, context/output limits, HF/local profile, calibration/confirmation and full-GPU/offload status.
- Default to detected GPU when its identity can be matched safely; otherwise show an explicit hardware selector. Opening this page does not start inference.

### B. Model recommendations and results

- List model variant, quantization, tested profile, quality pass count/denominator, median generation speed, median total duration, observed peak device VRAM, output-budget stops and test date.
- Each item explains its recommendation: measured on selected GPU, capacity candidate with no test on this GPU, observed offload, or insufficient evidence. Memory suitability and answer quality have separate labels.
- Default recommendations use the most recent confirmation cohort when available and its recorded decision; do not promote a rejected calibration candidate. Show all profiles through filters, including failures.
- Within a comparable cohort, order by combined pass fraction, then median total duration. Display sample size and scope (for example, two Rust tasks); this is not a universal model-quality rank.
- Detail view shows exact sampler, thinking mode, context/output budget, runtime/driver, CPU/RAM, source provenance and known limitations. Provide readable evidence excerpts from packaged summaries, plus original repository-relative artifact paths and upstream URLs. Do not depend on inaccessible `F:` file links in a shipped app.

### C. Compare up to six GPUs

- An “เพิ่มเพื่อเปรียบเทียบ” action adds a unique GPU variant to a tray labeled `n/6`; duplicates are prevented and a seventh selection is rejected with a clear message.
- Matrix columns are selected GPUs (maximum 6); rows are the chosen model variants and metrics. User can select a model/profile to inspect that model across every selected GPU.
- Show GPU name/VRAM, quality, tokens/s, total time, device VRAM peak, offload mode, sample count and benchmark date. Keep labels and headers fixed during horizontal scrolling.
- Missing model/GPU results show “ยังไม่มีผลทดสอบ”, never zero or a fabricated speed estimate. Catalog-only GPUs remain selectable for capacity comparison.
- Different suites, model weights/quantization, runtime, prompts/tests, seeds, sampler, token/context budgets or offload conditions get “เงื่อนไขทดสอบต่างกัน”. Values remain visible but no best/worst highlight or speedup ratio is calculated across mismatched cohorts. CPU/RAM/driver differences remain visible as machine confounders.
- Remove individual columns or clear the comparison. Preserve filters and selections only for the current page session in v1.
- At 1200×800 and 900×600, keep controls usable and scroll the table horizontally; do not compress six columns into unreadable cards. Keyboard users can select, remove and inspect each column.

## 5. VRAM recommendation rules

1. **Measured on this GPU:** matching identity/profile with telemetry and residency evidence. State whether it used full GPU or CPU+GPU offload; successful inference does not imply quality gates passed.
2. **Capacity candidate, not verified:** if the same profile has a measured full-GPU run elsewhere, its observed peak device usage may be used as an explicitly labeled reference against the selected capacity. State source GPU and context. This is a screening hint, not proof that another card fits or performs similarly.
3. **Below observed reference:** selected capacity is below that reference. Say that this profile may require reduced context or offload; do not declare impossibility from a different GPU's measurement.
4. **Insufficient evidence:** file size alone is not total VRAM demand; missing KV-cache/runtime measurements must not produce a “fits” recommendation. Show known file size and missing evidence without inventing an overhead multiplier.
5. Never use an offloaded run's low device VRAM peak to label a profile as fitting fully on GPU. Peak device VRAM includes other device allocations; retain the metric's scope rather than calling it model-only memory.
6. VRAM capacity is not currently free VRAM. Live available memory may be shown separately if already available from telemetry; historical recommendations retain their recorded conditions.

## 6. Implementation and report contract

Use a small explicit allowlist of existing run directories with manifests, validated summaries and integrity evidence. An export script projects only catalog metadata into `eval/catalog_sources`, strips generated answers and absolute host paths, and records hashes of the local source artifacts. The catalog builder reads these sanitized snapshots and generates a compact deterministic JSON asset; unsupported/incomplete runs are excluded with reasons. Raw run artifacts remain local and are not committed.

Added feature files:

- `scripts/build_benchmark_catalog.mjs` — validates source evidence, computes display metrics and emits the asset.
- `scripts/export_benchmark_catalog_sources.mjs` — exports allowlisted, sanitized metadata snapshots and source-artifact hashes.
- `src/data/benchmark_catalog.json` — derived data, never manually edited.
- `src/data/gpu_catalog.json` — GPU identity/capacity/source metadata; includes untested cards without numeric results.
- `src/js/model_advisor.js` — loading, filtering, recommendation labels and comparison UI.
- `eval/tests/benchmark_catalog.test.mjs` and `eval/tests/model_advisor.test.mjs` — meaningful contract and interaction-logic tests.

Minimal existing changes: page/nav in `src/index.html`, initialization/navigation in `src/main.js`, scoped styles in `src/styles.css`, package commands for sanitized source export and deterministic catalog generation, and documentation/traceability entries. No new runtime dependency, database, remote service or inference command is needed.

Catalog root: `schemaVersion`, source-content hashes, `gpus`, `models`, `runs`, `excludedSources`. Each run records:

| Group | Required meaning |
|---|---|
| Identity | stable run ID, GPU variant, machine ID, model weight identity/quantization, profile identity |
| Conditions | suite/task/test hashes, stage, seeds, runtime/version, context, output limit, thinking and sampler |
| Quality | completed/planned sample count, functional/combined passes with denominators, budget stops, runtime errors, separate diagnostic outcomes |
| Speed | per-slot measured tokens/s and total time; cohort median uses the same eligibility rule; missing durations remain null |
| Memory | peak device MiB and residency/offload evidence; unknown is null, not false or zero |
| Provenance | recorded test date, sanitized artifact-relative path, source-artifact hashes, HF/upstream/local guidance classification, recommendation decision and limitations |

Do not infer weight equality from a display name. Do not merge profiles with different budgets or samplers. Do not sum overlapping cohorts or treat the two-task pilot as six public benchmark suites. Speed reports include the cohort's unsuccessful completions when a valid measurement exists and disclose the eligible count; missing/truncated data remain explicit. Exclude known mislabelled cold/warm flags from cold/warm comparisons.

## 7. Acceptance criteria and verification

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-01 | Advisor opens within existing navigation and other pages still work | Browser smoke confirmed Model Catalog, Analytics, Arena and Advisor navigation |
| AC-02 | VRAM preset/custom input and GPU variants filter recommendations correctly | Capacity boundaries and model/benchmark/stage/task filters pass tests |
| AC-03 | Measured, reference-only, offloaded and unknown evidence are distinct | Status fixtures pass, including offload and missing-memory cases |
| AC-04 | Select 1–6 unique GPUs; seventh blocked; removing one permits another | Six unique variants selected; add disabled at six; keyboard removal and replacement passed |
| AC-05 | Same model is compared across GPUs; missing results never become zero | Browser showed no-data states for five selected variants without inventing metrics; only one GPU has recorded runs, so multi-GPU measured comparison remains unverified |
| AC-06 | Incompatible cohorts have no winner/speedup claims | Cohort tests cover weights, suite, task hashes, sampler/budgets, thinking, runtime, stage and seeds; available data did not exercise a multi-GPU mismatch card |
| AC-07 | Imported values and denominators match source evidence | Deterministic catalog build passed: 45 profiles, 0 excluded allowed sources |
| AC-08 | Calibration/confirmation and original/tuned profiles remain separate | Catalog contract tests preserve tuning outcomes and promotion decisions |
| AC-09 | Evidence details and safe source links are readable | Browser showed real aliases and source links; missing-evidence text remains explicit |
| AC-10 | Usable at both supported window sizes without layout breakage | Browser checks at 1200×800 and 900×600: no page-level horizontal overflow, comparison scroller is wider than its viewport; keyboard select/remove/re-add passed |
| AC-11 | No existing aliases, raw results or generation settings are modified | Diff review plus all evaluation tests passed (9/9) |

Definition of done: approved specification, acceptance tests passed, real catalog reconciled, UI verified, relevant regression checks passed, documentation updated and final version diff reported. A synthetic six-GPU test proves the UI limit, not six real hardware benchmarks. Native Tauri validation is reported separately from browser validation.

## 8. Scope boundary and out-of-scope findings

Included: recommendation page, verified report ingestion, six-GPU comparison, evidence details and empty states.

Excluded: live six-GPU orchestration, new model inference/benchmark runs, scraping community benchmark scores, model downloads, automatic routing changes, purchasing advice and changes to Arena's two-model execution. Existing seeded Analytics counters and older hardware labels are documented evidence limitations; this feature does not refactor those unrelated modules.

## 9. Implementation completion and version diff

- Version history: proposal v0.1.0 → approved specification v1.0.0 → implemented and locally verified v1.0.1 → sanitized catalog source package v1.0.2.
- Catalog evidence now comes from committed metadata-only snapshots; raw model responses and generated code stay local, while source artifact hashes retain provenance.
- Added report ingestion, derived benchmark/GPU catalogs, the Model Advisor view, VRAM recommendation states, six-GPU comparison controls, and contract tests.
- The catalog contains 45 attested profiles across one observed GPU variant (RTX 5060 Ti 16 GB); seven additional GPU variants are selectable with explicit no-data states.
- Browser verification covered six selected variants, seventh-slot blocking, keyboard selection/removal/replacement, navigation, aliases, and missing-data behavior at 1200×800 and 900×600. All 9 evaluation tests passed.
- Limits: there is no real cross-GPU benchmark pair yet, and native Tauri packaging was not run. Static browser preview also cannot serve the existing Tauri hardware-telemetry POST (HTTP 501), so live telemetry remains unverified. The Advisor does not start inference or benchmark jobs.
