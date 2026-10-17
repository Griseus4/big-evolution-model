"""Prepare a source-only GitHub ZIP from the canonical source export.

Run tools/export-source.py first. No Git/network operations are performed.
Local reports, repository metadata and hosting configuration are excluded by
an allowlist. A fresh staging folder is retained for extraction checks.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage-only', action='store_true', help='Prepare an isolated tree for checks; do not create a ZIP.')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'dist/source-manifest.json').read_text(encoding='utf-8'))
    version = re.search(r"MODEL_VERSION='([^']+)'", (ROOT / 'dist/life-history.js').read_text()).group(1)
    allowed_roots = {'AGENTS.md', 'README.md', 'README.ru.md', '.gitignore', '.gitattributes', 'package.json'}
    forbidden_parts = {'.git', '.openai', '.codex', '.agents', '.transfer', 'node_modules', '__pycache__', 'releases'}
    canonical = {Path(item['name']) for item in manifest}
    assert {Path(name) for name in allowed_roots}.issubset(canonical)
    files = set(canonical)
    files.update(Path('dist/source-files') / name for name in canonical if name.parts[0] != 'dist')
    files.update({Path('dist/source-manifest.json'), Path('dist/Big-Evolution-source.zip')})
    for name in files:
        assert not name.is_absolute() and '..' not in name.parts, name
        assert not forbidden_parts.intersection(name.parts), name
        assert name.parts[0] in {'dist', 'docs', 'tests', 'tools', '.github'} or name.as_posix() in allowed_roots, name
        path = ROOT / name
        assert path.resolve().is_relative_to(ROOT.resolve()) and path.is_file(), name
    # Source-viewer copies and its downloadable ZIP must reflect canonical files.
    with zipfile.ZipFile(ROOT / 'dist/Big-Evolution-source.zip') as source_zip:
        assert source_zip.testzip() is None
        for name in canonical:
            data = (ROOT / name).read_bytes()
            assert source_zip.read('Big-Evolution/' + name.as_posix()) == data, name
            if name.parts[0] != 'dist':
                assert (ROOT / 'dist/source-files' / name).read_bytes() == data, name
        for name in source_zip.namelist():
            assert not forbidden_parts.intersection(Path(name).parts), name
    transfer = ROOT / '.transfer'
    transfer.mkdir(exist_ok=True)
    stage_parent = Path(tempfile.mkdtemp(prefix='github-package-', dir=transfer))
    stage = stage_parent / 'big-evolution-model'
    for name in sorted(files):
        destination = stage / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, destination)
    report = {'modelVersion': version, 'files': len(files), 'stage': str(stage), 'gitHistoryIncluded': False,
              'hostingConfigurationIncluded': False, 'sourceFingerprint': json.loads((ROOT / 'dist/build-info.json').read_text())['sourceFingerprint']}
    if not args.stage_only:
        output = ROOT / 'releases'
        output.mkdir(exist_ok=True)
        target = output / f'Big-Evolution-Model-v{version}-GitHub.zip'
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in sorted(files):
                archive.write(stage / name, 'big-evolution-model/' + name.as_posix())
        with zipfile.ZipFile(target) as archive:
            assert archive.testzip() is None
            assert len(archive.namelist()) == len(files)
            for name in files:
                assert archive.read('big-evolution-model/' + name.as_posix()) == (ROOT / name).read_bytes(), name
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        target.with_suffix('.zip.sha256').write_text(f'{digest}  {target.name}\n', encoding='utf-8')
        report.update({'archive': str(target), 'bytes': target.stat().st_size, 'sha256': digest, 'crc': 'passed', 'canonicalContents': 'passed'})
    (transfer / 'github-package-latest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
