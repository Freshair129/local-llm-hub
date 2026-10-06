# trace:implements FR-021
from dataclasses import dataclass
from typing import Any, Protocol

from .tools import ToolContext, ToolDefinition, ToolRegistry, ToolResult


@dataclass(frozen=True)
class MCPTool:
    name: str
    description: str
    input_schema: dict[str, Any]


class MCPAdapter(Protocol):
    async def list_tools(self) -> list[MCPTool]: ...
    async def call_tool(self, name: str, arguments: dict[str, Any]) -> Any: ...
    async def close(self) -> None: ...


async def register_mcp(registry: ToolRegistry, namespace: str, adapter: MCPAdapter) -> None:
    """An operator-owned adapter must be explicitly installed; discovery grants no access."""
    for remote in await adapter.list_tools():
        name = f'mcp.{namespace}.{remote.name}'
        async def invoke(args: dict[str, Any], ctx: ToolContext, *, remote_name: str = remote.name) -> ToolResult:
            return ToolResult(data=await adapter.call_tool(remote_name, args))
        registry.register(ToolDefinition(name, remote.description, remote.input_schema,
            ToolResult.model_json_schema(), invoke, name, registry.timeout))
