import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {encodeState,decodeState} from '../dist/state-codec.js';
import {conceive,beginLabor} from '../dist/pregnancy.js';
import {ingestFood} from '../dist/digestion.js';
import {createMeat} from '../dist/food-resources.js';
import {syncBody,advancePhysiologyBodies} from '../dist/physiology-world.js';
const copy=w=>loadWorld(JSON.parse(JSON.stringify(saveWorld(w))));
const compare=(a,b)=>assert.deepEqual(saveWorld(b),saveWorld(a));
test('v5: точное продолжение живого мира с обучением и последней пищевой группой',()=>{
 const w=new Evolution({population:3,seed:88,physiology:{}});for(let i=0;i<2;i++)w.step();
 const a=w.agents[0];const meal=ingestFood(a.digestion,0,2,a.stomachCapacity,w.foodEnergies);w.stats.physiology.initialFoodEnergy+=meal.swallowed*w.foodEnergies[0]+.7*w.foodEnergies[2];syncBody(w,a);a.carriedMeat=createMeat(.7,w.subtick);a.foodInventory[2]=.7;syncBody(w,a);
 const restored=copy(w);for(let i=0;i<3;i++){w.step();restored.step();}
 // Производные снимки наблюдений могут быть пересобраны после загрузки.
 const pick=x=>({tick:x.tick,random:x.random,stats:x.stats,agents:x.agents.map(a=>({L:a.L,M:a.M,E:a.energy,H:a.health,d:a.digestion,food:a.foodInventory,brain:a.brain,process:a.process,pregnancy:a.pregnancy}))});
 assert.deepEqual(pick(restored),pick(w));
});
test('восстановление до/после последнего платежа, в родах и после рождения',()=>{
 const w=new Evolution({population:1,physiology:{},bodyGenes:{tPreg:.2},mutations:false});const a=w.agents[0];
 a.pregnancy=conceive(a.genome,a.bodyGenes,a.bodyPlan,0,w.physiology);w.stats.physiology.initialEnergy+=a.energyCapacity-a.energy;a.energy=a.energyCapacity;
 for(let i=0;i<24;i++){
  const restored=copy(w);advancePhysiologyBodies(w);advancePhysiologyBodies(restored);
  assert.deepEqual(w.agents.map(a=>[a.id,a.L,a.energy,a.health,a.pregnancy]),restored.agents.map(a=>[a.id,a.L,a.energy,a.health,a.pregnancy]));
 }
 assert.equal(w.stats.births,1);assert.equal(w.agents.length,2);
});
test('повреждения тела, кольца и генома плода отвергаются до возврата нового мира',()=>{
 const w=new Evolution({population:1,physiology:{}});for(const corrupt of [s=>s.agents[0].L=-1,s=>s.agents[0].digestion.width=0,s=>s.agents[0].foodInventory[0]=-1,s=>s.agents[0].genome[0]=Infinity]){
  const file=saveWorld(w),state=decodeState(file.state);corrupt(state);assert.throws(()=>loadWorld({...file,state:encodeState(state)}));assert(w.agents[0].L>0);
 }
});
