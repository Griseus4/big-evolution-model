"""Проверяет входные документы, локальные ссылки и несколько фактов модели.

Ничего не меняет и не запускает длинную симуляцию. Машинные факты извлекаются
из экспортов JS-модулей без создания мира или запуска симуляции; JSON правил не хранится.
"""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
FILES = [ROOT / 'AGENTS.md', ROOT / 'README.md', ROOT / 'README.ru.md', *sorted((ROOT / 'docs').rglob('*.md'))]
REQUIRED = ['START_HERE.md', 'architecture.md', 'mechanics-reference.md', 'decisions.md', 'future-ideas.md', 'work/current.md', 'workflows/context.md', 'workflows/local.md', 'templates/contract.md', 'verification.md']
errors = []
model_version = re.search(r"MODEL_VERSION='([^']+)'", (ROOT / 'dist/life-history.js').read_text(encoding='utf-8')).group(1)
for name, pattern in [('README.md', r'Current implementation:\*\* ([0-9.]+)'), ('README.ru.md', r'Текущая версия:\*\* ([0-9.]+)')]:
    marker = re.search(pattern, (ROOT / name).read_text(encoding='utf-8'))
    if not marker or marker.group(1).rstrip('.') != model_version:
        errors.append(f'{name}: текущая версия должна совпадать с MODEL_VERSION={model_version}')

for name in REQUIRED:
    if not (ROOT / 'docs' / name).is_file():
        errors.append(f'Отсутствует docs/{name}')

links = 0
for path in FILES:
    text = path.read_text(encoding='utf-8')
    # Потерянные при консольной записи буквы нельзя восстановить по UTF-8:
    # файл декодируется, но вместо слов уже записаны обычные знаки вопроса.
    for number, line in enumerate(text.splitlines(), 1):
        if '\ufffd' in line or re.search(r'\?{4,}', line):
            errors.append(f'{path.relative_to(ROOT)}:{number}: возможная потеря текста; проверить исходную запись и кодировку.')
    for href in re.findall(r'\[[^\]]+\]\(([^)]+)\)', text):
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', href):
            continue
        raw_path, _, fragment = href.partition('#')
        target = (path.parent / raw_path).resolve() if raw_path else path
        links += 1
        if not target.is_file():
            errors.append(f'{path.relative_to(ROOT)}: отсутствует цель {href}')
        elif fragment and target.suffix == '.md':
            headings = re.findall(r'^#{1,6}\s+(.+)$', target.read_text(encoding='utf-8'), re.MULTILINE)
            anchors = {re.sub(r'[^\w\s-]', '', h.lower()).strip().replace(' ', '-') for h in headings}
            if fragment not in anchors:
                errors.append(f'{path.relative_to(ROOT)}: отсутствует раздел {href}')

js = """
import {GENOME_VERSION,WORLD_WIDTH,WORLD_HEIGHT,GENE_COUNT} from './dist/evolution.js';
import {BODY_WEIGHT_COUNT} from './dist/policy-layout.js';
import {NEURAL_GENE_COUNT,PARAMETER_COUNT,NEIGHBOUR_BRAIN_TYPE,layoutForType} from './dist/neural-layout.js';
import {STRUCTURAL_TYPE_LAYOUT as SET_LAYOUT} from './dist/structural-brain.js';
import {MEMORY_LIMIT,TRACE_LIMIT,EXPERIENCE_SIZE,FEATURE_NAMES} from './dist/cognition.js';
console.log(JSON.stringify({setVersion:SET_LAYOUT.version,setGenes:null,neighbourGenes:layoutForType(NEIGHBOUR_BRAIN_TYPE).genes,neuralGenes:NEURAL_GENE_COUNT,parameters:PARAMETER_COUNT,width:WORLD_WIDTH,height:WORLD_HEIGHT,genes:GENE_COUNT,
version:GENOME_VERSION,memory:MEMORY_LIMIT,trace:TRACE_LIMIT,
experience:EXPERIENCE_SIZE,features:FEATURE_NAMES.length,bodyWeights:BODY_WEIGHT_COUNT}));
"""
result = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, text=True, capture_output=True, check=True)
facts = json.loads(result.stdout)
current = (ROOT / 'docs' / 'mechanics-reference.md').read_text(encoding='utf-8')
checks = [
    (current, f"{facts['width']}×{facts['height']}", 'размер карты'),
    (current, 'переменное число наследуемых', 'размер текущего генома'),
    (current, f"v{facts['setVersion']}", 'текущая схема'),
]

for text, marker, label in checks:
    if marker not in text:
        errors.append(f'Документы расходятся с кодом: {label}, ожидается {marker!r}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Документы согласованы: {len(FILES)} файлов, {links} локальных ссылок; карта {facts["width"]}×{facts["height"]}, сетевой геном {facts["setGenes"]}.')
