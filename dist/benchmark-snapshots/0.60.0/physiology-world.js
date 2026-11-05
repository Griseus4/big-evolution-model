import {CARE_ACTIONS} from './care-actions.js';
import {careRecord,carriedChild,attachChild,careDeath,releaseDueChildren,moveCarriedChild,visibleCare} from './child-care.js';
/** Владелец фаз — координатор мира. Нейросети получают общий наблюдаемый
 * снимок; расходы уже исполненных вычислений оплачиваются вместе с базой.
 * Worker может заменить только оценку решения между prepare/commit. */
import {DT,SUBSTEPS,DECISION_COST,REPEAT_COST,CALL_COMPLETE,CALL_REVIEW,CALL_FAILED} from './action-timing.js';
import {BODY_GENE_DEFAULTS,foodEnergies} from './physiology-settings.js';
import {bodyPlan,bodyCapacities,createBody,remainsMass,motorRate} from './body-physiology.js';
import {unpackDualBrain} from './dual-brain-layout.js';
import {createDigestion,advanceDigestion,ingestFood} from './digestion.js';
import {createGrass,grassAmount,takeGrass,createMeat,meatAmount,decayMeat,addMeat,takeMeat} from './food-resources.js';
import {budgetRecord,beginBodyInterval,payMotorInterval,finishBodyInterval} from './physiology-budget.js';
import {conceive,fundPregnancy,beginLabor,finishLabor,embryoRemains} from './pregnancy.js';
import {PHYSIOLOGY_ACTIONS,candidateKey,processTiming,startProcess,canConceive,inventoryTotal,resolveAttacks,visibleBody,actionKind} from './physiology-actions.js';
import {temporalNavigation,prepareTemporalDecision,commitTemporalBrain,observeTime,accrueTemporalReward,sampleLife,compactTemporalAgents,finishTemporal} from './temporal-world.js';
import {moveLocally} from './navigation.js';
import {countOthers} from './neighbour-perception.js';
import {ACTION_TURNS} from './navigation.js';
import {key} from './simulation.js';
import {decisionCharge} from './brain-cost.js';
import {attentionRequest} from './attention-gate.js';
import {scaledBrainCost} from './brain-economy.js';
import {mutateGenome,RULES} from './evolution.js';
import {regrowFoodIslands} from './food-islands.js';
import {sampleFoodExposure} from './food-exposure.js';
import {advanceEnvironment} from './automatic-environment.js';

