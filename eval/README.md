# Local LLM Hub — Evaluation Framework (SPEC-EVAL-002)

| Field | Value |
|---|---|
| **Specification ID** | [`SPEC-EVAL-002`](../docs/benchmarks/SPEC-EVAL-002-evaluation-hardening.md) |
| **Framework Version** | 1.0.0 |
| **Target Hardware** | NVIDIA GeForce RTX 3060 (12GB GDDR6 CUDA) + Intel Core i7-8700K |
| **Status** | Phase 1 & 2 Operational |

---

## 1. Overview & Architecture

The Local LLM Hub Evaluation Framework provides an objective, hardened testing harness for local coding LLMs. It replaces subjective LLM self-critiques with **Hard Verification Gates** (compiler checks, patch application integrity, test suite execution, and git worktree isolation) to evaluate coding capability against frontier agents (Codex).

```
Task (task.schema.json)
       ↓
  ContextBuilder (AST & Symbol Index)
       ↓
SpecContractBuilder (Dynamic ACs)
       ↓
  Worker Agent (Mellum2 12B)
       ↓
PatchArtifact (Unified Diff)
       ↓
PatchValidator (HG-01 & HG-06 Scope Check)
       ↓
  Git Worktree Sandbox
       ↓
TestRunner (HG-02 Compile, HG-03 Existing Tests, HG-04 Hidden Tests)
       ↓
Verify Gate (Sushi Coder @ 0.0 → review.schema.json)
       ↓
Circuit Breaker (Retry <= 2 -> Repair | Retry > 2 -> Escalate)
       ↓
Scorer & Report Generator (result.schema.json)
```

---

## 2. Directory Layout

```text
eval/
├── README.md
├── schemas/
│   ├── task.schema.json         # Standardized evaluation task definition
│   ├── patch.schema.json        # Unified diff / PatchArtifact contract
│   ├── review.schema.json       # Structured verification & review verdict
│   └── result.schema.json       # Reproducible run result artifact
├── config/
│   ├── machine-manifest.json    # Hardware ground truth (RTX 3060 12GB, driver, CPU)
│   ├── thresholds.yaml          # Qualification thresholds for BASE-1..6
│   └── risk-policy.yaml         # Risk score & routing tiers (L0..L3)
├── harness/
│   ├── patch-validator.mjs      # HG-01 & HG-06 path traversal and scope guard
│   ├── worktree-manager.mjs     # Isolated Git worktree sandbox
│   ├── test-runner.mjs          # Deterministic compiler and CLI test execution
│   ├── spec-contract-builder.mjs# Dynamic Acceptance Criteria deriver
│   ├── context-builder.mjs      # Structured symbol and AST context pack
│   ├── scorer.mjs               # Composite score and denominator metrics
│   ├── report-generator.mjs     # Scorecard markdown and JSON generator
│   └── run-eval.mjs             # Master evaluation runner
├── public/                      # Adapters for standard benchmarks (EvalPlus, BigCodeBench, SWE-bench)
├── project/                     # Private project evaluation fixtures
├── reviewer/                    # Injected defect taxonomy for BASE-6
├── reports/
│   ├── runs/                    # Individual run artifacts (RUN-*.json)
│   ├── scorecards/              # Batch scorecards (EVAL_SCORECARD_*.md)
│   └── comparisons/             # Local vs Codex comparative reports
└── tests/
    └── eval_harness.test.mjs    # Self-verification unit tests
```

---

## 3. Running Self-Verification Tests

To verify the evaluation harness:
```bash
node eval/tests/eval_harness.test.mjs
```

---

## 4. Hard Verification Gates (HG-01 to HG-06)

1. **HG-01 Patch Validity**: Unified diff must parse cleanly; no corrupted chunks or path traversal.
2. **HG-02 Build / Compile**: `cargo check`, `cargo test`, `npm test` must compile clean without fatal errors.
3. **HG-03 Existing Regression**: All existing unit and integration tests must pass.
4. **HG-04 Hidden Tests**: Must pass separate hidden test suites not exposed in prompt context.
5. **HG-05 Security & Zero-Panic**: Rust code must obey Zero-Panic (no `unwrap()`); secret scans clean.
6. **HG-06 Scope Check**: Changed files must strictly reside within `allowed_paths`.

---

## 5. Adding a New Evaluation Benchmark

To add a new benchmark:
1. Define tasks conforming to `eval/schemas/task.schema.json`.
2. Place public tasks in `eval/public/<benchmark-name>/` or private tasks in `eval/project/<project-name>/`.
3. Set qualification targets in `eval/config/thresholds.yaml`.
4. Run via `runEvaluationBatch(tasks, workerFn)`.
