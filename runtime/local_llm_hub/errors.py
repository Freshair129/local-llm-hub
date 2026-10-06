# trace:implements FR-018
from typing import Any


class HubError(Exception):
    """A safe domain error; never pass raw provider exceptions as its message."""

    def __init__(self, code: str, message: str, status: int = 400, *, retryable: bool = False,
                 details: dict[str, Any] | None = None) -> None:
        self.code, self.message, self.status = code, message, status
        self.retryable, self.details = retryable, details or {}
        super().__init__(f'{code}: {message}')
