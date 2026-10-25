"""Инвентарь рабочих исходников для пособия, без смыслового аудита кода.

Не включает производные копии, документацию и неизменяемые снимки. Вызывается
экспортёром; наличие файла здесь ещё не означает, что он полностью описан.
"""
from pathlib import Path
import json


def build_guide_inventory(root: Path) -> list[dict]:
    entries = []
    for directory, extensions, kind in [
        ('dist', {'.js', '.html', '.css'}, 'app'),
        ('tests', {'.mjs'}, 'tests'),
        ('tools', {'.py', '.mjs'}, 'tools'),
        ('.github/workflows', {'.yml', '.yaml'}, 'infrastructure'),
    ]:
        folder = root / directory
        paths = (folder.iterdir() if directory == 'dist' else folder.rglob('*')) if folder.is_dir() else []
        for path in sorted(paths):
            if path.is_file() and path.suffix in extensions:
                entries.append({'path': path.relative_to(root).as_posix(),
                                'kind': 'history' if path.name == 'legacy.html' else kind})
    if (root / 'package.json').is_file():
        entries.append({'path': 'package.json', 'kind': 'infrastructure'})
    return sorted(entries, key=lambda entry: entry['path'])


def write_guide_inventory(root: Path, model_version: str) -> None:
    payload = {'format': 'big-evolution-guide-inventory', 'version': 1,
               'modelVersion': model_version, 'files': build_guide_inventory(root)}
    (root / 'dist/project-guide-inventory.json').write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
