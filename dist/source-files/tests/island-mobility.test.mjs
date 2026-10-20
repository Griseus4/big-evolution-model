import test from 'node:test';
import assert from 'node:assert/strict';
import {proposedIslandCount} from '../dist/environment-plan.js';
import {translateFoodGroup} from '../dist/food-island-evolution.js';
import {ENVIRONMENT_RULES as R} from '../dist/environment-settings.js';
import {Random} from '../dist/simulation.js';
import {worldDistance} from '../dist/food-layout.js';
import {worldAxial,worldOffset} from '../dist/navigation.js';

test('small island counts respond to a one-sigma event and respect source limits',()=>{
 const normal=sign=>{let call=0;return {next:()=>call++%2===0?1-Math.exp(-.5):sign>0?0:.5};};
 assert.equal(proposedIslandCount(1,100,normal(1)),2);
 assert.equal(proposedIslandCount(2,100,normal(1)),3);
 assert.equal(proposedIslandCount(1,100,normal(-1)),1);
 assert.equal(proposedIslandCount(10,100,normal(1)),12);
 assert.equal(proposedIslandCount(1,1,normal(1)),1);
});

test('islands shift 5–20 hexes with one rigid translation, bushes stay local',()=>{
 const world={tile:(x,y)=>({x,y,terrain:'land'})},distances=new Set();
 for(let seed=1;seed<=256;seed++)for(const kind of ['island','bush']){
  const centre={x:20,y:20},origin=worldAxial(centre),sources=kind==='island'?[centre,worldOffset({q:origin.q+1,r:origin.r}),worldOffset({q:origin.q,r:origin.r+1})]:[centre];
  const before=sources.map(worldAxial),group={id:1,kind,centre,sources},used=new Set(sources.map(p=>`${p.x},${p.y}`));
  const move=translateFoodGroup(world,group,used,new Random(seed));assert.ok(move);
  const distance=worldDistance(move.from,move.to);assert.ok(kind==='island'?distance>=5&&distance<=20:distance>0&&distance<=5);
  if(kind==='island')distances.add(distance);
  const destination=worldAxial(group.centre),dq=destination.q-origin.q,dr=destination.r-origin.r;
  group.sources.forEach((p,i)=>assert.deepEqual(worldAxial(p),{q:before[i].q+dq,r:before[i].r+dr}));
  assert.equal(used.size,sources.length);
 }
 assert.ok(distances.has(5));assert.ok(distances.has(20));
});

test('blocked island movement has bounded work and leaves all state intact',()=>{
 const group={id:1,kind:'island',centre:{x:4,y:4},sources:[{x:4,y:4,capacity:3}]},before=structuredClone(group),used=new Set(['4,4']);let visits=0;
 const world={tile:()=>{visits++;return {terrain:'water'};}};
 assert.equal(translateFoodGroup(world,group,used,new Random(42)),null);
 assert.equal(visits,R.islandRelocationAttempts);assert.deepEqual(group,before);assert.deepEqual([...used],['4,4']);
});
