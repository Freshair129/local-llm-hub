# trace:implements FR-023
import argparse
import asyncio
import logging
import os
import secrets
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

from .api import create_app
from .config import load_config
from .errors import HubError


def main() -> None:
    parser = argparse.ArgumentParser(description='Local LLM Hub (one process owns queues and sessions)')
    parser.add_argument('--config', type=Path, default=Path('config'))
    parser.add_argument('--env-file', type=Path, default=Path('.env'))
    parser.add_argument('command', choices=['init', 'check', 'serve', 'evaluate'])
    parser.add_argument('--output', type=Path, default=Path('.hub/evaluation.json'))
    args = parser.parse_args()
    os.environ.setdefault('PYDANTIC_AI_NO_BANNER', '1')
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    # Transport INFO logs can include query parameters from untrusted HTTP tool URLs.
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    try:
        if args.command == 'init':
            with args.env_file.open('x', encoding='utf-8') as handle:
                handle.write('LOCAL_LLM_HUB_TOKEN=' + secrets.token_urlsafe(32) + '\n')
            args.env_file.chmod(0o600)
            print('Created private environment file; token was not printed. Restrict Windows ACLs to its owner.')
            return
        load_dotenv(args.env_file, override=False)
        config = load_config(args.config)
        if args.command == 'check':
            print(f'Configuration valid: {len(config.models)} models, {len(config.agents)} agents')
        elif args.command == 'evaluate':
            from .evaluation import evaluate
            result = asyncio.run(evaluate(config))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(result.model_dump_json(indent=2), encoding='utf-8')
            print(f'Evaluation: {result.passed} PASS, {result.failed} FAIL, {result.skipped} SKIP')
            raise SystemExit(1 if result.failed else 0)
        else:
            uvicorn.run(create_app(config), host=config.runtime.host, port=config.runtime.port,
                        workers=1, access_log=False, log_level='critical')
    except (HubError, OSError) as error:
        message = str(error) if isinstance(error, HubError) else 'Unable to access configuration/output file; init does not overwrite existing files'
        parser.exit(2, message + '\n')


if __name__ == '__main__':
    main()
