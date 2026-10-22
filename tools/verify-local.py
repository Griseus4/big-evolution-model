"""Запускает существующие короткие проверки проекта одной командой.

Полный набор: python tools/verify-local.py
Повтор части: python tools/verify-local.py --only mechanisms
Генерация архивов, коммиты, публикация и длительные опыты сюда не входят.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / '.transfer'


def find_node() -> str:
    """PATH предпочтителен; встроенный runtime Codex — запасной локальный путь."""
    candidates = [
        os.environ.get('BIG_EVOLUTION_NODE'),
        shutil.which('node'),
        str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'),
        str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise SystemExit('Node.js not found. Set BIG_EVOLUTION_NODE to its executable path.')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', choices=['docs', 'static', 'startup', 'mechanisms', 'worker'],
                        help='Run one group; omit for the complete short suite.')
    parser.add_argument('--source-only', action='store_true',
                        help='For ZIP/fresh repositories: skip Git history/diff checks; keep source hashes and executable checks.')
    args = parser.parse_args()
    node = find_node()
    git = shutil.which('git')
    if not git and not args.source_only:
        raise SystemExit('Git not found in PATH.')
    REPORTS.mkdir(exist_ok=True)
    env = os.environ.copy()
    env['PYTHONUTF8'] = '1'
    env['PATH'] = str(Path(node).parent) + os.pathsep + env.get('PATH', '')
    steps = [
        ('browser-wiring', 'static', [sys.executable, 'tools/check-browser-wiring.py']),
        ('project-docs', 'static', [sys.executable, 'tools/check-project-docs.py']),
        ('agent-context', 'static', [sys.executable, 'tools/check-agent-context.py']),
        ('benchmark-snapshots', 'static', [sys.executable, 'tools/check-benchmark-snapshots.py'] +
         (['--hash-only'] if args.source_only else [])),
        ('startup', 'startup', [node, 'tools/check-startup.mjs']),
        ('world-worker', 'worker', [node, '--test', 'tests/js-syntax.test.mjs', 'tests/analysis-builder047.test.mjs', 'tests/digestion-experiments046.test.mjs', 'tests/experiment-storage045.test.mjs', 'tests/pair-statistics042.test.mjs', 'tests/statistics043.test.mjs', 'tests/genome-experiments044.test.mjs', 'tests/statistical-ui041.test.mjs', 'tests/experiment-factors.test.mjs', 'tests/experiment-constructor.test.mjs', 'tests/experiment-statistics.test.mjs', 'tests/experiment-ui.test.mjs', 'tests/world-worker.test.mjs', 'tests/world-ui.test.mjs',
                                     'tests/performance-detail.test.mjs', 'tests/worker-timing.test.mjs', 'tests/help-ui.test.mjs', 'tests/live-history.test.mjs', 'tests/update037.test.mjs',
                                     'tests/temporal.test.mjs', 'tests/environment-save.test.mjs', 'tests/target-environment.test.mjs', 'tests/island-mobility.test.mjs', 'tests/interface0361.test.mjs', 'tests/activity-perception.test.mjs', 'tests/life-cohorts.test.mjs', 'tests/history-ui.test.mjs', 'tests/history-window.test.mjs', 'tests/parallel-world.test.mjs', 'tests/parallel-benchmark.test.mjs',
                                     'tests/worker-count-benchmark.test.mjs', 'tests/worker-count-ui.test.mjs',
                                     'tests/live-computations.test.mjs', 'tests/configuration-benchmark.test.mjs', 'tests/ui-text-controls.test.mjs']),
        ('mechanisms', 'mechanisms', [node, 'tools/check-mechanisms.mjs',
                                    str(REPORTS / 'mechanisms-latest.json')]),
        # HEAD учитывает и staged, и unstaged изменения отслеживаемых файлов.
        ('git-diff', 'static', [git, '-c', 'core.safecrlf=false', 'diff', 'HEAD', '--check']),
    ]
    selected = [step for step in steps if (args.only is None or step[1] == args.only or
                args.only == 'docs' and step[0] in {'project-docs', 'agent-context', 'git-diff'})
                and not (args.source_only and step[0] == 'git-diff')]
    version = re.search(r"MODEL_VERSION='([^']+)'", (ROOT / 'dist/life-history.js').read_text(encoding='utf-8')).group(1)
    start = perf_counter()
    report = {'format': 'big-evolution-local-verification', 'version': 1,
              'modelVersion': version, 'scope': args.only or 'all',
              'plannedChecks': [name for name, _, _ in selected], 'checks': []}
    report['sourceOnly'] = args.source_only
    report['skippedChecks'] = ([
        {'id': 'historical-snapshot-git', 'reason': 'Explicit --source-only; SHA-256 remains checked.'},
        {'id': 'git-diff', 'reason': 'Explicit --source-only; no original working-tree history required.'},
    ] if args.source_only else [])
    if args.source_only:
        print('Source-only mode: snapshot SHA-256 and executable checks enabled; '
              'historical Git comparison and Git diff explicitly skipped.', flush=True)
    for name, _, command in selected:
        print(f'Checking {name}...', flush=True)
        phase_start = perf_counter()
        try:
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True,
                                    text=True, encoding='utf-8', errors='replace', timeout=60)
            item = {'id': name, 'status': 'passed' if result.returncode == 0 else 'failed',
                    'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}
        except subprocess.TimeoutExpired as error:
            # TimeoutExpired может содержать bytes даже при text=True.
            def captured(value: str | bytes | None) -> str:
                return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else value or ''
            item = {'id': name, 'status': 'failed', 'error': 'Exceeded 60 seconds; stopped this check.',
                    'stdout': captured(error.stdout), 'stderr': captured(error.stderr)}
        except OSError as error:
            item = {'id': name, 'status': 'failed', 'error': str(error)}
        item['durationMs'] = round((perf_counter() - phase_start) * 1000, 2)
        report['checks'].append(item)
        print(f"  {item['status'].upper()} ({item['durationMs'] / 1000:.2f}s)", flush=True)
        if item['status'] == 'failed':
            print(item.get('stdout', '') + item.get('stderr', '') + item.get('error', ''), flush=True)
            break
    report['status'] = 'passed' if len(report['checks']) == len(selected) and all(
        item['status'] == 'passed' for item in report['checks']) else 'failed'
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    report['durationMs'] = round((perf_counter() - start) * 1000, 2)
    report_path = REPORTS / 'verification-latest.json'
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Result: {report['status'].upper()}, {report['durationMs'] / 1000:.2f}s; {report_path}")
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
