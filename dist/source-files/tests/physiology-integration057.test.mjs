import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {physiologyFrame,advancePhysiologyBodies,preparePhysiologyBoundary} from '../dist/physiology-world.js';
import {startProcess} from '../dist/physiology-actions.js';
import {conceive} from '../dist/pregnancy.js';
import {validatePlan,validateWorldOptions} from '../dist/experiment-plan.js';
import {analyzeGenome} from '../dist/genome-analysis.js';
import {energyPreview,previewBrain} from '../dist/energy-preview.js';
import {compileExpression,numericField} from '../dist/analysis-expression.js';
import {PHYSIOLOGY_METRICS,physiologyMetric} from '../dist/physiology-metrics.js';
import {PHYSIOLOGY_GUIDE_TEXT,digestionGuideExample} from '../dist/guide-physiology-text.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
const world=extra=>new Evolution({physiology:{},population:2,seed:42,...extra});
const begin=(w,a,action,test=()=>true)=>{const frame=physiologyFrame(w,a),choice=frame.request.candidates.find(c=>c.action===action&&test(c));assert(choice);a.process=startProcess(a,w.executableDecision(frame,choice),w.subtick,w.physiology);return a.process;};
test('фазы: уход до удара; конкурентный сбор сохраняет единственную порцию',()=>{
 const w=world(),[a,b]=w.agents;w.moveAgent(b,a);preparePhysiologyBoundary(w);
 const attack=begin(w,a,11),move=begin(w,b,0);attack.elapsed=attack.duration-1;move.elapsed=move.duration-1;const health=b.health;
 advancePhysiologyBodies(w);assert.equal(b.health,health);assert.equal(a.life.observer.interruptions.physical,1);assert.notEqual(a.x+','+a.y,b.x+','+b.y);
 w.moveAgent(b,a);w.tile(a.x,a.y).food=1;preparePhysiologyBoundary(w);
 for(const c of [a,b]){const p=begin(w,c,6,o=>o.foodType===1);p.elapsed=p.duration-1;}
 advancePhysiologyBodies(w);assert.equal(a.foodInventory[1]+b.foodInventory[1],1);assert.equal(w.tile(a.x,a.y).food,0);
});
test('беременность: живые роды сверх лимита, смерть на границе отменяет рождение',()=>{
 for(const killed of [false,true]){
  const w=world({limit:2,bodyGenes:{tPreg:.1},physiology:{attackDamage:2000,healingDeficitFraction:0,healingMinimumFraction:0}}),[a,b]=w.agents;w.moveAgent(b,a);
  a.pregnancy=conceive(a.genome.slice(),a.bodyGenes,a.bodyPlan,0,w.physiology);a.pregnancy.paid=a.pregnancy.cost;
  preparePhysiologyBoundary(w);advancePhysiologyBodies(w);assert.equal(a.pregnancy.stage,'labor');
  while(w.subtick<a.pregnancy.laborDue-1)advancePhysiologyBodies(w);
  if(killed){preparePhysiologyBoundary(w);const p=begin(w,b,11,c=>c.targetHandle===a.id);p.elapsed=p.duration-1;}
  const next=w.nextId;advancePhysiologyBodies(w);
  if(killed){assert.equal(w.stats.births,0);assert.equal(a.alive,false);assert(w.stats.physiology.createdMeat>0);}
  else{assert.equal(w.agents.length,3);const child=w.agents.find(c=>c.id===next);assert.equal(child.ageSteps,0);assert.equal(child.life.observer.brainCalls,0);assert.equal(child.brain.memory.size,0);assert(child.brain.networkDelta.every(v=>v===0));}
 }
});
test('план v4, анализ v18 и калькулятор принимают новые настройки без p→A',()=>{
 const plan=validatePlan({worlds:1,steps:1,factors:[{key:'bodyGenes.tau',values:[10,20]},{key:'physiology.grassEnergy',values:[11,22]}]});assert.equal(plan.variants.length,4);
 assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(plan))),plan);
 plan.variants[0].settings.bodyGenes.tau=3;assert.equal(plan.variants[1].settings.bodyGenes.tau,10);
 assert.throws(()=>validateWorldOptions({initialMutation:{behavior:{rate:.1,strength:.1}}}),/A\/r/);
 const w=world(),report=analyzeGenome(w.genomeFile(w.agents[0]),{name:'body'});assert.equal(report.genomeVersion,18);assert.equal(report.actions.length,12);assert(report.properties.some(p=>p.key==='body-gmax'));
 const settings=validateWorldOptions({population:2}),brain=previewBrain(settings),a=energyPreview(settings,brain,3,{foodType:0}),b=energyPreview({...settings,brainCostMultiplier:.5},brain,3,{foodType:0});
 assert.equal(a.food,b.food);assert.equal(a.physical,b.physical);assert.equal(a.main/2,b.main);assert.equal(a.learning/2,b.learning);assert.equal(a.attention/2,b.attention);assert(b.net>a.net);
});
test('метрики отличают отсутствие от нуля; индекс вида пищи доступен в выражении',()=>{
 for(const m of PHYSIOLOGY_METRICS)assert.equal(physiologyMetric({},m.id),null);
 const row={physiology:{absorbed:[1,2,3]}},expression=compileExpression('physiology.absorbed.0 + physiology.absorbed.2');assert.equal(expression.evaluate(p=>numericField(row,p)),4);
 assert(Math.abs(digestionGuideExample(0)-16.5)<1e-9);assert(Object.values(PHYSIOLOGY_GUIDE_TEXT).every(s=>!s.includes('NaN')&&!s.includes('undefined')));
});
test('сохранённый v18 сохраняет условную цену при продолжении и не принимает старую основу',()=>{
 const w=world();for(let i=0;i<5;i++)w.substep();const r=loadWorld(saveWorld(w));assert.equal(r.genomeVersion,18);assert.deepEqual(r.balances(),w.balances());
 const legacy=new Evolution({population:1,brainType:'set-duration-dual-dag-v1'});assert.throws(()=>world({baseGenome:legacy.agents[0].genome}),/Старый геном/);
});
import {prepareSetDecisionInput} from '../dist/physiology-inputs.js';
import {parallelPhysiologyCognition} from '../dist/physiology-cognition.js';
test('наблюдение процесса не раскрывает адрес исполнения; ID целей не меняют входы сети',()=>{
 const w=world(),[a,b]=w.agents;w.moveAgent(b,a);preparePhysiologyBoundary(w);begin(w,a,11);
 const request=physiologyFrame(w,a).request;assert(!('destination' in request.observation.process));assert(!('targetHandle' in request.observation.process));
 const copy=structuredClone(request);for(const c of copy.candidates){c.id='opaque-'+c.id;if(c.targetHandle!==null)c.targetHandle+=12345;}
 const first=prepareSetDecisionInput(a.brain,request),second=prepareSetDecisionInput(a.brain,copy);
 assert.deepEqual(first.prepared,second.prepared);assert.deepEqual(first.rows,second.rows);
});
test('повреждённый ответ владельца отвергается до выбора, цены и замены мозга',async()=>{
 const w=world({population:1}),a=w.agents[0],brain=a.brain,rng=w.random.state,energy=a.energy;
 const pool={world:w,owners:new Map(),lanes:[{added:[],removed:[],endpoint:{call:async()=>[{id:a.id,gateCost:-1,learningCost:0}]}}],metrics:{registrations:0,evaluateMs:0}};
 await assert.rejects(parallelPhysiologyCognition(pool,()=>{throw new Error('не должен заменяться');}),/Несогласованный/);
 assert.equal(a.brain,brain);assert.equal(a.energy,energy);assert.equal(w.random.state,rng);assert.equal(w.stats.brainCalls,0);
});
