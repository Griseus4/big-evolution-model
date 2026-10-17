import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,WORLD_WIDTH,WORLD_HEIGHT,RULES} from '../dist/evolution.js';
import {worldDistance} from '../dist/food-layout.js';
for(const scenario of ['balanced','scarce'])test(`islands preserve every source and distribute food across the map: ${scenario}`,()=>{
 for(const seed of [0,1,23,42,2026]){
  const s=new Evolution({seed,scenario,population:1}),again=new Evolution({seed,scenario,population:1});
  const sources=s.tiles.filter(c=>c.maxFood>0);
  assert.equal(sources.length,s.sourceTemplate.length);
  assert.deepEqual(sources.map(c=>c.maxFood).sort((a,b)=>a-b),s.sourceTemplate.map(c=>c.maxFood).sort((a,b)=>a-b));
  assert.equal(sources.reduce((n,c)=>n+c.food,0),s.initialFood);assert.equal(RULES.regrowInterval,80);
  assert.ok(sources.every(c=>c.terrain==='land'));assert.deepEqual(s.foodIslands,again.foodIslands);
  const allocated=s.foodIslands.flatMap(g=>g.sources);assert.equal(new Set(allocated.map(p=>`${p.x},${p.y}`)).size,sources.length);
  assert.ok(sources.some(c=>c.x>WORLD_WIDTH*.75));assert.ok(sources.some(c=>c.y>WORLD_HEIGHT*.75));
  for(const group of s.foodIslands){
   assert.ok(group.sources.length>=3);
   assert.ok(group.sources.every(p=>worldDistance(p,group.centre)<=3));
   for(const other of s.foodIslands)if(other.id!==group.id)assert.ok(worldDistance(group.centre,other.centre)>=10);
  }
 }
});
