import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,RULES,validateDigestionTime} from '../dist/evolution.js';
import {validatePlan,validateWorldOptions} from '../dist/experiment-plan.js';
import {advanceTemporalBodies} from '../dist/temporal-world.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {decodeState,encodeState} from '../dist/state-codec.js';

test('digestion time forms independent experiment combinations with the previous default',()=>{
 assert.equal(validateWorldOptions().digestionTime,20);
 const p=validatePlan({worlds:1,factors:[{key:'digestionTime',values:[5,20]},{key:'learning',values:[true,false]}]});
 assert.equal(p.variants.length,4);
 assert.deepEqual(p.variants.map(v=>[v.settings.digestionTime,v.settings.learning]),[[5,true],[5,false],[20,true],[20,false]]);
 for(const n of [0,-1,null,NaN,Infinity,.01])assert.throws(()=>validateDigestionTime(n));
 assert.equal(validateDigestionTime(12.5),12.5);
});
test('individual worlds digest one unchanged portion at their selected rate',()=>{
 for(const time of [5,20]){
  const w=new Evolution({population:1,limit:1,digestionTime:time,automaticEnvironment:{enabled:false}}),a=w.agents[0];
  a.energy=0;a.stomach=RULES.foodEnergy;
  for(let i=0;i<50;i++)advanceTemporalBodies(w);
  const gain=RULES.foodEnergy*5/time;
  assert.ok(Math.abs(a.energy-gain)<1e-9);assert.ok(Math.abs(a.stomach-(RULES.foodEnergy-gain))<1e-9);
 }
});
test('world snapshots retain custom digestion and old worlds acquire only the original default',()=>{
 const w=new Evolution({population:2,digestionTime:5}),restored=loadWorld(saveWorld(w));
 assert.equal(restored.digestionTime,5);assert.equal(restored.digestionRate,4.4);
 const old=saveWorld(new Evolution({population:2})),state=decodeState(old.state);
 delete state.digestionTime;old.state=encodeState(state);old.modelVersion='0.45.0';
 assert.throws(()=>loadWorld(old),/Неподдерживаемый формат|версия/);
});
