"""Снимок расчётных модулей из указанного commit; игру не запускает.

Зависимости читаются рекурсивно из Git, включая прежние нагрузки/восстановление.
Содержимое файлов не переписывается. Существующий снимок никогда не обновляем:
при исправлении нужен новый ID. SHA каждого модуля хранится рядом с commit.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import argparse

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('version')
parser.add_argument('commit')
parser.add_argument('--repository', type=Path, default=ROOT,
                    help='Git checkout with the source commit; output stays in this workspace.')
args = parser.parse_args()
version, commit = args.version, args.commit
GIT_ROOT = args.repository.resolve()
# HEAD/имя ветки изменяются после следующего commit. В манифесте и чтении
# исходников используем один неизменяемый полный хеш исходного commit.
commit = subprocess.check_output(['git', 'rev-parse', '--verify', commit + '^{commit}'], cwd=GIT_ROOT).decode().strip()
target = ROOT / 'dist' / 'benchmark-snapshots' / version
if target.exists():
    raise SystemExit('Снимок уже существует; его нельзя перезаписывать')
pending = ['benchmark-fixtures.js', 'benchmark-state.js', 'brain-controller.js', 'experiment-runner.js']
if subprocess.run(['git', 'cat-file', '-e', f'{commit}:dist/parallel-world.js'], cwd=GIT_ROOT, capture_output=True).returncode == 0:
    pending.append('parallel-world.js')
files = {}
while pending:
    name = pending.pop()
    if name in files:
        continue
    data = subprocess.check_output(['git', 'show', f'{commit}:dist/{name}'], cwd=GIT_ROOT)
    files[name] = data
    for dependency in re.findall(r"from\s+['\"]\./([^'\"]+\.js)['\"]", data.decode()):
        pending.append(dependency)
    for dependency in re.findall(r"new URL\(['\"]\./([^'\"]+\.js)['\"]", data.decode()):
        pending.append(dependency)
build = json.loads(subprocess.check_output(['git', 'show', f'{commit}:dist/build-info.json'], cwd=GIT_ROOT))
if build['modelVersion'] != version:
    raise SystemExit('Версия commit не совпадает с запрошенным снимком')
target.mkdir(parents=True)
for name, data in files.items():
    (target / name).write_bytes(data)
series_source = subprocess.check_output(['git', 'show', f'{commit}:dist/benchmark-versions.js'], cwd=GIT_ROOT).decode()
suite_source = files['benchmark-fixtures.js'].decode()
series_id = re.search(r"BENCHMARK_MODEL_SERIES='([^']+)'", series_source).group(1)
suite_id = re.search(r"BENCHMARK_SUITE_ID='([^']+)'", suite_source).group(1)
manifest = {'id': version, 'commitSha': commit, 'modelVersion': version,
            'seriesId': series_id, 'suiteId': suite_id,
            'build': build, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}
(target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'{version}: {len(files)} неизменённых модулей, {sum(map(len, files.values()))} байт')
