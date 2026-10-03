FROM ghcr.io/astral-sh/uv:0.11.2 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY runtime/local_llm_hub ./runtime/local_llm_hub
RUN uv sync --locked --no-dev --no-cache --no-editable \
    && useradd --uid 10001 --create-home hub \
    && mkdir -p /app/.hub /app/workspace \
    && chown -R hub:hub /app/.hub /app/workspace
COPY config ./config
COPY workspace/README.md ./workspace/README.md
RUN sed -i 's/host: 127.0.0.1/host: 0.0.0.0\n  allow_remote_bind: true/' config/runtime.yaml
USER 10001:10001
ENV PYTHONUNBUFFERED=1 PYDANTIC_AI_NO_BANNER=1
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD ["/app/.venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=2)"]
CMD ["/app/.venv/bin/local-llm-hub", "serve"]
