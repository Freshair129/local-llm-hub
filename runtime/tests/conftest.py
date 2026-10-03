from pathlib import Path

import pytest
from local_llm_hub.config import (
    AgentDefinition,
    EndpointDefinition,
    HubConfig,
    PolicyDefinition,
    ProjectDefinition,
    RuntimeSettings,
)
from local_llm_hub.models import Capabilities, ModelDefinition
from pydantic import SecretStr


@pytest.fixture
def config(tmp_path: Path) -> HubConfig:
    grants = ('filesystem.read', 'filesystem.write', 'filesystem.list', 'search.grep',
              'memory.store', 'memory.retrieve', 'memory.search', 'memory.update',
              'memory.delete', 'agent.delegate')
    return HubConfig(
        endpoints={'cpu': EndpointDefinition(provider='mock')},
        models={'demo': ModelDefinition(id='demo', endpoint='cpu', model='demo',
            aliases=('chat',), roles=('general',), capabilities=Capabilities(
                tool_calling=True, structured_output=True, coding=True, reasoning=True,
                context_length=16384))},
        agents={
            'assistant': AgentDefinition(id='assistant', policy='writer', tools=grants,
                delegate_to=('assistant', 'reviewer')),
            'reviewer': AgentDefinition(id='reviewer', tools=('filesystem.read',)),
        },
        projects={'demo': ProjectDefinition(roots=[tmp_path])},
        policies={
            'reader': PolicyDefinition(grants=('filesystem.read',)),
            'writer': PolicyDefinition(mode='workspace', grants=grants),
        },
        runtime=RuntimeSettings(token=SecretStr('test-only-auth-token-123'),
            state_path=tmp_path / '.state' / 'memory.sqlite3', agent_concurrency=1,
            run_timeout=5, queue_timeout=1, tool_timeout=2),
    )
