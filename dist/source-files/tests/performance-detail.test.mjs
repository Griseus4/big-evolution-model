import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Evolution} from '../dist/evolution.js';
import {PerformanceProfiler} from '../dist/performance-profiler.js';
import {beginComputePart,endComputePart} from '../dist/performance-probe.js';
import {WorldProfiler} from '../dist/world-profiler.js';
import {loadSnapshotRuntime} from '../dist/benchmark-snapshot-runtime.js';
import {BENCHMARK_CURRENT_KERNEL} from '../dist/benchmark-versions.js';

test('nested phase times partition a parent without subtracting its main group',()=>{
 let now=0;const world=new Evolution({population:1});
 world.choose=()=>{};
 world.evaluateFrame=function(){
  const a=beginComputePart('gradient');now+=2;
  const b=beginComputePart('forward');now+=3;endComputePart(b);
  now+=4;endComputePart(a);
 };
 world.step=function(){this.tick++;this.evaluateFrame();now+=1;};
 const profiler=new PerformanceProfiler({clock:()=>now,sampleEvery:1});
 profiler.start(world,{running:true});world.step();profiler.stop();const report=profiler.report();
 assert.equal(report.version,3);assert.equal(report.detailSchema,'brain-phases-v1');
 assert.equal(report.stepMs,10);assert.equal(report.groups.evaluation.ms,9);
 const detail=report.details.find(d=>d.parent==='evaluation');
 assert.equal(detail.coveredMs,9);assert.equal(detail.unattributedMs,0);
 assert.equal(detail.phases.find(p=>p.id==='gradient').ms,6);
 assert.equal(detail.phases.find(p=>p.id==='gradient').inclusiveMs,9);
 assert.equal(detail.phases.find(p=>p.id==='forward').ms,3);
});
test('measured and unmeasured worlds retain exact full state and RNG',()=>{
 for(const seed of [42,19]){
  const a=new Evolution({seed,population:12,limit:20}),b=new Evolution({seed,population:12,limit:20});
  const original=b.decisionFrame;const profiler=new PerformanceProfiler({sampleEvery:3});
  profiler.start(b,{running:true});
  for(let i=0;i<12;i++){a.step();b.step();assert.deepEqual(a.snapshot(),b.snapshot());}
  profiler.stop();assert.equal(b.decisionFrame,original);
  const report=profiler.report();assert.equal(report.sampledSteps,4);
  const phases=new Set(report.details.flatMap(d=>d.phases.map(p=>p.id)));
  for(const id of ['observation','inputs','weights','forward','probabilities','gradient','updates','copies','afterUpdate'])assert.ok(phases.has(id),id);
  for(const detail of report.details)assert.ok(detail.coveredMs<=detail.totalMs+1e-5,detail.parent);
 }
});
test('phase hooks preserve the current frozen numerical model',async()=>{
 const savedFetch=globalThis.fetch;
 globalThis.fetch=async url=>new Response(await readFile(new URL(url)));
 try{
  const runtime=await loadSnapshotRuntime(BENCHMARK_CURRENT_KERNEL);
  const spec=runtime.specs.find(s=>s.kind==='world'&&s.population===150);
  const oldWorld=runtime.create(spec),state=runtime.capture(oldWorld);
  // Восстанавливаем тот же физический мир/контроллеры в нынешние прототипы.
  const {restoreBenchmarkState}=await import('../dist/benchmark-state.js');
  const current=restoreBenchmarkState(state),profiler=new PerformanceProfiler({sampleEvery:1});
  profiler.start(current,{running:true});
  for(let i=0;i<3;i++){oldWorld.step();current.step();assert.deepEqual(current.snapshot(),oldWorld.snapshot());}
  profiler.stop();
 }finally{globalThis.fetch=savedFetch;}
});
test('unsampled steps, UI evaluation and disabled hooks add no detail timers',()=>{
 let now=0;const world=new Evolution({population:2}),profiler=new PerformanceProfiler({clock:()=>now,sampleEvery:10});
 assert.equal(beginComputePart('inputs'),null);
 profiler.start(world,{running:true});world.step();
 const before=structuredClone(profiler.data.detailGroups);
 world.step();world.evaluate(world.agents[0]);
 assert.deepEqual(profiler.data.detailGroups,before);
 profiler.stop();const calls=profiler.timerCalls;world.step();
 assert.equal(profiler.timerCalls,calls);assert.equal(beginComputePart('forward'),null);
});
test('exception unwinds phase scope and restores world methods when stopped',()=>{
 const world=new Evolution({population:1}),original=world.decisionFrame;
 world.step=()=>{const mark=beginComputePart('inputs');try{throw new Error('fixture');}finally{endComputePart(mark);}};
 const profiler=new PerformanceProfiler();profiler.start(world,{running:true});
 assert.throws(()=>world.step(),/fixture/);
 assert.equal(profiler.detailStack.length,0);assert.equal(profiler.stack.length,0);
 assert.equal(beginComputePart('forward'),null);
 profiler.stop();assert.equal(world.decisionFrame,original);
});
test('Worker/UI facade keeps v3 detail and accepts earlier v1/v2 reports',()=>{
 const facade=new WorldProfiler({running:false});
 facade.accept({version:1,status:'completed',groups:{},breakdown:[]});assert.equal(facade.report().version,1);
 facade.accept({version:2,status:'completed',groups:{},breakdown:[],details:[]});assert.equal(facade.report().version,2);
 const world=new Evolution({population:2}),profiler=new PerformanceProfiler();
 profiler.start(world,{running:true});world.step();profiler.stop();
 facade.accept(profiler.report());const report=facade.report();
 assert.equal(report.version,3);assert.ok(report.details.length>0);
 assert.doesNotThrow(()=>JSON.stringify(report));
});
