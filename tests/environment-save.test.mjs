import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,RULES,worldDistance} from '../dist/evolution.js';
import {spendEnergy,ENERGY_DEFICIT_FACTOR} from '../dist/energy-budget.js';
import {foodProduction,ENVIRONMENT_DEFAULTS} from '../dist/environment-settings.js';
import {configureEnvironment,advanceEnvironment} from '../dist/automatic-environment.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
import {checkInvariants} from '../dist/experiment-runner.js';
import {encodeState,decodeState} from '../dist/state-codec.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const roundtrip=w=>loadWorld(JSON.parse(JSON.stringify(saveWorld(w))));
function compare(a,b){assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.lifeReport(),b.lifeReport());assert.deepEqual(a.automaticEnvironment,b.automaticEnvironment);}

test('UI releases retain identical-schema saves and still reject unknown model versions',()=>{
 const w=new Evolution({seed:42,population:2});w.step();const saved=saveWorld(w);
 for(const modelVersion of ['0.54.4','0.54.3','0.54.2','0.53.0','0.53.1','0.53.2','0.53.3','0.54.0','0.54.1']){const reference=loadWorld(saved),loaded=loadWorld({...saved,modelVersion});compare(reference,loaded);reference.step();loaded.step();compare(reference,loaded);}
 for(const modelVersion of ['0.38.0','0.39.2','0.52.0','0.52.1','0.52.2','0.99.0'])assert.throws(()=>loadWorld({...saved,modelVersion}),/Неподдерживаемый/);
});

test('JSON codec preserves shared references, sparse arrays, typed negative zero and rejects executable types',()=>{
 const shared={n:-0},sparse=[];sparse[4]=shared;const source={shared,sparse,buffer:new Float64Array([-0,1.2345678901234567]),map:new Map([['a',shared]])};
 const result=decodeState(JSON.parse(JSON.stringify(encodeState(source))));assert.deepEqual(result,source);assert.equal(result.map.get('a'),result.shared);assert.equal(result.sparse[4],result.shared);assert.equal(0 in result.sparse,false);
 assert.throws(()=>decodeState({entry:{ref:0},nodes:[['Function',[]]]}));assert.throws(()=>encodeState({call:()=>{}}));
});

test('deficit charges only unpaid energy, exact zero is harmless, no negative balance',()=>{
 const w=new Evolution({population:1}),a=w.agents[0];a.energy=.02;const before=w.stats.spent;spendEnergy(w,a,.10,true);near(a.energy,0);near(a.health,100-.08*ENERGY_DEFICIT_FACTOR);near(w.stats.spent-before,.02);
 a.health=100;a.energy=.03;spendEnergy(w,a,.03);near(a.health,100);near(a.energy,0);spendEnergy(w,a,.36);near(a.health,98.5);
});
test('death on brain payment cannot start action and stays exact across workers',async()=>{
 const setup=w=>{const a=w.agents[0];w.stats.spent+=a.energy;w.stats.actionSpent+=a.energy;a.energy=0;a.health=.01;};
 const a=new Evolution({population:1}),b=new Evolution({population:1});setup(a);setup(b);const pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});
 try{a.step();await pool.step();assert.equal(a.agents.length,0);assert.equal(b.agents.length,0);assert.equal(a.stats.started.reduce((n,x)=>n+x,0),0);compare(a,b);}finally{await pool.close();}
});
test('five gradual impoverishments reach target, preserve stocks, locality and all life RNG',()=>{
 const w=new Evolution({population:2,automaticEnvironment:{preparationInterval:1,randomInterval:1}});
 const rng=[w.random,w.cognitiveRandom,w.bodyRandom,w.neuralRandom,w.mutationRandom].map(r=>r.state);
 for(let i=1;i<=5;i++){const food=w.tiles.map(c=>c.food);w.tick=i;w.subtick=i*10;assert.equal(advanceEnvironment(w),true);assert.deepEqual(w.tiles.map(c=>c.food),food);for(const move of w.environmentChanges.at(-1).movedGroups){const distance=worldDistance(move.from,move.to);assert.ok(move.kind==='island'?distance>=5&&distance<=20:distance>0&&distance<=5);}}
 assert.equal(w.automaticEnvironment.completedSteps,5);near(w.foodSettings.regrowInterval,100);assert.equal(w.foodSettings.sourceCount,300);assert.ok(foodProduction(w)>=2&&foodProduction(w)<=6);assert.deepEqual([w.random,w.cognitiveRandom,w.bodyRandom,w.neuralRandom,w.mutationRandom].map(r=>r.state),rng);
 for(let i=6;i<60;i++){w.tick=i;w.subtick=i*10;advanceEnvironment(w);assert.ok(foodProduction(w)>=ENVIRONMENT_DEFAULTS.minimumRate-1e-9);assert.equal(w.foodIslands.flatMap(g=>g.sources).length,w.foodSettings.sourceCount);}
});
test('disabled timer restarts a full interval and manual poverty disables/cancels preparation',()=>{
 const w=new Evolution({population:1});configureEnvironment(w,{enabled:false});assert.equal(w.automaticEnvironment.nextTick,null);w.tick=81;w.subtick=810;configureEnvironment(w,{enabled:true});assert.equal(w.automaticEnvironment.nextTick,581);
 w.changeFoodEnvironment({foodSources:10,foodRegrowInterval:300,foodIslandCount:2,foodPeriodSpread:0,foodSizeSpread:0});assert.equal(w.automaticEnvironment.enabled,false);assert.equal(w.automaticEnvironment.preparationCancelled,true);assert.throws(()=>configureEnvironment(w,{enabled:true}),/минимума/);
 w.changeFoodEnvironment({foodSources:384,foodRegrowInterval:20,foodIslandCount:8,foodPeriodSpread:0,foodSizeSpread:0});configureEnvironment(w,{enabled:true});assert.equal(w.automaticEnvironment.nextTick,w.tick+1000);assert.equal(w.automaticEnvironment.completedSteps,5);
});

