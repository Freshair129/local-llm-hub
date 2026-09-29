#!/usr/bin/env python3
"""
LiteLLM Unified Proxy Sidecar Server
trace:implements FR-008
Orchestrates an OpenAI-compatible endpoint on localhost:4000
connecting to local Ollama and vLLM backends.
"""

import os
import sys
import json
import yaml
import subprocess
import requests
from pathlib import Path

DEFAULT_PORT = int(os.environ.get("LITELLM_PORT", "4000"))
DEFAULT_HOST = os.environ.get("LITELLM_HOST", "127.0.0.1")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
VLLM_URL = os.environ.get("VLLM_URL", "http://127.0.0.1:8000")
CONFIG_PATH = os.environ.get("CONFIG_PATH", "sidecar/config.yaml")

def fetch_ollama_models(ollama_url):
    try:
        res = requests.get(f"{ollama_url}/api/tags", timeout=2)
        if res.status_code == 200:
            data = res.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception as e:
        print(f"[Sidecar] Notice: Ollama not reachable at {ollama_url} ({e})")
    return []

def ensure_config():
    config_file = Path(CONFIG_PATH)
    if config_file.exists():
        print(f"[Sidecar] Using existing config: {config_file.resolve()}")
        return str(config_file.resolve())

    print(f"[Sidecar] Generating default LiteLLM config at {config_file.resolve()}...")
    config_file.parent.mkdir(parents=True, exist_ok=True)
    
    models = fetch_ollama_models(OLLAMA_URL)
    model_list = []
    
    for m in models:
        clean_name = m.split(":")[0].replace("/", "-")
        model_list.append({
            "model_name": clean_name,
            "litellm_params": {
                "model": f"ollama/{m}",
                "api_base": OLLAMA_URL
            }
        })
        
    if not model_list:
        model_list.append({
            "model_name": "local-default",
            "litellm_params": {
                "model": "ollama/default",
                "api_base": OLLAMA_URL
            }
        })

    config_data = {
        "model_list": model_list,
        "litellm_settings": {
            "drop_params": True,
            "set_verbose": False
        },
        "general_settings": {
            "master_key": "sk-local-hub"
        }
    }

    with open(config_file, "w", encoding="utf-8") as f:
        yaml.dump(config_data, f, default_flow_style=False)
        
    return str(config_file.resolve())

def main():
    cfg_path = ensure_config()
    cmd = [
        sys.executable, "-m", "litellm",
        "--config", cfg_path,
        "--host", DEFAULT_HOST,
        "--port", str(DEFAULT_PORT)
    ]
    print(f"[Sidecar] Starting LiteLLM proxy on {DEFAULT_HOST}:{DEFAULT_PORT}...")
    print(f"[Sidecar] Executing: {' '.join(cmd)}")
    try:
        proc = subprocess.Popen(cmd)
        proc.wait()
    except KeyboardInterrupt:
        print("[Sidecar] Shutting down...")
        proc.terminate()

if __name__ == "__main__":
    main()
