# trace:implements FR-018
import os
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlsplit

import jsonschema
import yaml
from pydantic import Field, SecretStr, StrictBool, ValidationError

from .errors import HubError
from .models import (
    BUILTIN_TOOLS,
    Capability,
    Identifier,
    InferenceSettings,
    ModelDefinition,
    StrictModel,
)
from .registry import ModelRegistry


class EndpointDefinition(StrictModel):
    provider: Literal['mock', 'openai-compatible']
    base_url: str | None = None
    api_key_env: str | None = None
    api_key: SecretStr | None = Field(default=None, exclude=True)
    cloud: bool = False
    max_concurrency: int = Field(default=1, gt=0, le=128)
    max_queue: int = Field(default=32, ge=0, le=10000)
    supported_inference_settings: tuple[Literal['top_p', 'presence_penalty', 'reasoning_effort'], ...] = ()


class ProjectDefinition(StrictModel):
    roots: list[Path]


class PolicyDefinition(StrictModel):
    mode: Literal['read-only', 'workspace', 'trusted', 'admin'] = 'read-only'
    grants: tuple[str, ...] = ()
    commands: tuple[tuple[str, ...], ...] = ()
    http_origins: tuple[str, ...] = ()


class AgentDefinition(StrictModel):
    id: Identifier
    role: str = 'general'
    model: str = 'auto'
    project: str = 'demo'
    policy: str = 'reader'
    instructions: str = 'You are a helpful local assistant.'
    tools: tuple[str, ...] = ()
    requires: tuple[Capability, ...] = ()
    delegate_to: tuple[str, ...] = ()
    context_budget: int = Field(default=8192, gt=0)
    max_tokens: int = Field(default=1024, gt=0)
    allow_cloud: bool = False
    output_schema: dict[str, Any] | None = None
    inference_settings: InferenceSettings = Field(default_factory=InferenceSettings)
    emit_run_evidence: StrictBool = False


class RuntimeSettings(StrictModel):
    host: str = '127.0.0.1'
    port: int = Field(default=8787, gt=0, le=65535)
    allow_remote_bind: bool = False
    auth_env: str = 'LOCAL_LLM_HUB_TOKEN'
    token: SecretStr = Field(default=SecretStr(''), exclude=True)
    state_path: Path = Path('../.hub/memory.sqlite3')
    agent_concurrency: int = Field(default=4, gt=0, le=128)
    queue_timeout: float = Field(default=10, gt=0)
    run_timeout: float = Field(default=120, gt=0, le=3600)
    max_depth: int = Field(default=3, ge=0, le=10)
    max_delegations: int = Field(default=16, ge=0, le=100)
    max_model_requests: int = Field(default=16, gt=0, le=100)
    max_tool_calls: int = Field(default=24, gt=0, le=100)
    max_sessions: int = Field(default=1000, gt=0)
    session_ttl: float = Field(default=3600, gt=0)
    tool_timeout: float = Field(default=10, gt=0, le=120)
    tool_output_bytes: int = Field(default=16384, ge=256, le=1048576)
    health_interval: float = Field(default=30, gt=0)


class HubConfig(StrictModel):
    endpoints: dict[Identifier, EndpointDefinition]
    models: dict[Identifier, ModelDefinition]
    agents: dict[Identifier, AgentDefinition]
    projects: dict[Identifier, ProjectDefinition]
    policies: dict[Identifier, PolicyDefinition]
    runtime: RuntimeSettings


class UniqueLoader(yaml.SafeLoader):
    pass


def _mapping(loader: UniqueLoader, node: yaml.MappingNode) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if not isinstance(key, str) or key in result:
            raise HubError('CONFIG_INVALID', 'YAML keys must be unique strings')
        result[key] = loader.construct_object(value_node)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)


