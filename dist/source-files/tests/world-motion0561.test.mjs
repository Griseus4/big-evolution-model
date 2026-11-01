import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionCapture,MotionPlayer,agentPoint,MOTION_RULES} from '../dist/world-motion.js';
import {WorldMapLayers} from '../dist/world-map-layers.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL,WorldView} from '../dist/world-view.js';
import {Evolution} from '../dist/evolution.js';
import {DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {saveWorld} from '../dist/world-save.js';
const cell=(x,y)=>y*48+x;
const a=(id,x,y)=>({id,x,y,founderId:id});
const packet=(from,to,moves=[],reset=false,generation=1)=>({generation,from,to,reset,moves:Float64Array.from(moves.flat())});
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,`${x} != ${y}`);

test('motion follows each confirmed corner and hit testing uses the visual point',()=>{
 const p=new MotionPlayer();p.accept([a(1,2,2)],packet(0,0,[],true),0);
 const route=[[1,cell(2,2),cell(3,2),10],[1,cell(3,2),cell(3,3),20]];
 const live=a(1,3,3);p.accept([live],packet(0,20,route),200);
 p.sample(250);const first=agentPoint(a(1,2,2)),corner=agentPoint(a(1,3,2));
 close(p.point(live).x,(first.x+corner.x)/2);close(p.point(live).y,first.y);
 assert.equal(p.hitTest([live],p.point(live).x,p.point(live).y),live);
 p.sample(300);close(p.point(live).x,corner.x);close(p.point(live).y,corner.y);
 p.sample(350);const end=agentPoint(live);close(p.point(live).x,(corner.x+end.x)/2);close(p.point(live).y,(corner.y+end.y)/2);
 p.sample(450);assert.deepEqual(p.point(live),end);assert.equal(p.active,false);
});
test('overlapping snapshots preserve a pending route and finish within bounded delay',()=>{
 const p=new MotionPlayer();p.accept([a(1,0,0)],packet(0,0,[],true),0);
 p.accept([a(1,1,0)],packet(0,10,[[1,cell(0,0),cell(1,0),10]]),200);p.sample(250);
 const before={...p.point(a(1,1,0))};p.accept([a(1,1,1)],packet(10,20,[[1,cell(1,0),cell(1,1),20]]),250);
 assert.deepEqual(p.point(a(1,1,1)),before);p.sample(501);assert.deepEqual(p.point(a(1,1,1)),agentPoint(a(1,1,1)));assert.equal(p.active,false);
});
test('pause, missing routes, new generations and same-world discontinuities snap safely',()=>{
 for(const mode of ['pause','missing','reset','generation']){
  const p=new MotionPlayer();p.accept([a(1,0,0)],packet(0,0,[],true),0);
  const live=a(1,10,10),data=packet(0,10,[],mode==='reset',mode==='generation'?2:1);
  p.accept([live],data,200,mode!=='pause');assert.deepEqual(p.point(live),agentPoint(live));assert.equal(p.active,false);
 }
});
test('birth, death and ID reuse do not animate imaginary earlier lives',()=>{
 const p=new MotionPlayer();p.accept([a(1,0,0)],packet(0,0,[],true),0);
 const child=a(2,8,9);p.accept([child],packet(0,10,[[2,cell(8,8),cell(8,9),10]]),200);
 assert.equal(p.tracks.has(1),false);assert.deepEqual(p.point(child),agentPoint(child));
 p.accept([a(1,20,20)],packet(10,0,[],true,2),300);assert.equal(p.tracks.has(2),false);assert.deepEqual(p.point(a(1,20,20)),agentPoint(a(1,20,20)));
});
test('same-tick jumps and oversized per-agent histories do not leave delayed ghosts',()=>{
 const p=new MotionPlayer();p.accept([a(1,0,0)],packet(0,0,[],true),0);
 p.accept([a(1,1,0)],packet(0,0,[[1,0,1,0]]),20);assert.deepEqual(p.point(a(1,1,0)),agentPoint(a(1,1,0)));assert.equal(p.active,false);
 let x=1;const moves=[];for(let i=1;i<100;i++){const nx=x===1?2:1;moves.push([1,cell(x,0),cell(nx,0),i]);x=nx;}
 p.accept([a(1,x,0)],packet(0,100,moves),100);assert.ok(p.tracks.get(1).points.length<=MOTION_RULES.maxPointsPerAgent);assert.deepEqual(p.point(a(1,x,0)),agentPoint(a(1,x,0)));
});
test('capture records odd/even neighbours and bounds overflow without shortened edges',()=>{
 const c=new MotionCapture();c.configure(true,0);c.take(0);
 c.moved(a(1,3,2),2,2,10);c.moved(a(1,3,3),3,2,20);
 assert.deepEqual([...c.take(20).moves],[1,cell(2,2),cell(3,2),10,1,cell(3,2),cell(3,3),20]);
 c.moved(a(1,20,20),3,3,30);assert.equal(c.take(30).reset,true);
 for(let i=0;i<MOTION_RULES.maxMoves+1;i++)c.moved(a(1,1,0),0,0,i+31);
 const overflow=c.take(MOTION_RULES.maxMoves+32);assert.equal(overflow.reset,true);assert.equal(overflow.moves.length,0);
 c.configure(false,10000);c.take(10000);c.moved(a(1,1,0),0,0,10001);assert.equal(c.take(10001).moves.length,0);
});
test('terrain, food and overlay caches are invalidated independently',()=>{
 const context=new Proxy({},{get:()=>()=>{},set:()=>true}),make=()=>({width:0,height:0,getContext:()=>context});
 const layers=new WorldMapLayers({width:300,height:200},make),view={tiles:[{x:0,y:0,terrain:'land',food:0,maxFood:1}],foodRevision:1};
 layers.draw(context,view,()=>{});for(let i=0;i<20;i++)layers.draw(context,view,()=>{});
 assert.deepEqual(layers.builds,{terrain:1,food:1,overlay:1});
 view.foodRevision++;view.tiles[0].food=2;layers.draw(context,view,()=>{});assert.deepEqual(layers.builds,{terrain:1,food:2,overlay:1});
 layers.invalidateOverlay();layers.draw(context,view,()=>{});assert.equal(layers.builds.overlay,2);
 view.tiles=view.tiles.map(c=>({...c}));layers.draw(context,view,()=>{});assert.equal(layers.builds.terrain,2);assert.equal(layers.builds.food,3);
 const v=new WorldView(),state={tick:0,agents:[],tiles:view.tiles,food:[2],summary:{}};
 v.apply(state);layers.draw(context,v,()=>{});const terrain=layers.builds.terrain,food=layers.builds.food;
 v.apply({...state,tiles:state.tiles.map(c=>({...c,maxFood:3}))});layers.draw(context,v,()=>{});
 assert.equal(layers.builds.terrain,terrain);assert.equal(layers.builds.food,food+1);
 v.apply({...state,tiles:state.tiles.map(c=>({...c,terrain:'water'}))});layers.draw(context,v,()=>{});assert.equal(layers.builds.terrain,terrain+1);
});
test('observer preserves complete genomes, personal learning and RNG with visible/hidden maps',async()=>{
 for(const population of [12,150,1000]){
  const options={seed:42,brainType:DUAL_BRAIN_TYPE,population,limit:1000,computeWorkers:1},reference=new Evolution(options);let time=0;
  const sent=[],runtime=new WorldRuntime({clock:()=>time,send:m=>sent.push(structuredClone(m))});let id=0;
  const command=async(type,payload={})=>runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});
  await command('init',{settings:options});await command('speed',{value:100});await command('running',{value:true});
  for(let j=0;j<(population===1000?3:6);j++){
   reference.step();time+=20;await runtime.pulse();
   await command('ack',{sequence:runtime.inFlight});await command('view',{visible:j%2===0,tab:'world',section:'birth'});
  }
  assert.deepEqual(saveWorld(runtime.world).state,saveWorld(reference).state,`population ${population}`);
  await command('view',{visible:true,tab:'world',section:'birth'});await command('speed',{value:1,substeps:true});
  assert.equal(runtime.motion.enabled,true);assert.equal(sent.filter(m=>m.type==='state').at(-1).paintBeforeNext,true);
 }
});

