import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {computationWorkers} from '../dist/computation-settings.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {createBenchmarkFixture,BENCHMARK_CASES} from '../dist/benchmark-fixtures.js';

test('live serial/pool changes preserve full trajectories, memory, histories and RNG',async()=>{
 const sent=[],runtime=new WorldRuntime({send:m=>sent.push(m),executorFactory:(w,s)=>{
  const workers=computationWorkers(s.computeWorkers,20,w.agents.length);return workers>1?new ParallelWorld(w,{workers,createWorker:createCognitionWorker}):null;
 }});let id=0;
 const command=async(type,payload={})=>{await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});const reply=sent.at(-1);assert.equal(reply.error,undefined,reply.error);return reply.result;};
 const settings={seed:77,population:12,limit:20,computeWorkers:1},reference=new Evolution(settings);
 try{
  await command('init',{settings});const world=runtime.world,selected=runtime.selected;
  for(const workers of [1,4,2,1,6,1]){
   const running=runtime.running;await command('computations',{value:workers});assert.equal(runtime.world,world);assert.equal(runtime.selected,selected);assert.equal(runtime.running,running);
   if(runtime.executor)await runtime.executor.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot());
   reference.step();await command('step');if(runtime.executor)await runtime.executor.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot());assert.deepEqual(world.lifeReport(),reference.lifeReport());
  }
  await command('running',{value:true});await command('profile-start');await command('computations',{value:4});assert.equal(runtime.running,true);assert.equal(runtime.profiler.active,false);assert.equal(runtime.profile().context.computeWorkers,1);
 }finally{await runtime.executor?.close();}
});

test('registration failure retains old pool and its complete personal experience',async()=>{
 const world=createBenchmarkFixture({...BENCHMARK_CASES[4],population:8}),reference=createBenchmarkFixture({...BENCHMARK_CASES[4],population:8});
 const runtime=new WorldRuntime({send:()=>{},executorFactory:w=>new ParallelWorld(w,{workers:4,createWorker:()=>{
  const worker=createCognitionWorker(),send=worker.postMessage;worker.postMessage=(message,transfer)=>{if(message.type==='register')queueMicrotask(()=>worker.onmessage({data:{protocol:message.protocol,id:message.id,error:'registration failed'}}));else send(message,transfer);};return worker;
 }})});runtime.world=world;runtime.selected=world.agents[0];runtime.executor=new ParallelWorld(world,{workers:2,createWorker:createCognitionWorker});const old=runtime.executor;
 try{
  reference.step();await old.step();runtime.setRunning(true);await assert.rejects(runtime.changeComputations(4),/registration failed/);assert.equal(runtime.executor,old);assert.equal(old.closed,false);assert.equal(runtime.running,true);
  reference.step();await old.step();await old.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot());
 }finally{await runtime.executor?.close();}
});
