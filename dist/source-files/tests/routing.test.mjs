import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,key,distance,Random,PATH_RISK_WEIGHT} from '../dist/simulation.js';
function world(fear=1){
 const s=new Simulation({fearSensitivity:fear});s.agent.x=4;s.agent.y=6;s.agent.memory.clear();
 for(const c of s.tiles){c.terrain='land';c.risk=0;c.food=0;c.maxFood=0;s.agent.memory.set(key(c.x,c.y),{...c,seenAt:0});}
 return s;
}
test('routing prefers a longer safe detour over a short known hazardous crossing',()=>{
 const s=world();s.agent.memory.get(key(6,6)).risk=.3;
 const path=s.route({x:8,y:6});assert.ok(path.length>distance(s.agent,{x:8,y:6}));
 assert.ok(!path.some(p=>p.x===6&&p.y===6));
 const straight=[5,6,7,8].map(x=>({x,y:6}));assert.ok(s.pathCost(path)<s.pathCost(straight));
 let before=s.agent;for(const p of path){assert.equal(distance(before,p),1);before=p;}
});
test('individual fear changes whether the agent accepts a short risky route',()=>{
 const s=world(.001);s.agent.memory.get(key(6,6)).risk=.3;
 const bold=s.route({x:8,y:6});assert.equal(bold.length,4);assert.ok(bold.some(p=>p.x===6&&p.y===6));
 s.agent.fearSensitivity=2.5;const cautious=s.route({x:8,y:6});assert.ok(cautious.length>bold.length);assert.ok(!cautious.some(p=>p.x===6&&p.y===6));
});
test('unavoidable undesirable cells remain traversable; water does not',()=>{
 const s=world();for(const m of s.agent.memory.values())if(m.x===6)m.risk=.16;
 const risky=s.route({x:8,y:6});assert.ok(risky?.some(p=>p.x===6));
 for(const m of s.agent.memory.values())if(m.x===6)m.terrain='water';
 assert.equal(s.route({x:8,y:6}),null);
});
test('routes depend on remembered hazards and not unobserved changes in the world',()=>{
 const s=world();const before=s.route({x:8,y:6});s.tile(6,6).risk=.3;s.tile(6,6).terrain='water';
 assert.deepEqual(s.route({x:8,y:6}),before);
 s.observe();assert.ok(!s.route({x:8,y:6}).some(p=>p.x===6&&p.y===6));
 s.agent.memory.delete(key(8,6));assert.equal(s.route({x:8,y:6}),null);
 assert.ok(s.route({x:8,y:6},true));
});
test('newly observed danger changes an active route before crossing the bad cell',()=>{
 const s=world();const target={x:8,y:6},path=s.route(target);assert.ok(path.some(p=>p.x===6&&p.y===6));
 s.agent.plan={type:'explore',label:'Исследовать',target,path,steps:0,remaining:3};
 s.tile(6,6).risk=.3;s.step();
 assert.equal(s.stats.decisions,0);assert.ok(s.agent.plan);
 assert.ok(!s.agent.plan.path.some(p=>p.x===6&&p.y===6));
 assert.ok(s.events.some(e=>e.title==='Маршрут пересчитан'));
});
test('A* has the same minimum cost as an independent exhaustive search',()=>{
 for(let seed=1;seed<=8;seed++){
  const s=world(),rng=new Random(seed),target={x:10,y:9};
  for(const m of s.agent.memory.values()){
   m.terrain=m.x>=3&&m.x<=11&&m.y>=3&&m.y<=10?'land':'water';
   m.risk=Math.floor(rng.next()*4)*.04;
  }
  const distances=new Map([[key(s.agent.x,s.agent.y),0]]),pending=[{x:s.agent.x,y:s.agent.y,cost:0}];let expected=null;
  while(pending.length){
   pending.sort((a,b)=>a.cost-b.cost);const p=pending.shift(),pk=key(p.x,p.y);
   if(p.cost>distances.get(pk))continue;
   if(p.x===target.x&&p.y===target.y){expected=p.cost;break;}
   for(const n of s.neighbours(p)){
    const nk=key(n.x,n.y),m=s.agent.memory.get(nk);if(m?.terrain!=='land')continue;
    const cost=p.cost+1+PATH_RISK_WEIGHT*m.risk*s.agent.fearSensitivity;
    if(cost<(distances.get(nk)??Infinity)){distances.set(nk,cost);pending.push({...n,cost});}
   }
  }
  const path=s.route(target);assert.ok(path);assert.ok(Math.abs(s.pathCost(path)-expected)<1e-9);
 }
});