const previewPacket=(from,to,moves=[],reset=false,generation=1)=>({...packet(from,to,moves,reset,generation),preview:true,intervalMs:500});
const walking=(id,x,y,nx,ny,elapsed,duration=15)=>({...a(id,x,y),movement:{x:nx,y:ny,elapsed,duration}});
const fractionPoint=(agent,f)=>{
 const source=agentPoint(agent),end=agentPoint({id:agent.id,x:agent.movement.x,y:agent.movement.y});
 return {x:source.x+(end.x-source.x)*f,y:source.y+(end.y-source.y)*f};
};

test('slow movement advances between substeps while its physical cell stays at the source',()=>{
 const p=new MotionPlayer(),start=walking(1,2,2,3,2,0),live=walking(1,2,2,3,2,1);
 p.accept([start],previewPacket(0,0,[],true),0);
 p.accept([live],previewPacket(0,1),500);p.sample(750);
 const expected=fractionPoint(live,.5/15);close(p.point(live).x,expected.x);close(p.point(live).y,expected.y);
 assert.equal(live.x,2);assert.equal(live.y,2);assert.equal(p.hitTest([live],expected.x,expected.y),live);
 p.sample(1000);assert.deepEqual(p.point(live),fractionPoint(live,1/15));
});

test('pause freezes the drawn point, commands do not move it, resume finishes the same progress',()=>{
 const p=new MotionPlayer(),live=walking(1,2,2,3,2,1);
 p.accept([walking(1,2,2,3,2,0)],previewPacket(0,0,[],true),0);
 p.accept([live],previewPacket(0,1),500);p.sample(650);const shown={...p.point(live)};
 p.accept([live],previewPacket(1,1),700,false);p.sample(5000);
 assert.deepEqual(p.point(live),shown);assert.equal(p.active,false);
 p.accept([live],previewPacket(1,1),5100,false);assert.deepEqual(p.point(live),shown);
 p.accept([live],previewPacket(1,1),5200,true);p.sample(5700);
 assert.deepEqual(p.point(live),fractionPoint(live,1/15));
});

