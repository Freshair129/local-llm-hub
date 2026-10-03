# trace:verifies FR-021
import asyncio
import json
import socket

import pytest
from local_llm_hub.config import PolicyDefinition
from local_llm_hub.errors import HubError
from local_llm_hub.mcp import MCPTool, register_mcp
from local_llm_hub.memory import SQLiteMemory
from local_llm_hub.permissions import ExecutionIdentity, PermissionPolicy
from local_llm_hub.tools import ToolContext, ToolRegistry


async def test_mcp_discovery_never_grants_permission_and_limits_execution(config):
    class Adapter:
        calls = 0
        async def list_tools(self):
            return [MCPTool('echo', 'Echo data', {'type': 'object', 'properties': {'text': {'type': 'string'}}, 'required': ['text'], 'additionalProperties': False})]
        async def call_tool(self, name, arguments):
            self.calls += 1
            if arguments['text'] == 'slow':
                await asyncio.sleep(10)
            return arguments
        async def close(self):
            pass
    adapter = Adapter()
    registry = ToolRegistry(config)
    await register_mcp(registry, 'fixture', adapter)
    memory = SQLiteMemory(config.runtime.state_path)
    name = 'mcp.fixture.echo'
    policy = PolicyDefinition(grants=(name,))
    actor = ExecutionIdentity('a', 's', 'demo', (policy,), frozenset())
    try:
        with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
            await registry.execute(name, {'text': 'x'}, ToolContext(actor, PermissionPolicy(config), memory))
        assert adapter.calls == 0
        allowed = ExecutionIdentity('a', 's', 'demo', (policy,), frozenset({name}))
        ctx = ToolContext(allowed, PermissionPolicy(config), memory)
        assert (await registry.execute(name, {'text': 'hello'}, ctx)).data == {'text': 'hello'}
        with pytest.raises(HubError, match='TOOL_INPUT_INVALID'):
            await registry.execute(name, {'wrong': 'x'}, ctx)
        registry.timeout = .05
        with pytest.raises(HubError, match='TOOL_TIMEOUT'):
            await registry.execute(name, {'text': 'slow'}, ctx)
        bounded = await registry.execute(name, {'text': 'x' * 20000}, ctx)
        assert bounded.truncated and bounded.original_bytes > 20000
        assert len(bounded.model_dump_json().encode()) < config.runtime.tool_output_bytes
    finally:
        await adapter.close()
        await memory.close()


async def test_http_explicit_local_origin_redirect_and_dns_protection(config, monkeypatch):
    async def serve(reader, writer):
        request = await reader.readuntil(b'\r\n\r\n')
        redirect = b'/redirect ' in request
        body = json.dumps({'hello': 'local'}).encode()
        status = b'302 Found\r\nLocation: http://example.com/' if redirect else b'200 OK'
        writer.write(b'HTTP/1.1 ' + status + b'\r\nContent-Length: ' + str(len(body)).encode() + b'\r\nConnection: close\r\n\r\n' + body)
        await writer.drain()
        writer.close()
        await writer.wait_closed()
    server = await asyncio.start_server(serve, '127.0.0.1', 0)
    port = server.sockets[0].getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    policy = PolicyDefinition(mode='trusted', grants=('http',), http_origins=(origin, 'http://rebind.invalid'))
    actor = ExecutionIdentity('a', 's', 'demo', (policy,), frozenset({'http'}))
    memory = SQLiteMemory(config.runtime.state_path)
    ctx = ToolContext(actor, PermissionPolicy(config), memory)
    registry = ToolRegistry(config)
    try:
        result = await registry.execute('http', {'url': origin + '/data'}, ctx)
        assert result.data['status'] == 200 and 'local' in result.data['text']
        for url in (origin + '/redirect', 'http://169.254.169.254/', 'https://example.com/'):
            with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
                await registry.execute('http', {'url': url}, ctx)
        async def rebinding(*args, **kwargs):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))]
        monkeypatch.setattr(asyncio.get_running_loop(), 'getaddrinfo', rebinding)
        with pytest.raises(HubError, match='TOOL_PERMISSION_DENIED'):
            await registry.execute('http', {'url': 'http://rebind.invalid'}, ctx)
    finally:
        server.close()
        await server.wait_closed()
        await memory.close()
