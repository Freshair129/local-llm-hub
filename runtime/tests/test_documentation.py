# trace:verifies FR-023
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml

ROOT = Path(__file__).resolve().parents[2]
GUIDES = ('architecture', 'agent-runtime', 'model-router', 'providers', 'tools', 'permissions',
          'memory', 'configuration', 'local-deployment')
DOCS = [*ROOT.glob('docs/architecture/**/*.md'), *(ROOT / f'docs/{name}.md' for name in GUIDES),
    ROOT / 'docs/features/CROSS-FEAT-002-agent-harness.md', ROOT / '.brain/rca/RCA-001-UAT-EVIDENCE.md',
    ROOT / '.brain/rca/RCA-002-DESKTOP-ACCEPTANCE-GAPS.md', ROOT / 'docs/plans/HUB-ACCEPTANCE-REPAIR.md',
    ROOT / 'docs/requirements/FR-007-chat-interface.md', ROOT / 'docs/requirements/FR-011-model-arena.md',
    *(p for n in range(18, 24) for p in ROOT.glob(f'docs/requirements/FR-{n:03}-*.md')),
    *(p for n in range(18, 24) for p in ROOT.glob(f'docs/packets/PKT-FR-{n:03}-*.md'))]


def test_harness_doc_metadata_links_and_fences():
    assert len(DOCS) == 36
    for path in DOCS:
        text = path.read_text(encoding='utf-8')
        frontmatter = re.match(r'^---\n(.*?)\n---', text, re.S)
        assert frontmatter, path
        metadata = yaml.safe_load(frontmatter.group(1))
        assert metadata['status'] == 'active', path
        assert metadata['superseded_by'] is None and metadata['version'], path
        assert len(re.findall(r'^```', text, re.M)) % 2 == 0, path
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            parsed = urlsplit(target)
            if parsed.scheme or not parsed.path:
                continue
            assert (path.parent / unquote(parsed.path)).exists(), (path, target)


def test_doc_graph_integrity_and_requirement_dependency_dag():
    graph = json.loads((ROOT / 'docs/.doc-graph.json').read_text(encoding='utf-8'))
    identifiers = [node['id'] for node in graph['nodes']]
    assert len(identifiers) == len(set(identifiers))
    edges = [json.dumps(edge, sort_keys=True) for edge in graph['edges']]
    assert len(edges) == len(set(edges))
    for edge in graph['edges']:
        assert edge['from'] in identifiers and edge['to'] in identifiers
    for node in graph['nodes']:
        assert (ROOT / node['path']).exists(), node['id']
    paths = {node['path'] for node in graph['nodes']}
    assert all(path.relative_to(ROOT).as_posix() in paths for path in DOCS)
    dependencies = {f'FR-{n:03}': [] for n in range(18, 24)}
    for path in DOCS:
        if path.parent.name == 'requirements':
            fm = yaml.safe_load(re.match(r'^---\n(.*?)\n---', path.read_text(encoding='utf-8'), re.S).group(1))
            dependencies[fm['id']] = fm.get('depends_on', [])
    def visit(identifier, stack):
        assert identifier not in stack, 'Requirement cycle'
        for child in dependencies[identifier]:
            visit(child, stack | {identifier})
    for identifier in dependencies:
        visit(identifier, set())


def test_owned_source_and_test_trace_annotations():
    for path in ROOT.glob('runtime/local_llm_hub/*.py'):
        assert re.search(r'trace:implements FR-0(18|19|20|21|22|23)', path.read_text(encoding='utf-8')), path
    for path in ROOT.glob('runtime/tests/test_*.py'):
        assert re.search(r'trace:verifies FR-0(18|19|20|21|22|23)', path.read_text(encoding='utf-8')), path
