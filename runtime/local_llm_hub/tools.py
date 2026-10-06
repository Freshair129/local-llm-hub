# trace:implements FR-021
import asyncio
import json
import logging
import os
import re
import signal
import stat
import subprocess
import sys
import tempfile
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from hashlib import sha256
from itertools import islice
from pathlib import Path, PurePosixPath
from typing import Any, Literal

import httpx
import jsonschema
from pydantic import Field, ValidationError

from .config import HubConfig
from .errors import HubError
from .memory import MemoryStore, Namespace
from .models import ReadEvidence, StrictModel
from .permissions import ExecutionIdentity, PermissionPolicy, denied


class PathInput(StrictModel):
    path: str = '.'
    root: int = Field(default=0, ge=0)


class WriteInput(PathInput):
    content: str = Field(max_length=65536)


class SearchInput(PathInput):
    query: str = Field(min_length=1, max_length=500)


class ShellInput(PathInput):
    argv: list[str] = Field(min_length=1, max_length=100)


class HttpInput(StrictModel):
    url: str = Field(max_length=2048)
    method: Literal['GET', 'HEAD'] = 'GET'


class MemoryInput(StrictModel):
    scope: Literal['session', 'project', 'agent'] = 'session'
    key: str = Field(default='', max_length=200)
    value: str = Field(default='', max_length=65536)
    query: str = Field(default='', max_length=1000)


class DelegateInput(StrictModel):
    agent_id: str
    task: str = Field(min_length=1, max_length=65536)


class ToolResult(StrictModel):
    data: Any
    truncated: bool = False
    original_bytes: int | None = None


@dataclass
class ToolContext:
    identity: ExecutionIdentity
    policy: PermissionPolicy
    memory: MemoryStore
    delegate: Callable[[str, str], Awaitable[str]] | None = None
    request_id: str | None = None
    reads: list[ReadEvidence] | None = None


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    handler: Callable[[dict[str, Any], ToolContext], Awaitable[ToolResult]]
    permission: str
    timeout: float


