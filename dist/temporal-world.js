/** Фазы однопоточного мираv13. Время — целые подшаги, внешнееtick — Т.
 * Локальный геометрический след пересчитывается только после перемещения;
 * текущие количества считываются один раз на границу и переиспользуются. */
import {RULES,actionEnergyCost,WORLD_WIDTH,mutateGenome} from './evolution.js';
import {ACTIONS} from './action-catalog.js';
import {ACTION_DURATIONS,DT,DECISION_COST,REPEAT_COST,CALL_COMPLETE,CALL_REVIEW,CALL_FAILED} from './action-timing.js';
import {localNeighbours,memoryWorldPosition,moveLocally} from './navigation.js';
import {countOthers} from './neighbour-perception.js';
import {observe,rememberDecision,rememberExperience} from './cognition.js';
import {rememberAttention,attentionRequest} from './attention-gate.js';
import {learnSetBrain} from './temporal-brain.js';
import {beginComputeGroup,endComputeGroup} from './performance-probe.js';
import {cloneSetInput} from './set-brain-inputs.js';
import {regrowFoodIslands} from './food-islands.js';
import {ACTIVITY_COUNT,rebuildActivities,sampleActivities} from './activity-perception.js';
import {createFoodExposure,sampleFoodExposure} from './food-exposure.js';
import {spendEnergy as spend} from './energy-budget.js';
import {advanceEnvironment} from './automatic-environment.js';

