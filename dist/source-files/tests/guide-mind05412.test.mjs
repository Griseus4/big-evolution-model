import test from 'node:test';
import assert from 'node:assert/strict';
import {guideFeelingExample,guideOperationExample,guideMemoryExample} from '../dist/guide-mind-text.js';
import {Evolution} from '../dist/evolution.js';
import {sampleCells,localTemporalObservation} from '../dist/temporal-world.js';
import {rebuildActivities,sampleActivities,ACTIVITY_COUNT} from '../dist/activity-perception.js';
import {prepareSetInput} from '../dist/temporal-inputs.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {searchGuideArticles} from '../dist/project-guide-search.js';

test('changing only the energy sensitivity sign reverses the same subjective state',()=>{
 const e=guideFeelingExample();assert.equal(e.positive,-50);assert.equal(e.negative,50);assert.equal(e.indifferent,0);
});
test('equal candidate scores give equal operation shares regardless of target count',()=>{
 const rows=guideOperationExample(),moves=rows.filter(r=>r.operation===0),eat=rows.at(-1);
 assert.ok(Math.abs(moves.reduce((n,r)=>n+r.probability,0)-.5)<1e-12);
 assert.ok(Math.abs(eat.probability-.5)<1e-12);assert.ok(moves.every(r=>Math.abs(r.targetProbability-1/6)<1e-12));
 assert.ok(Math.abs(rows.reduce((n,r)=>n+r.probability,0)-1)<1e-12);
});
test('an unseen change does not overwrite a memory record, while its confidence ages',()=>{
 const e=guideMemoryExample();assert.equal(e.recorded,2);assert.equal(e.hiddenFood,0);
 assert.equal(e.before.confidence,1);assert.ok(Math.abs(e.later.confidence-Math.exp(-1))<1e-12);
});
test('activity snapshot excludes the observer and changes only when rebuilt',()=>{
 const w=new Evolution({population:2,seed:42,automaticEnvironment:{enabled:false}}),[a,b]=w.agents;
 w.moveAgent(b,{x:a.x,y:a.y});w.rebuildOccupancy();
 a.process={action:8};b.process={action:8};rebuildActivities(w);
 const out=new Float64Array(ACTIVITY_COUNT),cell=w.tile(a.x,a.y);
 sampleActivities(w,a,cell,out);assert.equal(out[8],1);
 b.process.action=7;sampleActivities(w,a,cell,out);assert.equal(out[8],1);assert.equal(out[7],0);
 rebuildActivities(w);sampleActivities(w,a,cell,out);assert.equal(out[8],0);assert.equal(out[7],1);
 a.process=null;const cells=sampleCells(w,a),o=localTemporalObservation(w,a,cells);
 assert.equal(cells[0].neighbours,1);assert.equal(o.body.energy,a.energy);assert.equal(o.x,undefined);assert.equal(o.y,undefined);
});
test('disabled memory removes memory features while retaining current visual inputs',()=>{
 const w=new Evolution({population:1,seed:42,memory:false,automaticEnvironment:{enabled:false}}),a=w.agents[0];a.process=null;
 const o=localTemporalObservation(w,a,sampleCells(w,a));
 const input=prepareSetInput(a.brain,{observation:o,candidates:[]});
 assert.ok(Array.from(input.memory).every(v=>v===0));assert.equal(input.body[0],a.energy/100);
 assert.ok(input.cells.every(c=>c[6]===0&&c[7]===0&&c[8]===0));
});
test('new chapter questions and terms resolve through the existing guide search',()=>{
 for(const [id,query]of [['observation','общая граница'],['memory','закрепление'],['feelings','чувствительность'],['brain-structure','проекция цели'],['choice','logmeanexp']]){
  const article=GUIDE_ARTICLES.find(a=>a.id===id);assert.equal(article.reviewedVersion,'0.54.12');
  assert.ok(searchGuideArticles(query).some(a=>a.id===id));
 }
});
