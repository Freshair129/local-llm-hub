# RCA: benchmark validation collapsed separate result gates

## Symptom

The existing validator emitted one pass value for compilation, visible tests, heldout tests, guard checks, and trace checks. It did not retain a whole-response single-Rust-fence gate, so reports could not distinguish functional behavior from code-format and safety compliance.

## Evidence

- docs/benchmarks/BENCH-5060TI-GENERAL-005.md requires a separate single-Rust-fence format gate and separate functional, code-gate, and combined outcomes.
- Before correction, scripts/benchmark_5060ti_pilot.mjs saved result.pass from compile, visible, heldout, guard, and trace values only.
- Before correction, the existing harness had no whole-response fence-count check.

## Root Cause

The pilot validator was implemented for compile/test and guard/trace outcomes, while the later general benchmark contract added distinct raw-format and result-accounting requirements without updating that validator.

## Why the issue escaped detection

The prior regression test covered extraction, safety flags, trace checks, and compiler results. It did not assert that raw formatting was assessed separately or that validation emitted independent functional, code-gate, and combined fields.

## Proposed prevention

Evaluate the original response for exactly one nonempty Rust fence, keep that outcome independent from visible/heldout execution, and persist functional, code-gate, and combined result fields. Add regression cases for extra prose, wrong-language fences, multiple fences, and a valid response.
