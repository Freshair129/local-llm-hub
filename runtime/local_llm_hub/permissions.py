# trace:implements FR-021
import asyncio
import ipaddress
import os
import re
import socket
import stat
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from urllib.parse import urlsplit

from .config import HubConfig, PolicyDefinition
from .errors import HubError


@dataclass(frozen=True)
class ExecutionIdentity:
    agent_id: str
    session_id: str
    project: str
    policies: tuple[PolicyDefinition, ...]
    grants: frozenset[str]


def denied() -> HubError:
    return HubError('TOOL_PERMISSION_DENIED', 'Tool operation is outside the granted scope', 403)


class PermissionPolicy:
    def __init__(self, config: HubConfig) -> None:
        self.config = config

    def authorize(self, identity: ExecutionIdentity, name: str) -> None:
        if name not in identity.grants or not identity.policies or any(
                name not in p.grants or p.mode == 'admin' for p in identity.policies):
            raise denied()

    def resolve(self, identity: ExecutionIdentity, name: str, root_index: int = 0) -> Path:
        if '\x00' in name or ':' in name or Path(name).is_absolute() or PureWindowsPath(name).drive or name.startswith(('\\', '/')):
            raise denied()
        parts = name.replace('\\', '/').split('/')
        protected = {'.git', '.env', '.venv', '.hub', '.uv-cache'}
        for part in parts:
            if part in {'', '.'}:
                continue
            if part == '..' or part.lower() in protected or part.lower().startswith('.env.') or part.endswith((' ', '.')):
                raise denied()
            if re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?', part, re.I):
                raise denied()
        roots = self.config.projects[identity.project].roots
        if root_index < 0 or root_index >= len(roots):
            raise denied()
        root = roots[root_index].resolve()
        candidate = root.joinpath(*parts)
        current = root
        for part in parts:
            current /= part
            if current.is_symlink():
                raise denied()
            if current.exists() and getattr(current.stat(follow_symlinks=False), 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                raise denied()
        result = candidate.resolve()
        if not result.is_relative_to(root):
            raise denied()
        state = self.config.runtime.state_path.resolve()
        if (result == state or str(result).startswith(str(state) + '-') or
                (state.parent != root and result.is_relative_to(state.parent))):
            raise denied()
        return result

    def command(self, identity: ExecutionIdentity, argv: list[str]) -> None:
        self.authorize(identity, 'shell')
        if not argv or any(p.mode != 'trusted' or tuple(argv) not in p.commands for p in identity.policies):
            raise denied()
        if not os.path.isabs(argv[0]):
            raise denied()

    async def destination(self, identity: ExecutionIdentity, url: str) -> tuple[str, str]:
        self.authorize(identity, 'http')
        try:
            parsed = urlsplit(url)
            host = parsed.hostname or ''
            port = parsed.port or (443 if parsed.scheme == 'https' else 80)
            origin = f'{parsed.scheme}://{parsed.netloc}'.rstrip('/')
            if parsed.scheme not in {'http', 'https'} or parsed.username or parsed.password or parsed.fragment or not host:
                raise denied()
            if any(origin not in {o.rstrip('/') for o in p.http_origins} for p in identity.policies):
                raise denied()
            infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
            addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
            for ip in addresses:
                if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
                    raise denied()
                if not ip.is_global and host not in {str(ip), 'localhost'}:
                    raise denied()
            if not addresses:
                raise denied()
            return str(addresses[0]), host
        except (ValueError, OSError) as error:
            raise denied() from error
