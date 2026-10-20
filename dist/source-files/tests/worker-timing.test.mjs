import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkerTiming} from '../dist/worker-timing.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
import {Evolution} from '../dist/evolution.js';
import {readFile} from 'node:fs/promises';
import {BENCHMARK_CURRENT_KERNEL} from '../dist/benchmark-versions.js';

test('baseline modules retain byte identity except release, display bins and explicit founder-only initialization',async()=>{
 const base=new URL(`../dist/benchmark-snapshots/${BENCHMARK_CURRENT_KERNEL}/`,import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
 for(const name of Object.keys(manifest.files)){
  let current=await readFile(new URL(`../dist/${name}`,import.meta.url),'utf8'),frozen=await readFile(new URL(name,base),'utf8');
  if(name==='life-history.js'){
   const version=/export const MODEL_VERSION='[^']+';/;
   current=current.replace(version,'MODEL_VERSION');frozen=frozen.replace(version,'MODEL_VERSION');
  }
  // Только ширина корзины отображения меняется в 0.43; наследуемые
  // значения и захват наблюдений должны остаться побайтно прежними.
  if(name==='heritable-statistics.js'){
   current=current.replace('SENSITIVITY_BIN_WIDTH=20','SENSITIVITY_BIN_WIDTH=5');
  }
  // 0.44 добавляет только необязательное вмешательство в начальные гены.
  // Удаляем точные четыре добавки; остальная физика сравнивается побайтно.
  // Отдельный genome-experiments044 проверяет траекторию прежнего режима.
  if(name==='evolution.js')current=current
   .replace(/import \{compileFounderSenses\} from '.\/founder-senses.js';\r?\n/,'')
   .replace(',automaticEnvironment,founderSenses}',',automaticEnvironment}')
   .replace(/  const founderEdits=compileFounderSenses\(founderSenses,layoutForType\(this.brainType\)\);\r?\n/,'')
   .replace(/   for\(const \[index,value\]of founderEdits\)genome\[index\]=value;\r?\n/,'');
  assert.equal(current.replaceAll('\r\n','\n'),frozen.replaceAll('\r\n','\n'),name);
 }
});

test('task phases partition elapsed time; command sends remain outside tasks',()=>{
 let now=0;const t=new WorkerTiming(()=>now);t.start();
 t.phase('send',0);now=1;t.beginTask();
 const step=now;now+=7;t.phase('step',step);
 const presentation=now;now+=2;t.phase('presentation',presentation);
 const send=now;now+=3;t.phase('send',send);now+=4;t.endTask();
 now+=5;t.beginTask();now+=1;t.endTask();t.stop(now);
 const r=t.report();assert.deepEqual(r.taskPhases,{stepMs:7,presentationMs:2,sendMs:3,otherMs:5});
 assert.equal(r.metrics.task.totalMs,17);assert.equal(r.metrics.interTaskGap.totalMs,5);
 assert.equal(r.metrics.queue.count,0);assert.equal(r.metrics.step.count,1);
 assert.equal(r.sendCalls,2);assert.equal(r.cpuTimeMs,null);assert.equal(r.gcTimeMs,null);
 for(const m of Object.values(r.metrics))assert.equal(m.bins.reduce((a,b)=>a+b,0),m.count);
});
test('queue delay, timer rounding, lateness and zero-delay overload are distinct',()=>{
 let now=0;const t=new WorkerTiming(()=>now);t.start();
 t.scheduled(.25,1);t.scheduled(50,50);now=1.4;t.beginTask();now=3;t.endTask();
 t.scheduled(0,0);now=5;t.beginTask();now=8;t.endTask();
 const r=t.report();assert.equal(r.metrics.queue.count,2);assert.equal(r.metrics.queue.totalMs,3.4);
 assert.equal(r.metrics.requestedDelay.totalMs,.25);assert.equal(r.metrics.effectiveDelay.totalMs,1);
 assert.ok(Math.abs(r.metrics.late.totalMs-2.4)<1e-9);
 assert.equal(r.metrics.interTaskGap.totalMs,2);
});
test('cancel/reset excludes old boundaries; stopped/off timing is frozen and bounded',()=>{
 let now=0;const t=new WorkerTiming(()=>now);t.beginTask();t.scheduled(0,0);assert.equal(t.report(),null);
 t.start();t.scheduled(100,100);now=10;t.resetBoundary();now=500;t.beginTask();now=501;t.endTask();
 assert.equal(t.report().metrics.queue.count,0);assert.equal(t.report().metrics.interTaskGap.count,0);
 for(let i=0;i<10000;i++){t.scheduled(0,0);now++;t.beginTask();now++;t.endTask();}
 t.stop(now);const saved=t.report();now+=900;t.scheduled(0,0);t.beginTask();t.phase('send',0);t.endTask();
 assert.deepEqual(t.report(),saved);assert.equal(saved.metrics.task.bins.length,16);
 assert.equal(saved.metrics.task.count,10001);
});