def _env(value: Any, environ: Mapping[str, str]) -> Any:
    if isinstance(value, str):
        def replace(match: re.Match[str]) -> str:
            name = match.group(1)
            if name not in environ:
                raise HubError('CONFIG_INVALID', f'Missing environment variable: {name}')
            return environ[name]
        return re.sub(r'\$\{([A-Z_][A-Z0-9_]*)\}', replace, value)
    if isinstance(value, list):
        return [_env(v, environ) for v in value]
    if isinstance(value, dict):
        return {k: _env(v, environ) for k, v in value.items()}
    return value


def load_config(directory: Path, environ: Mapping[str, str] | None = None) -> HubConfig:
    env = os.environ if environ is None else environ
    directory = directory.resolve()
    merged: dict[str, Any] = {}
    try:
        for filename in ('models.yaml', 'agents.yaml', 'permissions.yaml', 'runtime.yaml'):
            data = yaml.load((directory / filename).read_text(encoding='utf-8'), Loader=UniqueLoader)
            if not isinstance(data, dict) or merged.keys() & data.keys():
                raise HubError('CONFIG_INVALID', f'Invalid or duplicated section in {filename}')
            merged.update(_env(data, env))
        for section in ('models', 'agents'):
            for key, value in merged.get(section, {}).items():
                if 'id' in value:
                    raise HubError('CONFIG_INVALID', 'Use the mapping key as the definition ID')
                value['id'] = key
        for value in merged.get('models', {}).values():
            if 'context_length' not in value.get('capabilities', {}):
                raise HubError('CONFIG_INVALID', 'Every configured model needs an explicit context_length')
        if 'token' in merged.get('runtime', {}) or any('api_key' in e for e in merged.get('endpoints', {}).values()):
            raise HubError('CONFIG_INVALID', 'Credentials must use environment references')
        config = HubConfig.model_validate(merged)
    except (OSError, yaml.YAMLError, TypeError, AttributeError) as error:
        raise HubError('CONFIG_INVALID', 'Unable to read configuration structure') from error
    except ValidationError as error:
        locations = ['.'.join(map(str, e['loc'])) for e in error.errors(include_input=False)]
        raise HubError('CONFIG_INVALID', 'Invalid fields', details={'fields': locations}) from error
    registry = ModelRegistry(config.models)
    if not config.models or not config.agents:
        raise HubError('CONFIG_INVALID', 'At least one model and agent must be configured')
    endpoints: dict[str, EndpointDefinition] = {}
    for key, endpoint in config.endpoints.items():
        url = urlsplit(endpoint.base_url or '')
        if endpoint.provider != 'mock' and (
            url.scheme not in {'http', 'https'} or not url.hostname or url.username
            or url.password or url.query or url.fragment
        ):
            raise HubError('CONFIG_INVALID', f'Invalid endpoint URL: {key}')
        secret = env.get(endpoint.api_key_env or '')
        if endpoint.api_key_env and not secret:
            raise HubError('CONFIG_INVALID', f'Missing credential for endpoint: {key}')
        endpoints[key] = endpoint.model_copy(update={'base_url': (endpoint.base_url or '').rstrip('/'),
                                                    'api_key': SecretStr(secret) if secret else None})
    for model in config.models.values():
        if model.endpoint not in endpoints:
            raise HubError('CONFIG_INVALID', f'Unknown endpoint for model: {model.id}')
        if model.max_concurrency and model.max_concurrency != endpoints[model.endpoint].max_concurrency:
            raise HubError('CONFIG_INVALID', 'Model and endpoint concurrency disagree')
    def visit(name: str, ancestors: frozenset[str]) -> None:
        if name in ancestors:
            raise HubError('CONFIG_INVALID', 'Fallback cycle')
        if name not in config.models:
            raise HubError('CONFIG_INVALID', 'Unknown fallback model')
        for fallback in config.models[name].fallbacks:
            visit(fallback, ancestors | {name})
    for name in config.models:
        visit(name, frozenset())
    projects: dict[str, ProjectDefinition] = {}
    for name, project in config.projects.items():
        roots = [(directory / p).resolve() for p in project.roots]
        if not roots or any(not p.is_dir() for p in roots):
            raise HubError('CONFIG_INVALID', f'Invalid workspace roots: {name}')
        projects[name] = project.model_copy(update={'roots': roots})
    for policy in config.policies.values():
        if set(policy.grants) - BUILTIN_TOOLS:
            raise HubError('CONFIG_INVALID', 'Unknown tool grant')
        if policy.mode != 'trusted' and ({'shell', 'http'} & set(policy.grants)):
            raise HubError('CONFIG_INVALID', 'Shell and HTTP require trusted policy')
        if policy.mode == 'read-only' and any(t in policy.grants for t in
                ('filesystem.write', 'memory.store', 'memory.update', 'memory.delete')):
            raise HubError('CONFIG_INVALID', 'Read-only policy grants a write tool')
        for command in policy.commands:
            if not command or not Path(command[0]).is_absolute() or not Path(command[0]).is_file():
                raise HubError('CONFIG_INVALID', 'Commands must specify an existing absolute executable')
        for origin in policy.http_origins:
            parsed = urlsplit(origin)
            if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password or parsed.path not in {'', '/'} or parsed.query or parsed.fragment:
                raise HubError('CONFIG_INVALID', 'HTTP grants must be exact origins')
    for agent in config.agents.values():
        if agent.output_schema is not None:
            try:
                jsonschema.Draft202012Validator.check_schema(agent.output_schema)
                if agent.output_schema.get('type') != 'object':
                    raise HubError('CONFIG_INVALID', 'Agent output schema must be an object')
            except jsonschema.SchemaError as error:
                raise HubError('CONFIG_INVALID', 'Invalid agent output schema') from error
        if agent.policy not in config.policies or agent.project not in projects:
            raise HubError('CONFIG_INVALID', 'Unknown agent policy or project')
        policy = config.policies[agent.policy]
        if policy.mode == 'admin' or set(agent.tools) - set(policy.grants):
            raise HubError('CONFIG_INVALID', 'Agent tools exceed policy')
        if any(child not in config.agents for child in agent.delegate_to):
            raise HubError('CONFIG_INVALID', 'Unknown delegate agent')
        if agent.model != 'auto':
            try:
                registry.resolve(agent.model)
            except HubError as error:
                raise HubError('CONFIG_INVALID', 'Unknown agent model') from error
        elif not any(agent.role in m.roles for m in registry.list()):
            raise HubError('CONFIG_INVALID', 'Agent role has no registered models')
        required_settings = agent.inference_settings.optional_settings()
        if required_settings:
            initial = ([registry.resolve(agent.model)] if agent.model != 'auto' else
                       [m for m in registry.list() if agent.role in m.roles])
            checked: set[str] = set()
            pending = list(initial)
            while pending:
                model = pending.pop()
                if model.id in checked:
                    continue
                checked.add(model.id)
                if required_settings - set(endpoints[model.endpoint].supported_inference_settings):
                    raise HubError('CONFIG_INVALID', 'Agent settings unsupported by a configured candidate')
                pending.extend(registry.resolve(fallback) for fallback in model.fallbacks)
    token = env.get(config.runtime.auth_env, '')
    if len(token) < 16 or token in {'replace-with-random-token', 'change-me'}:
        raise HubError('CONFIG_INVALID', 'Set a runtime auth token of at least 16 characters')
    if config.runtime.host not in {'127.0.0.1', '::1', 'localhost'} and not config.runtime.allow_remote_bind:
        raise HubError('CONFIG_INVALID', 'Remote bind requires explicit opt-in')
    runtime = config.runtime.model_copy(update={'token': SecretStr(token),
        'state_path': (directory / config.runtime.state_path).resolve()})
    return config.model_copy(update={'endpoints': endpoints, 'projects': projects, 'runtime': runtime})