test('automatic food can be enabled at two portions per T, rejects less and keeps random events above two',()=>{
 const w=new Evolution({population:1,automaticEnvironment:{enabled:false,randomInterval:1}});
 const options={foodSources:40,foodRegrowInterval:20,foodIslandCount:1,foodPeriodSpread:0,foodSizeSpread:0};
 w.changeFoodEnvironment(options);near(foodProduction(w),2);configureEnvironment(w,{enabled:true});assert.equal(w.automaticEnvironment.enabled,true);
 for(let i=1;i<=50;i++){w.tick=i;w.subtick=i*10;advanceEnvironment(w);assert.ok(foodProduction(w)>=2-1e-9);}
 w.changeFoodEnvironment({...options,foodSources:39});assert.equal(w.automaticEnvironment.enabled,false);assert.throws(()=>configureEnvironment(w,{enabled:true}),/минимума/);
});
test('save/load preserves exact biology, learning, calendars, observer and environment RNG',()=>{
 const w=new Evolution({population:5,automaticEnvironment:{preparationInterval:1,randomInterval:2}});for(let i=0;i<7;i++)w.step();const restored=roundtrip(w);compare(w,restored);
 for(let i=0;i<6;i++){w.step();restored.step();compare(w,restored);checkInvariants(restored);}assert.equal(JSON.stringify(saveWorld(w)),JSON.stringify(saveWorld(restored)));
});
test('save/load before first choice and after extinction are supported',()=>{
 const w=new Evolution({population:1});const r=roundtrip(w);w.step();r.step();compare(w,r);
 const a=w.agents[0];w.die(a,'age');w.agents=[];const dead=roundtrip(w);compare(w,dead);assert.equal(dead.nextId,w.nextId);
});
test('save during birth preserves remaining duration, newborn ID and mutation streams',()=>{
 const w=new Evolution({population:1}),a=w.agents[0];w._primed=true;a.born=-100;a.bornSubtick=-1000;a.age=100;a.process={action:9,duration:20,elapsed:5,localDestination:{...a.brain.position},destination:{x:a.x,y:a.y},direction:null};
 const r=roundtrip(w);for(let i=0;i<2;i++){w.step();r.step();compare(w,r);}assert.equal(w.stats.births,1);assert.equal(r.agents[1].id,w.agents[1].id);
});
test('save/load can change ownership count without changing scientific state',async()=>{
 const w=new Evolution({population:5,automaticEnvironment:{preparationInterval:1,randomInterval:2}}),original=new ParallelWorld(w,{workers:2,createWorker:createCognitionWorker});let other;
 try{await original.step();await original.syncAll();const restored=roundtrip(w);other=new ParallelWorld(restored,{workers:4,createWorker:createCognitionWorker});await other.ready();await other.attach();
  for(let i=0;i<3;i++){await original.step();await other.step();await original.syncAll();await other.syncAll();compare(w,restored);}
 }finally{await original.close();await other?.close();}
});
test('damaged/unsupported saves leave the current running runtime untouched',async()=>{
 const replies=[],runtime=new WorldRuntime({send:m=>replies.push(m)});await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:1,type:'init',payload:{settings:{population:2}}});runtime.setRunning(true);const before=runtime.world,snapshot=saveWorld(before);
 for(const bad of [{...snapshot,version:99},{...snapshot,state:{entry:{ref:999},nodes:[]}}, {format:'big-evolution-lives'}]){
  await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:2,type:'load-world',payload:{json:JSON.stringify(bad)}});assert.ok(replies.at(-1).error);assert.equal(runtime.world,before);assert.equal(runtime.running,true);
 }
 await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:3,type:'save-world'});const saved=replies.at(-1).result;assert.equal(runtime.running,true);
 await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:4,type:'load-world',payload:{json:saved.json}});assert.equal(replies.at(-1).error,undefined);assert.equal(runtime.running,false);assert.notEqual(runtime.world,before);
});
test('failed preparation of loaded workers preserves the old running world',async()=>{
 const replies=[],runtime=new WorldRuntime({send:m=>replies.push(m)});
 await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:1,type:'init',payload:{settings:{population:2}}});runtime.setRunning(true);
 const before=runtime.world;let closed=false;
 runtime.executorFactory=()=>({ready:async()=>{throw new Error('test unavailable');},close:async()=>{closed=true;}});
 await runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:2,type:'load-world',payload:{json:JSON.stringify(saveWorld(before))}});
 assert.match(replies.at(-1).error,/test unavailable/);assert.equal(closed,true);assert.equal(runtime.world,before);assert.equal(runtime.running,true);
});
