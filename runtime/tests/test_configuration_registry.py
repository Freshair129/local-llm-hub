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


@pytest.mark.parametrize('settings', [
    {'temperature': -1}, {'temperature': '1'}, {'temperature': True},
    {'temperature': float('nan')}, {'top_p': 0}, {'top_p': float('inf')},
    {'presence_penalty': 3}, {'reasoning_effort': 'high'}, {'top_k': 20},
])
def test_settings_defaults_and_validation(tmp_path: Path, settings) -> None:
    import yaml

    directory = write_config(tmp_path)
    env = {'HUB_TEST_KEY': 'unit-test-key-long-enough'}
    baseline = load_config(directory, env)
    assert baseline.agents['assistant'].inference_settings.temperature == 0.2
    assert baseline.agents['assistant'].emit_run_evidence is False
    (directory / 'agents.yaml').write_text(yaml.safe_dump({'agents': {'assistant': {
        'inference_settings': settings}}}))
    with pytest.raises(HubError, match='CONFIG_INVALID'):
        load_config(directory, env)


def test_settings_endpoint_support_before_run(tmp_path: Path) -> None:
    directory = write_config(tmp_path)
    env = {'HUB_TEST_KEY': 'unit-test-key-long-enough'}
    (directory / 'agents.yaml').write_text('agents:\n  assistant:\n    inference_settings: {reasoning_effort: none}\n')
    with pytest.raises(HubError, match='CONFIG_INVALID'):
        load_config(directory, env)
    models = directory / 'models.yaml'
    models.write_text(models.read_text().replace('provider: mock,',
        'provider: mock, supported_inference_settings: [reasoning_effort],'))
    assert load_config(directory, env).agents['assistant'].inference_settings.reasoning_effort == 'none'


def test_fallback_settings_checked_at_config_load(tmp_path: Path) -> None:
    import yaml

    directory = write_config(tmp_path)
    env = {'HUB_TEST_KEY': 'unit-test-key-long-enough'}
    models_path = directory / 'models.yaml'
    data = yaml.safe_load(models_path.read_text())
    data['endpoints']['cpu']['supported_inference_settings'] = ['reasoning_effort']
    data['endpoints']['backup'] = {'provider': 'mock'}
    data['models']['demo']['fallbacks'] = ['backup']
    data['models']['backup'] = {'endpoint': 'backup', 'model': 'backup', 'capabilities': {'context_length': 8192}}
    models_path.write_text(yaml.safe_dump(data))
    (directory / 'agents.yaml').write_text('agents:\n  assistant:\n    model: demo\n    inference_settings: {reasoning_effort: none}\n')
    with pytest.raises(HubError, match='CONFIG_INVALID'):
        load_config(directory, env)
