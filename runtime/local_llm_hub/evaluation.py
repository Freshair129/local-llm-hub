# trace:implements FR-023
import ast
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from .agents import AgentRuntime
from .config import HubConfig
from .errors import HubError
from .models import StrictModel


class EvaluationRow(StrictModel):
    task: str
    model: str | None = None
    status: Literal['PASS', 'FAIL', 'SKIP']
    success: bool | None
    latency_ms: float | None = None
    tokens_per_second: float | None = None
    time_to_first_token_ms: float | None = None
    error: str | None = None


class EvaluationReport(StrictModel):
    mode: Literal['mock-contract', 'provider-evaluation']
    results: list[EvaluationRow]
    passed: int
    failed: int
    skipped: int
    error_rate: float | None


@dataclass(frozen=True)
class EvaluationCase:
    name: str
    agent: str
    prompt: str
    mock_prompt: str
    assertion: Callable[[Any], bool]


def addition_function(output: Any) -> bool:
    if not isinstance(output, str):
        return False
    try:
        actual = ast.dump(ast.parse(output.strip()))
        expected = ast.dump(ast.parse('def add(a, b):\n    return a + b'))
        return actual == expected
    except SyntaxError:
        return False


CASES = (
    EvaluationCase('instruction_following', 'assistant', 'Reply with exactly READY and no other text.', 'echo:READY', lambda v: v == 'READY'),
    EvaluationCase('tool_calling', 'coder', 'Store eval-check=verified in session memory using memory.store and report the value.',
        'tool:{"name":"memory.store","arguments":{"key":"eval-check","value":"verified"}}', lambda v: isinstance(v, str) and 'verified' in v),
    EvaluationCase('structured_output', 'structured', 'Return answer as the integer 42.', 'json:{"answer":42}', lambda v: v == {'answer': 42}),
    EvaluationCase('coding', 'assistant', 'Return only Python source: a function add(a, b) returning a + b. No markdown.',
        'echo:def add(a, b):\n    return a + b', addition_function),
    EvaluationCase('reasoning', 'assistant', 'What is 6 multiplied by 7? Reply with only the number.', 'echo:42', lambda v: v == '42'),
)


async def evaluate(config: HubConfig) -> EvaluationReport:
    mock = all(e.provider == 'mock' for e in config.endpoints.values())
    runtime = AgentRuntime(config)
    rows: list[EvaluationRow] = []
    try:
        for case in CASES:
            if case.agent not in config.agents:
                rows.append(EvaluationRow(task=case.name, status='SKIP', success=None, error='AGENT_NOT_CONFIGURED'))
                continue
            started = time.perf_counter()
            try:
                result = await runtime.run(case.agent, case.mock_prompt if mock else case.prompt)
                success = case.assertion(result.output)
                if case.name == 'tool_calling':
                    from .memory import Namespace
                    record = await runtime.memory.retrieve(Namespace('session', config.agents[case.agent].project, result.session_id), 'eval-check')
                    success = success and record.value == 'verified'
                rows.append(EvaluationRow(task=case.name, model=result.model_id, status='PASS' if success else 'FAIL',
                    success=success, latency_ms=(time.perf_counter() - started) * 1000,
                    error=None if success else 'ASSERTION_FAILED'))
            except HubError as error:
                rows.append(EvaluationRow(task=case.name, status='FAIL', success=False,
                    latency_ms=(time.perf_counter() - started) * 1000, error=error.code))
    finally:
        await runtime.close()
    passed, failed, skipped = (sum(r.status == status for r in rows) for status in ('PASS', 'FAIL', 'SKIP'))
    return EvaluationReport(mode='mock-contract' if mock else 'provider-evaluation', results=rows,
        passed=passed, failed=failed, skipped=skipped, error_rate=failed / (passed + failed) if passed + failed else None)