class ToolRegistry:
    def __init__(self, config: HubConfig) -> None:
        self.config, self.timeout = config, config.runtime.tool_timeout
        self.limit = config.runtime.tool_output_bytes
        self.definitions: dict[str, ToolDefinition] = {}
        schemas: dict[str, type[StrictModel]] = {
            'filesystem.read': PathInput, 'filesystem.write': WriteInput, 'filesystem.list': PathInput,
            'search.grep': SearchInput, 'shell': ShellInput, 'http': HttpInput, 'agent.delegate': DelegateInput,
            **dict.fromkeys(('memory.store', 'memory.retrieve', 'memory.search', 'memory.update', 'memory.delete'), MemoryInput),
        }
        for name, schema in schemas.items():
            async def handler(args: dict[str, Any], ctx: ToolContext, *, tool_name: str = name,
                              model: type[StrictModel] = schema) -> ToolResult:
                validated = model.model_validate(args)
                return ToolResult(data=await self._native(tool_name, validated.model_dump(), ctx))
            self.register(ToolDefinition(name, f'{name}: scoped operation with bounded output', schema.model_json_schema(),
                                         ToolResult.model_json_schema(), handler, name, self.timeout))

    def register(self, definition: ToolDefinition) -> None:
        wire_name = definition.name.replace('.', '__')
        if (not re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]{0,63}', definition.name) or
            wire_name in {name.replace('.', '__') for name in self.definitions}):
            raise HubError('CONFIG_INVALID', 'Invalid or duplicate tool name')
        jsonschema.Draft202012Validator.check_schema(definition.input_schema)
        jsonschema.Draft202012Validator.check_schema(definition.output_schema)
        self.definitions[definition.name] = definition

    async def execute(self, name: str, arguments: dict[str, Any], execution: ToolContext,
                      *, tool_call_id: str | None = None) -> ToolResult:
        if name not in self.definitions:
            raise HubError('TOOL_NOT_FOUND', 'Unknown tool', 404)
        definition = self.definitions[name]
        execution.policy.authorize(execution.identity, definition.permission)
        try:
            jsonschema.validate(arguments, definition.input_schema)
            async with asyncio.timeout(min(self.timeout, definition.timeout)):
                result = await definition.handler(arguments, execution)
        except (ValidationError, jsonschema.ValidationError) as error:
            raise HubError('TOOL_INPUT_INVALID', 'Tool schema validation failed', 422) from error
        except TimeoutError as error:
            raise HubError('TOOL_TIMEOUT', 'Tool deadline exceeded', 504) from error
        except (OSError, httpx.TransportError) as error:
            raise HubError('TOOL_ERROR', 'Tool operation failed', 502) from error
        try:
            jsonschema.validate(result.model_dump(), definition.output_schema)
        except jsonschema.ValidationError as error:
            raise HubError('TOOL_OUTPUT_INVALID', 'Tool output schema validation failed', 502) from error
        logging.getLogger('local_llm_hub').info(json.dumps({'event': 'tool_completed',
            'request_id': execution.request_id, 'session_id': execution.identity.session_id,
            'agent_id': execution.identity.agent_id, 'tool_name': name}))
        raw = result.model_dump_json().encode('utf-8')
        if len(raw) > self.limit:
            result = ToolResult(data={'preview': raw[:self.limit // 4].decode('utf-8', errors='replace')},
                                truncated=True, original_bytes=len(raw))
        if name == 'filesystem.read' and execution.reads is not None:
            if not tool_call_id:
                raise HubError('TOOL_OUTPUT_INVALID', 'Read evidence requires a tool call identity', 502)
            text = result.data.get('text', result.data.get('preview'))
            if not isinstance(text, str):
                raise HubError('TOOL_OUTPUT_INVALID', 'Read result has no text', 502)
            encoded = text.encode('utf-8')
            execution.reads.append(ReadEvidence(root=arguments.get('root', 0),
                path=PurePosixPath(arguments.get('path', '.').replace('\\', '/')).as_posix(),
                tool_call_id=tool_call_id, sha256=sha256(encoded).hexdigest(), returned_bytes=len(encoded),
                truncated=result.truncated or bool(result.data.get('truncated', False))))
        return result

    async def _native(self, name: str, args: dict[str, Any], ctx: ToolContext) -> Any:
        actor = ctx.identity
        if name == 'agent.delegate':
            if ctx.delegate is None:
                raise denied()
            return {'output': await ctx.delegate(args['agent_id'], args['task'])}
        if name.startswith('memory.'):
            scope = args['scope']
            owner = actor.session_id if scope == 'session' else actor.agent_id if scope == 'agent' else ''
            ns = Namespace(scope, actor.project, owner, time.time() + self.config.runtime.session_ttl if scope == 'session' else None)
            if name == 'memory.search':
                return [r.model_dump() for r in await ctx.memory.search(ns, args['query'])]
            if name == 'memory.retrieve':
                return (await ctx.memory.retrieve(ns, args['key'])).model_dump()
            if name == 'memory.delete':
                return {'deleted': await ctx.memory.delete(ns, args['key'])}
            operation = ctx.memory.store if name == 'memory.store' else ctx.memory.update
            return (await operation(ns, args['key'], args['value'])).model_dump()
        if name == 'http':
            ip, hostname = await ctx.policy.destination(actor, args['url'])
            url = httpx.URL(args['url'])
            async with httpx.AsyncClient(trust_env=False, follow_redirects=False) as client:
                async with client.stream(args['method'], url.copy_with(host=ip),
                        headers={'Host': url.netloc.decode('ascii')}, extensions={'sni_hostname': hostname}, timeout=self.timeout) as response:
                    if response.is_redirect:
                        raise denied()
                    body = bytearray()
                    async for chunk in response.aiter_bytes():
                        body.extend(chunk[:max(0, self.limit + 1 - len(body))])
                        if len(body) > self.limit:
                            break
                    return {'status': response.status_code, 'text': body[:self.limit].decode('utf-8', 'replace'), 'truncated': len(body) > self.limit}
        target = ctx.policy.resolve(actor, args['path'], args['root'])
        if name == 'shell':
            ctx.policy.command(actor, args['argv'])
            return await self._shell(args['argv'], target)
        # Local operations are bounded and require trusted root ownership; no arbitrary recursive traversal.
        if name == 'filesystem.write':
            if len(args['content'].encode('utf-8')) > 65536:
                raise HubError('TOOL_INPUT_INVALID', 'Write exceeds byte limit', 422)
            if not target.parent.is_dir() or (target.exists() and not target.is_file()):
                raise HubError('TOOL_INPUT_INVALID', 'Write requires an existing directory parent', 422)
            ctx.policy.resolve(actor, args['path'], args['root'])
            temporary: str | None = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent, delete=False) as handle:
                    temporary = handle.name
                    handle.write(args['content'])
                ctx.policy.resolve(actor, args['path'], args['root'])
                os.replace(temporary, target)
            finally:
                if temporary:
                    await asyncio.to_thread(Path(temporary).unlink, missing_ok=True)
            return {'written_bytes': len(args['content'].encode('utf-8'))}
        if name == 'filesystem.read':
            if not stat.S_ISREG(target.stat().st_mode):
                raise denied()
            with target.open('rb') as handle:
                content = handle.read(self.limit + 1)
            return {'text': content[:self.limit].decode('utf-8', 'replace'), 'truncated': len(content) > self.limit}
        children = list(islice(target.iterdir(), 200)) if target.is_dir() else [target]
        safe: list[Path] = []
        root = self.config.projects[actor.project].roots[args['root']]
        for child in children:
            try:
                safe.append(ctx.policy.resolve(actor, str(child.relative_to(root)), args['root']))
            except HubError:
                continue
        if name == 'filesystem.list':
            return {'entries': [{'name': p.name, 'directory': p.is_dir()} for p in safe], 'limit': 200}
        matches = []
        for child in safe:
            if not child.is_file():
                continue
            with child.open('rb') as handle:
                text = handle.read(self.limit).decode('utf-8', 'replace')
            for number, line in enumerate(text.splitlines(), 1):
                if args['query'] in line:
                    matches.append({'path': str(child.relative_to(root)), 'line': number, 'text': line[:500]})
                    if len(matches) == 50:
                        return {'matches': matches, 'truncated': True}
        return {'matches': matches, 'truncated': False, 'search': 'literal, current directory only'}

    async def _shell(self, argv: list[str], cwd: Path) -> dict[str, Any]:
        env = {k: os.environ[k] for k in ('SystemRoot', 'WINDIR') if k in os.environ}
        options: dict[str, Any] = {'creationflags': subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
        command = [sys.executable, '-I', '-u', str(Path(__file__).with_name('_windows_shell.py'))] if os.name == 'nt' else argv
        process = await asyncio.create_subprocess_exec(*command, cwd=cwd, env=env, stdin=asyncio.subprocess.PIPE if os.name == 'nt' else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, **options)
        async def capture(stream: asyncio.StreamReader | None) -> tuple[str, int]:
            saved = bytearray()
            size = 0
            if stream is not None:
                while chunk := await stream.read(4096):
                    size += len(chunk)
                    saved.extend(chunk[:max(0, self.limit - len(saved))])
            return saved.decode('utf-8', 'replace'), size
        captures: list[asyncio.Task[tuple[str, int]]] = []
        try:
            if os.name == 'nt':
                assert process.stdout is not None and process.stdin is not None
                if await process.stdout.readline() != b'HUB_READY\r\n':
                    raise HubError('TOOL_ERROR', 'Unable to establish Windows process containment', 502)
                process.stdin.write(json.dumps({'argv': argv}).encode() + b'\n')
                await process.stdin.drain()
                process.stdin.close()
            captures = [asyncio.create_task(capture(process.stdout)), asyncio.create_task(capture(process.stderr))]
            await process.wait()
            stdout, stderr = await asyncio.gather(*captures)
            return {'stdout': stdout[0], 'stderr': stderr[0], 'exit_code': process.returncode,
                    'truncated': max(stdout[1], stderr[1]) > self.limit}
        finally:
            if os.name == 'nt':
                if process.returncode is None:
                    process.kill()
            else:
                try:
                    kill_group = getattr(os, 'killpg', None)
                    kill_signal = getattr(signal, 'SIGKILL', None)
                    if kill_group is not None and kill_signal is not None:
                        kill_group(process.pid, kill_signal)
                except ProcessLookupError:
                    pass
            await process.wait()
            for task in captures:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*captures, return_exceptions=True)