function fixture(){
 let now=0,id=0,accepted=true;const sent=[];
 const runtime=new WorldRuntime({clock:()=>now,wake:()=>accepted,send:m=>{sent.push(structuredClone(m));}});
 const command=(type,payload={})=>{runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});return sent.at(-1);};
 command('init',{settings:{seed:42,population:4,limit:12}});
 return {runtime,command,time:n=>now=n,spend:n=>now+=n,accept:value=>accepted=value};
}
test('runtime records whole task, separate send, final step and frozen auto-stop',()=>{
 const f=fixture(),r=f.runtime;
 r.profiler.durationMs=100;f.command('running',{value:true});f.command('profile-start',{measurementMode:'light'});
 const original=r.world.step;r.world.step=function(){original.call(this);f.spend(20);};
 f.time(90);r.credit=1;r.pulse();const report=r.profile();
 assert.equal(report.reason,'duration');assert.equal(report.activeMs,110);assert.equal(report.steps,1);
 assert.equal(report.workerTiming.metrics.task.count,1);assert.equal(report.workerTiming.taskPhases.stepMs,20);
 assert.equal(report.sampledSteps,0);assert.equal(r.running,true);
 const frozen=structuredClone(report.workerTiming);f.time(210);r.pulse();
 assert.deepEqual(r.profile().workerTiming,frozen);
});
test('runtime resets queue boundaries on speed/pause/restart and ignores rejected wake',()=>{
 const f=fixture(),r=f.runtime;f.command('profile-start',{measurementMode:'light'});
 f.command('running',{value:true});f.time(100);r.pulse();
 assert.equal(r.profile().workerTiming.metrics.queue.count,1);
 f.command('speed',{value:1280});f.time(200);r.pulse();
 assert.equal(r.profile().workerTiming.metrics.interTaskGap.count,0);
 f.command('running',{value:false});f.time(2000);f.accept(false);f.command('running',{value:true});r.pulse();
 assert.equal(r.profile().workerTiming.metrics.interTaskGap.count,0);
 assert.equal(r.profile().workerTiming.metrics.queue.count,2);
 f.command('init',{settings:{seed:19,population:4,limit:12}});
 assert.equal(r.profiler.active,false);assert.equal(r.profile().reason,'world-restarted');
});
test('low target delay and missing UI ACK do not become blocked calculation',()=>{
 const f=fixture(),r=f.runtime;f.command('profile-start',{measurementMode:'light'});f.command('running',{value:true});
 f.time(100);r.pulse();f.time(200);r.pulse();f.time(300);r.pulse();
 const report=f.command('profile-stop').result,m=report.workerTiming.metrics;
 assert.equal(report.steps,3);assert.equal(m.queue.count,3);assert.equal(m.effectiveDelay.totalMs,300);
 assert.equal(m.late.totalMs,0);assert.equal(report.workerTransport.messages,2);
 assert.equal(r.running,true);assert.equal(r.profiler.workerTiming.active,false);
});
test('light and detailed runtime diagnostics preserve exact state/RNG in three seeds',()=>{
 for(const seed of [42,19,98])for(const mode of ['light','detailed']){
  const f=fixture(),options={seed,population:8,limit:16};
  f.command('init',{settings:options});const reference=new Evolution(options);
  const original=f.runtime.world.step,observe=f.runtime.world.observe;
  f.command('profile-start',{measurementMode:mode});f.command('running',{value:true});
  if(mode==='light')assert.equal(f.runtime.world.observe,observe);
  for(let i=1;i<=12;i++){reference.step();f.time(i*100);f.runtime.pulse();assert.deepEqual(f.runtime.world.snapshot(),reference.snapshot());}
  const report=f.command('profile-stop').result;
  assert.equal(report.version,3);assert.equal(report.mode,mode);assert.equal(report.steps,12);
  assert.equal(report.sampledSteps,mode==='light'?0:2);assert.equal(f.runtime.world.step,original);
  assert.equal(f.runtime.world.observe,observe);
 }
});
test('invalid measurement mode preserves ongoing profile and running world',()=>{
 const f=fixture();f.command('running',{value:true});f.command('profile-start',{measurementMode:'light'});
 assert.match(f.command('profile-start',{measurementMode:'unknown'}).error,/режим/);
 assert.equal(f.runtime.profiler.mode,'light');assert.equal(f.runtime.profiler.active,true);assert.equal(f.runtime.running,true);
});
