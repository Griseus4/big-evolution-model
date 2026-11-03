import {DT} from './action-timing.js';
import {PHYSIOLOGY_DEFAULTS} from './physiology-settings.js';
import {basalRate,bodyCapacities} from './body-physiology.js';

/** Реестр одного интервала переиспользуется, физические траты имеют разные
 * приоритеты. Непокрытый обязательный долг не превращается в расход энергии. */
export function budgetRecord(){return {basal:0,brain:0,mandatoryPaid:0,unpaid:0,catabolized:0,catabolicEnergy:0,catabolicLoss:0,hungerDamage:0,motor:0,motorInterrupted:false,pregnancy:0,growth:0,synthesisLoss:0,healing:0,overflow:0,absorbed:0};}
export function beginBodyInterval(a,g,absorbed,brainCost,r=PHYSIOLOGY_DEFAULTS,out=budgetRecord()){
 for(const key of Object.keys(out))out[key]=key==='motorInterrupted'?false:0;
 if(![absorbed,brainCost].every(v=>Number.isFinite(v)&&v>=0))throw new Error('Некорректное поступление/начисление энергии.');
 out.absorbed=absorbed;out.basal=basalRate(a,g,r)*DT;out.brain=brainCost;
 const cost=out.basal+brainCost,available=a.energy+absorbed;
 if(!Number.isFinite(cost)||!Number.isFinite(available))throw new Error('Переполнен энергетический бюджет.');
 const paid=Math.min(available,cost),deficit=cost-paid; a.energy=available-paid;
 const organs=r.organFraction*a.M,yieldPerMass=r.tissueEnergy*r.catabolismEfficiency;
 const cat=Math.min(deficit/yieldPerMass,r.catabolismGrowthFactor*g.gmax*DT,Math.max(0,a.L-organs));
 if(cat>0){const old=a.L;a.L=Math.max(organs,a.L-cat);a.health=Math.min(r.healthPerMass*a.L,a.health*a.L/old);}
 out.catabolized=cat;out.catabolicEnergy=cat*yieldPerMass;out.catabolicLoss=cat*(r.tissueEnergy-yieldPerMass);
 out.mandatoryPaid=paid+out.catabolicEnergy;out.unpaid=Math.max(0,deficit-out.catabolicEnergy);
 out.hungerDamage=r.deficitDamage*out.unpaid;a.health=Math.max(0,a.health-out.hungerDamage);
 // Уменьшение ёмкости имеет немедленную потерю; обычное переполнение после
 // усвоения ограничивается лишь в finishBodyInterval, после добровольных трат.
 if(cat>0&&a.energy>r.energyPerMass*a.L){out.overflow+=a.energy-r.energyPerMass*a.L;a.energy=r.energyPerMass*a.L;}
 return out;
}
export function payMotorInterval(a,cost,out){
 if(!Number.isFinite(cost)||cost<0)throw new Error('Некорректная моторная цена.');
 if(a.health<=0||a.energy<cost){out.motorInterrupted=true;return false;}
 a.energy-=cost;out.motor+=cost;return true;
}
/** Беременность вызывается между мотором и этой функцией. Возраст задаётся
 * целой границей: после окна развития разрешено восстановление прежнего M. */
export function finishBodyInterval(a,g,ageSteps,r=PHYSIOLOGY_DEFAULTS,out=budgetRecord()){
 if(a.health<=0)return out;
 const energyMax=r.energyPerMass*a.L,limit=ageSteps<g.adultSteps?g.potential:a.M,price=r.tissueEnergy/r.synthesisEfficiency;
 if(a.energy>r.growthThreshold*energyMax){
  const growth=Math.min(g.gmax*DT,Math.max(0,limit-a.L),a.energy/price);
  a.energy-=price*growth;a.L+=growth;a.M=Math.max(a.M,a.L);a.health+=r.healthPerMass*growth;
  out.growth=growth;out.synthesisLoss=(price-r.tissueEnergy)*growth;
 }
 const c=bodyCapacities(a,r),missing=Math.max(0,c.health-a.health);
 const heal=Math.min(missing,Math.max(missing*r.healingDeficitFraction,c.health*r.healingMinimumFraction),Math.max(0,a.energy-r.healingReserve*c.energy)/r.healingPrice);
 a.health=Math.min(c.health,a.health+heal);a.energy-=r.healingPrice*heal;out.healing=heal*r.healingPrice;
 if(a.energy>c.energy){out.overflow+=a.energy-c.energy;a.energy=c.energy;}
 return out;
}
