# trace:verifies FR-023
from pathlib import Path

from local_llm_hub.config import load_config
from local_llm_hub.evaluation import addition_function, evaluate

ROOT = Path(__file__).resolve().parents[2]

async def test_mock_evaluation_runs_five_real_assertions(tmp_path):
    config = load_config(ROOT / 'config', {'LOCAL_LLM_HUB_TOKEN': 'fixture-key-long-enough'})
    config = config.model_copy(update={'runtime': config.runtime.model_copy(update={'state_path': tmp_path / 'memory.db'})})
    result = await evaluate(config)
    assert result.mode == 'mock-contract'
    assert (result.passed, result.failed, result.skipped) == (5, 0, 0)
    assert result.error_rate == 0
    assert all(r.tokens_per_second is None and r.time_to_first_token_ms is None for r in result.results)
    assert not addition_function('def add(a,b): return a-b')
    assert not addition_function('not python!')
