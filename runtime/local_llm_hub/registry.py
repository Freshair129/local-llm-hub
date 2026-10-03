# trace:implements FR-018
from collections.abc import Mapping

from .errors import HubError
from .models import ModelDefinition


class ModelRegistry:
    def __init__(self, models: Mapping[str, ModelDefinition] | None = None) -> None:
        self._models: dict[str, ModelDefinition] = {}
        self._aliases: dict[str, str] = {}
        for model in (models or {}).values():
            self.register(model)

    def register(self, model: ModelDefinition) -> None:
        names = (model.id, *model.aliases)
        if len(set(names)) != len(names) or any(n in self._aliases for n in names):
            raise HubError('CONFIG_INVALID', 'Duplicate model ID or alias')
        self._models[model.id] = model
        self._aliases.update(dict.fromkeys(names, model.id))

    def resolve(self, name: str) -> ModelDefinition:
        if name not in self._aliases:
            raise HubError('MODEL_NOT_FOUND', 'Unknown model', 404)
        return self._models[self._aliases[name]]

    def list(self) -> list[ModelDefinition]:
        return list(self._models.values())
