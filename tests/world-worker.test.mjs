import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {Evolution} from '../dist/evolution.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL,WorldView} from '../dist/world-view.js';
import {WorldClient} from '../dist/world-client.js';
import {memoryWorldPosition} from '../dist/navigation.js';
const settings={seed:42,population:12,limit:20};
function fixture(options=settings){
 let now=0,id=0;const messages=[];
 const runtime=new WorldRuntime({clock:()=>now,send:m=>messages.push(structuredClone(m))});
 const command=(type,payload={},epoch=1)=>{runtime.handle({protocol:WORLD_PROTOCOL,epoch,id:++id,type,payload});return messages.at(-1);};
 command('init',{settings:options});
 return {runtime,messages,command,time:value=>now=value};
}
test('Worker observer preserves exact world, learning and RNG in three seeds',()=>{
 for(const seed of [42,17,98]){
  const options={...settings,seed},reference=new Evolution(options),f=fixture(options);
  for(let i=0;i<14;i++){
   if(i===5){const food={foodSources:20,foodRegrowInterval:30,foodIslandCount:3,foodPeriodSpread:30,foodSizeSpread:30};reference.changeFoodEnvironment(food);f.command('food',food);}
   reference.step();f.command('step');
   // Разные панели и дополнительные снимки не расходуют RNG/не обучают.
   f.command('view',{visible:true,tab:'world',section:i%2?'features':'senses'});
   assert.deepEqual(f.runtime.world.snapshot(),reference.snapshot());
  }
 }
});
test('presentation is detached, contains one brain, static map only when changed',()=>{
 const f=fixture(),first=f.messages.find(m=>m.type==='state'),view=new WorldView();view.apply(first.state);
 assert.equal(view.tiles.length,48*32);assert.equal(view.agents.some(a=>a.brain),false);
 assert.equal(view.detail.agent.brain.memory instanceof Map,true);
 const a=f.runtime.selected;assert.deepEqual(memoryWorldPosition(view.detail.agent,{q:0,r:0}),memoryWorldPosition(a,{q:0,r:0}));
 first.state.selected.agent.energy=-100;assert.notEqual(a.energy,-100);
 f.command('step');const last=f.messages.filter(m=>m.type==='state').at(-1);
 assert.equal(last.state.tiles,undefined);view.apply(last.state);assert.equal(view.tick,1);
 assert.equal(view.tile(-1,0),null);assert.equal(view.tile(0,32),null);
});
test('selected dead life, complete trail and genome remain available',()=>{
 const f=fixture(),a=f.runtime.selected;
 // Настоящие доступные перемещения, отдельные снимки не нужны для маршрута.
 for(let i=0;i<30;i++){const p=f.runtime.world.tiles.find(c=>c.terrain==='land'&&(c.x!==a.x||c.y!==a.y));f.runtime.world.moveAgent(a,p);}
 assert.equal(f.runtime.trail.points.length,21);
 f.runtime.world.die(a,'age');f.runtime.world.agents=f.runtime.world.agents.filter(x=>x.alive);
 f.command('view',{visible:true,tab:'history',section:'features'});
 const state=f.messages.filter(m=>m.type==='state').at(-1).state;
 assert.equal(state.selected.agent.alive,false);assert.equal(state.lives.dead.length,1);
 assert.equal(f.command('genome').result.source.id,a.id);
});
test('hidden world runs without ACK; regular snapshot queue remains bounded',()=>{
 const f=fixture();f.command('view',{visible:false,tab:'world',section:'birth'});f.command('running',{value:true});
 const count=f.messages.length;for(let i=1;i<=20;i++){f.time(i*100);f.runtime.pulse();}
 assert.equal(f.runtime.world.tick,20);assert.equal(f.messages.length,count);
 f.command('view',{visible:true,tab:'world',section:'birth'});
 const snapshots=f.messages.filter(m=>m.type==='state').length;
 for(let i=21;i<=26;i++){f.time(i*100);f.runtime.pulse();}
 assert.equal(f.messages.filter(m=>m.type==='state').length,snapshots);
 f.command('ack',{sequence:f.runtime.inFlight});f.time(2700);f.runtime.pulse();
 assert.equal(f.messages.filter(m=>m.type==='state').length,snapshots+1);
});
test('explicit pause stops at a whole step; single step stays paused; tabs keep running',()=>{
 const f=fixture();f.command('running',{value:true});f.time(100);f.runtime.pulse();
 assert.equal(f.runtime.world.tick,1);const reply=f.command('running',{value:false});assert.equal(reply.tick,1);
 f.time(500);f.runtime.pulse();assert.equal(f.runtime.world.tick,1);
 f.command('step');assert.equal(f.runtime.world.tick,2);assert.equal(f.runtime.running,false);
 f.command('running',{value:true});f.command('view',{visible:true,tab:'analysis',section:'birth'});
 f.time(900);f.runtime.pulse();assert.equal(f.runtime.world.tick,3);assert.equal(f.runtime.running,true);
});

