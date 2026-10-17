import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {ParallelWorld,computationWorkers} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {Evolution as FrozenEvolution} from '../dist/benchmark-snapshots/0.32.0/evolution.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
import {createBenchmarkFixture,BENCHMARK_CASES} from '../dist/benchmark-fixtures.js';
import {Worker} from 'node:worker_threads';
import {WorldClient} from '../dist/world-client.js';
import {COMPUTATION_WORKER_COUNTS} from '../dist/computation-settings.js';

test('all expanded pool sizes preserve full state even with fewer agents than workers',async()=>{
 for(const workers of COMPUTATION_WORKER_COUNTS.filter(n=>n>4)){
  const reference=new Evolution({seed:71,population:9}),world=new Evolution({seed:71,population:9});
  const pool=new ParallelWorld(world,{workers,createWorker:createCognitionWorker});
  try{await pool.ready();for(let i=0;i<2;i++){reference.step();await pool.step();}await pool.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot(),String(workers));}
  finally{await pool.close();}
 }
});

test('failed readiness closes the partial pool and preserves the previous running world',async()=>{
 let failures=false,created=0,closed=0;
 const runtime=new WorldRuntime({send:()=>{},executorFactory:world=>failures?new ParallelWorld(world,{workers:14,createWorker:()=>{
  if(++created===5)throw new Error('Worker unavailable');
  return {terminate:()=>{closed++;}};
 }}):null});
 await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:1,type:'init',payload:{settings:{population:2}}});
 runtime.setRunning(true);const old=runtime.world;failures=true;
 await runtime.handle({protocol:WORLD_PROTOCOL,epoch:2,id:2,type:'init',payload:{settings:{population:2}}});
 assert.equal(closed,4);assert.equal(runtime.world,old);assert.equal(runtime.running,true);assert.equal(old.tick,0);
 const pool=new ParallelWorld(new Evolution({population:1}),{workers:2,timeout:10,createWorker:()=>({postMessage(){},terminate:()=>{closed++;}})});
 await assert.rejects(pool.ready(),/не ответил/);assert.equal(pool.closed,true);assert.equal(closed,6);
});
test('parallel world preserves full state, memory, learning and all RNG streams',async()=>{
 for(const workers of [1,2,4])for(const seed of [42,17]){
  const settings={seed,population:12,limit:30},reference=new Evolution(settings),world=new Evolution(settings),pool=new ParallelWorld(world,{workers,createWorker:createCognitionWorker});
  try{for(let i=0;i<4;i++){
   reference.step();await pool.step();await pool.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot(),`workers=${workers} seed=${seed} T=${world.tick}`);
  }}finally{await pool.close();}
 }
});
test('automatic pool avoids tiny worlds and caps the measured initial pool at four',()=>{
 assert.equal(computationWorkers('auto',20,150),4);assert.equal(computationWorkers('auto',20,2),1);assert.equal(computationWorkers('auto',4,150),2);assert.equal(computationWorkers('auto',6,150),2);assert.equal(computationWorkers('auto',2,150),1);assert.throws(()=>computationWorkers(20));
});
test('shared phase extraction retains the frozen 0.32 full trajectory',()=>{
 for(const seed of [42,17,803]){const settings={seed,population:16,limit:30},old=new FrozenEvolution(settings),now=new Evolution(settings);for(let i=0;i<8;i++){old.step();now.step();assert.deepEqual(now.snapshot(),old.snapshot());}}
});
async function compareScenario(setup,workers=4,{delay=false,steps=3}={}){
 const settings={seed:42,population:3,limit:4,foodSources:0},reference=new Evolution(settings),world=new Evolution(settings);
 for(const w of [reference,world])setup(w);
 const pool=new ParallelWorld(world,{workers,createWorker:i=>createCognitionWorker({delay:delay?(i===0?2:1):0})});pool.retained=world.agents[0];
 try{for(let i=0;i<steps;i++){reference.step();await pool.step();await pool.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot());assert.deepEqual(world.lifeReport(),reference.lifeReport());}return {world,reference};}finally{await pool.close();}
}
test('soft birth limit, newborns and mutation RNG stay exact with reordered replies',async()=>{
 const {world}=await compareScenario(w=>{w.limit=3;w._primed=true;for(const a of w.agents){a.bornSubtick=-1000;a.born=-100;a.age=100;a.process={action:9,duration:20,elapsed:19,localDestination:{...a.brain.position},destination:{x:a.x,y:a.y},direction:null};}},4,{delay:true});
 assert.equal(world.stats.births,3);assert.ok(world.agents.length>world.limit);
});
test('competition for the last food preserves lottery, interruption, energy and learning',async()=>{
 const {world}=await compareScenario(w=>{w._primed=true;for(const c of w.tiles){c.terrain='land';c.food=0;}const c=w.tile(12,12);c.food=1;w.initialFood++;
  for(const a of w.agents){w.moveAgent(a,c);a._cells=null;a.process={action:6,duration:5,elapsed:4,localDestination:{...a.brain.position},destination:{x:a.x,y:a.y},direction:null};}},2,{delay:true});
 assert.equal(world.stats.gathered,1);assert.ok(world.stats.interrupted[6]>=2);
});
test('ongoing movement retains progress under attention and identical rolls',async()=>{
 const {world}=await compareScenario(w=>{for(const c of w.tiles)c.terrain='land';w.random.next=()=>0;for(const a of w.agents){w.moveAgent(a,{x:12,y:12});a._cells=null;a.frameRotation=0;a.brain.gateBase.fill(0);a.brain.gateBase[72]=1;}},4);
 assert.ok(world.stats.reviews>0);assert.ok(world.stats.completed[0]>0);
});
test('selected death keeps its final brain and releases other dead owners',async()=>{
 const settings={seed:42,population:3,limit:4},reference=new Evolution(settings),world=new Evolution(settings),pool=new ParallelWorld(world,{workers:4,createWorker:createCognitionWorker});
 const dead=world.agents[0],expected=reference.agents[0];pool.retained=dead;
 try{reference.step();await pool.step();for(const w of [reference,world])for(const a of w.agents.slice(0,2)){a.energy=0;a.stomach=0;a.health=.1;}
  reference.step();await pool.step();await pool.syncAll();await pool.syncAgent(dead);assert.deepEqual(world.snapshot(),reference.snapshot());assert.deepEqual(dead.brain,expected.brain);assert.deepEqual(world.lifeReport(),reference.lifeReport());assert.equal(pool.owners.has(2),false);
 }finally{await pool.close();}
});
test('memory and learning switches preserve exact trajectories',async()=>{
 for(const memory of [false,true])for(const learning of [false,true])await compareScenario(w=>{w.memoryEnabled=memory;w.learningEnabled=learning;},2,{steps:2});
});
test('filled memory, food edits and reset keep complete personal state',async()=>{
 const spec={...BENCHMARK_CASES[4],population:20},world=createBenchmarkFixture(spec),reference=createBenchmarkFixture(spec),pool=new ParallelWorld(world,{workers:4,createWorker:createCognitionWorker});
 try{for(let i=0;i<3;i++){if(i===1){const food={foodSources:30,foodRegrowInterval:30,foodIslandCount:3,foodPeriodSpread:30,foodSizeSpread:30};world.changeFoodEnvironment(food);reference.changeFoodEnvironment(food);}reference.step();await pool.step();await pool.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot());}
  const next=new Evolution({seed:91,population:1}),expected=new Evolution({seed:91,population:1});await pool.reset(next);expected.step();await pool.step();await pool.syncAll();assert.deepEqual(next.snapshot(),expected.snapshot());
 }finally{await pool.close();}
});
test('worker failure stops the pool instead of advancing an incomplete world',async()=>{
 const pool=new ParallelWorld(new Evolution({population:2}),{workers:2,createWorker:()=>{const worker=createCognitionWorker(),send=worker.postMessage;worker.postMessage=(m,t)=>{if(m.type==='evaluate')queueMicrotask(()=>worker.onerror(new Error('test owner failure')));else send(m,t);};return worker;}});
 await assert.rejects(pool.step(),/test owner failure/);assert.equal(pool.closed,true);await assert.rejects(pool.step(),/test owner failure/);
});
test('attaching to an already running world preserves historical cell references',async()=>{
 const reference=new Evolution({seed:12,population:12}),world=new Evolution({seed:12,population:12});reference.advance(3);world.advance(3);
 const pool=new ParallelWorld(world,{workers:2,createWorker:createCognitionWorker});
 try{for(let i=0;i<3;i++){reference.step();await pool.step();await pool.syncAll();assert.deepEqual(world.snapshot(),reference.snapshot());}}finally{await pool.close();}
});
test('runtime publishes coherent detail, counts paused steps and freezes parallel profiling',async()=>{
 let now=0,id=0;const sent=[],runtime=new WorldRuntime({clock:()=>now,send:m=>sent.push(structuredClone(m)),executorFactory:w=>new ParallelWorld(w,{workers:2,createWorker:createCognitionWorker})});
 const command=async(type,payload={})=>{await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});return sent.at(-1);};
 try{await command('init',{settings:{seed:42,population:4,limit:8}});await command('profile-start',{measurementMode:'detailed'});now=100;await command('step');
  const report=(await command('profile-stop')).result;assert.equal(report.steps,1);assert.equal(report.stepsWhilePaused,1);assert.equal(report.parallel.substeps,10);assert.equal(report.context.computeWorkers,2);
  const saved=structuredClone(report.parallel);await command('step');assert.deepEqual(runtime.profile().parallel,saved);
  const reference=new Evolution({seed:42,population:4,limit:8});reference.advance(2);await runtime.executor.syncAll();assert.deepEqual(runtime.world.snapshot(),reference.snapshot());
  const state=sent.filter(m=>m.type==='state').at(-1).state;assert.equal(state.execution.computeWorkers,2);assert.deepEqual(state.selected.agent.brain.memory,runtime.selected.brain.memory);
 }finally{await runtime.executor?.close();}
});
test('real world Worker serializes pause, edits, history and profile around async steps',async()=>{
 const adapter=new Worker(new URL('./world-worker-adapter.mjs',import.meta.url)),worker={postMessage:m=>adapter.postMessage(m)};adapter.on('message',data=>worker.onmessage?.({data}));adapter.on('error',e=>worker.onerror?.(e));const client=new WorldClient({worker});
 try{await client.init({seed:42,population:12,limit:20,computeWorkers:4});await client.request('speed',{value:1280});await client.request('view',{visible:false,tab:'world',section:'features'});await client.request('profile-start');await client.request('running',{value:true});await new Promise(r=>setTimeout(r,180));
  await client.request('food',{foodSources:30,foodRegrowInterval:30,foodIslandCount:3,foodPeriodSpread:30,foodSizeSpread:30});assert.equal(client.running,true);
  await client.request('running',{value:false});const tick=client.view.tick;assert.ok(tick>0&&Number.isInteger(tick));await new Promise(r=>setTimeout(r,30));await client.request('view',{visible:true,tab:'history',section:'features'});assert.equal(client.view.tick,tick);assert.ok(client.view.lives);
  const report=await client.request('profile-stop');assert.ok(report.steps>0);assert.equal(report.parallel.workers,4);const genome=await client.request('genome');assert.equal(genome.source.tick,tick);
 }finally{await adapter.terminate();}
});
