import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GUIDE_REFERENCE_TEXT} from '../dist/guide-reference-text.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {HELP,PAGE_TEXT} from '../dist/ui-text.js';
import {guideSourceHelpKey} from '../dist/project-guide-search.js';
import {RULES,actionEnergyCost} from '../dist/evolution.js';
import {SUBSTEPS,DT,ACTION_DURATIONS,DECISION_COST,REPEAT_COST} from '../dist/action-timing.js';
import {ENERGY_DEFICIT_FACTOR} from '../dist/energy-budget.js';
import {REPRODUCTION_DEFAULTS} from '../dist/reproduction.js';
import {SOURCE_CAPACITY_LIMITS} from '../dist/food-settings.js';
import {STRUCTURAL_TYPE_LAYOUT} from '../dist/structural-brain.js';
import {ENVIRONMENT_RULES} from '../dist/environment-settings.js';
import {GATE_INPUTS,GATE_HIDDEN} from '../dist/temporal-layout.js';

test('dense numeric rules use titled tables in block hosts and the requested redundant qualifications are absent',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 for(const key of ['description66','description67','description68','description69','wiki-environment','wiki-saves']){
  assert.match(GUIDE_REFERENCE_TEXT[key],/<table[^>]*>[\s\S]*?<caption>/);
  assert.match(html,new RegExp(`<div[^>]*data-ui-text="${key}"`));assert.doesNotMatch(html,new RegExp(`<p[^>]*data-ui-text="${key}"`));
 }
 assert.doesNotMatch(Object.values(PAGE_TEXT).join(' '),/Рождение ещё не означает успешного взрослого потомка|Это модель эволюции с условностями/);
 assert.match(PAGE_TEXT.description40,/Назначенных очков/);assert.match(PAGE_TEXT.description41,/мутации/);
});

test('inline article and source links resolve to the same summaries used by delayed help',()=>{
 const ids=new Set(GUIDE_ARTICLES.map(a=>a.id));
 for(const text of Object.values(GUIDE_REFERENCE_TEXT))for(const [,id]of text.matchAll(/data-guide-article="([^"]+)"/g)){assert.ok(ids.has(id));assert.ok(HELP[`wiki-tab-${id}`]?.[1]);}
 for(const article of GUIDE_ARTICLES)for(const source of [...article.sources,...article.checks])assert.ok(HELP[guideSourceHelpKey(article.id,source.file)]?.[1]);
 assert.ok(HELP['guide-code-index']);assert.ok(HELP['guide-future-index']);
});

test('reference numbers follow shared rules instead of retaining duplicated prose values',()=>{
 // Подмена источников имитирует изменение базовых параметров, не запускает мир
 // и проверяет перенос чисел/расчётов в читательский текст, а не только их формат.
 const source=readFileSync(new URL('../dist/guide-reference-text.js',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace('export const GUIDE_REFERENCE_TEXT','const GUIDE_REFERENCE_TEXT');
 const changed=vm.runInNewContext(source+'\nGUIDE_REFERENCE_TEXT',{
  RULES:{...RULES,foodEnergy:30,digestionRate:2,inventoryCapacity:7},actionEnergyCost,SUBSTEPS,DT,ACTION_DURATIONS,DECISION_COST,REPEAT_COST,ENERGY_DEFICIT_FACTOR,
  REPRODUCTION_DEFAULTS:{...REPRODUCTION_DEFAULTS,maturity:150},SOURCE_CAPACITY_LIMITS,STRUCTURAL_TYPE_LAYOUT,ENVIRONMENT_RULES,GATE_INPUTS,GATE_HIDDEN,
 });
 const plain=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 assert.match(plain(changed.description67),/Энергия одной порции 30/);assert.match(plain(changed.description67),/инвентаря, порций 7/);assert.match(plain(changed.description67),/Усвоение одной порции 15 Т/);
 assert.match(plain(changed.description69),/Возраст 150 Т/);assert.match(changed.description67,/значения по умолчанию/);
});