test('all tabs preserve running or paused state and observing does not change world trajectories',()=>{
 for(const running of [false,true]){
  const f=fixture(),reference=new Evolution(settings);f.command('running',{value:running});let time=0;
  for(const tab of ['history','tests','analysis','about','world']){
   f.command('view',{visible:true,tab,section:'birth'});assert.equal(f.runtime.running,running);
   f.time(time+=100);f.runtime.pulse();if(running)reference.step();
   assert.deepEqual(f.runtime.world.snapshot(),reference.snapshot());
  }
 }
});

test('live history is delivered once per second; explicit pause flushes the last changed report',()=>{
 const f=fixture();f.command('view',{visible:true,tab:'history',section:'birth'});f.command('running',{value:true});
 for(let i=1;i<=10;i++){f.command('ack',{sequence:f.runtime.inFlight});f.time(i*100);f.runtime.pulse();}
 const reports=()=>f.messages.filter(m=>m.type==='state'&&m.state.lives).map(m=>m.state.lives.tick);
 assert.deepEqual(reports(),[0,10]);assert.equal(f.runtime.running,true);
 f.command('ack',{sequence:f.runtime.inFlight});f.time(1100);f.runtime.pulse();
 f.command('running',{value:false});assert.deepEqual(reports(),[0,10,11]);
});
test('target pacing and bounded catchup after suspension',()=>{
 const f=fixture();f.command('running',{value:true});
 for(let i=1;i<=100;i++){f.time(i*10);f.runtime.pulse();}
 assert.equal(f.runtime.world.tick,10);
 f.time(100000);f.runtime.pulse();assert.equal(f.runtime.world.tick,11);assert.ok(f.runtime.credit<=1.5);
 f.command('speed',{value:1280});assert.equal(f.runtime.target,1280);assert.equal(f.runtime.credit,0);
 assert.ok(f.command('speed',{value:NaN}).error);
});

test('slow visible playback publishes every substep, waits for paint and releases in background',async()=>{
 for(const target of [.2,.4,1]){
  const f=fixture({...settings,population:2}),r=f.runtime,interval=100/target;
  await f.command('speed',{value:target,substeps:true});await f.command('running',{value:true});
  const ack=()=>f.command('ack',{sequence:r.inFlight});await ack();
  const start=f.messages.length;
  for(let i=1;i<=10;i++){
   f.time(i*interval);await r.pulse();assert.equal(r.world.subtick,i);
   const state=f.messages.filter(m=>m.type==='state').at(-1);assert.equal(state.paintBeforeNext,true);assert.equal(state.state.tick,i/10);
   await r.pulse();assert.equal(r.world.subtick,i); // UI ещё не подтвердил кадр.
   await ack();
  }
  assert.equal(f.messages.slice(start).filter(m=>m.type==='state').length,10);
  // Не пришедший ACK не блокирует скрытую страницу или другой раздел.
  await f.command('view',{visible:false,tab:'world',section:'birth'});f.time(11*interval);await r.pulse();assert.equal(r.world.subtick,11);
  await f.command('view',{visible:true,tab:'history',section:'birth'});f.time(12*interval);await r.pulse();assert.equal(r.world.subtick,12);
  await f.command('view',{visible:true,tab:'world',section:'birth'});
  const sequence=r.inFlight;await f.command('ack',{sequence:sequence-1});f.time(13*interval);await r.pulse();assert.equal(r.world.subtick,12);
  await ack();await r.pulse();assert.equal(r.world.subtick,13);
 }
});