test('fast confirmed-route animation also freezes on pause and resumes its known route',()=>{
 const p=new MotionPlayer(),live=a(1,3,2);p.accept([a(1,2,2)],packet(0,0,[],true),0);
 p.accept([live],packet(0,15,[[1,cell(2,2),cell(3,2),15]]),200);p.sample(250);
 const shown={...p.point(live)};p.accept([live],packet(15,15),260,false);p.sample(1000);
 assert.deepEqual(p.point(live),shown);assert.equal(p.active,false);
 p.accept([live],packet(15,15),1100,true);p.sample(1400);assert.deepEqual(p.point(live),agentPoint(live));
});

test('cancellation snaps to source; a replacement process and zero-elapsed restart discard old progress',()=>{
 for(const replacement of [a(1,2,2),walking(1,2,2,2,3,0),walking(1,2,2,3,2,0)]){
  const p=new MotionPlayer(),live=walking(1,2,2,3,2,7);
  p.accept([live],previewPacket(7,7,[],true),0);
  p.accept([replacement],previewPacket(7,8),500);assert.deepEqual(p.point(replacement),agentPoint(replacement));
  p.sample(1000);assert.deepEqual(p.point(replacement),agentPoint(replacement));
 }
});

test('completion and a new direction preserve the corner; continued process does not jump back',()=>{
 const p=new MotionPlayer(),before=walking(1,2,2,3,2,14),next=walking(1,3,2,3,3,0);
 p.accept([before],previewPacket(14,14,[],true),0);
 p.accept([next],previewPacket(14,15,[[1,cell(2,2),cell(3,2),15]]),500);
 p.sample(750);const source=agentPoint(before),corner=agentPoint(next),shown=p.point(next);
 close(shown.y,source.y);assert.ok(shown.x>source.x&&shown.x<corner.x);
 p.sample(1000);assert.deepEqual(p.point(next),corner);
 const continued=walking(1,3,2,3,3,1);p.accept([continued],previewPacket(15,16),1000);p.sample(1250);
 const expected=fractionPoint(continued,.5/15);close(p.point(continued).x,expected.x);close(p.point(continued).y,expected.y);
});

