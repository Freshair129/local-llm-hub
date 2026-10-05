"""Bounded, opt-in Docker Compose acceptance for the approved R5 container scope."""

# trace:verifies FR-023
import hashlib
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    evidence = root / ".hub" / "container"
    compose = root / "compose.yaml"
    dockerfile = root / "runtime" / "Dockerfile"
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    project = "hub-acceptance-" + run_id.lower()
    receipt_path = evidence / (run_id + ".json")
    if receipt_path.exists():
        raise FileExistsError(receipt_path)
    evidence.mkdir(parents=True, exist_ok=True)
    token = secrets.token_urlsafe(32)
    memory_key = "acceptance-" + uuid4().hex
    memory_value = "persisted-" + uuid4().hex
    env = dict(os.environ, LOCAL_LLM_HUB_TOKEN=token)
    base = "http://127.0.0.1:8787"
    checks: list[dict[str, str]] = []
    failure: BaseException | None = None
    cleanup_errors: list[str] = []
    try:
        source_commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except subprocess.CalledProcessError:
        source_commit = os.environ.get("LOCAL_LLM_HUB_SOURCE_COMMIT", "unavailable")
    receipt: dict[str, object] = {
        "task_date": "2026-10-05",
        "project": project,
        "provider": "explicit CPU mock",
        "endpoint": base,
        "source_commit": source_commit,
        "compose_sha256": hashlib.sha256(compose.read_bytes()).hexdigest(),
        "dockerfile_sha256": hashlib.sha256(dockerfile.read_bytes()).hexdigest(),
        "runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "checks": checks,
        "volumes_disposition": "preserved; compose down omits --volumes",
    }
    started = False

    def docker(*args: str, timeout: int = 600) -> str:
        result = subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                str(compose),
                "-p",
                project,
                "--env-file",
                "/dev/null",
                *args,
            ],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        # This smoke supplies the token through process environment; never place it in argv or receipts.
        if result.returncode:
            safe_stderr = result.stderr.replace(token, "[redacted]")
            raise RuntimeError("docker compose failed: " + safe_stderr[-3000:])
        return result.stdout

    def request(path: str, body: dict[str, object] | None = None, *, authorized: bool = True):
        headers = {"Content-Type": "application/json"}
        if authorized:
            headers["Authorization"] = "Bearer " + token
        req = urllib.request.Request(
            base + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def port_listeners() -> list[str]:
        result = subprocess.run(
            ["ss", "-H", "-ltn", "sport", "=", ":8787"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if result.returncode:
            raise RuntimeError("could not inspect port 8787 listeners: " + result.stderr[-1000:])
        return [line for line in result.stdout.splitlines() if line.strip()]

    def passed(name: str, detail: str = "") -> None:
        checks.append({"name": name, "status": "PASS", "detail": detail})
        print("PASS: " + name, flush=True)

    def health_diagnostics() -> dict[str, str]:
        container = subprocess.run(
            ["docker", "inspect", "--format", "{{json .State}}", project + "-agent-runtime-1"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        logs = subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                str(compose),
                "-p",
                project,
                "--env-file",
                "/dev/null",
                "logs",
                "--no-color",
                "--tail",
                "40",
                "agent-runtime",
            ],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        return {
            "container_state": (container.stdout or container.stderr).strip()[:2000],
            "recent_logs": (logs.stdout + logs.stderr).replace(token, "[redacted]")[-4000:],
        }

    def wait_healthy(phase: str) -> None:
        deadline = time.monotonic() + 180
        while True:
            try:
                status, health = request("/health", authorized=False)
                if status == 200 and health.get("status") == "ok":
                    return
            except (
                urllib.error.URLError,
                TimeoutError,
                ValueError,
                ConnectionError,
            ):
                pass
            if time.monotonic() >= deadline:
                receipt["health_diagnostics"] = health_diagnostics()
                raise TimeoutError(phase + " health deadline exceeded")
            time.sleep(0.5)

    def check_linux_symlink_escape() -> None:
        test = """from pathlib import Path
from uuid import uuid4
from local_llm_hub.config import load_config
from local_llm_hub.errors import HubError
from local_llm_hub.permissions import ExecutionIdentity, PermissionPolicy

config = load_config(Path('/app/config'))
root = config.projects['demo'].roots[0].resolve()
outside = Path('/tmp') / ('hub-outside-' + uuid4().hex)
link = root / ('hub-link-' + uuid4().hex)
outside.mkdir()
try:
    link.symlink_to(outside, target_is_directory=True)
    identity = ExecutionIdentity('coder', 'symlink-acceptance', 'demo',
        (config.policies['writer'],), frozenset(config.agents['coder'].tools))
    try:
        PermissionPolicy(config).resolve(identity, link.name + '/secret')
    except HubError as error:
        assert error.code == 'TOOL_PERMISSION_DENIED'
    else:
        raise AssertionError('symlink escape was accepted')
finally:
    if link.is_symlink():
        link.unlink()
    outside.rmdir()
print('Linux symlink escape rejected')"""
        result = subprocess.run(
            [
                "docker",
                "exec",
                "--user",
                "10001:10001",
                project + "-agent-runtime-1",
                "/app/.venv/bin/python",
                "-c",
                test,
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode:
            raise RuntimeError(
                "Linux symlink escape check failed: "
                + result.stderr.replace(token, "[redacted]")[-2000:]
            )

    try:
        start = subprocess.run(
            ["systemctl", "start", "docker.service"],
            capture_output=True,
            text=True,
            check=False,
        )
        if start.returncode:
            raise RuntimeError("Docker service failed to start: " + start.stderr[-2000:])
        receipt["docker_service_started_for_test"] = True
        receipt["docker_server_version"] = subprocess.check_output(
            ["docker", "version", "--format", "{{.Server.Version}}"], text=True
        ).strip()
        receipt["compose_version"] = subprocess.check_output(
            ["docker", "compose", "version", "--short"], text=True
        ).strip()
        if port_listeners():
            raise RuntimeError("port 8787 already has a listening socket")
        started = True
        docker("config", "--quiet")
        docker("up", "--build", "--detach", timeout=2400)
        wait_healthy("initial")
        passed("loopback health check")

        status, _ = request("/v1/models", authorized=False)
        assert status == 401, status
        passed("unauthorized catalog rejected")

        status, catalog = request("/v1/models")
        assert status == 200 and any(
            m["id"] == "mock-local" and m["enabled"] for m in catalog["data"]
        )
        passed("authenticated mock catalog")

        status, chat = request(
            "/v1/chat/completions",
            {
                "model": "mock-local",
                "messages": [{"role": "user", "content": "echo:docker-acceptance"}],
                "max_tokens": 32,
            },
        )
        assert status == 200 and chat["choices"][0]["message"]["content"] == "docker-acceptance"
        passed("authenticated mock chat completion")

        status, store = request(
            "/v1/agents/coder/run",
            {
                "input": "tool:"
                + json.dumps(
                    {
                        "name": "memory.store",
                        "arguments": {"scope": "project", "key": memory_key, "value": memory_value},
                    }
                )
            },
        )
        assert status == 200 and memory_value in json.dumps(store)
        passed("project memory stored in persistent SQLite volume")

        inspect = subprocess.run(
            [
                "docker",
                "inspect",
                "--format",
                "{{json .Config.User}} {{json .HostConfig.ReadonlyRootfs}} {{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}} {{json .HostConfig.PortBindings}} {{json .Mounts}} {{.Image}}",
                project + "-agent-runtime-1",
            ],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        assert (
            inspect.startswith('"10001:10001" true ["ALL"]') and "no-new-privileges:true" in inspect
        )
        assert '"HostIp":"127.0.0.1"' in inspect
        assert "hub-state" in inspect and "hub-workspace" in inspect
        receipt["image_id"] = inspect.split()[-1]
        passed(
            "unprivileged user, read-only rootfs, dropped capabilities, loopback-only port and persistent mounts"
        )
        check_linux_symlink_escape()
        passed("Linux symlink traversal rejected inside the container")

        docker("restart", "agent-runtime")
        wait_healthy("post-restart")
        status, restore = request(
            "/v1/agents/coder/run",
            {
                "input": "tool:"
                + json.dumps(
                    {
                        "name": "memory.retrieve",
                        "arguments": {"scope": "project", "key": memory_key},
                    }
                )
            },
        )
        assert status == 200 and memory_value in json.dumps(restore)
        passed("project memory persisted across container restart")
    except BaseException as error:
        failure = error
        receipt["status"] = "FAIL"
        receipt["error"] = str(error).replace(token, "[redacted]")
    finally:
        try:
            if started:
                try:
                    cleanup = subprocess.run(
                        [
                            "docker",
                            "compose",
                            "-f",
                            str(compose),
                            "-p",
                            project,
                            "--env-file",
                            "/dev/null",
                            "down",
                        ],
                        cwd=root,
                        env=env,
                        capture_output=True,
                        text=True,
                        timeout=180,
                        check=False,
                    )
                    receipt["compose_down_exit_code"] = cleanup.returncode
                    if cleanup.returncode:
                        cleanup_errors.append(
                            "compose down failed: "
                            + cleanup.stderr.replace(token, "[redacted]")[-3000:]
                        )
                    else:
                        retained_volumes = []
                        for volume in (project + "_hub-state", project + "_hub-workspace"):
                            check = subprocess.run(
                                ["docker", "volume", "inspect", "--format", "{{.Name}}", volume],
                                capture_output=True,
                                text=True,
                                check=False,
                            )
                            if check.returncode or check.stdout.strip() != volume:
                                cleanup_errors.append(
                                    "expected named volume was not preserved: " + volume
                                )
                            else:
                                retained_volumes.append(volume)
                        receipt["retained_named_volumes"] = retained_volumes
                        containers = subprocess.run(
                            [
                                "docker",
                                "ps",
                                "-aq",
                                "--filter",
                                "label=com.docker.compose.project=" + project,
                            ],
                            capture_output=True,
                            text=True,
                            check=False,
                        )
                        networks = subprocess.run(
                            [
                                "docker",
                                "network",
                                "ls",
                                "-q",
                                "--filter",
                                "label=com.docker.compose.project=" + project,
                            ],
                            capture_output=True,
                            text=True,
                            check=False,
                        )
                        receipt["remaining_task_containers"] = containers.stdout.splitlines()
                        receipt["remaining_task_networks"] = networks.stdout.splitlines()
                        if containers.returncode or containers.stdout.strip():
                            cleanup_errors.append("task-owned containers remain after compose down")
                        if networks.returncode or networks.stdout.strip():
                            cleanup_errors.append("task-owned networks remain after compose down")
                except (OSError, subprocess.SubprocessError) as error:
                    cleanup_errors.append(
                        "Compose cleanup raised: " + str(error).replace(token, "[redacted]")[-2000:]
                    )
                receipt["cleanup_volumes_preserved"] = not cleanup_errors
        finally:
            try:
                stop = subprocess.run(
                    ["systemctl", "stop", "docker.socket", "docker.service", "containerd.service"],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if stop.returncode:
                    cleanup_errors.append("systemctl stop failed: " + stop.stderr[-2000:])
                service_states = []
                enabled_states = []
                for unit in ("docker.socket", "docker.service", "containerd.service"):
                    state = subprocess.run(
                        ["systemctl", "is-active", unit],
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    service_states.append(state.stdout.strip() or "unknown")
                    enabled = subprocess.run(
                        ["systemctl", "is-enabled", unit],
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    enabled_states.append(enabled.stdout.strip() or "unknown")
                receipt["docker_service_states_after_cleanup"] = service_states
                receipt["docker_service_enablement_after_cleanup"] = enabled_states
                if service_states != ["inactive", "inactive", "inactive"]:
                    cleanup_errors.append("Docker-related systemd units are not all inactive")
                if enabled_states != ["disabled", "disabled", "disabled"]:
                    cleanup_errors.append("Docker-related systemd units are not all disabled")
            except (OSError, subprocess.SubprocessError) as error:
                cleanup_errors.append("Docker service shutdown raised: " + str(error)[-2000:])

            try:
                listeners = port_listeners()
                receipt["port_8787_listening_sockets_after_cleanup"] = len(listeners)
                receipt["port_8787_closed_after_cleanup"] = not listeners
                if listeners:
                    cleanup_errors.append("127.0.0.1:8787 has a listener after cleanup")
            except (OSError, subprocess.SubprocessError, RuntimeError) as error:
                receipt["port_8787_closed_after_cleanup"] = False
                cleanup_errors.append(
                    "could not verify port 8787 after cleanup: " + str(error)[-1000:]
                )

            receipt["cleanup_errors"] = cleanup_errors
            if failure is None and not cleanup_errors:
                receipt["status"] = "PASS"
            elif failure is None:
                receipt["status"] = "FAIL"
            receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")

    if failure is not None:
        raise failure
    if cleanup_errors:
        raise RuntimeError("cleanup verification failed; inspect the sanitized receipt")


if __name__ == "__main__":
    main()
