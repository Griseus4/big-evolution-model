"""Статическая проверка файлов/связей, без запуска игры, тестов и браузера.

Проверяет JS-синтаксис, локальные импорты/ресурсы и ID. Она не доказывает
правильность поведения программы: исполняемые проверки запускает пользователь.
"""
from pathlib import Path
from html.parser import HTMLParser
import re
import json
import subprocess
ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'dist'
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.resources=[]; self.controls=[]; self.ranges={}; self.references=[]; self.selects={}; self.open_select=None
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.append(attrs['id'])
        if tag in {'button','input','select','textarea'} and 'id' in attrs:self.controls.append(attrs['id'])
        if tag=='input' and attrs.get('type')=='range':self.ranges[attrs['id']]=attrs
        if tag=='select':self.open_select=attrs.get('id');self.selects[self.open_select]=[]
        if tag=='option' and self.open_select:self.selects[self.open_select].append(attrs)
        for name in ['aria-controls','aria-labelledby','aria-describedby','for']:
            if name in attrs:self.references.extend(attrs[name].split())
        if tag in {'script','link'}:
            url=attrs.get('src',attrs.get('href',''))
            if url.startswith('./'):self.resources.append(url)
    def handle_endtag(self,tag):
        if tag=='select':self.open_select=None
p=Page();p.feed((DIST/'index.html').read_text())
assert len(set(p.ids))==len(p.ids),'Повтор ID в HTML'
for url in p.resources:assert (DIST/url.removeprefix('./')).is_file(),url
checked=0
for path in sorted([*DIST.glob('*.js'),*(DIST/'benchmark-snapshots').rglob('*.js')]):
    subprocess.run(['node','--check',str(path)],check=True,capture_output=True,text=True)
    text=path.read_text()
    for target in re.findall(r"(?:from\s+|new URL\()'([.][^']+)'",text):
        assert (path.parent/target).is_file(),f'{path.name}: нет {target}'
    checked+=1
for name in ['evolution-app.js','lab-tabs.js','sidebar.js','genome-analysis-ui.js','performance-ui.js','benchmark-ui.js','help.js']:
    text=(DIST/name).read_text()
    ids=re.findall(r"(?:element|byId)\('([^']+)'\)",text)
    for identity in ids:assert identity in p.ids,f'{name}: нет id={identity}'
for tab in ['world','history','tests','analysis','about']:
    for prefix in ['tab-','panel-']:assert prefix+tab in p.ids
for tab in ['resident','world','new','performance']:
    for prefix in ['side-tab-','side-panel-']:assert prefix+tab in p.ids
for mode in ['no-memory-no-td','memory-only','memory-and-td']:assert 'mode-'+mode in p.ids
checks=re.findall(r"check\('([^']+)'", (DIST/'temporal-checks.js').read_text())
assert len(checks)==len(set(checks)),'Повтор ID проверки'
# Читаем только определения справки/констант, не создаём мир и не исполняем
# проверки механизмов. Покрытие всех настроек проверяем отдельно от DOM-кликов.
js="""
import {HELP,ALIASES} from './dist/help.js';
import {MAX_BENCHMARK_REPEATS,DEFAULT_BENCHMARK_COUNTS} from './dist/benchmark-versions.js';
import {FOOD_LIMITS} from './dist/food-settings.js';
import {WORLD_DEFAULTS} from './dist/world-defaults.js';
import {SOURCE_CAPACITY_LIMITS} from './dist/world-edit.js';
import {REPRODUCTION_PROFILES,DEFAULT_REPRODUCTION} from './dist/reproduction.js';
import {GEOGRAPHY_PROFILES,DEFAULT_GEOGRAPHY} from './dist/geography.js';
console.log(JSON.stringify({benchmarkDefaults:DEFAULT_BENCHMARK_COUNTS,benchmarkMax:MAX_BENCHMARK_REPEATS,defaults:WORLD_DEFAULTS,help:Object.keys(HELP),aliases:ALIASES,limits:FOOD_LIMITS,capacity:SOURCE_CAPACITY_LIMITS,geography:GEOGRAPHY_PROFILES.map(p=>p.id),defaultGeography:DEFAULT_GEOGRAPHY,reproduction:REPRODUCTION_PROFILES.filter(p=>!p.automatic).map(p=>p.id),defaultReproduction:DEFAULT_REPRODUCTION}));
"""
data=json.loads(subprocess.run(['node','--input-type=module','-e',js],cwd=ROOT,check=True,capture_output=True,text=True).stdout)
aliases=data['aliases']
for identity in p.controls:
    if identity.startswith(('tab-','side-tab-','resident-tab-','test-tab-')) or identity=='help-close':continue
    assert aliases.get(identity,identity) in data['help'],f'Нет подсказки для {identity}'
