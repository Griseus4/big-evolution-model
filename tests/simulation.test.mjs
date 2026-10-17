import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation,key,WIDTH,HEIGHT,distance,hexCenter,hexAt,MAP_WIDTH,MAP_HEIGHT,FOOD_ENERGY,DIGESTION_RATE,REVISIT_AGE} from '../dist/simulation.js';

test('same world and seed reproduce events; batching does not change the result',()=>{
 const a=new Simulation({seed:71,scenario:'risk'}),b=new Simulation({seed:71,scenario:'risk'});
 a.advance(700);for(let i=0;i<70;i++)b.advance(10);
 assert.deepEqual(a.snapshot(),b.snapshot());
});
test('changing unseen food and hazards cannot change the current choice or route',()=>{
 const a=new Simulation(),b=new Simulation();
 assert.equal(a.agent.memory.has(key(20,14)),false);
 Object.assign(b.tile(20,14),{food:999,risk:1,terrain:'water'});
 assert.deepEqual(a.evaluate(),b.evaluate());
 const unknown={x:20,y:14};
 assert.equal(a.route(unknown),null);
 assert.equal(b.route(unknown),null);
});
test('observations reveal a source only after it enters perception',()=>{
 const s=new Simulation();assert.equal(s.agent.memory.has(key(20,14)),false);
 s.agent.x=19;s.agent.y=14;s.observe();
 assert.equal(s.agent.memory.get(key(20,14)).food,7);
 assert.ok(s.evaluate().some(o=>o.type==='gather'&&o.target.x===20&&o.target.y===14));
});
test('memory can retain outdated food without reading the real world during choice',()=>{
 const s=new Simulation();const source=s.agent.memory.get(key(10,9));assert.equal(source.food,6);
 s.tile(10,9).food=0;
 assert.ok(s.evaluate().some(o=>o.type==='gather'&&o.target.x===10));
 s.observe();assert.equal(s.agent.memory.get(key(10,9)).food,0);
 assert.ok(!s.evaluate().some(o=>o.type==='gather'&&o.target.x===10&&o.target.y===9));
});
test('food is conserved, state remains bounded and movement remains legal across runs',()=>{
 let gathered=0,eaten=0,explored=0;
 for(let seed=1;seed<=24;seed++){
  const s=new Simulation({seed,scenario:seed%2?'mixed':'risk'});
  for(let t=0;t<900&&s.agent.alive;t++){
   const before={x:s.agent.x,y:s.agent.y};s.step();const a=s.agent;
   assert.ok(distance(a,before)<=1);
   assert.equal(s.tile(a.x,a.y).terrain,'land');
   assert.ok(a.energy>=0&&a.energy<=100&&a.health>=0&&a.health<=100);
   assert.ok(a.inventory>=0&&a.inventory<=a.capacity);
   const total=s.tiles.reduce((sum,c)=>sum+c.food,0)+a.inventory+s.stats.eaten;
   assert.equal(total,s.initialFood+s.stats.regrown);
   assert.equal(s.stats.gathered,a.inventory+s.stats.eaten);
  }
  gathered+=s.stats.gathered;eaten+=s.stats.eaten;explored+=s.agent.memory.size;
 }
 assert.ok(gathered>100&&eaten>100&&explored>1000);
});
test('stronger hunger raises the chance of eating available food',()=>{
 const s=new Simulation();s.agent.inventory=1;s.agent.energy=80;
 const satiated=s.evaluate().find(o=>o.type==='eat').probability;
 s.agent.energy=10;
 const hungry=s.evaluate().find(o=>o.type==='eat').probability;
 assert.ok(hungry>satiated);
});
test('stronger fear reduces selection of a known hazardous food source',()=>{
 const s=new Simulation({scenario:'risk',fearSensitivity:.1});
 const low=s.evaluate().find(o=>o.type==='gather').probability;
 s.agent.fearSensitivity=2.5;
 const high=s.evaluate().find(o=>o.type==='gather').probability;
 assert.ok(high<low);
});
test('exploration remains available when no food is known',()=>{
 const s=new Simulation();for(const m of s.agent.memory.values())m.food=0;
 const options=s.evaluate();assert.ok(options.some(o=>o.type==='explore'));
 assert.ok(!options.some(o=>o.type==='gather'));
 assert.ok(Math.abs(options.reduce((sum,o)=>sum+o.probability,0)-1)<1e-12);
});
test('plans survive multiple movement steps instead of rerolling every tick',()=>{
 const s=new Simulation();s.agent.plan={type:'explore',label:'Проверка',target:{x:8,y:12},
   path:[{x:8,y:10},{x:8,y:11},{x:8,y:12}],steps:0,remaining:3};
 s.step();assert.equal(s.stats.decisions,0);assert.equal(s.agent.plan.path.length,2);
 s.step();assert.equal(s.stats.decisions,0);assert.equal(s.agent.plan.path.length,1);
});
test('an unseen blocked exploration step is discovered without moving into water',()=>{
 const s=new Simulation();const target={x:12,y:9};s.agent.x=11;s.agent.y=9;
 s.tile(12,9).terrain='water';s.agent.memory.delete(key(12,9));
 s.agent.plan={type:'explore',label:'Проверка',target,path:[target],steps:0,remaining:3};
 s.step();assert.equal(s.agent.x,11);assert.equal(s.agent.memory.get(key(12,9)).terrain,'water');
 assert.equal(s.agent.plan,null);
});
test('death ends the simulation and no action occurs afterwards',()=>{
 const s=new Simulation();s.agent.energy=0;s.agent.health=1;
 s.step();assert.equal(s.agent.alive,false);const snapshot=s.snapshot();s.advance(100);
 assert.deepEqual(s.snapshot(),snapshot);
});
test('desktop controls reference existing elements; the simulation is presentation independent',()=>{
 const html=fs.readFileSync(new URL('../dist/legacy.html',import.meta.url),'utf8');
 const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 const engine=fs.readFileSync(new URL('../dist/simulation.js',import.meta.url),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const m of app.matchAll(/\$\('([a-z-]+)'\)/g))assert.ok(ids.includes(m[1]),`missing #${m[1]}`);
 assert.ok(!engine.includes('Math.random('));assert.ok(!engine.includes('document.'));
 assert.ok(MAP_WIDTH>1000);assert.ok(MAP_HEIGHT>500);
});

