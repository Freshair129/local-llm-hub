# trace:verifies FR-018
from pathlib import Path

import pytest
from local_llm_hub.config import load_config
from local_llm_hub.errors import HubError
from local_llm_hub.models import Capabilities, ModelDefinition
from local_llm_hub.registry import ModelRegistry


def write_config(tmp_path: Path, models: str = '') -> Path:
    (tmp_path / 'models.yaml').write_text(models or '''
endpoints:
  cpu: {provider: mock, max_concurrency: 1}
models:
  demo:
    endpoint: cpu
    model: demo
    aliases: [chat]
    roles: [general]
    capabilities: {tool_calling: true, context_length: 8192}
''')
    (tmp_path / 'agents.yaml').write_text('agents:\n  assistant: {role: general, project: demo}\n')
    (tmp_path / 'permissions.yaml').write_text('projects:\n  demo: {roots: ["."]}\npolicies:\n  reader: {mode: read-only}\n')
    (tmp_path / 'runtime.yaml').write_text('runtime: {auth_env: HUB_TEST_KEY}\n')
    return tmp_path


def test_config_and_alias(tmp_path: Path) -> None:
    config = load_config(write_config(tmp_path), {'HUB_TEST_KEY': 'unit-test-key-long-enough'})
    assert config.projects['demo'].roots == [tmp_path.resolve()]
    assert ModelRegistry(config.models).resolve('chat').id == 'demo'


@pytest.mark.parametrize('bad', [
    'endpoints: {}\nmodels: {}\nmodels: {}',
    'endpoints: {}\nmodels: {}\nunknown: true',
    'endpoints: {cpu: {provider: mock, max_concurrency: 0}}\nmodels: {}',
    'endpoints: {}\nmodels: {a: {endpoint: missing, model: a}}',
])
def test_bad_config_fails_safely(tmp_path: Path, bad: str) -> None:
    with pytest.raises(HubError, match='CONFIG_INVALID'):
        load_config(write_config(tmp_path, bad), {'HUB_TEST_KEY': 'unit-test-key-long-enough'})


def test_missing_secret_does_not_leak(tmp_path: Path) -> None:
    with pytest.raises(HubError, match='CONFIG_INVALID') as error:
        load_config(write_config(tmp_path), {})
    assert 'unit-test-key' not in str(error.value)


def test_registry_rejects_alias_collision_and_preserves_state() -> None:
    a = ModelDefinition(id='a', endpoint='cpu', model='a', aliases=['alias'], capabilities=Capabilities(context_length=1000))
    registry = ModelRegistry({'a': a})
    with pytest.raises(HubError):
        registry.register(ModelDefinition(id='b', endpoint='cpu', model='b', aliases=['alias']))
    assert registry.resolve('alias').id == 'a'
    assert len(registry.list()) == 1
