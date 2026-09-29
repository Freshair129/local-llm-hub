---
name: local-llm-orchestrator
description: Orchestrates local LLMs on RTX 3060 (12GB CUDA) through an automated multi-agent workflow (Explorer, Spec Gate, Worker, Verify Gate, Test Gate, Review Gate) according to SPEC-WORKFLOW-001. Use when the user wants to implement, refactor, or audit code using the local model fleet.
---

# Local LLM Multi-Agent Orchestrator Skill

Use this skill to route coding, refactoring, and auditing tasks across the local LLM fleet on NVIDIA GeForce RTX 3060 (12GB CUDA).

## When to Use
- User asks to implement a feature using local LLMs.
- User requests multi-agent task distribution or automated code verification.
- User wants to run a full SWE pipeline (Explore → Spec → Code → Verify → Test → Review).

## Multi-Agent Fleet Map (RTX 3060 Optimized)
- **Explorer Agent:** `JetBrains/Mellum2-12B-A2.5B-Instruct` (1,875 t/s prompt read, 128K context)
- **Spec Contract Gate:** Acceptance Criteria & System Constraints extraction.
- **Worker Agent:** `JetBrains/Mellum2-12B-A2.5B-Instruct` (132.4 t/s generation speed, 18s turnaround)
- **Verify Gate:** `bigatuna/Qwen3.5-9b-Sushi-Coder-RL` (Deterministic rule check @ `temperature: 0.0`)
- **Reasoning Escalator:** `JetBrains/Mellum2-12B-A2.5B-Thinking` (Circuit breaker when retries $\ge 2$)
- **Test Gate:** `unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL` (Senior Engineering Critique & Edge Cases)
- **Review Gate / Release:** `JetBrains/Mellum2-12B-A2.5B-Thinking` (130.2 t/s, Concurrency & Release signoff)

## Execution Instructions
To execute the pipeline autonomously on any file or goal, run:
```bash
node scripts/run_multi_agent_pipeline.mjs "<Task Goal>" "<Target File Path>"
```

### Example
```bash
node scripts/run_multi_agent_pipeline.mjs "Refactor main.js to use centralized state store and non-blocking toast notifications" "src/main.js"
```

## VRAM Safety Rules
1. **Never load two models simultaneously** on RTX 3060 (12GB) without evicting the previous model.
2. The script handles `keep_alive: 0` eviction and 1.5s CUDA synchronization automatically.
3. Creation phase (Explorer + Spec + Worker) shares `Mellum2 12B Instruct` to eliminate swap latency.