test('client acknowledges slow playback after drawing and ignores delayed paint from a restarted world',async()=>{
 const sent=[],paint=[],order=[],worker={postMessage:m=>{sent.push(m);if(m.type==='ack')order.push('ack');}},client=new WorldClient({worker,afterPaint:fn=>paint.push(fn),onState:()=>order.push('draw')});
 client.epoch=1;
 const f=fixture({...settings,population:1}),state=f.messages.find(m=>m.type==='state').state;
 client.receive({protocol:WORLD_PROTOCOL,epoch:1,type:'state',sequence:1,state,paintBeforeNext:true});
 assert.deepEqual(order,['draw']);paint.shift()();assert.deepEqual(order,['draw','ack']);
 client.receive({protocol:WORLD_PROTOCOL,epoch:1,type:'state',sequence:2,state,paintBeforeNext:true});
 const pending=client.init(settings),request=sent.at(-1);paint.shift()();assert.equal(sent.filter(m=>m.type==='ack').length,1);
 client.receive({protocol:WORLD_PROTOCOL,epoch:2,type:'reply',id:request.id,result:null});await pending;
});
test('food edits and rejected edits preserve running state at the current whole step',()=>{
 for(const running of [false,true]){
  const f=fixture();f.command('running',{value:running});
  const tick=f.runtime.world.tick;
  const food={foodSources:30,foodRegrowInterval:30,foodIslandCount:3,foodPeriodSpread:30,foodSizeSpread:30};
  const changed=f.command('food',food);assert.equal(changed.error,undefined);
  assert.equal(f.runtime.running,running);assert.equal(f.runtime.world.tick,tick);
  const same=f.command('food',food);assert.equal(same.error,undefined);assert.equal(same.result,null);
  const before=structuredClone(f.runtime.world.foodSettings);
  assert.ok(f.command('food',{...food,foodSources:-1}).error);
  assert.deepEqual(f.runtime.world.foodSettings,before);assert.equal(f.runtime.running,running);
  f.time(100);f.runtime.pulse();assert.equal(f.runtime.world.tick,tick+Number(running));
 }
});
test('restart rejects stale commands; failed init preserves previous world',()=>{
 const f=fixture();f.command('step');const before=f.runtime.world;
 assert.ok(f.command('init',{settings:{geography:'bad'}},2).error);assert.equal(f.runtime.world,before);assert.equal(f.runtime.epoch,1);
 f.command('init',{settings:{...settings,seed:9}},2);const length=f.messages.length;
 f.command('step',{},1);assert.equal(f.messages.length,length);assert.equal(f.runtime.world.tick,0);
});
test('observation export uses actual step, balances, all lives and environment',()=>{
 const f=fixture();f.command('step');const report=f.command('observation').result;
 assert.equal(report.tick,1);assert.deepEqual(report.balances,f.runtime.world.balances());
 assert.deepEqual(report.living,f.runtime.world.lifeReport().living);assert.equal(report.settings.initialPopulation,12);
 assert.deepEqual(report.foodIslands,f.runtime.world.foodIslands);
});
test('profile measures simulation in Worker including hidden activity',()=>{
 const f=fixture();f.command('running',{value:true});f.command('profile-start');
 f.command('view',{visible:false,tab:'world',section:'birth'});f.time(100);f.runtime.pulse();
 const report=f.command('profile-stop').result;
 assert.equal(report.context.worldMode,'dedicated-worker');assert.equal(report.steps,1);
 assert.equal(report.activeMs,100);assert.equal(report.scheduler.computeBudgetMs,null);
 assert.ok(report.workerTransport.messages>0);assert.equal(f.runtime.running,true);
});
test('client ignores stale epoch and releases pending requests on failure',async()=>{
 const sent=[],worker={postMessage:m=>sent.push(m)},client=new WorldClient({worker});
 const init=client.init(settings),request=sent[0];
 client.receive({protocol:WORLD_PROTOCOL,epoch:0,type:'state',sequence:100});assert.equal(client.ready,false);
 client.receive({protocol:WORLD_PROTOCOL,epoch:1,type:'reply',id:request.id,result:null});await init;
 const pending=client.request('step');client.fail('worker failed');await assert.rejects(pending,/worker failed/);
 assert.equal(client.pending.size,0);
});
test('real module Worker runs while parent is blocked and confirms pause',async()=>{
 const adapter=new Worker(new URL('./world-worker-adapter.mjs',import.meta.url));
 const worker={postMessage:m=>adapter.postMessage(m)};
 adapter.on('message',m=>worker.onmessage?.({data:m}));adapter.on('error',e=>worker.onerror?.(e));
 const client=new WorldClient({worker});
 try{
  await client.init({...settings,population:2});await client.request('speed',{value:20});
  await client.request('view',{visible:false,tab:'world',section:'features'});
  await client.request('running',{value:true});
  const until=performance.now()+250;while(performance.now()<until){} // UI не принимает сообщения.
  await client.request('running',{value:false});assert.ok(client.view.tick>=2);
  const tick=client.view.tick;await new Promise(r=>setTimeout(r,70));
  await client.request('view',{visible:true,tab:'history',section:'features'});assert.equal(client.view.tick,tick);
  assert.equal(client.view.lives.living.length,2);
  const genome=await client.request('genome');assert.equal(genome.source.tick,tick);
 }finally{await adapter.terminate();}
});
test('presentation remains equivalent at 150, 400 and 1000 residents',()=>{
 for(const population of [150,400,1000]){
  const options={...settings,population,limit:1000},f=fixture(options),reference=new Evolution(options);
  reference.step();f.command('step');
  assert.deepEqual(f.runtime.world.snapshot(),reference.snapshot());
  const state=f.messages.filter(m=>m.type==='state').at(-1).state;
  assert.equal(state.agents.length,f.runtime.world.agents.length);
  assert.equal(state.agents.filter(a=>a.brain).length,0);
 }
});