export function initializePhysiologyAgent(w,a,body=null){
 const genes=unpackDualBrain(a.genome);if(![18,19,20].includes(genes.layout.version))throw new Error('Нужен поддерживаемый геном тела.');
 a.bodyGenes=genes.body;a.bodyPlan=bodyPlan(genes.body);Object.assign(a,body??createBody(a.bodyPlan,w.physiology));
 a.bornSubtick=w.subtick??0;a.ageSteps=0;a.foodInventory=[0,0,0];a.carriedMeat=createMeat(0,w.subtick??0);
 a.digestion=createDigestion(a.bodyPlan.retentionSteps,w.subtick??0);a.pregnancy=null;a.brainDue=0;a.budget=budgetRecord();a.resting=false;
 if(w.childCare){a.carrierId=null;a.carryingChildId=null;a.carryStarted=null;a.carryDue=null;a.life.care=careRecord();}
 a.life.actions.push(0);if(w.childCare)a.life.actions.push(0);a.life.physiology={schema:'physiology-life-v1',samples:0,inventoryTotal:0,bodyMassTotal:0,maximumMassTotal:0,energyCapacityTotal:0,healthCapacityTotal:0,stomachVolumeTotal:0,pregnancyTime:0,laborTime:0,absorbed:[0,0,0],ingested:[0,0,0],basal:0,brain:0,motor:0,pregnancy:0,catabolized:0,growth:0,healing:0,overflow:0,excreted:0,attackDamage:0};
 syncBody(w,a);
}
export function initializePhysiologyWorld(w){
 if(w.childCare)w.stats.care=careRecord();
 const r=w.physiology;w._growingGrass=new Set();w.foodEnergies=foodEnergies(r);w._meatTiles=new Set();w._physById=new Map(w.agents.map(a=>[a.id,a]));
 for(let i=0;i<w.tiles.length;i++){const c=w.tiles[i];c.grass=c.terrain==='land'?createGrass(w.foodSeed,i,0,r):null;c.looseGrass=0;c.meat=createMeat();}
 w._groundFood=w.tiles.reduce((s,c)=>s+(c.grass?.amount??0)+c.food,0);
 for(const name of ['actions','started','completed','interrupted'])w.stats[name]=Array(w.childCare?13:12).fill(0);
 w.stats.physiology={absorbed:[0,0,0],ingested:[0,0,0],basal:0,brain:0,motor:0,pregnancy:0,catabolized:0,growth:0,healing:0,overflow:0,excreted:0,attackDamage:0,spoiledMeat:0,conceptions:0,stillbirths:0};
 Object.assign(w.stats.physiology,{initialMass:w.agents.reduce((s,a)=>s+a.L,0),initialEnergy:w.agents.reduce((s,a)=>s+a.energy,0),initialFoodEnergy:w.tiles.reduce((s,c)=>s+(c.grass?.amount??0)*w.foodEnergies[0]+c.food*w.foodEnergies[1],0),newbornEnergy:0,bornMass:0,deathEnergy:0,deadMass:0,catabolicEnergy:0,mandatoryPaid:0,growthCost:0,regrown:[0,0,0],createdMeat:0,discardedEnergy:0});
 w._physNextFruit=w.individualFood?Math.min(Infinity,...w.foodIslands.map(g=>g.nextTick)):w.nextFoodRegrowth();
 w._physEnvironment=w.environmentRevision;w._physActivities=new Map();w._physActivityEpoch=-1;
}
export function syncBody(w,a){
 const c=bodyCapacities(a,w.physiology);a.referenceMass=w.physiology.referenceMass;a.energyCapacity=c.energy;a.healthCapacity=c.health;a.stomachCapacity=c.volume;
 a.stomach=a.digestion.volume;a.inventory=inventoryTotal(a);
}
function groundFoods(w,c){return [c.looseGrass+(c.grass?grassAmount(c.grass,w.subtick,w.physiology):0),c.food,meatAmount(c.meat)];}
function rebuildSnapshot(w){
 w._physActivities.clear();const attacks=new Map();for(const a of w.agents)if(a.alive&&a.process?.action===11){const target=w._physById.get(a.process.targetHandle);if(target?.alive&&target.x===a.x&&target.y===a.y)attacks.set(target.id,(attacks.get(target.id)??0)+1);}
 for(const a of w.agents){
  if(!a.alive)continue;
  const at=key(a.x,a.y);let row=w._physActivities.get(at);if(!row){row=new Float64Array(w.childCare?15:13);w._physActivities.set(at,row);}
  const action=a.carrierId!=null?14:a.pregnancy?.stage==='labor'?12:a.process?.action===12?13:a.process?.action??8;
  row[action<6?(a.frameRotation+a.brain.facing+ACTION_TURNS[action])%6:action]++;
  if(w.childCare)a._careVisible=visibleCare(w,a);a.visibleAttacks=attacks.get(a.id)??0;a._physVisible=visibleBody(a,w.physiology);
 }
 w._physActivityEpoch=w._viewEpoch;
}
export function physiologyCells(w,a){
 if(w._physActivityEpoch!==w._viewEpoch)rebuildSnapshot(w);
 const n=temporalNavigation(a),places=[a.brain.position,...n.neighbours],world=[a,...n.destinations],cells=[];
 for(let i=0;i<places.length;i++){
  const c=w.tile(world[i].x,world[i].y);if(!c)continue;
  const foods=groundFoods(w,c),row=w._physActivities.get(key(c.x,c.y)),activities=new Float64Array(w.childCare?15:13),own=i===0;
  const v=a._physVisible,rotation=(a.frameRotation+a.brain.facing)%6;
  for(let j=0;j<activities.length;j++){const category=j<6?(rotation+ACTION_TURNS[j])%6:j;activities[j]=(row?.[category]??0)-Number(own&&(j<6?v.action===j:v.action===(j===12?'labor':j===13?12:j===14?'carried':j)));}
  cells.push({...places[i],food:foods[0]+foods[1]+foods[2],foods,terrain:c.terrain,isFoodSource:c.maxFood>0,neighbours:countOthers(w.occupancy,a,c.x,c.y),activities});
 }
 a._cells=cells;return cells;
}
export function physiologyObservation(w,a,cells=physiologyCells(w,a)){
 const p=a.process,gestation=a.pregnancy,c=bodyCapacities(a,w.physiology),place=p?.localDestination??a.brain.position;
 return {body:{...(w.childCare?{child:visibleCare(w,a)}:{}),energy:a.energy,health:a.health,inventory:a.inventory,stomach:a.stomach,L:a.L,M:a.M,age:a.ageSteps,adultSteps:a.bodyPlan.adultSteps,foodInventory:a.foodInventory.slice(),pregnant:!!gestation,labor:gestation?.stage==='labor',pregnancyPaid:gestation?gestation.paid/gestation.cost:0,pregnancyProgress:gestation?Math.min(1,(w.subtick-gestation.conceivedAt)/gestation.steps):0},
 capacities:{energy:c.energy,health:c.health,inventory:w.physiology.inventoryCapacity,stomach:c.volume,referenceMass:w.physiology.referenceMass},position:{...a.brain.position},currentFood:cells[0].food>0,previousAction:a.lastAction,tick:w.tick,memoryEnabled:w.memoryEnabled,learningEnabled:w.learningEnabled,cells,
 process:p?{action:p.action,foodType:p.foodType,active:true,progress:p.elapsed/p.duration,remaining:p.duration-p.elapsed,localDestination:place,cell:cells.find(c=>c.q===place.q&&c.r===place.r),visibleTarget:visibleTarget(w,a,p.targetHandle)}:null,callReason:a.callReason??CALL_COMPLETE};
}
function visibleTarget(w,a,handle){
 const other=w._physById.get(handle);if(!other?.alive||other.x!==a.x||other.y!==a.y)return null;
 const v=other._physVisible??visibleBody(other,w.physiology);
 return {size:v.size,health:v.health,action:v.action,attacksMe:v.attackTarget===a.id,attacksOther:v.attackTarget!==null&&v.attackTarget!==a.id};
}
export function physiologyBirthAvailability(w,a){
 const blocked=[];if(!a.alive)blocked.push('terminal');if(a.ageSteps<a.bodyPlan.conceptionSteps)blocked.push('immature');if(a.pregnancy)blocked.push('inProgress');if(a.carryingChildId!=null||a.carrierId!=null)blocked.push('care');if(w.agents.length>=w.limit)blocked.push('limit');return {eligible:!blocked.length,blocked};
}
export function physiologyFrame(w,a,withExecution=true){
 const observation=physiologyObservation(w,a),candidates=[],n=temporalNavigation(a),r=w.physiology,executionDestinations=withExecution?new Map():null;
 const add=(action,foodType=null,targetHandle=null)=>{
  const place=action<6?n.neighbours[action]:a.brain.position,cell=observation.cells.find(c=>c.q===place.q&&c.r===place.r);if(!cell)return;
  const id=candidateKey(action,foodType,targetHandle),continuation=a.process?.id===id,repeat=a.lastProcess?.id===id||action===8&&a.resting;
  const label=(w.childCare?CARE_ACTIONS:PHYSIOLOGY_ACTIONS)[action]+(foodType!==null?' — '+['трава','плоды','мясо'][foodType]:targetHandle!==null?' — житель №'+targetHandle:'');
  const candidate={id,action,foodType,targetHandle,visibleTarget:targetHandle===null?null:visibleTarget(w,a,targetHandle),label,localDestination:{...place},cell,continuation:!!continuation,repeat:!!repeat,decisionCost:repeat?REPEAT_COST:DECISION_COST,duration:0};
  candidate.duration=continuation?a.process.duration-a.process.elapsed:processTiming(a,candidate,r).steps;candidates.push(candidate);
  executionDestinations?.set(id,{action,foodType,targetHandle,localDestination:{...place},destination:action<6?{...n.destinations[action]}:{x:a.x,y:a.y}});
 };
 if(a.alive&&a.carrierId==null&&a.pregnancy?.stage!=='labor'){
  for(let action=0;action<6;action++){const c=w.tile(n.destinations[action].x,n.destinations[action].y);if(c&&c.terrain!=='water')add(action);}
  const foods=observation.cells[0].foods;
  for(let type=0;type<3;type++){
   if(a.inventory<r.inventoryCapacity&&foods[type]>0)add(6,type);
   if(w.childCare&&a.foodInventory[type]>0&&carriedChild(w,a)?.alive)add(12,type,a.carryingChildId);
   if(a.foodInventory[type]>0&&a.stomach<a.stomachCapacity)add(7,type);
   if(a.foodInventory[type]>0&&(type===2||foods[type]<RULES.groundFoodCapacity))add(10,type);
  }
  add(8);if(canConceive(a,w.agents.length,w.limit))add(9);
  for(const id of [...(w.occupancy.cells.get(key(a.x,a.y))??[])].sort((a,b)=>a-b))if(id!==a.id&&w._physById.get(id)?.alive)add(11,null,id);
 }
 const request={schema:w.childCare?'local-body-food-care-v1':'local-body-food-target-v1',observation,candidates};
 const decision={frame:{request}};for(const c of candidates)c.computeCharge=decisionCharge(a.brain,decision,c.decisionCost);
 return {request,executionDestinations};
}
function interrupt(w,a,reason='physical'){
 const p=a.process;if(!p)return;
 w.stats.interrupted[p.action]++;a.life.observer.interruptions[reason]++;a.lastProcess=p;a.process=null;a.callReason=CALL_FAILED;
}
export function chargePhysiologyBrain(w,a,kind,cost){
 const paid=scaledBrainCost(cost,w.brainCostMultiplier);if(!Number.isFinite(paid)||paid<0)throw new Error('Неконечная цена мозга.');a.brainDue+=paid;
 const o=a.life.observer;o[kind]=(o[kind]??0)+paid;
 if(kind!=='attentionEnergyCost')o.brainEnergyCost=(o.brainEnergyCost??0)+paid;
 if(kind==='attentionEnergyCost')w.stats.attentionSpent=(w.stats.attentionSpent??0)+paid;else w.stats.brainSpent+=paid;
}
export function commitPhysiologyChoice(w,a,decision,choice,beforeFeeling,recordBrain=true){
 chargePhysiologyBrain(w,a,'mainDecisionEnergyCost',choice.computeCharge??decisionCharge(a.brain,decision,choice.decisionCost));chargePhysiologyBrain(w,a,'learningEnergyCost',a.brain.learningCharge??0);a.brain.learningCharge=0;
 w.stats.brainCalls++;a.life.observer.brainCalls++;
 if(a.callReason===CALL_REVIEW){w.stats.reviews++;a.life.observer.reviews++;}
 if(!choice.continuation){if(a.process)interrupt(w,a,'voluntary');a.process=startProcess(a,choice,w.subtick,w.physiology);if(a.process){w.stats.started[choice.action]++;w.stats.actions[choice.action]++;}}
 a.resting=choice.action===8;a.lastAction=choice.action;a.callReason=CALL_COMPLETE;
 a.brain.lastDecisionSubtick=w.subtick;
 if(recordBrain)commitTemporalBrain(w,a,decision,choice,beforeFeeling);
}
export function preparePhysiologyBoundary(w){
 // Проверка порядка не выделяет массив на каждый подшаг. Рождения идут по ID;
 // импорт/внешняя перестановка канонизируются один раз перед общей фазой.
 for(let i=1;i<w.agents.length;i++)if(w.agents[i-1].id>w.agents[i].id){w.agents.sort((a,b)=>a.id-b.id);break;}
 w._physById=new Map(w.agents.map(a=>[a.id,a]));rebuildSnapshot(w);
}
export function preparePhysiologyCognition(w){
 preparePhysiologyBoundary(w);const requests=[];
 for(const a of w.agents){
  if(!a.alive||a.readyAt>w.subtick)continue;
  const cells=physiologyCells(w,a);
  if(w.memoryEnabled)observeTime(w,a,cells,w._primed?DT:0);
  if(w._primed){accrueTemporalReward(w,a);sampleLife(w,a);}
  if(a.carrierId!=null||a.pregnancy?.stage==='labor')continue;
  let wants=!a.process&&!a.resting;
  if(!wants){w.stats.gateCalls++;a.life.observer.attentionCalls++;wants=attentionRequest(a,cells,w.physiology.inventoryCapacity,a.stomachCapacity,w.subtick);chargePhysiologyBrain(w,a,'attentionEnergyCost',a.brain.gateCharge);if(wants)a.callReason=CALL_REVIEW;}
  if(wants)requests.push(a);
 }
 return requests;
}
export function physiologyDecisions(w){
 const prepared=preparePhysiologyCognition(w).map(a=>{const decision=prepareTemporalDecision(w,a);w.recordBirthDecision(a);return {a,decision,beforeFeeling:w.feeling(a),choice:w.choose(a,decision)};});
 for(const p of prepared)commitPhysiologyChoice(w,p.a,p.decision,p.choice,p.beforeFeeling);
 w._primed=true;
}
function advanceResources(w){
 const regrownBefore=w.stats.regrown;advanceEnvironment(w);
 if(w._physEnvironment!==w.environmentRevision){w._physEnvironment=w.environmentRevision; w._physNextFruit=w.individualFood?Math.min(Infinity,...w.foodIslands.map(g=>g.nextTick)):w.nextFoodRegrowth();}
 if(w.tick+1e-9>=w._physNextFruit){if(w.individualFood)regrowFoodIslands(w);else for(const c of w.tiles)if(c.food<c.maxFood){c.food++;w.stats.regrown++;} w._physNextFruit=w.individualFood?Math.min(Infinity,...w.foodIslands.map(g=>g.nextTick)):w.nextFoodRegrowth();}
 w.stats.physiology.regrown[1]+=w.stats.regrown-regrownBefore;w._groundFood+=w.stats.regrown-regrownBefore;
 for(const index of w._growingGrass){const c=w.tiles[index],before=grassAmount(c.grass,w.subtick-1,w.physiology),now=grassAmount(c.grass,w.subtick,w.physiology);w._groundFood+=now-before;if(now>=c.grass.maximum)w._growingGrass.delete(index);}
 for(const index of [...w._meatTiles].sort((a,b)=>a-b)){const c=w.tiles[index];const lost=decayMeat(c.meat,w.subtick,w.random,w.physiology);w.stats.physiology.spoiledMeat+=lost;w._groundFood-=lost;if(!meatAmount(c.meat))w._meatTiles.delete(index);}
 for(const a of w.agents){if(w.childCare)for(const record of [a.life.care,w.stats.care]){record.carriedTime+=Number(a.carrierId!==null)*DT;record.carryingTime+=Number(a.carryingChildId!==null)*DT;}w.stats.physiology.spoiledMeat+=decayMeat(a.carriedMeat,w.subtick,w.random,w.physiology);a.foodInventory[2]=meatAmount(a.carriedMeat);syncBody(w,a);}
}
function putMeat(w,c,amount){
 if(!amount)return;decayMeat(c.meat,w.subtick,w.random,w.physiology);addMeat(c.meat,amount,w.subtick);w._groundFood+=amount;w._meatTiles.add(c.y*(w.tiles.at(-1).x+1)+c.x);
}
export function physiologyDeath(w,a){
 careDeath(w,a);const c=w.tile(a.x,a.y);interrupt(w,a,'death');
 const created=remainsMass(a,w.physiology)+embryoRemains(a.pregnancy,w.physiology);w.stats.physiology.createdMeat+=created;w.stats.physiology.deathEnergy+=a.energy;w.stats.physiology.deadMass+=a.L;w.stats.physiology.discardedEnergy+=a.digestion.remaining.reduce((s,v)=>s+v,0);
 putMeat(w,c,created+a.foodInventory[2]);c.looseGrass+=a.foodInventory[0];c.food+=a.foodInventory[1];w._groundFood+=a.foodInventory[0]+a.foodInventory[1];
 a.pregnancy=null;a.foodInventory.fill(0);a.inventory=0;a.brain.pending=null;
}
function completed(w,a){const p=a.process;if(!p)return;w.stats.completed[p.action]++;a.life.actions[p.action]++;a.life.moved+=Number(p.action<6);a.life.gathered+=Number(p.action===6);a.life.eaten+=Number(p.action===7);a.life.deposited+=Number(p.action===10);a.lastProcess=p;a.process=null;a.callReason=CALL_COMPLETE;}
function takeGround(w,c,type,max){
 if(type===2)return takeMeat(c.meat,max);
 if(type===1){const n=Math.min(c.food,max);c.food-=n;return n;}
 const loose=Math.min(c.looseGrass,max);c.looseGrass-=loose;if(!c.grass)return loose;const grown=takeGrass(c.grass,max-loose,w.subtick,w.physiology);w.stats.physiology.regrown[0]+=grown.regrown;if(c.grass.amount<c.grass.maximum)w._growingGrass.add(c.y*(w.tiles.at(-1).x+1)+c.x);return loose+grown.amount;
}
function completeOther(w,a){
 const p=a.process;if(!p||!a.alive)return;const c=w.tile(a.x,a.y),r=w.physiology,type=p.foodType;
 if(p.action===6){const n=takeGround(w,c,type,Math.min(r.portionPerAction,r.inventoryCapacity-a.inventory));if(n<=0){interrupt(w,a);return;}w._groundFood-=n;a.foodInventory[type]+=n;if(type===2)addMeat(a.carriedMeat,n,w.subtick);w.stats.gathered+=n;}
 else if(p.action===7){const result=ingestFood(a.digestion,type,a.foodInventory[type],a.stomachCapacity,w.foodEnergies);if(!result.started){interrupt(w,a);return;}a.foodInventory[type]-=result.started;if(type===2)takeMeat(a.carriedMeat,result.started);w.stats.eaten+=result.started;w.stats.discardedFood+=result.discarded;w.stats.physiology.discardedEnergy+=result.discarded*w.foodEnergies[type];a.life.physiology.ingested[type]+=result.swallowed;w.stats.physiology.ingested[type]+=result.swallowed;const life=a.life;life.maxMealGap=Math.max(life.maxMealGap,a.age-(life.lastMealAge??0));life.firstMealAge??=a.age;life.lastMealAge=a.age;}
 else if(p.action===12){
  const child=carriedChild(w,a);a.life.care.feedAttempts++;w.stats.care.feedAttempts++;
  if(!child?.alive||child.id!==p.targetHandle||child.carrierId!==a.id){interrupt(w,a);return;}
  const meal=ingestFood(child.digestion,type,a.foodInventory[type],child.stomachCapacity,w.foodEnergies);if(!meal.started){interrupt(w,a);return;}
  a.foodInventory[type]-=meal.started;if(type===2)takeMeat(a.carriedMeat,meal.started);w.stats.eaten+=meal.started;child.life.physiology.ingested[type]+=meal.swallowed;w.stats.physiology.ingested[type]+=meal.swallowed;
  a.life.care.fed[type]+=meal.swallowed;child.life.care.received[type]+=meal.swallowed;w.stats.care.fed[type]+=meal.swallowed;w.stats.care.received[type]+=meal.swallowed;
  child.life.firstMealAge??=child.age;child.life.maxMealGap=Math.max(child.life.maxMealGap,child.age-(child.life.lastMealAge??0));child.life.lastMealAge=child.age;syncBody(w,child);
 }
 else if(p.action===10){const available=type===2?Infinity:Math.max(0,RULES.groundFoodCapacity-groundFoods(w,c)[type]),n=Math.min(r.portionPerAction,a.foodInventory[type],available);if(n<=0){interrupt(w,a);return;}a.foodInventory[type]-=n;if(type===2){takeMeat(a.carriedMeat,n);putMeat(w,c,n);}else if(type===0){c.looseGrass+=n;w._groundFood+=n;}else{c.food+=n;w._groundFood+=n;}w.stats.deposited=(w.stats.deposited??0)+n;}
 else if(p.action===9){
  if(!canConceive(a,w.agents.length,w.limit)){interrupt(w,a);return;}
  const genes=w.mutations?mutateGenome(a.genome,w.random,w.mutationRate,.7,w.cognitiveRandom,w.bodyRandom,w.neuralRandom,w):a.genome.slice();
  a.pregnancy=conceive(genes,unpackDualBrain(genes).body,a.bodyPlan,w.subtick,r);w.stats.physiology.conceptions++;
 }
 syncBody(w,a);completed(w,a);
}
function recordBudget(w,a){
 const b=a.budget,p=a.life.physiology;p.samples+=DT;p.inventoryTotal+=a.inventory*DT;p.bodyMassTotal+=a.L*DT;p.maximumMassTotal+=a.M*DT;p.energyCapacityTotal+=a.L*w.physiology.energyPerMass*DT;p.healthCapacityTotal+=a.L*w.physiology.healthPerMass*DT;p.stomachVolumeTotal+=a.stomachCapacity*DT;p.pregnancyTime+=Number(!!a.pregnancy)*DT;p.laborTime+=Number(a.pregnancy?.stage==='labor')*DT;
 for(const out of [a.life.physiology,w.stats.physiology])for(const name of ['basal','brain','motor','pregnancy','catabolized','growth','healing','overflow'])out[name]+=b[name];
 w.stats.physiology.catabolicEnergy+=b.catabolicEnergy;w.stats.physiology.mandatoryPaid+=b.mandatoryPaid;w.stats.physiology.growthCost+=b.growth*w.physiology.tissueEnergy/w.physiology.synthesisEfficiency;
 w.stats.digested+=b.absorbed;w.stats.overflow+=b.overflow;w.stats.actionSpent+=b.motor;w.stats.birthSpent+=b.pregnancy;
}
export function advancePhysiologyBodies(w,onDeath=null){
 sampleFoodExposure(w,w._groundFood);w.subtick++;w.tick=w.subtick/SUBSTEPS;advanceResources(w);
 const due=[],labor=[];
 for(const a of w.agents){
  a.ageSteps=w.subtick-a.bornSubtick;a.age=a.ageSteps/SUBSTEPS;
  const load=w.childCare&&a.process?.action<6?(carriedChild(w,a)?.L??0):0;
  const g=a.bodyPlan,motor=a.process?(a.process.action===11?a.process.motor:motorRate(a,actionKind(a.process.action),w.physiology)*DT+(a.process.action<6?w.physiology.moveRate*load/w.physiology.referenceMass*DT:0)):0;
  const absorbed=advanceDigestion(a.digestion,w.subtick,a.stomachCapacity,[g.Fg,g.Ff,g.Fm],w.foodEnergies);
  for(let j=0;j<3;j++){a.life.physiology.absorbed[j]+=a.digestion.absorbed[j];w.stats.physiology.absorbed[j]+=a.digestion.absorbed[j];}
  const excreted=a.digestion.excretedEnergy;a.life.physiology.excreted+=excreted;w.stats.physiology.excreted+=excreted;
  beginBodyInterval(a,g,absorbed,a.brainDue,w.physiology,a.budget);a.brainDue=0;
  if(a.health<=0){recordBudget(w,a);w.die(a,'starvation');onDeath?.(a);continue;}
  if(a.pregnancy?.stage==='labor'){if(w.subtick>=a.pregnancy.laborDue)labor.push(a);}
  else if(a.process){if(payMotorInterval(a,motor,a.budget)){a.process.elapsed++;if(a.process.elapsed>=a.process.duration)due.push(a);}else interrupt(w,a);}
  else if(a.resting)a.life.observer.restTime+=DT;
  if(a.pregnancy?.stage==='gestation')fundPregnancy(a,w.subtick,a.budget);
  finishBodyInterval(a,g,a.ageSteps,w.physiology,a.budget);syncBody(w,a);recordBudget(w,a);
  const bins=a.life.observer.inventorySubsteps;bins[Math.min(bins.length-1,Math.floor(a.inventory))]++;
 }
 // Перемещение — единая фаза, поэтому убежавшая жертва не получает удар.
 for(const a of due)if(a.alive&&a.process?.action<6){if(w.childCare)moveCarriedChild(w,a,a.process.destination);w.moveAgent(a,a.process.destination);moveLocally(a.brain,a.process.action);completed(w,a);}
 const hits=resolveAttacks(due.filter(a=>a.alive&&a.process?.action===11),w._physById,w.physiology);
 for(const hit of hits){hit.attacker.life.physiology.attackDamage+=hit.damage;w.stats.physiology.attackDamage+=hit.damage;if(hit.target)completed(w,hit.attacker);else interrupt(w,hit.attacker);}
 for(const a of w.agents)if(a.alive&&a.health<=0){w.die(a,'attack');onDeath?.(a);}
 compactTemporalAgents(w);releaseDueChildren(w);
 // Общая жеребьёвка завершений убирает преимущество раннего ID при сборе
 // и ограничении зачатий. Состав задан каноническими ID до бросков RNG.
 const other=due.filter(a=>a.alive&&a.process&&a.process.action!==11);
 for(let i=other.length-1;i>0;i--){const j=Math.floor(w.random.next()*(i+1));[other[i],other[j]]=[other[j],other[i]];}
 for(const a of other)completeOther(w,a);
 for(const a of labor)if(a.alive){
  const birth=finishLabor(a,w.subtick,w.physiology);if(birth?.body){const child=w.addAgent(a,birth.genome,a,birth.body);child.readyAt=w.subtick;w.stats.physiology.newbornEnergy+=child.energy;w.stats.physiology.bornMass+=child.L;w._physById.set(child.id,child);attachChild(w,a,child);a.children++;a.life.firstBirthAge??=a.age;a.life.reproduction.births++;w.stats.reproduction.births++;w.stats.births++;}else w.stats.physiology.stillbirths++;
  a.resting=false;a.callReason=CALL_COMPLETE;
 }
 for(const a of w.agents)if(beginLabor(a,w.subtick,w.physiology)){interrupt(w,a,'physical');a.resting=false;}
 w._viewEpoch++;
}
export function advancePhysiology(w){if(!w.agents.length)return;physiologyDecisions(w);advancePhysiologyBodies(w);finishTemporal(w);}
