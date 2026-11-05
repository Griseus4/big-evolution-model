import {worldAxial,rotate} from './navigation.js';
import {CALL_COMPLETE} from './action-timing.js';
/** Связи принадлежат координатору. Одна пара ID, без сканирования популяции. */
export const careRecord=()=>({schema:'postnatal-care-v1',carriedTime:0,carryingTime:0,feedAttempts:0,fed:[0,0,0],received:[0,0,0],releasedByDeath:0});
export const carriedChild=(w,a)=>a.carryingChildId===null?null:w._physById.get(a.carryingChildId)??null;
export function attachChild(w,parent,child){
 if(!w.childCare)return;
 if(parent.carryingChildId!==null||child.carrierId!==null)throw new Error('Ребёнок уже носится.');
 const due=w.subtick+parent.bodyPlan.carrySteps;if(!Number.isSafeInteger(due))throw new Error('Срок ношения вне целой сетки.');
 parent.carryingChildId=child.id;child.carrierId=parent.id;child.carryStarted=w.subtick;child.carryDue=due;child.process=null;child.resting=false;child.brain.pending=null;
}
export function releaseChild(w,parent,reason='time'){
 const child=carriedChild(w,parent);parent.carryingChildId=null;if(!child)return;
 child.carrierId=null;child.carryStarted=null;child.carryDue=null;child.callReason=CALL_COMPLETE;
 if(reason==='death'&&child.alive){child.life.care.releasedByDeath++;w.stats.care.releasedByDeath++;}
}
export function careDeath(w,a){
 if(!w.childCare)return;
 if(a.carryingChildId!==null)releaseChild(w,a,'death');
 if(a.carrierId!==null){const parent=w._physById.get(a.carrierId);if(parent?.carryingChildId===a.id)parent.carryingChildId=null;a.carrierId=null;a.carryStarted=null;a.carryDue=null;}
}
export function releaseDueChildren(w){if(w.childCare)for(const a of w.agents)if(a.alive&&a.carrierId!==null&&w.subtick>=a.carryDue){const parent=w._physById.get(a.carrierId);if(parent)releaseChild(w,parent);}}
export function moveCarriedChild(w,parent,destination){
 const child=carriedChild(w,parent);if(!child?.alive)return;
 const from=worldAxial(child),to=worldAxial(destination),delta=rotate({q:to.q-from.q,r:to.r-from.r},-child.frameRotation);
 child.brain.position={q:child.brain.position.q+delta.q,r:child.brain.position.r+delta.r};child.brain.spatialCache=null;w.moveAgent(child,destination);
}
export function visibleCare(w,a){
 const child=carriedChild(w,a);if(!child?.alive)return null;
 return {size:child.L,health:child.health/child.healthCapacity,remaining:Math.max(0,(child.carryDue-w.subtick)/(child.carryDue-child.carryStarted))};
}
export function validateCareLinks(w){
 if(!w.childCare)return;
 const fail=m=>{throw new Error('Повреждена связь ношения: '+m);},id=v=>v===null||Number.isSafeInteger(v)&&v>0;
 for(const a of w.agents){
  if(!id(a.carrierId)||!id(a.carryingChildId)||a.carrierId!==null&&a.carryingChildId!==null)fail('ID');
  const c=a.life?.care;if(!c||c.schema!=='postnatal-care-v1'||![c.carriedTime,c.carryingTime,c.feedAttempts,c.releasedByDeath].every(v=>Number.isFinite(v)&&v>=0)||![c.fed,c.received].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&n>=0)))fail('история');
  if(a.carrierId!==null){const p=w._physById.get(a.carrierId);if(!p?.alive||p.carryingChildId!==a.id||p.id===a.id||a.process!==null||a.resting||a.pregnancy||a.x!==p.x||a.y!==p.y||!Number.isSafeInteger(a.carryStarted)||a.carryStarted!==a.bornSubtick||a.carryDue!==a.carryStarted+p.bodyPlan.carrySteps||w.subtick>=a.carryDue)fail('ребёнок/срок');if(a.brain.pending||a.brain.updates!==0||a.life.observer.brainCalls!==0||a.life.observer.attentionCalls!==0)fail('самостоятельные вычисления ребёнка');}
  else if(a.carryStarted!==null||a.carryDue!==null)fail('освобождённый ребёнок');
  if(a.carryingChildId!==null){const c=w._physById.get(a.carryingChildId);if(!c?.alive||c.carrierId!==a.id||a.pregnancy)fail('родитель');}
 }
}