export function initializeTemporal(w){
 w.foodExposure=createFoodExposure();
 w.subtick=0;w._primed=false;w._due=[];w._gatherGroups=new Map();w._touched=[];w._viewEpoch=0;
 w.stats.started=Array(11).fill(0);w.stats.completed=Array(11).fill(0);w.stats.interrupted=Array(11).fill(0);w.stats.brainCalls=0;w.stats.gateCalls=0;w.stats.reviews=0;w.stats.brainSpent=0;w.stats.actionSpent=0;
 delete w.stats.injuries;delete w.stats.deathsByCause.injury;delete w.lifeHistory.byCause.injury;
 for(const g of [w.lifeHistory.all,w.lifeHistory.founders,w.lifeHistory.descendants,...Object.values(w.lifeHistory.byCause)])delete g.causes.injury;
 for(const c of w.tiles)delete c.risk;
 for(const a of w.agents){a.bornSubtick=0;sampleCells(w,a);}
 resetFoodCalendar(w);
}
function resetFoodCalendar(w){w._foodRevision=w.environmentRevision;w._nextGrowth=w.individualFood?Math.min(...w.foodIslands.map(g=>g.nextTick)):w.nextFoodRegrowth();}
export function sampleCells(w,a){
 if(!a._cells||a._footX!==a.x||a._footY!==a.y||a._footQ!==a.brain.position.q||a._footR!==a.brain.position.r){
  a._cells=[];a._tiles=[];
  for(const p of [a.brain.position,...localNeighbours(a.brain)]){const pos=memoryWorldPosition(a,p),c=w.tile(pos.x,pos.y);if(c){a._tiles.push(c);a._cells.push({q:p.q,r:p.r,food:0,isFoodSource:false,terrain:c.terrain,neighbours:0,activities:new Float64Array(ACTIVITY_COUNT)});}}
  a._footX=a.x;a._footY=a.y;a._footQ=a.brain.position.q;a._footR=a.brain.position.r;a._sampleEpoch=-1;
 }
 if(a._sampleEpoch!==w._viewEpoch||a._sampleEnvironment!==w.environmentRevision||a._sampleActivityRevision!==w._activities?.revision||a._sampleFacing!==a.brain.facing){
  for(let i=0;i<a._cells.length;i++){const v=a._cells[i],c=a._tiles[i];v.food=c.food;v.isFoodSource=c.maxFood>0;v.neighbours=countOthers(w.occupancy,a,c.x,c.y);sampleActivities(w,a,c,v.activities);}
  a._sampleEpoch=w._viewEpoch;a._sampleEnvironment=w.environmentRevision;a._sampleActivityRevision=w._activities.revision;a._sampleFacing=a.brain.facing;
 }
 return a._cells;
}
export function temporalBirthAvailability(w,a){
 const blocked=[];if(a.energy<w.reproduction.energy)blocked.push('energy');if(a.health<w.reproduction.health)blocked.push('health');if(a.age<RULES.maturity)blocked.push('immature');if(a.age-a.lastBirthAge<RULES.birthInterval-1e-9)blocked.push('interval');if(w.agents.length>=w.limit)blocked.push('limit');if(!a.alive||a.age>=RULES.maxAge)blocked.push('terminal');if(a.process?.action===9)blocked.push('inProgress');return {eligible:blocked.length===0,blocked};
}
function processView(w,a,cells){
 const p=a.process??a.lastProcess,place=p?.localDestination??a.brain.position,cell=cells.find(c=>c.q===place.q&&c.r===place.r);
 return {action:p?.action??8,active:Boolean(a.process),progress:p?p.elapsed/p.duration:1,remaining:a.process?p.duration-p.elapsed:0,localDestination:place,cell};
}
export function localTemporalObservation(w,a,cells){return {body:{energy:a.energy,health:a.health,inventory:a.inventory,stomach:a.stomach},capacities:{inventory:RULES.inventoryCapacity,stomach:RULES.stomachCapacity},position:{...a.brain.position},currentFood:cells[0].food>0,previousAction:a.lastAction,tick:w.tick,memoryEnabled:w.memoryEnabled,learningEnabled:w.learningEnabled,cells,process:processView(w,a,cells),callReason:a.callReason??CALL_COMPLETE};}
export function temporalObservation(w,a){return localTemporalObservation(w,a,sampleCells(w,a));}
function sameActivity(a,action,place){const p=a.lastProcess;if(!p||p.action>=6||action>=6)return p?.action===action;return place.q-a.brain.position.q===p.direction.q&&place.r-a.brain.position.r===p.direction.r;}
function physical(w,a,action,destination,ending=false){
 const c=w.tile(destination.x,destination.y);if(action<6)return Boolean(c&&c.terrain!=='water');
 if(action===6)return a.inventory<RULES.inventoryCapacity&&w.tile(a.x,a.y).food>0;
 if(action===7)return a.inventory>0&&a.stomach<=RULES.stomachCapacity-RULES.foodEnergy+1e-9;
 if(action===10)return w.canDeposit(a);
 if(action===9)return ending?a.alive&&a.energy>=RULES.birthCost:temporalBirthAvailability(w,a).eligible;
 return true;
}
// Кэш только геометрии: при перемещении/повороте/телепортации ключ меняется.
// Доступность и пища никогда не кэшируются между подшагами.
const navigation=new WeakMap();
export function temporalNavigation(a){
 let n=navigation.get(a);const b=a.brain;
 if(!n||n.x!==a.x||n.y!==a.y||n.rotation!==a.frameRotation||n.q!==b.position.q||n.r!==b.position.r||n.facing!==b.facing){
  const neighbours=localNeighbours(b);n={x:a.x,y:a.y,rotation:a.frameRotation,q:b.position.q,r:b.position.r,facing:b.facing,neighbours,destinations:neighbours.map(p=>memoryWorldPosition(a,p))};navigation.set(a,n);
 }
 return n;
}
export function temporalAvailableMask(w,a){
 if(!a.alive||a.process?.action===9)return 0;
 const n=temporalNavigation(a);let mask=0;
 for(let action=0;action<11;action++)if(!(action===9&&w.reproduction.automatic)&&physical(w,a,action,action<6?n.destinations[action]:a))mask|=1<<action;
 return mask;
}
export function localTemporalFrame(a,observation,mask){
 const candidates=[],neighbours=temporalNavigation(a).neighbours;
  for(let action=0;action<11;action++){
   if(!(mask&(1<<action)))continue;
   const candidate=temporalCandidate(a,observation,action,neighbours);if(candidate)candidates.push(candidate);
  }
 return {schema:'local-decision-v1',observation,candidates};
}
function temporalCandidate(a,observation,action,neighbours=temporalNavigation(a).neighbours){
   const cells=observation.cells,place=action<6?neighbours[action]:a.brain.position;
   const continuation=Boolean(a.process&&a.process.action===action&&(action>=6||place.q===a.process.localDestination.q&&place.r===a.process.localDestination.r));
   const cell=cells.find(c=>c.q===place.q&&c.r===place.r);if(!cell)return null;
   const repeat=a.callReason===CALL_COMPLETE&&sameActivity(a,action,place),decisionCost=repeat?REPEAT_COST:DECISION_COST,id=`action-${action}`;
   return {id,action,label:ACTIONS[action],localDestination:{q:place.q,r:place.r},cell,continuation,repeat,decisionCost,duration:continuation?a.process.duration-a.process.elapsed:ACTION_DURATIONS[action]};
}
export function temporalSelectedChoice(w,a,action){
 const destination=action<6?temporalNavigation(a).destinations[action]:a;
 if(!a.alive||a.process?.action===9||action===9&&w.reproduction.automatic||!physical(w,a,action,destination))throw new Error('Действие недоступно на общей границе.');
 const candidate=temporalCandidate(a,temporalObservation(w,a),action);if(!candidate)throw new Error('Нет наблюдаемой цели действия.');
 return {...candidate,destination:action<6?{...temporalNavigation(a).destinations[action]}:{x:a.x,y:a.y}};
}
export function temporalFrame(w,a,withExecution=true){
 const request=localTemporalFrame(a,temporalObservation(w,a),temporalAvailableMask(w,a)),executionDestinations=withExecution?new Map():null;
 if(withExecution)for(const c of request.candidates)executionDestinations.set(c.id,{action:c.action,destination:c.action<6?{...temporalNavigation(a).destinations[c.action]}:{x:a.x,y:a.y},localDestination:{...c.localDestination}});
 return {request,executionDestinations};
}
function fail(w,a,reason='physical'){const p=a.process;if(!p)return;w.stats.interrupted[p.action]++;if(a.life.observer)a.life.observer.interruptions[reason]++;a.lastProcess=p;a.process=null;a.callReason=CALL_FAILED;}
function complete(w,a){
 const p=a.process,action=p.action;if(!physical(w,a,action,p.destination,true)){fail(w,a);return;}
 if(action<6){w.moveAgent(a,p.destination);moveLocally(a.brain,action);a._sampleEpoch=-1;}
 else if(action===6){w.tile(a.x,a.y).food--;a.inventory++;w.stats.gathered++;}
 else if(action===7){a.inventory--;a.stomach+=RULES.foodEnergy;w.stats.eaten++;const c=a.life;c.maxMealGap=Math.max(c.maxMealGap,a.age-(c.lastMealAge??0));c.firstMealAge??=a.age;c.lastMealAge=a.age;}
 else if(action===10)w.depositFood(a);
 else if(action===9){
  // Конечная проверка намеренно не проверяетN/50/40 повторно.
  a.energy-=RULES.birthCost;w.stats.birthSpent+=RULES.birthCost-RULES.newbornEnergy;a.lastBirthAge=a.age;if(a.children===0)a.life.firstBirthAge=a.age;a.children++;w.stats.births++;a.life.reproduction.births++;w.stats.reproduction.births++;
  const genes=w.mutations?mutateGenome(a.genome,w.random,w.mutationRate,.7,w.cognitiveRandom,w.bodyRandom,w.neuralRandom):a.genome.slice();const child=w.addAgent(a,genes,a);child.bornSubtick=w.subtick;child.readyAt=w.subtick+1;
 }
 w.stats.completed[action]++;a.life.actions[action]++;a.life.moved+=Number(action<6);a.life.gathered+=Number(action===6);a.life.eaten+=Number(action===7);a.life.deposited+=Number(action===10);a.lastProcess=p;a.process=null;a.callReason=CALL_COMPLETE;
}
function ageExperience(a,tick){const b=a.brain,d=Math.max(0,tick-b.decayTime);if(!d)return;const retain=(1-b.traits.forgetting)**d;for(let i=0;i<b.networkDelta.length;i++)b.networkDelta[i]*=retain;b.decayTime=tick;}
export function prepareTemporalDecision(w,a){
 const learningMark=beginComputeGroup('learning');let decision;
 try{
 const b=a.brain;if(w.learningEnabled)ageExperience(a,w.tick);
 if(b.pending&&w.memoryEnabled)rememberExperience(b,b.pending,w.feeling(a),w.tick);
 decision=w.prepareDecision(a);const pending=b.pending;
 if(pending&&w.learningEnabled){const nextValue=w.expectedContinuation(a,decision),elapsed=(w.subtick-pending.startSubtick)/10,reward=pending.sum+pending.discount*w.feeling(a)/100-pending.beforeFeeling/100;
  if(elapsed>0)learnSetBrain(b,pending.choice,{beforeFeeling:pending.beforeFeeling,afterFeeling:w.feeling(a),nextValue,terminal:false,tick:w.tick,reward,elapsed,temporal:true});}
 b.pending=null;
 }finally{endComputeGroup(learningMark);}
 return decision;
}
export function acceptTemporalChoice(w,a,choice){
 const b=a.brain;w.stats.brainCalls++;if(a.callReason===CALL_REVIEW)w.stats.reviews++;
 if(a.life.observer){a.life.observer.brainCalls++;a.life.observer.reviews+=Number(a.callReason===CALL_REVIEW);}
 // Вычисление уже состоялось, но смертельная оплата не начинает действие.
 spend(w,a,choice.decisionCost,true);
 if(a.health===0){fail(w,a,'death');w.die(a,'starvation');b.pending=null;return false;}
 if(!choice.continuation){if(a.process)fail(w,a,'voluntary');const direction=choice.action<6?{q:choice.localDestination.q-b.position.q,r:choice.localDestination.r-b.position.r}:null;a.process={action:choice.action,destination:choice.destination,localDestination:choice.localDestination,direction,duration:ACTION_DURATIONS[choice.action],elapsed:0};w.stats.started[choice.action]++;w.stats.actions[choice.action]++;if(choice.action===9){a.life.reproduction.chosen++;w.stats.reproduction.chosen++;}}
 a.lastAction=choice.action;
 a.callReason=CALL_COMPLETE;
 return true;
}
export function commitTemporalBrain(w,a,decision,choice,beforeFeeling){
 const b=a.brain;rememberAttention(a,decision.frame.request.observation.cells);
 if(w.memoryEnabled)rememberDecision(b,b.position,w.tick);
 if(w.learningEnabled||w.memoryEnabled)b.pending={choice:{id:choice.id,action:choice.action,row:0,features:choice.features.slice(),senses:choice.senses.slice(),place:{...b.position},batchInput:cloneSetInput(choice.batchInput)},beforeFeeling,startSubtick:w.subtick,sum:0,discount:1};
}
function decide(w,a){const decision=prepareTemporalDecision(w,a);w.recordBirthDecision(a);const beforeFeeling=w.feeling(a),choice=w.choose(a,decision);if(acceptTemporalChoice(w,a,choice))commitTemporalBrain(w,a,decision,choice,beforeFeeling);}
export function sampleLife(w,a){const c=a.life,f=w.feeling(a);c.samples+=DT;c.energyTotal+=a.energy*DT;c.healthTotal+=a.health*DT;c.hungerSteps+=Number(a.energy<30)*DT;c.emptyEnergySteps+=Number(a.energy===0)*DT;a.brain.feelingTotal+=f*DT;a.brain.feelingSamples+=DT;a.brain.wellbeing=f;w.lifeExposure.steps+=DT;w.lifeExposure.feelingTotal+=f*DT;}
export function compactTemporalAgents(w){let k=0;for(let i=0;i<w.agents.length;i++)if(w.agents[i].alive)w.agents[k++]=w.agents[i];w.agents.length=k;}
export function observeTime(w,a,cells,elapsed){const mark=beginComputeGroup('memory');try{observe(a.brain,cells,a.brain.position,w.tick,true,elapsed);}finally{endComputeGroup(mark);}}
export function accrueTemporalReward(w,a){const b=a.brain;if(b.pending){b.pending.sum+=b.pending.discount*b.timeReward.b*w.feeling(a)/100;b.pending.discount*=b.timeReward.q;}}
export function prepareTemporalAgent(w,a){if(a.readyAt>w.subtick)return null;if(a.process&&a.process.action!==9&&!physical(w,a,a.process.action,a.process.destination))fail(w,a);return sampleCells(w,a);}
/** Сначала все физические срывы, затем общий снимок деятельности. Никаких
 * решений между этими фазами: последовательный и параллельный пути видят одно. */
