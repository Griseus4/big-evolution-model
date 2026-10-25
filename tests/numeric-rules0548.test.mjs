import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Evolution} from '../dist/evolution.js';
import {saveWorld} from '../dist/world-save.js';
import {RULES,BODY_LIMITS} from '../dist/model-rules.js';
import {SUBSTEPS,DT,DURATION_SUBSTEPS,ACTION_DURATIONS} from '../dist/action-timing.js';
import {RULES as PUBLIC_RULES,actionEnergyCost as PUBLIC_COST} from '../dist/evolution.js';
import {actionEnergyCost} from '../dist/model-rules.js';
import {numericRuleRows,NUMERIC_RULE_GROUPS} from '../dist/numeric-rules.js';
import {formatRuleNumber,GUIDE_NUMBERS_TEXT} from '../dist/guide-numbers-text.js';
import {MUTATION_RULES} from '../dist/mutation-parameters.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/numeric-rules0548.json',import.meta.url),'utf8'));
// Фикстура сравнивает физику v14; новая оболочка сохранения v4 — отдельный контракт.
const hash=w=>{const s=saveWorld(w);delete s.modelVersion;s.version=3;return createHash('sha256').update(JSON.stringify(s)).digest('hex');};

for(const {options,samples} of fixture.cases)test(`full pre-refactor state, memory, learning and RNG stay exact: seed ${options.seed}`,()=>{
 const w=new Evolution(options);for(const point of samples){while(w.subtick<point.subtick)w.substep();assert.equal(hash(w),point.hash,`subtick ${point.subtick}`);}
});
test('named durations retain their action order and the physical clock has one source',()=>{
 assert.equal(DT,1/SUBSTEPS);
 assert.deepEqual(ACTION_DURATIONS,[...Array(6).fill(DURATION_SUBSTEPS.move),DURATION_SUBSTEPS.gather,DURATION_SUBSTEPS.eat,DURATION_SUBSTEPS.wait,DURATION_SUBSTEPS.birth,DURATION_SUBSTEPS.deposit]);
 const w=new Evolution({population:1});assert.equal(w.agents[0].health,BODY_LIMITS.health);assert.equal(w.agents[0].energy,RULES.initialEnergy);
 for(const file of ['evolution.js','temporal-world.js','world-save.js','parallel-world.js']){
  const source=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/subtick\s*\/\s*10|born\s*\*\s*10|i<10&&(?:this|w)\.agents/);
 }
});
test('catalogue documents numeric fields of every registered owner and uses their live exports',()=>{
 assert.equal(PUBLIC_RULES,RULES);assert.equal(PUBLIC_COST,actionEnergyCost);
 const rows=numericRuleRows(),keys=new Set(rows.map(r=>r.group+':'+r.key));assert.equal(keys.size,rows.length);
 for(const group of NUMERIC_RULE_GROUPS)for(const [key,value] of Object.entries(group.values))if(typeof value==='number'){
  const row=rows.find(r=>r.group===group.id&&r.key===key);assert.equal(row.value,value);assert.ok(row.label);assert.equal(typeof row.unit,'string');
 }
 assert.equal(rows.find(r=>r.name==='RULES.inventoryCapacity').value,RULES.inventoryCapacity);
 assert.equal(rows.find(r=>r.name==='DURATION_SUBSTEPS.move').value,DURATION_SUBSTEPS.move);
 assert.notEqual(formatRuleNumber(MUTATION_RULES.strengthFloor),'0');assert.match(formatRuleNumber(MUTATION_RULES.strengthFloor),/0,000001/);
 assert.match(GUIDE_NUMBERS_TEXT['guide-numbers-body'],/RULES.inventoryCapacity/);
});
