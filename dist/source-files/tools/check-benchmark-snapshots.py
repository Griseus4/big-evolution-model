"""Статическая проверка снимков против исходных commit. Миров не создаёт."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import re

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--hash-only', action='store_true',
                    help='Verify SHA-256 only; explicitly skip historical Git comparison for source archives.')
args = parser.parse_args()
total = 0
registry = (ROOT / 'dist/benchmark-versions.js').read_text(encoding='utf-8')
active = re.findall(r"path:'\./benchmark-snapshots/([^/]+)/'", registry)
assert active, 'Нет активного снимка'
for version in active:
    assert (ROOT / 'dist/benchmark-snapshots' / version / 'manifest.json').is_file(), f'Нет снимка {version}'
for folder in sorted((ROOT / 'dist' / 'benchmark-snapshots').iterdir()):
    manifest = json.loads((folder / 'manifest.json').read_text())
    assert manifest['id'] == folder.name
    assert manifest['build']['modelVersion'] == folder.name
    for name, expected in manifest['files'].items():
        data = (folder / name).read_bytes()
        assert hashlib.sha256(data).hexdigest() == expected, f'Изменён {folder.name}/{name}'
        if not args.hash_only:
            original = subprocess.check_output(['git', 'show', f"{manifest['commitSha']}:dist/{name}"], cwd=ROOT)
            assert data == original, f'Снимок не совпадает с Git: {name}'
        total += 1
if args.hash_only:
    print(f'Снимки: SHA-256 всех {total} файлов совпадает с манифестами. '
          'Историческое сравнение с Git явно пропущено (--hash-only).')
else:
    print(f'Снимки: {total} файлов побайтно совпадают с исходными commit и SHA-256.')
