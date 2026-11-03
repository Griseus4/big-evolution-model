import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {ingestFood} from '../dist/digestion.js';
import {physiologyFrame,preparePhysiologyBoundary,advancePhysiologyBodies,syncBody} from '../dist/physiology-world.js';
import {startProcess} from '../dist/physiology-actions.js';
import {createMeat,meatAmount} from '../dist/food-resources.js';
import {checkPhysiologyInvariants} from '../dist/physiology-invariants.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {energyPreview,previewBrain} from '../dist/energy-preview.js';
import {validateWorldOptions} from '../dist/experiment-plan.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function fixture(type,{amount=3,filled=2.3,large=false}={}){
 const w=new Evolution({seed:42,population:1,mutations:false,physiology:{meatHalfLife:Number.MAX_VALUE,inventoryCapacity:large?30:3},...(large?{bodyGenes:{gmax:1}}:{})}),a=w.agents[0];
 a.foodInventory[type]=amount;if(type===2)a.carriedMeat=createMeat(amount,0);
 const meal=ingestFood(a.digestion,type,filled,a.stomachCapacity,w.foodEnergies);
 w.stats.physiology.initialFoodEnergy+=(amount+meal.swallowed)*w.foodEnergies[type];syncBody(w,a);return {w,a};
}
function finishMeal(w,a,type){
 preparePhysiologyBoundary(w);const frame=physiologyFrame(w,a),candidate=frame.request.candidates.find(c=>c.action===7&&c.foodType===type);assert(candidate);
 a.process=startProcess(a,w.executableDecision(frame,candidate),w.subtick,w.physiology);assert.equal(a.process.duration,w.physiology.eatSteps);
 const duration=a.process.duration;for(let step=0;step<duration;step++)advancePhysiologyBodies(w);return a.life.physiology.ingested[type];
}
test('трава, плоды и мясо: дробный приём сохраняет остаток и баланс',()=>{
 for(let type=0;type<3;type++){
  const {w,a}=fixture(type);near(finishMeal(w,a,type),.7);near(a.foodInventory[type],2.3);near(a.stomach,3);
  if(type===2){near(meatAmount(a.carriedMeat),2.3);assert.equal(a.carriedMeat.subtick,w.subtick);}
  assert.equal(w.stats.discardedFood,0);assert.equal(w.stats.physiology.discardedEnergy,0);checkPhysiologyInvariants(w);
 }
});
test('один приём превышает прежний предел, время и моторная цена не зависят от объёма',()=>{
 for(const amount of [.25,12.5]){
  const {w,a}=fixture(0,{amount,filled:0,large:true});near(finishMeal(w,a,0),amount);near(a.foodInventory[0],0);near(a.stomach,amount);
  near(a.life.physiology.motor,w.physiology.eatRate*(a.L/w.physiology.referenceMass)*w.physiology.eatSteps/10);checkPhysiologyInvariants(w);
 }
});
test('полный желудок не предлагает еду; остаток точно продолжается после загрузки мира v5',()=>{
 const {w,a}=fixture(1);finishMeal(w,a,1);preparePhysiologyBoundary(w);
 assert(!physiologyFrame(w,a).request.candidates.some(c=>c.action===7));
 const file=JSON.parse(JSON.stringify(saveWorld(w)));file.modelVersion='0.57.2';const restored=loadWorld(file);
 near(restored.agents[0].foodInventory[1],2.3);w.step();restored.step();assert.deepEqual(saveWorld(restored),saveWorld(w));
});
test('калькулятор собирает запас перед одним приёмом, малый лимит относится к сбору',()=>{
 const options=validateWorldOptions({physiology:{portionPerAction:.5}}),brain=previewBrain(options),a=energyPreview(options,brain,1);
 near(a.portion,3);near(a.gathers,6);assert(Number.isFinite(a.net));
});
