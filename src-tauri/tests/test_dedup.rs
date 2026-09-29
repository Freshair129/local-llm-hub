// src-tauri/tests/test_dedup.rs
// trace:verifies FR-003
// trace:verifies TC-FEAT-006-INTEG
//! Feature Integration Test: Duplicate model detection and preferred backend resolution (BR-001).

use tauri_app_lib::commands::models::{backend_priority_rank, dedup_models};
use tauri_app_lib::models::types::UnifiedModel;
use std::time::Instant;

#[test]
fn test_tc_feat_006_dedup_integration() {
    let start = Instant::now();

    // Model 1: Llama 3 across 3 different backends
    let llama_ollama = UnifiedModel::new(
        "ollama:llama3:latest",
        "llama3:latest",
        "llama3",
        "ollama",
        "gguf",
        4500000000,
        Some("Q4_0".to_string()),
        true,
    );

    let llama_vllm = UnifiedModel::new(
        "vllm:meta-llama/Meta-Llama-3-8B",
        "meta-llama/Meta-Llama-3-8B",
        "llama3",
        "vllm",
        "safetensors",
        16000000000,
        None,
        false,
    );

    let llama_gguf = UnifiedModel::new(
        "gguf:Llama-3-8B.Q4_K_M.gguf",
        "Llama-3-8B.Q4_K_M.gguf",
        "llama3",
        "gguf",
        "gguf",
        4900000000,
        Some("Q4_K_M".to_string()),
        false,
    );

    // Model 2: Mellum2 only on Ollama (unique)
    let mellum_ollama = UnifiedModel::new(
        "ollama:mellum2-12b",
        "mellum2-12b",
        "mellum2 12b",
        "ollama",
        "gguf",
        8080000000,
        Some("Q4_K_M".to_string()),
        true,
    );

    // Model 3: Qwen 4B across GGUF and HF (no Ollama)
    let qwen_gguf = UnifiedModel::new(
        "gguf:qwen-4b-thai-reasoning.gguf",
        "qwen-4b-thai-reasoning.gguf",
        "qwen 4b thai reasoning",
        "gguf",
        "gguf",
        2700000000,
        Some("Q4_K_M".to_string()),
        false,
    );

    let qwen_hf = UnifiedModel::new(
        "hf:nectec/qwen-4b-thai-reasoning",
        "nectec/qwen-4b-thai-reasoning",
        "qwen 4b thai reasoning",
        "hf",
        "safetensors",
        8000000000,
        None,
        false,
    );

    let input = vec![
        llama_ollama,
        llama_vllm,
        llama_gguf,
        mellum_ollama,
        qwen_gguf,
        qwen_hf,
    ];

    let (deduped, groups) = dedup_models(&input);
    let elapsed = start.elapsed();

    // 1. Must find exactly 2 duplicate groups: "llama3" and "qwen 4b thai reasoning"
    assert_eq!(groups.len(), 2, "Expected exactly 2 duplicate groups");

    // 2. Verification of "llama3" group: Ollama must be preferred over vLLM and GGUF (BR-001)
    let llama_group = groups.iter().find(|g| g.canonical_name == "llama3").expect("llama3 group");
    assert_eq!(llama_group.preferred_backend, "ollama");
    assert_eq!(llama_group.instances.len(), 3);

    let llama_ollama_res = deduped.iter().find(|m| m.id == "ollama:llama3:latest").expect("llama ollama");
    assert!(llama_ollama_res.is_duplicate);
    assert!(llama_ollama_res.is_preferred, "Ollama should be preferred for llama3");
    assert_eq!(llama_ollama_res.duplicate_backends, vec!["ollama", "vllm", "gguf"]);

    let llama_vllm_res = deduped.iter().find(|m| m.id == "vllm:meta-llama/Meta-Llama-3-8B").expect("llama vllm");
    assert!(llama_vllm_res.is_duplicate);
    assert!(!llama_vllm_res.is_preferred, "vLLM should not be preferred when Ollama is present");

    let llama_gguf_res = deduped.iter().find(|m| m.id == "gguf:Llama-3-8B.Q4_K_M.gguf").expect("llama gguf");
    assert!(llama_gguf_res.is_duplicate);
    assert!(!llama_gguf_res.is_preferred, "GGUF should not be preferred when Ollama is present");

    // 3. Verification of "qwen 4b thai reasoning": GGUF must win over HF
    let qwen_group = groups.iter().find(|g| g.canonical_name == "qwen 4b thai reasoning").expect("qwen group");
    assert_eq!(qwen_group.preferred_backend, "gguf");
    assert_eq!(qwen_group.instances.len(), 2);

    let qwen_gguf_res = deduped.iter().find(|m| m.id == "gguf:qwen-4b-thai-reasoning.gguf").expect("qwen gguf");
    assert!(qwen_gguf_res.is_duplicate);
    assert!(qwen_gguf_res.is_preferred, "GGUF should be preferred over HF");

    let qwen_hf_res = deduped.iter().find(|m| m.id == "hf:nectec/qwen-4b-thai-reasoning").expect("qwen hf");
    assert!(qwen_hf_res.is_duplicate);
    assert!(!qwen_hf_res.is_preferred, "HF loses against GGUF");

    // 4. Verification of unique model: Mellum2 must not be marked as duplicate
    let mellum_res = deduped.iter().find(|m| m.id == "ollama:mellum2-12b").expect("mellum");
    assert!(!mellum_res.is_duplicate);
    assert!(!mellum_res.is_preferred);
    assert!(mellum_res.duplicate_group.is_none());
    assert!(mellum_res.duplicate_backends.is_empty());

    // 5. Verification of priority rank helper
    assert_eq!(backend_priority_rank("ollama"), 1);
    assert_eq!(backend_priority_rank("vllm"), 2);
    assert_eq!(backend_priority_rank("gguf"), 3);
    assert_eq!(backend_priority_rank("hf"), 4);
    assert_eq!(backend_priority_rank("huggingface"), 4);
    assert_eq!(backend_priority_rank("unknown"), 5);

    println!("TC-FEAT-006 (Duplicate Detection Integration) Passed in {:?}", elapsed);
}
