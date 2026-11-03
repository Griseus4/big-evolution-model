/** Переменные списки вариантов протокола 5. Координатор хранит физические
 * адреса; владельцу нужны только наблюдения и непрозрачные ключи вариантов. */
import {prepareControllerDecision,evaluateController,expectedControllerValue,controllerFeeling,selectControllerDecision} from './brain-controller.js';
import {prepareTemporalDecision,commitTemporalBrain,observeTime,accrueTemporalReward,sampleLife} from './temporal-world.js';
import {preparePhysiologyBoundary,physiologyFrame,commitPhysiologyChoice,chargePhysiologyBrain} from './physiology-world.js';
import {attentionRequest} from './attention-gate.js';
import {decisionCharge} from './brain-cost.js';
import {DT,CALL_REVIEW} from './action-timing.js';
import {setCognitionSummary} from './cognition-summary.js';
import {memoryWorldPosition} from './navigation.js';

export function evaluateBodyCognition(owner,{rows,added=[],removed=[],retainedId=null,tick,subtick,primed,memoryEnabled,learningEnabled}){
 if(owner.batch)throw new Error('Предыдущие решения не подтверждены.');owner.register(added);
 if(owner.deadId!==null&&owner.deadId!==retainedId){owner.agents.delete(owner.deadId);owner.deadId=null;}
 for(const d of removed){const a=owner.agents.get(d.id);if(a&&d.id===retainedId){Object.assign(a.brain,d.feeling);a.brain.pending=null;a.dead=true;owner.deadId=d.id;}else owner.agents.delete(d.id);}
 const w={tick,subtick,memoryEnabled,learningEnabled,feeling:a=>controllerFeeling(a.brain,a,a.stomachCapacity),
  prepareDecision:a=>{const frame={request:a.request};return {frame,input:prepareControllerDecision(a.brain,frame.request)};},
  expectedContinuation:(a,d)=>expectedControllerValue(a.brain,null,d.frame.request,d.input)};
 const batch=[],results=[];
 for(const row of rows){
  const a=owner.agents.get(row.id);if(!a||a.dead||row.request.schema!=='local-body-food-target-v1')throw new Error('Неверный владелец/схема наблюдений.');
  Object.assign(a,row.state);a.pregnancy=row.request.observation.body.pregnant?{stage:row.labor?'labor':'gestation'}:null;Object.assign(a.brain,row.navigation);a.request=row.request;a.cells=row.request.observation.cells;
  if(memoryEnabled)observeTime(w,a,a.cells,primed?DT:0);if(primed)accrueTemporalReward(w,a);
  let gateCost=0,gate=false,wants=false;
  if(!row.labor){wants=!a.process&&!a.resting;if(!wants){gate=true;wants=attentionRequest(a,a.cells,row.request.observation.capacities.inventory,a.stomachCapacity,subtick);gateCost=a.brain.gateCharge;if(wants){a.callReason=CALL_REVIEW;a.request.observation.callReason=CALL_REVIEW;}}}
  let decision=null,options=null,beforeFeeling=null;
  if(wants){decision=prepareTemporalDecision(w,a);beforeFeeling=w.feeling(a);options=evaluateController(a.brain,null,decision.frame.request,decision.input);}
  batch.push({a,decision,options,beforeFeeling});
  results.push({id:a.id,gate,gateCost,review:wants&&a.callReason===CALL_REVIEW,learningCost:wants?a.brain.learningCharge??0:0,updates:a.brain.updates,short:a.brain.memory.size,long:a.brain.longMemory.size,
   options:options?.map(o=>({id:o.id,action:o.action,probability:o.probability,computeCharge:decisionCharge(a.brain,decision,o.decisionCost)}))??null});
 }
 owner.batch={items:batch,w};return results;
}
export function commitBodyCognition(owner,selections){
 const batch=owner.batch;if(!batch||selections.length!==batch.items.length)throw new Error('Нет согласованной оценки.');
 for(let i=0;i<batch.items.length;i++){
  const {a,decision,options,beforeFeeling}=batch.items[i],selected=selections[i];
  if(!options){if(selected!==null)throw new Error('Лишнее подтверждение.');continue;}
  const option=options.find(o=>o.id===selected);if(!option)throw new Error('Подтверждён неизвестный вариант.');
  a.brain.learningCharge=0;a.lastDecision={tick:batch.w.tick,row:option.row,options:options.map(o=>({...o,localDestination:{...o.localDestination},destination:o.action<6?memoryWorldPosition(a,o.localDestination):{x:a.x,y:a.y}})),chosen:option.action};
  commitTemporalBrain(batch.w,a,decision,option,beforeFeeling);
 }
 owner.batch=null;
}
const physicalKeys=['x','y','frameRotation','energy','health','referenceMass','energyCapacity','healthCapacity','stomachCapacity','L','M','inventory','stomach','process','resting','lastAction','callReason','visibleAttacks'];
export async function parallelPhysiologyCognition(pool,mirrorBrain){
 const w=pool.world;preparePhysiologyBoundary(w);const groups=pool.lanes.map(()=>[]),frames=new Map();
 for(const a of w.agents){
  if(!a.alive||a.readyAt>w.subtick)continue;
  if(w._primed)sampleLife(w,a);
  let index=pool.owners.get(a.id);if(index===undefined){index=(a.id-1)%pool.lanes.length;pool.owners.set(a.id,index);pool.lanes[index].added.push({id:a.id,brain:a.brain,lastDecision:a.lastDecision});pool.metrics.registrations++;}
  const frame=physiologyFrame(w,a);frames.set(a.id,frame);
  // Координаты исполнения не включаются в request; они остаются в frame Map.
  groups[index].push({id:a.id,state:Object.fromEntries(physicalKeys.map(k=>[k,a[k]])),navigation:{position:{...a.brain.position},facing:a.brain.facing,feelingTotal:a.brain.feelingTotal,feelingSamples:a.brain.feelingSamples,wellbeing:a.brain.wellbeing},request:frame.request,labor:a.pregnancy?.stage==='labor'});
 }
 const start=performance.now(),replies=await Promise.all(pool.lanes.map((l,i)=>l.endpoint.call('evaluate-body',{rows:groups[i],added:l.added,removed:l.removed,retainedId:pool.retained?.id??null,tick:w.tick,subtick:w.subtick,primed:w._primed,memoryEnabled:w.memoryEnabled,learningEnabled:w.learningEnabled})));
 pool.metrics.evaluateMs+=performance.now()-start;
 const results=new Map(),selections=groups.map(rows=>rows.map(()=>null));
 for(let j=0;j<groups.length;j++){
  if(!Array.isArray(replies[j])||replies[j].length!==groups[j].length)throw new Error('Неполный список ответов вычислителя.');
  for(let i=0;i<groups[j].length;i++){
   const r=replies[j][i];if(!r||r.id!==groups[j][i].id||![r.gateCost,r.learningCost].every(v=>Number.isFinite(v)&&v>=0)||![r.updates,r.short,r.long].every(v=>Number.isSafeInteger(v)&&v>=0)||typeof r.gate!=='boolean'||typeof r.review!=='boolean'||r.options!==null&&!Array.isArray(r.options))throw new Error('Несогласованный результат/цена вычислителя.');
   const candidates=frames.get(r.id).request.candidates;
   if(r.options){if(r.options.length!==candidates.length||r.options.some((o,k)=>o.id!==candidates[k].id||o.action!==candidates[k].action||!Number.isFinite(o.probability)||o.probability<0||!Number.isFinite(o.computeCharge)||o.computeCharge<0)||Math.abs(r.options.reduce((s,o)=>s+o.probability,0)-1)>1e-10)throw new Error('Несогласованные вероятности/варианты.');}
   results.set(r.id,{r,lane:j,index:i});
  }
 }
 // Только после проверки ВСЕХ ответов меняем зеркала и физическое состояние.
 for(const l of pool.lanes){for(const added of l.added){const a=w._physById.get(added.id);a.brain=mirrorBrain(a.brain);a.lastDecision=null;}l.added.length=0;l.removed.length=0;}
 for(const a of w.agents){
  const result=results.get(a.id);if(!result)continue;const {r,lane,index}=result;
  a.brain.updates=r.updates;setCognitionSummary(a,r.short,r.long);
  if(r.gate){w.stats.gateCalls++;a.life.observer.attentionCalls++;chargePhysiologyBrain(w,a,'attentionEnergyCost',r.gateCost);}
  if(!r.options)continue;
  if(r.review)a.callReason=CALL_REVIEW;
  const frame=frames.get(a.id),selected=selectControllerDecision(r.options,w.random.next()),source=frame.request.candidates.find(c=>c.id===selected.id),choice=w.executableDecision(frame,{...source,...selected});
  a.brain.learningCharge=r.learningCost;w.recordBirthDecision(a);commitPhysiologyChoice(w,a,{frame},choice,w.feeling(a),false);selections[lane][index]=choice.id;
 }
 const commitStart=performance.now();await Promise.all(pool.lanes.map((l,i)=>l.endpoint.call('commit-body',{selections:selections[i]})));pool.metrics.commitMs+=performance.now()-commitStart;w._primed=true;pool.metrics.substeps++;
}
