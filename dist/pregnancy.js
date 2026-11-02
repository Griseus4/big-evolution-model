import {PHYSIOLOGY_DEFAULTS} from './physiology-settings.js';
import {bodyPlan,pregnancyPlan,createBody,remainsMass} from './body-physiology.js';

/** Геном плода формируется вызывающей стороной ровно при зачатии. Копия
 * защищает от мутации буфера родителя; личного опыта здесь нет. */
export function conceive(childGenome,childGenes,parentPlan,subtick,r=PHYSIOLOGY_DEFAULTS){
 const plan=bodyPlan(childGenes),budget=pregnancyPlan(plan,r),due=subtick+parentPlan.pregnancySteps;
 if(!Number.isSafeInteger(due))throw new Error('Срок беременности вне целой сетки.');
 return {stage:'gestation',genome:childGenome.slice(),plan,...budget,conceivedAt:subtick,due,steps:parentPlan.pregnancySteps,paid:0,lastPayment:subtick,fraction:null,laborStarted:null,laborDue:null};
}
export function fundPregnancy(a,subtick,out){
 const p=a.pregnancy;if(!p||p.stage!=='gestation'||a.health<=0)return;
 if(subtick<=p.conceivedAt||subtick>p.due||subtick!==p.lastPayment+1)throw new Error('Пропущен или повторён платёж беременности.');
 p.lastPayment=subtick;
 const payment=Math.min(p.cost/p.steps,a.energy,Math.max(0,p.cost-p.paid));
 a.energy-=payment;p.paid+=payment;out.pregnancy+=payment;
 if(subtick===p.due)p.fraction=Math.max(0,Math.min(1,p.paid/p.cost));
}
export function beginLabor(a,subtick,r=PHYSIOLOGY_DEFAULTS){
 const p=a.pregnancy;if(!p||p.stage!=='gestation'||subtick<p.due||a.health<=0)return false;
 if(p.fraction===null)throw new Error('Роды начались до последнего платежа.');
 p.stage='labor';p.laborStarted=subtick;p.laborDue=subtick+r.birthSteps;
 if(!Number.isSafeInteger(p.laborDue))throw new Error('Срок родов вне целой сетки.');
 return true;
}
/** Возвращает оплаченный исход и удаляет состояние один раз. Создание новой
 * особи/истории принадлежит координатору, а не этой чистой машине состояний. */
export function finishLabor(a,subtick,r=PHYSIOLOGY_DEFAULTS){
 const p=a.pregnancy;if(!p||p.stage!=='labor'||subtick<p.laborDue||a.health<=0)return null;
 a.pregnancy=null;return {genome:p.genome,plan:p.plan,body:createBody(p.plan,r,p.fraction),paid:p.paid};
}
export function embryoRemains(p,r=PHYSIOLOGY_DEFAULTS){
 if(!p)return 0;const f=p.fraction??Math.max(0,Math.min(1,p.paid/p.cost)),mass=f*p.mass;
 return mass===0?0:remainsMass({L:mass,M:mass},r);
}
