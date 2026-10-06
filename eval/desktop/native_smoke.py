"""Opt-in Windows Tauri WebDriver smoke. Requires an isolated acceptance build.

Uses real IPC and a real Hub HTTP service with its explicit mock provider.
All descendants are contained in task-owned Windows jobs; no user app is reused.
"""
# trace:verifies FR-007
# trace:verifies FR-011
# trace:verifies FR-023
import argparse
import base64
import hashlib
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import yaml


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--application', type=Path, required=True)
    parser.add_argument('--driver', type=Path, required=True)
    parser.add_argument('--edge-driver', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    config = out / 'config'
    shutil.copytree(root / 'config', config)
    workspace = out / 'workspace'
    workspace.mkdir()
    runtime = yaml.safe_load((config / 'runtime.yaml').read_text())
    hub_port, driver_port, native_port = (free_port() for _ in range(3))
    runtime['runtime'].update(port=hub_port, state_path=str(out / 'memory.sqlite3'))
    (config / 'runtime.yaml').write_text(yaml.safe_dump(runtime))
    permissions = yaml.safe_load((config / 'permissions.yaml').read_text())
    permissions['projects']['demo']['roots'] = [str(workspace)]
    (config / 'permissions.yaml').write_text(yaml.safe_dump(permissions))
    env = dict(os.environ)
    env.update(LOCAL_LLM_HUB_TOKEN=secrets.token_urlsafe(32),
               LOCAL_LLM_HUB_URL=f'http://127.0.0.1:{hub_port}',
               WEBVIEW2_USER_DATA_FOLDER=str(out / 'webview-profile'),
               TEMP=str(root / '.hub/tmp'), TMP=str(root / '.hub/tmp'))
    owned = []
    logs = []
    receipt = {'provider': 'mock', 'transport': 'native Tauri IPC -> Hub HTTP',
               'application_sha256': hashlib.sha256(args.application.read_bytes()).hexdigest(),
               'checks': [], 'source_base': subprocess.check_output(
                   ['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()}
    started = time.monotonic()
    session = None
    client = httpx.Client(base_url=f'http://127.0.0.1:{driver_port}', trust_env=False, timeout=60)

    def spawn(name, argv):
        log = (out / (name + '.log')).open('w', encoding='utf-8')
        logs.append(log)
        proc = subprocess.Popen([sys.executable, str(root / 'runtime/local_llm_hub/_windows_shell.py')],
                                stdin=subprocess.PIPE, stdout=log, stderr=subprocess.STDOUT,
                                text=True, env=env, cwd=root, creationflags=subprocess.CREATE_NO_WINDOW)
        owned.append(proc)
        proc.stdin.write(json.dumps({'argv': argv}) + '\n')
        proc.stdin.close()
        return proc

    def wait(check, label, seconds=145):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            try:
                result = check()
                if result:
                    return result
            except (httpx.HTTPError, KeyError):
                pass
            time.sleep(0.2)
        raise AssertionError('Timed out: ' + label)

    def command(method, suffix, payload=None):
        result = client.request(method, '/session/' + session + suffix, json=payload)
        value = result.json()['value']
        if isinstance(value, dict) and 'error' in value:
            raise AssertionError(value)
        result.raise_for_status()
        return value

    def script(code):
        return command('POST', '/execute/sync', {'script': code, 'args': []})

    def element(selector):
        value = command('POST', '/element', {'using': 'css selector', 'value': selector})
        return value['element-6066-11e4-a52e-4f735466cecf']

    def click(selector):
        command('POST', '/element/' + element(selector) + '/click', {})

    def type_text(selector, text):
        command('POST', '/element/' + element(selector) + '/value', {'text': text, 'value': list(text)})

    def passed(label):
        receipt['checks'].append({'name': label, 'status': 'PASS', 'elapsed_seconds': round(time.monotonic() - started, 2)})
        print('PASS: ' + label, flush=True)

    try:
        hub = spawn('hub', [sys.executable, '-m', 'local_llm_hub.cli', '--config', str(config),
                            '--env-file', str(out / 'absent.env'), 'serve'])
        with httpx.Client(trust_env=False, timeout=2) as health:
            wait(lambda: health.get(env['LOCAL_LLM_HUB_URL'] + '/health').status_code == 200, 'Hub health')
        spawn('driver', [str(args.driver.resolve()), '--port', str(driver_port), '--native-port',
                         str(native_port), '--native-driver', str(args.edge_driver.resolve())])
        wait(lambda: client.get('/status').status_code == 200, 'driver')
        result = client.post('/session', json={'capabilities': {'alwaysMatch': {
            'tauri:options': {'application': str(args.application.resolve()),
                              'webviewOptions': {'userDataFolder': str(out / 'webview-profile')}}}}})
        result.raise_for_status()
        session = result.json()['value']['sessionId']
        receipt['capabilities'] = result.json()['value']['capabilities']
        assert (out / 'webview-profile').is_dir(), 'Isolated profile was not created'
        wait(lambda: script("return document.querySelector('#chat-model-select')?.value === 'mock-local'"), 'Hub catalog')
        passed('Hub logical model loaded into Chat catalog')
        assert script("return [...document.querySelectorAll('.view-panel')].every(e => e.parentElement.id === 'views-container')"), 'Nested peer view panels'
        passed('Peer view panels are not hidden by a parent view')
        click('.ptab[data-domain="inference-gateway"]')
        click('#nav-chat')
        type_text('#chat-user-input', 'echo:desktop-ready')
        click('#chat-send-btn')
        wait(lambda: script("return [...document.querySelectorAll('.message-assistant .message-body')].some(e => e.textContent === 'desktop-ready')"), 'Chat response')
        passed('Chat canonical response through real IPC and HTTP')
        click('.ptab[data-domain="model-management"]')
        click('#nav-arena')
        type_text('#arena-prompt-input', 'echo:arena-ready')
        click('#btn-run-arena')
        wait(lambda: script("return ['a','b'].every(id => document.querySelector('#arena-output-'+id).textContent.includes('arena-ready')) && !document.querySelector('#btn-run-arena').disabled"), 'Arena responses')
        assert script("return ['a','b'].every(id => document.getElementById(id+'-ttft').textContent === 'Not measured' && document.getElementById(id+'-tokens').textContent === 'Not reported')")
        passed('Arena both canonical responses and unavailable metrics')
        (out / 'arena.png').write_bytes(base64.b64decode(command('GET', '/screenshot')))
        hub.terminate()
        hub.wait(timeout=15)
        click('.ptab[data-domain="inference-gateway"]')
        click('#nav-chat')
        type_text('#chat-user-input', 'echo:must-fail')
        click('#chat-send-btn')
        wait(lambda: script("return !!document.querySelector('.message-assistant.error') && !document.querySelector('#chat-send-btn').disabled"), 'visible outage', 145)
        passed('Hub outage visibly fails and releases Chat busy state')
        (out / 'outage.png').write_bytes(base64.b64decode(command('GET', '/screenshot')))
        click('.ptab[data-domain="model-management"]')
        click('#nav-arena')
        click('#btn-run-arena')
        wait(lambda: script("return ['a','b'].every(id => document.querySelector('#arena-output-'+id+' .error-badge')) && !document.querySelector('#btn-run-arena').disabled"), 'Arena outage', 145)
        passed('Both Arena errors are visible and busy state is released')
        click('#nav-models')
        command('POST', '/window/rect', {'width': 1600, 'height': 900})
        click('#btn-refresh-models')
        wait(lambda: script("return document.querySelector('#chat-model-select').value === '' && document.querySelector('#chat-send-btn').disabled && document.querySelector('#btn-run-arena').disabled"), 'catalog fails closed', 90)
        passed('Failed catalog refresh clears stale selections and disables inference')
        receipt['status'] = 'PASS'
    except Exception as error:
        receipt['status'] = 'FAIL'
        receipt['error'] = str(error)
        raise
    finally:
        if session:
            try:
                (out / 'final.png').write_bytes(base64.b64decode(command('GET', '/screenshot')))
                receipt['input_geometry'] = script("return ['view-chat','chat-user-input'].map(id => {const e=document.getElementById(id); return {id,rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility};})")
                receipt['ancestors'] = script("let a=[],e=document.getElementById('view-chat');while(e){a.push({tag:e.tagName,id:e.id,display:getComputedStyle(e).display});e=e.parentElement;}return a;")
                receipt['final_dom'] = script('return document.body.innerText')
                command('DELETE', '')
            except Exception:
                pass
        for proc in reversed(owned):
            if proc.poll() is None:
                proc.terminate()
            proc.wait(timeout=15)
        client.close()
        for log in logs:
            log.close()
        receipt['supervisors_stopped'] = all(proc.poll() is not None for proc in owned)
        receipt['ports_closed'] = True
        for port in (hub_port, driver_port, native_port):
            deadline = time.monotonic() + 10
            while True:
                with socket.socket() as sock:
                    sock.settimeout(0.2)
                    closed = sock.connect_ex(('127.0.0.1', port)) != 0
                if closed or time.monotonic() >= deadline:
                    break
                time.sleep(0.1)
            receipt['ports_closed'] &= closed
        (out / 'receipt.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
        if not receipt['ports_closed']:
            raise AssertionError('Owned listener cleanup failed; see receipt')


if __name__ == '__main__':
    main()