test('paused manual substep, reload, speed changes and malformed destinations show safe positions',()=>{
 const p=new MotionPlayer(),live=walking(1,2,2,3,2,6);
 p.accept([live],previewPacket(6,6,[],true),0,false);assert.deepEqual(p.point(live),fractionPoint(live,6/15));
 const stepped=walking(1,2,2,3,2,7);p.accept([stepped],previewPacket(6,7),500,false);
 assert.deepEqual(p.point(stepped),fractionPoint(stepped,7/15));assert.equal(p.active,false);
 p.accept([live],previewPacket(7,6,[],true,2),600,false);assert.deepEqual(p.point(live),fractionPoint(live,6/15));
 p.accept([live],packet(6,6,[],true,3),700);assert.deepEqual(p.point(live),agentPoint(live));
 p.accept([live],previewPacket(6,6,[],true,4),800);assert.deepEqual(p.point(live),fractionPoint(live,6/15));
 const invalid=walking(1,2,2,20,20,4);p.accept([invalid],previewPacket(6,7),900);assert.deepEqual(p.point(invalid),agentPoint(invalid));
});

test('slow birth/death and selection ignore absent tracks without replaying other lives',()=>{
 const p=new MotionPlayer(),old=walking(1,2,2,3,2,5),child=walking(2,6,6,7,6,1);
 p.accept([old],previewPacket(5,5,[],true),0);
 p.accept([child],previewPacket(5,6),500);
 assert.equal(p.tracks.has(1),false);assert.deepEqual(p.point(child),fractionPoint(child,1/15));
 assert.equal(p.hitTest([child],p.point(old).x,p.point(old).y),null);
});

test('runtime slow snapshots carry only observer progress, preserve complete world and keep pause generation',async()=>{
 for(const population of [12,150,1000]){
  const options={seed:42,brainType:DUAL_BRAIN_TYPE,population,limit:1000,computeWorkers:1},reference=new Evolution(options);
  let time=0,id=0;const sent=[],runtime=new WorldRuntime({clock:()=>time,send:m=>sent.push(structuredClone(m))});
  const command=async(type,payload={})=>runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});
  const latest=()=>sent.filter(m=>m.type==='state').at(-1);
  await command('init',{settings:options});await command('speed',{value:.2,substeps:true});await command('running',{value:true});
  for(let i=1;i<=4;i++){
   reference.substep();time+=500;await command('ack',{sequence:runtime.inFlight});await runtime.pulse();
   const state=latest().state;assert.equal(state.motion.preview,true);assert.equal(state.motion.intervalMs,500);
   assert.equal(latest().paintBeforeNext,true);
   for(const point of state.agents){const process=runtime.world.agents.find(a=>a.id===point.id).process;
    if(process?.action<6)assert.deepEqual(point.movement,{x:process.destination.x,y:process.destination.y,elapsed:process.elapsed,duration:process.duration});
    else assert.equal(point.movement,undefined);
   }
  }
  assert.deepEqual(saveWorld(runtime.world).state,saveWorld(reference).state,`slow population ${population}`);
  const generation=latest().state.motion.generation;await command('running',{value:false});
  assert.equal(latest().state.motion.generation,generation);await command('running',{value:true});assert.equal(latest().state.motion.generation,generation);
 }
});