for identity,attrs in p.ranges.items():
    if identity=='world-food-capacity':
        expected=[data['capacity'][x] for x in ['min','max','default']]
    elif identity.endswith('spread'):
        expected=[data['limits']['spreadMin'],data['limits']['spreadMax'],data['limits']['periodSpreadDefault' if identity.endswith('period-spread') else 'sizeSpreadDefault']]
    else:
        prefix='sources' if identity.endswith('sources') else 'interval'
        expected=[data['limits'][prefix+x] for x in ['Min','Max','Default']]
    assert [int(attrs[x]) for x in ['min','max','value']]==expected,f'Границы/начальное значение {identity}'
for prefix in ['', 'world-', 'test-']:
    for suffix in ['sources', 'period', 'islands', 'period-spread', 'size-spread']:
        assert prefix+'food-'+suffix in p.ids, 'Не хватает общего пищевого поля'
    assert re.search(r'id="'+prefix+r'food-islands"[^>]*min="'+str(data['limits']['islandsMin'])+r'"[^>]*max="'+str(data['limits']['islandsMax'])+r'"[^>]*value="'+str(data['limits']['islandsDefault'])+r'"', (DIST/'index.html').read_text()), 'Границы островков'
for identity in p.references:assert identity in p.ids,f'Отсутствует цель HTML/ARIA {identity}'
for identity in ['geography','test-geography']:
    options=p.selects[identity]
    assert [o.get('value') for o in options]==[data['defaultGeography']],f'Профили {identity} расходятся с моделью'
    assert [o.get('value') for o in options if 'selected' in o]==[data['defaultGeography']],f'Исходный профиль {identity}'
assert [o.get('value') for o in p.selects['test-reproduction']]==data['reproduction']
assert [o.get('value') for o in p.selects['test-reproduction'] if 'selected' in o]==[data['defaultReproduction']]
page=(DIST/'index.html').read_text()
for identity,key in [('founders','population'),('population-limit','limit'),('test-founders','population'),('test-limit','limit')]:
    assert re.search(r'id="'+identity+r'"[^>]*value="'+str(data['defaults'][key])+r'"',page),f'Начальное значение {identity}'
assert re.search(r'id="mutation-rate"[^>]*value="0.02"',page),'Параметр старой основы'
for tab in ['mechanisms','benchmark','long']:
    for prefix in ['test-tab-','test-panel-']:assert prefix+tab in p.ids
for section in ['birth','position','senses','actions','learning','traits','short','long','features']:
    for prefix in ['resident-tab-','resident-panel-']:assert prefix+section in p.ids
assert len(checks)>=30,'Неполный набор проверок текущей модели'
print(f'Статическая проверка: {checked} JS-файлов, {len(p.ids)} ID, {len(checks)} браузерная проверка подготовлена, не запущена.')

for kind in ['evaluator','world']:
    assert re.search(r'id="benchmark-repeats-'+kind+r'"[^>]*max="'+str(data["benchmarkMax"])+r'"',page),"Предел повторов HTML расходится с валидатором"
    assert re.search(r'id="benchmark-repeats-'+kind+r'"[^>]*value="'+str(data["benchmarkDefaults"][kind])+r'"',page),"Начальные повторы HTML расходятся с настройками"