test('eating starts digestion without an instantaneous energy gain',()=>{
 const s=new Simulation();const a=s.agent;a.inventory=1;a.energy=20;
 a.plan={type:'eat',path:[],steps:0,remaining:1};s.step();
 assert.equal(a.inventory,0);assert.equal(a.stomach,FOOD_ENERGY);
 assert.ok(a.energy<20);assert.equal(a.lastAbsorbed,0);
 a.plan={type:'wait',path:[],steps:0,remaining:100};const before=a.energy;s.step();
 assert.ok(a.energy>before&&a.energy<=before+DIGESTION_RATE);
 assert.equal(a.stomach,FOOD_ENERGY-DIGESTION_RATE);
 for(let i=0;i<19;i++){a.plan={type:'wait',path:[],steps:0,remaining:1};s.step();}assert.ok(a.stomach<1e-10);
 assert.ok(Math.abs(s.stats.digested-FOOD_ENERGY)<1e-10);
});
test('satiation and pending digestion suppress both eating and food gathering',()=>{
 const s=new Simulation();const a=s.agent;a.inventory=1;a.energy=95;
 const full=s.evaluate();a.energy=20;const hungry=s.evaluate();
 const prob=(options,type)=>options.filter(o=>o.type===type).reduce((v,o)=>v+o.probability,0);
 assert.ok(prob(full,'eat')<.04);assert.ok(prob(hungry,'eat')>prob(full,'eat'));
 assert.ok(prob(hungry,'eat')+prob(hungry,'gather')>prob(full,'eat')+prob(full,'gather'));
 a.inventory=0;a.energy=95;const fullGather=prob(s.evaluate(),'gather');a.energy=20;const hungryGather=prob(s.evaluate(),'gather');
 assert.ok(hungryGather>fullGather);a.inventory=1;
 a.stomach=66;const digesting=s.evaluate();assert.ok(prob(digesting,'eat')<prob(hungry,'eat'));
 a.inventory=0;assert.ok(prob(s.evaluate(),'gather')<hungryGather);
});
test('food energy is accounted for during digestion and saturation',()=>{
 const s=new Simulation();s.agent.energy=99;s.agent.stomach=FOOD_ENERGY;
 s.agent.plan={type:'wait',path:[],steps:0,remaining:100};s.advance(21);
 assert.ok(s.agent.energy<=100);assert.ok(s.stats.overflow>0);
 assert.ok(Math.abs(s.stats.digested-s.stats.absorbed-s.stats.overflow)<1e-9);
 assert.ok(Math.abs(s.agent.stomach+s.stats.digested-FOOD_ENERGY)<1e-9);
});
test('stale empty sources can be revisited, even with the entire map known',()=>{
 const s=new Simulation();s.agent.x=2;s.agent.y=2;s.tick=REVISIT_AGE+10;
 for(const c of s.tiles)s.agent.memory.set(key(c.x,c.y),{...c,seenAt:0,food:0});
 s.observe();const options=s.evaluate();assert.ok(!options.some(o=>o.type==='explore'));
 const revisit=options.find(o=>o.type==='revisit');assert.ok(revisit);
 assert.ok(s.agent.memory.get(key(revisit.target.x,revisit.target.y)).maxFood>0);
 const before=s.agent.memory.get(key(revisit.target.x,revisit.target.y)).seenAt;
 s.agent.plan={...revisit,path:revisit.path.map(p=>({...p})),steps:0,remaining:1};
 s.advance(20);
 assert.ok(s.agent.memory.get(key(revisit.target.x,revisit.target.y)).seenAt>before);
 assert.ok(s.stats.revisited>=1);
});
test('changed distant territory stays unknown until a revisit observes it',()=>{
 const a=new Simulation(),b=new Simulation();
 for(const s of [a,b]){s.tick=100;s.agent.memory.set(key(20,14),{x:20,y:14,terrain:'land',food:0,maxFood:7,risk:0,seenAt:0});}
 b.tile(20,14).food=5;b.tile(20,14).risk=.3;
 assert.deepEqual(a.evaluate(),b.evaluate());
 b.agent.x=19;b.agent.y=14;b.observe();
 assert.equal(b.agent.memory.get(key(20,14)).food,5);
 assert.equal(b.agent.memory.get(key(20,14)).risk,.3);
});
test('hex navigation has six adjacent directions and display hits the same cells',()=>{
 const s=new Simulation();
 for(const p of [{x:8,y:8},{x:8,y:9}]){
  const ns=s.neighbours(p);assert.equal(ns.length,6);
  for(const n of ns){assert.equal(distance(n,p),1);assert.ok(s.neighbours(n).some(q=>q.x===p.x&&q.y===p.y));}
 }
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const c=hexCenter({x,y});assert.deepEqual(hexAt(c.x,c.y),{x,y});
  assert.ok(c.x>0&&c.x<MAP_WIDTH&&c.y>0&&c.y<MAP_HEIGHT);
 }
 assert.equal(hexAt(-100,-100),null);
});