export function prepareTemporalBoundary(w){
 for(const a of w.agents)if(!(a.readyAt>w.subtick)&&a.process&&a.process.action!==9&&!physical(w,a,a.process.action,a.process.destination))fail(w,a);
 rebuildActivities(w);
}
export function advanceTemporal(w){
 if(!w.agents.length)return;
 if(!w._primed){prepareTemporalBoundary(w);for(const a of w.agents){const cells=sampleCells(w,a);if(w.memoryEnabled)observeTime(w,a,cells,0);decide(w,a);}compactTemporalAgents(w);w._primed=true;}
 if(!w.agents.length){finishTemporal(w);return;}
 advanceTemporalBodies(w);
 prepareTemporalBoundary(w);
 const count=w.agents.length;
 for(let i=0;i<count;i++){
  const a=w.agents[i],cells=prepareTemporalAgent(w,a);if(!cells)continue;
  if(w.memoryEnabled)observeTime(w,a,cells,DT);
  accrueTemporalReward(w,a);sampleLife(w,a);
  if(!a.process)decide(w,a);
  else if(a.process.action!==9){w.stats.gateCalls++;if(attentionRequest(a,cells,RULES.inventoryCapacity,RULES.stomachCapacity)){a.callReason=CALL_REVIEW;decide(w,a);}}
 }
 compactTemporalAgents(w);finishTemporal(w);
}
export function advanceTemporalBodies(w,onDeath=null){
 sampleFoodExposure(w);
 w.subtick++;w.tick=w.subtick/10;
 advanceEnvironment(w);
 if(w._foodRevision!==w.environmentRevision)resetFoodCalendar(w);
 if(w.tick+1e-9>=w._nextGrowth){if(w.individualFood)regrowFoodIslands(w);else for(const c of w.tiles)if(c.food<c.maxFood){c.food++;w.stats.regrown++;}resetFoodCalendar(w);}
 const due=w._due;due.length=0;
 for(const a of w.agents){
  a.age=(w.subtick-(a.bornSubtick??Math.round(a.born*10)))/10;
  if(a.life.observer)a.life.observer.inventorySubsteps[a.inventory]++;
  const amount=Math.min(a.stomach,RULES.digestionRate*DT),gain=Math.min(amount,100-a.energy);a.stomach-=amount;a.energy+=gain;w.stats.digested+=amount;w.stats.overflow+=amount-gain;
  if(a.process){if(a.process.action!==9)spend(w,a,actionEnergyCost(a.process.action)*DT);a.process.elapsed++;}
  if(a.health===0||a.age>=RULES.maxAge){fail(w,a,'death');sampleLife(w,a);w.die(a,a.health===0?'starvation':'age');a.brain.pending=null;onDeath?.(a);continue;}
  if(a.process&&a.process.elapsed>=a.process.duration)due.push(a);
 }
 compactTemporalAgents(w);
 // Сначала независимые завершения; жеребьёвка только при недостатке порций.
 const touched=w._touched;touched.length=0;
 for(const a of due){if(a.process.action!==6){complete(w,a);continue;}const key=a.y*WORLD_WIDTH+a.x;let group=w._gatherGroups.get(key);if(!group){group=[];w._gatherGroups.set(key,group);}if(!group.length)touched.push(group);group.push(a);}
 for(const group of touched){if(w.tile(group[0].x,group[0].y).food<group.length)for(let i=group.length-1;i>0;i--){const j=Math.floor(w.random.next()*(i+1));[group[i],group[j]]=[group[j],group[i]];}for(const a of group)complete(w,a);group.length=0;}
 w._viewEpoch++;
}
export function finishTemporal(w){
 if(w.subtick%100===0||!w.agents.length)w.record();
 if(w.records.size>6000){const keep=new Set();for(const a of w.agents){keep.add(a.id);keep.add(a.parentId);}for(const [id,r]of w.records){if(w.records.size<=5000)break;if(r.death!==null&&!keep.has(id))w.records.delete(id);}}
 if(!w.agents.length)w.log('Опыт завершён','Популяция вымерла. Автоматического возрождения нет.');
}
