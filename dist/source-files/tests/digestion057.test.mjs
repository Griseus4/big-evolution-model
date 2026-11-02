import test from 'node:test';
import assert from 'node:assert/strict';
import {createDigestion,ingestFood,advanceDigestion} from '../dist/digestion.js';
const energy=[22,22,2.4],powers=[.00125,.00025,.00025],close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('полная загрузка: контрольные выходы трёх пищ и последнее усвоение',()=>{
 for(const [type,expected]of [[0,16.5],[1,3.3],[2,.36]]){
  const d=createDigestion(200);ingestFood(d,type,3,3,energy);let total=0;
  for(let step=1;step<=200;step++){total+=advanceDigestion(d,step,3,powers,energy);if(step===199)assert.equal(d.volume,3);}
  close(total,expected);assert.equal(d.volume,0);close(d.excretedEnergy,3*energy[type]-expected);
 }
});
test('одна порция усваивается полнее, исчерпанная энергия не освобождает место',()=>{
 const d=createDigestion(200);ingestFood(d,0,1,3,energy);let total=0;for(let step=1;step<=200;step++)total+=advanceDigestion(d,step,3,powers,energy);close(total,16.5);
 const fast=createDigestion(10);ingestFood(fast,0,1,1,energy);advanceDigestion(fast,1,1,[1,1,1],energy);assert.equal(fast.volume,1);assert.equal(fast.remaining.reduce((a,b)=>a+b),0);assert.equal(ingestFood(fast,0,1,1,energy).started,0);
});
test('смесь и пропорции считаются по одному состоянию; порция после усвоения ждёт',()=>{
 const d=createDigestion(200);ingestFood(d,0,1,3,energy);ingestFood(d,1,1,3,energy);ingestFood(d,2,1,3,energy);
 close(advanceDigestion(d,1,3,powers,energy),.0825+.0165+.0018);
 const e=createDigestion(20);advanceDigestion(e,1,3,powers,energy);ingestFood(e,0,1,3,energy);close(e.remaining.reduce((a,b)=>a+b),22);close(advanceDigestion(e,2,3,powers,energy),.0825);
});
test('малая ёмкость списывает начатую порцию целиком, при нуле не начинает',()=>{
 const d=createDigestion(20);assert.deepEqual(ingestFood(d,0,1,.3,energy),{started:1,swallowed:.3,discarded:.7});assert.deepEqual(ingestFood(d,0,1,.3,energy),{started:0,swallowed:0,discarded:0});
});
test('кольцо не растёт с tau, выведение и повторное заполнение не конфликтуют',()=>{
 for(let n=1;n<10000;n++)assert.ok(createDigestion(n).starts.length<=39);
 for(const n of [1,39,41,59,201,Number.MAX_SAFE_INTEGER])assert.ok(createDigestion(n).starts.length<=39);
 const d=createDigestion(41);let consumed=0,absorbed=0,waste=0;
 for(let step=1;step<300;step++){
  absorbed+=advanceDigestion(d,step,3,powers,energy);waste+=d.excretedEnergy;
  const meal=ingestFood(d,0,.1,3,energy);consumed+=meal.swallowed*22;
 }
 close(consumed,absorbed+waste+d.remaining.reduce((a,b)=>a+b,0));
 const copy=structuredClone(d);for(let step=300;step<320;step++){assert.equal(advanceDigestion(d,step,3,powers,energy),advanceDigestion(copy,step,3,powers,energy));}assert.deepEqual(d,copy);
 assert.throws(()=>advanceDigestion(d,319,3,powers,energy));
});
