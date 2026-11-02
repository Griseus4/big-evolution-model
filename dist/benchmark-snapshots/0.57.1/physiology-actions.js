import {DT} from './action-timing.js';
import {PHYSIOLOGY_DEFAULTS,FOOD_TYPES} from './physiology-settings.js';
import {movementSteps,motorRate,attackProfile,attackDamage,bodyCapacities} from './body-physiology.js';

export const PHYSIOLOGY_ACTIONS=Object.freeze(['Вперёд','Назад','Назад-влево','Вперёд-влево','Назад-вправо','Вперёд-вправо','Подобрать','Съесть','Покой','Зачать','Положить','Атаковать']);
export const PHYSIOLOGY_OPERATIONS=Object.freeze(['Переместиться','Подобрать','Съесть','Покой','Зачать','Положить','Атаковать']);
export const actionKind=action=>action<6?'move':['gather','eat','rest','conceive','deposit','attack'][action-6];
export const operationForAction=action=>action<6?0:action-5;

/** Ключ различает порции разных типов и отдельные наблюдаемые цели. Handle
 * служит координатору для исполнения и никогда не является входом сети. */
export function candidateKey(action,foodType=null,targetHandle=null){return `${action}:${foodType??''}:${targetHandle??''}`;}
export function processTiming(a,choice,r=PHYSIOLOGY_DEFAULTS){
 const kind=actionKind(choice.action);
 if(kind==='attack'){const p=attackProfile(a,a.bodyPlan,r);return {...p,motor:p.motor/p.steps,kind};}
 const steps=kind==='move'?movementSteps(a,r):kind==='gather'?r.gatherSteps:kind==='eat'?r.eatSteps:kind==='deposit'?r.depositSteps:kind==='conceive'?1:0;
 if(!kind)throw new Error('Неизвестное действие тела.');
 return {kind,steps,motor:motorRate(a,kind,r)*DT,total:motorRate(a,kind,r)*DT*steps};
}
export function startProcess(a,choice,subtick,r=PHYSIOLOGY_DEFAULTS){
 const timing=processTiming(a,choice,r);
 if(timing.kind==='rest')return null;
 const {id,action,foodType,targetHandle,destination,localDestination}=choice;
 return {id,action,foodType,targetHandle,destination:{...destination},localDestination:{...localDestination},...timing,duration:timing.steps,elapsed:0,startedAt:subtick};
}
export function sameProcess(a,choice){return !!a.process&&a.process.id===choice.id;}
export function canConceive(a,aliveCount,populationCap){return a.alive&&a.ageSteps>=a.bodyPlan.conceptionSteps&&!a.pregnancy&&aliveCount<populationCap;}
export function inventoryTotal(a){return a.foodInventory.reduce((sum,value)=>sum+value,0);}
export function foodChoices(action,amounts){return FOOD_TYPES.flatMap((type,j)=>amounts[j]>0?[{id:candidateKey(action,j),action,foodType:j}]:[]);}

/** Общий снимок атаки снимается ПОСЛЕ всех перемещений. Сначала считаются
 * все удары, затем применяется ущерб; гибель не отменяет уже начатый удар. */
export function resolveAttacks(attackers,byId,r=PHYSIOLOGY_DEFAULTS){
 const hits=new Map(),results=[];
 for(const a of attackers){
  const target=byId.get(a.process?.targetHandle),valid=a.alive&&target?.alive&&target!==a&&target.x===a.x&&target.y===a.y;
  const damage=valid?attackDamage(a,r):0;
  results.push({attacker:a,target:valid?target:null,damage});
  if(valid)hits.set(target,(hits.get(target)??0)+damage);
 }
 for(const [a,damage] of hits)a.health=Math.max(0,a.health-damage);
 return results;
}
export function visibleBody(a,r=PHYSIOLOGY_DEFAULTS){
 const c=bodyCapacities(a,r);
 return {handle:a.id,size:a.L,health:a.health/c.health,action:a.pregnancy?.stage==='labor'?'labor':a.process?.action??8,attackTarget:a.process?.action===11?a.process.targetHandle:null};
}
