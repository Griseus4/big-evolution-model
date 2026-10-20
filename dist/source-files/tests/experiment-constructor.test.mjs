import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,standardSeeds,seedMatrix,allocateComputations,workerCost,selectAttempt} from '../dist/experiment-plan.js';
import {ExperimentSeries} from '../dist/experiment-series.js';
import {ExperimentExecution} from '../dist/experiment-execution.js';
import {ExperimentStore} from '../dist/experiment-store.js';
import {validateExperimentReport} from '../dist/experiment-ui.js';
import {Evolution} from '../dist/evolution.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {decodeState} from '../dist/state-codec.js';
import {MODEL_VERSION} from '../dist/life-history.js';
import {runWorld} from '../dist/experiment-runner.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';

const plan=(options={})=>validatePlan({worlds:2,steps:5,budget:2,common:{population:3,limit:10},variants:[{name:'A'},{name:'B',settings:{learning:false}}],...options});
function harness(input=plan()){
 const workers=[],finished=[];let changes=0;
 const series=new ExperimentSeries({createWorker:()=>{const w={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.closed=true;}};workers.push(w);return w;},onChange:()=>changes++,onFinish:r=>finished.push(r)});
 series.start(input);
 const send=(worker,type,values={})=>worker.onmessage({data:{type,jobId:worker.sent.find(m=>m.type==='run').job.id,...values}});
 const done=(worker,tick=5,extinct=false,status='completed')=>send(worker,'done',{result:{modelVersion:MODEL_VERSION,status,tick,extinct,lives:{tick,dead:[],living:[],completed:{count:0,meanAge:null,medianAge:null},byCause:{}}}});
 return {series,workers,finished,send,done,get changes(){return changes;}};
}
test('plan defaults, independent flags, nested overrides and input validation',()=>{
 const p=validatePlan({variants:[{name:'A'},{name:'B',settings:{memory:false,learning:true,reproduction:{maturity:1}}}]});
 assert.equal(p.worlds,5);assert.equal(p.steps,20000);assert.equal(p.common.population,150);assert.equal(p.common.limit,1000);
 assert.equal(p.variants[1].settings.memory,false);assert.equal(p.variants[1].settings.learning,true);assert.equal(p.variants[1].settings.reproduction.maturity,1);assert.equal(p.common.reproduction.maturity,90);
 for(const bad of [{worlds:0},{seeds:[42,42]},{budget:1,allocation:'fixed',maxWorkers:2},{common:{population:5,limit:4}},{variants:[]}])assert.throws(()=>plan(bad));
 assert.equal(plan({common:{foodRegrowInterval:125.5,foodIslandCount:0}}).common.foodGeneralSettings,true);
});
test('seeds retain a stable prefix and all variants receive the predetermined retry matrix',()=>{
 assert.deepEqual(standardSeeds(5),standardSeeds(12).slice(0,5));const p=plan(),matrix=seedMatrix(p.seeds);
 assert.equal(new Set(matrix.flat()).size,6);assert.deepEqual(matrix,p.seedMatrix);assert.deepEqual(validatePlan(p),p);
 const h=harness();h.done(h.workers[0],1,true);assert.equal(h.workers.at(-1).sent[0].job.seed,p.seedMatrix[0][0]);
});
test('scheduler respects budget, retries extinction and retains every attempt',()=>{
 const h=harness(plan({worlds:1,budget:1,variants:[{name:'A'}]}));
 h.done(h.workers[0],2,true);h.done(h.workers[1],3,true);h.done(h.workers[2],1,true);
 const g=h.series.report.groups[0];assert.equal(g.attempts.length,3);assert.equal(g.selectedId,g.attempts[1].id);assert.equal(g.attempts.filter(a=>a.extinct).length,3);assert.equal(h.finished.length,1);
 assert.deepEqual(g.attempts.map(a=>a.seed),h.series.report.plan.seedMatrix[0]);assert.equal(validateExperimentReport(h.series.report),h.series.report);
});
test('successful retry ends the group, technical errors are not biological retries',()=>{
 const h=harness(plan({worlds:1,budget:1,variants:[{name:'A'}]}));h.done(h.workers[0],1,true);h.done(h.workers[1]);assert.equal(h.workers.length,2);assert.equal(h.series.report.groups[0].selectedId,'v1-0-2');
 const f=harness(plan({worlds:1,variants:[{name:'A'}]}));f.done(f.workers[0],1,false,'failed');assert.equal(f.workers.length,1);assert.equal(f.series.report.status,'completed-with-errors');
});
test('workers strengthen only after the queue drains; allocation ACK protects the global budget',()=>{
 const h=harness(plan({worlds:3,budget:3,maxWorkers:4,common:{population:150,limit:1000},variants:[{name:'A'}]}));
 assert.equal(h.workers.length,3);h.done(h.workers[0]);assert.equal(h.series.used(),2);assert.ok(h.series.slots.every(s=>s.actual===1));
 h.done(h.workers[1]);const last=h.workers[2];assert.deepEqual(last.sent.at(-1),{type:'computations',value:2});assert.equal(h.series.used(),3);
 h.send(last,'progress',{progress:{tick:2,population:150,computeWorkers:2,allocationChanged:true}});assert.equal(h.series.slots[0].actual,2);assert.equal(h.series.used(),3);h.done(last);assert.equal(h.finished.length,1);
});
test('allocation failure retains the working mode without an endless retry loop',()=>{
 const h=harness(plan({worlds:1,budget:5,maxWorkers:4,common:{population:150,limit:1000},variants:[{name:'A'}]})),w=h.workers[0];
 assert.equal(w.sent.at(-1).type,'computations');h.send(w,'progress',{progress:{tick:0,population:150,computeWorkers:1,allocationError:'Unavailable'}});
 assert.equal(h.series.slots[0].requested,null);assert.equal(h.series.slots[0].cap,1);assert.equal(w.sent.filter(m=>m.type==='computations').length,1);h.done(w);
});
test('cooperative stop waits for active worlds; forced stop releases and ignores stale replies',()=>{
 const h=harness();h.series.stop();assert.equal(h.finished.length,0);for(const w of h.workers)h.done(w,2,false,'stopped');assert.equal(h.finished.length,1);assert.equal(h.series.report.status,'stopped');
 const f=harness();f.series.stop(true);assert.equal(f.finished.length,1);const changes=f.changes;f.done(f.workers[0]);assert.equal(f.changes,changes);assert.ok(f.workers.every(w=>w.closed));
});
test('allocation calculator counts coordinators and avoids parallel overhead in tiny populations',()=>{
 const p=plan({budget:14,maxWorkers:14});for(const pending of [true,false]){const counts=allocateComputations(p,[150,400,3],pending);assert.ok(counts.reduce((s,c)=>s+workerCost(c),0)<=14);assert.equal(counts[2],1);if(pending)assert.deepEqual(counts,[1,1,1]);}
 assert.equal(selectAttempt([{id:'a',status:'completed',tick:5,extinct:true},{id:'b',status:'completed',tick:5,extinct:true}],20).id,'a');
});
test('custom reproduction is per world and survives a full save roundtrip',()=>{
 const w=new Evolution({population:2,reproduction:{energy:10,health:15,maturity:5,birthInterval:12}}),other=new Evolution({population:2});
 const a=w.agents[0];a.age=4;assert.ok(w.birthAvailability(a).blocked.includes('immature'));a.age=5;assert.ok(!w.birthAvailability(a).blocked.includes('immature'));a.lastBirthAge=0;assert.ok(w.birthAvailability(a).blocked.includes('interval'));
 assert.equal(other.reproduction.maturity,90);assert.equal(other.reproduction.birthInterval,100);assert.deepEqual(loadWorld(saveWorld(w)).reproduction,w.reproduction);
});
test('changing execution ownership preserves exact brains, memory, RNG and full world state',async()=>{
 const w=new Evolution({seed:42,population:5,limit:10}),reference=new Evolution({seed:42,population:5,limit:10}),e=new ExperimentExecution(w,createCognitionWorker);
 try{for(const count of [1,2,1,4,1]){await e.resize(count);for(let i=0;i<2;i++){await e.step();reference.step();}await e.sync();assert.deepEqual(decodeState(saveWorld(w).state),decodeState(saveWorld(reference).state));}}finally{await e.close();}
});
test('constructor runner retains full observer rows and serial/parallel results match',async()=>{
 const p=plan({common:{population:4,limit:10,mutations:false,reproduction:{maturity:2,birthInterval:4}}}),job={id:'short',steps:4,seed:42,fullHistory:true,saveGenomes:false,worldOptions:p.variants[0].settings};
 const serial=await runWorld(job),parallel=await runWorld(job,{getComputations:()=>2,createWorker:createCognitionWorker});
 assert.equal(serial.status,'completed');assert.equal(parallel.status,'completed');assert.deepEqual(serial.lives,parallel.lives);assert.deepEqual(serial.stats,parallel.stats);assert.equal(serial.detailRetention.deadRowsLimit,null);assert.equal(serial.settings.worldOptions.mutations,false);
 for(const memory of [true,false])for(const learning of [true,false]){const r=await runWorld({...job,steps:1,worldOptions:{...job.worldOptions,memory,learning}});assert.equal(r.status,'completed');assert.equal(r.settings.worldOptions.memory,memory);assert.equal(r.settings.worldOptions.learning,learning);}
});
test('report validation rejects damaged retry seeds and unsupported report formats',()=>{
 const h=harness(plan({worlds:1,variants:[{name:'A'}]}));h.done(h.workers[0]);const r=structuredClone(h.series.report);r.groups[0].attempts[0].seed++;assert.throws(()=>validateExperimentReport(r));assert.throws(()=>validateExperimentReport({format:'other'}));
});
test('unavailable persistence is explicit and never pretends the report was saved',async()=>{
 const store=new ExperimentStore(null);await assert.rejects(store.saveTemplate('x',plan()),/Скачайте результаты/);
});
test('actual experiment Worker protocol completes a short two-variant series',async()=>{
 let series;const finished=new Promise(resolve=>{series=new ExperimentSeries({createWorker:()=>createCognitionWorker({url:new URL('../dist/experiment-worker.js',import.meta.url)}),onFinish:resolve});});
 try{series.start(plan({worlds:1,steps:2,budget:1}));const report=await finished;assert.equal(report.status,'completed');assert.equal(report.groups.length,2);for(const g of report.groups){assert.equal(g.attempts[0].tick,2);assert.equal(g.attempts[0].lives.living.length,3);}assert.equal(validateExperimentReport(report),report);}finally{series.stop(true);}
});
test('current base genome is retained in normalized and reloaded plans',()=>{
 const genes=new Evolution({population:1}).agents[0].genome,p=plan({common:{baseGenome:genes}});assert.deepEqual(p.common.baseGenome,genes);assert.deepEqual(validatePlan(p),p);assert.notEqual(p.common.baseGenome,genes);
});
