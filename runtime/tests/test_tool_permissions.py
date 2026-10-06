# trace:verifies FR-021
import asyncio
import hashlib
import os
import subprocess
import sys

import pytest
from local_llm_hub.config import PolicyDefinition
from local_llm_hub.errors import HubError
from local_llm_hub.memory import SQLiteMemory
from local_llm_hub.permissions import ExecutionIdentity, PermissionPolicy
from local_llm_hub.tools import ToolContext, ToolRegistry


def identity(config, policies=None):
    return ExecutionIdentity('assistant', 'session-a', 'demo',
        tuple(policies or [config.policies['writer']]), frozenset(config.agents['assistant'].tools))


@pytest.mark.parametrize('name', ['../escape', '/etc/passwd', 'C:\\Windows\\win.ini',
    '\\\\server\\share', 'notes.txt:secret', '..\\escape', '.env', '.git/config', 'CON', 'file.'])
def test_path_protection(config, name) -> None:
    policy = PermissionPolicy(config)
    with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
        policy.resolve(identity(config), name)


def test_symlink_escape(config, tmp_path) -> None:
    outside = tmp_path.parent / f'{tmp_path.name}-outside'
    outside.mkdir()
    link = tmp_path / 'link'
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip('Host does not permit symlink creation')
    with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
        PermissionPolicy(config).resolve(identity(config), 'link/secret')


@pytest.mark.skipif(os.name != 'nt', reason='Windows junction protection')
def test_windows_junction_escape(config, tmp_path) -> None:
    outside = tmp_path.parent / f'{tmp_path.name}-junction-target'
    outside.mkdir()
    link = tmp_path / 'junction'
    created = subprocess.run(['cmd.exe', '/d', '/c', 'mklink', '/J', str(link), str(outside)],
        capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    if created.returncode:
        pytest.skip('Host does not permit junction creation')
    try:
        with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
            PermissionPolicy(config).resolve(identity(config), 'junction/secret')
    finally:
        # Remove only this junction directory entry, never recurse into its target.
        link.rmdir()


async def test_tools_write_read_search_and_deny(config, tmp_path) -> None:
    memory = SQLiteMemory(config.runtime.state_path)
    tools = ToolRegistry(config)
    ctx = ToolContext(identity(config), PermissionPolicy(config), memory)
    await tools.execute('filesystem.write', {'path':'hello.txt','content':'hello world'}, ctx)
    assert (await tools.execute('filesystem.read', {'path':'hello.txt'}, ctx)).data['text'] == 'hello world'
    assert (await tools.execute('search.grep', {'path':'.','query':'world'}, ctx)).data['matches']
    restricted = ToolContext(identity(config, [config.policies['reader']]), ctx.policy, memory)
    with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
        await tools.execute('filesystem.write', {'path':'blocked.txt','content':'x'}, restricted)
    assert not (tmp_path/'blocked.txt').exists()
    with pytest.raises(HubError, match='TOOL_INPUT_INVALID'):
        await tools.execute('filesystem.read', {'path':'hello.txt','extra':True}, ctx)
    with pytest.raises(HubError):
        await tools.execute('filesystem.read', {'path':'.state/memory.sqlite3'}, ctx)
    await memory.close()


@pytest.mark.parametrize('parent_waits', [True, False])
async def test_shell_owns_descendants_even_after_parent_exit(config, tmp_path, parent_waits) -> None:
    marker = tmp_path / 'escaped.txt'
    child_code = 'import time,pathlib; time.sleep(0.7); pathlib.Path("escaped.txt").write_text("bad")'
    source = f'import subprocess,sys,time; subprocess.Popen([sys.executable,"-I","-c",{child_code!r}]); '
    source += 'time.sleep(20)' if parent_waits else 'sys.exit(0)'
    argv = (sys.executable, '-I', '-c', source)
    policy = PolicyDefinition(mode='trusted', grants=('shell',), commands=(argv,))
    actor = ExecutionIdentity('a', 's', 'demo', (policy,), frozenset({'shell'}))
    memory = SQLiteMemory(config.runtime.state_path)
    registry = ToolRegistry(config)
    registry.timeout = 0.3
    try:
        if parent_waits:
            with pytest.raises(HubError, match='TOOL_TIMEOUT'):
                await registry.execute('shell', {'argv': list(argv)}, ToolContext(actor, PermissionPolicy(config), memory))
        else:
            result = await registry.execute('shell', {'argv': list(argv)}, ToolContext(actor, PermissionPolicy(config), memory))
            assert result.data['exit_code'] == 0
        await asyncio.sleep(0.8)
        assert not marker.exists()
    finally:
        await memory.close()


async def test_exact_shell_policy_and_timeout(config, tmp_path) -> None:
    argv = (sys.executable, '-I', '-c', 'import os; print(os.getenv("LOCAL_LLM_HUB_TOKEN", "clean"))')
    slow = (sys.executable, '-I', '-c', 'import time; time.sleep(30)')
    policy = PolicyDefinition(mode='trusted', grants=('shell',), commands=(argv, slow))
    actor = ExecutionIdentity('a','s','demo',(policy,),frozenset({'shell'}))
    memory = SQLiteMemory(config.runtime.state_path)
    ctx = ToolContext(actor, PermissionPolicy(config), memory)
    registry = ToolRegistry(config)
    result = await registry.execute('shell', {'argv':list(argv)}, ctx)
    assert result.data['exit_code'] == 0 and 'clean' in result.data['stdout']
    with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
        await registry.execute('shell', {'argv':[sys.executable,'-c','print(1)']}, ctx)
    registry.timeout = 0.1
    with pytest.raises(HubError, match='TOOL_TIMEOUT'):
        await registry.execute('shell', {'argv':list(slow)}, ctx)
    await memory.close()


async def test_read_evidence_bounded_and_denied(config, tmp_path) -> None:
    (tmp_path / 'large.txt').write_text('x' * 1000)
    registry = ToolRegistry(config)
    registry.limit = 256
    memory = SQLiteMemory(config.runtime.state_path)
    ctx = ToolContext(identity(config), PermissionPolicy(config), memory, reads=[])
    try:
        returned = await registry.execute('filesystem.read', {'path': 'large.txt'}, ctx, tool_call_id='read-large')
        observed_text = returned.data.get('text', returned.data.get('preview'))
        read = ctx.reads[0]
        assert read.truncated and read.sha256 == hashlib.sha256(observed_text.encode()).hexdigest()
        assert read.returned_bytes == len(observed_text.encode()) and read.tool_call_id == 'read-large'
        with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
            await registry.execute('filesystem.read', {'path': '../escape'}, ctx, tool_call_id='denied')
        assert len(ctx.reads) == 1
    finally:
        await memory.close()
