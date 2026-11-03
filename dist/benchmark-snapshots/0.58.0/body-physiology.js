import {DT,SUBSTEPS} from './action-timing.js';
import {BODY_GENE_DEFAULTS,PHYSIOLOGY_DEFAULTS,bodyGeneValues,effectiveSubsteps} from './physiology-settings.js';

/** Собственные ткани отделены от содержимого и плода. Первичны L/M/E/H;
 * energy/health сохраняют имена тела, используемые наблюдением и обучением. */
export function bodyPlan(genes=BODY_GENE_DEFAULTS){
 const g=bodyGeneValues(genes),adultSteps=effectiveSubsteps(g.tAdult),pregnancySteps=effectiveSubsteps(g.tPreg),retentionSteps=effectiveSubsteps(g.tau);
 const potential=g.gmax*(adultSteps/SUBSTEPS)/(1-g.kBirth);
 return {...g,tAdult:adultSteps/SUBSTEPS,tPreg:pregnancySteps/SUBSTEPS,tau:retentionSteps/SUBSTEPS,adultSteps,pregnancySteps,retentionSteps,potential,birthMass:g.kBirth*potential,conceptionSteps:Math.max(1,Math.ceil(g.alpha*adultSteps))};
}
export function bodyCapacities(a,r=PHYSIOLOGY_DEFAULTS,out={}){
 out.organs=r.organFraction*a.M;out.energy=r.energyPerMass*a.L;out.health=r.healthPerMass*a.L;out.volume=r.volumePerOrgan*out.organs;out.tissueEnergy=r.tissueEnergy*a.L;
 return out;
}
export function validateBody(a,r=PHYSIOLOGY_DEFAULTS){
 const c=bodyCapacities(a,r);
 if(![a.L,a.M,a.energy,a.health,...Object.values(c)].every(Number.isFinite)||!(a.L>0)||a.M<a.L||c.organs>a.L||!(c.energy>0)||!(c.health>0)||!(c.volume>0)||a.energy<0||a.health<0||a.energy>c.energy||a.health>c.health)throw new Error('Повреждено состояние тканей/энергии/здоровья.');
 return a;
}
export function createBody(plan=bodyPlan(),r=PHYSIOLOGY_DEFAULTS,fraction=null){
 if(fraction!==null&&(!Number.isFinite(fraction)||fraction<0||fraction>1))throw new Error('Неверная оплаченная доля ребёнка.');
 if(fraction===0)return null;
 const L=fraction===null?plan.potential:plan.birthMass*fraction;
 return validateBody({L,M:L,energy:r.energyPerMass*L*(fraction===null?r.founderEnergyFraction:r.newbornEnergyFraction),health:r.healthPerMass*L},r);
}
export function basalRate(a,g,r=PHYSIOLOGY_DEFAULTS){
 return r.tissueRate*a.L/r.referenceMass+r.digestionRate*(r.volumePerOrgan*r.organFraction*a.M/r.digestionReferenceVolume)*(g.Fg+g.Ff+g.Fm)/r.digestionReferencePower;
}
export function bodySpeed(a,r=PHYSIOLOGY_DEFAULTS){
 const x=a.M/r.referenceMass,f=x<=1?x:Math.max(r.speedRightFloor,1-(x-1)/r.speedDecline);
 return a.L/a.M*r.speedPeak*f;
}
export function movementSteps(a,r=PHYSIOLOGY_DEFAULTS){
 const n=Math.max(1,Math.ceil(SUBSTEPS/bodySpeed(a,r)));
 if(!Number.isSafeInteger(n))throw new Error('Длительность движения не помещается в целую сетку.');
 return n;
}
export function motorRate(a,kind,r=PHYSIOLOGY_DEFAULTS){
 const rate={move:r.moveRate,gather:r.gatherRate,eat:r.eatRate,deposit:r.depositRate,rest:0,birth:0,conceive:0}[kind];
 if(rate===undefined)throw new Error('Для атаки требуется фиксированная цена замаха.');
 return rate*a.L/r.referenceMass;
}
export function attackProfile(a,g,r=PHYSIOLOGY_DEFAULTS){
 const base=basalRate(a,g,r),moveCost=(base+motorRate(a,'move',r))*movementSteps(a,r)*DT,total=moveCost*r.attackMoveFraction;
 return {steps:r.attackSteps,total,motor:Math.max(0,total-base*r.attackSteps*DT)};
}
export function attackDamage(a,r=PHYSIOLOGY_DEFAULTS){return r.attackDamage*(a.L/r.referenceMass)*(a.health/(r.healthPerMass*a.L));}
export function remainsMass(a,r=PHYSIOLOGY_DEFAULTS){return a.L-(1-r.remainsOrganFraction)*r.organFraction*a.M;}
export function pregnancyPlan(childPlan,r=PHYSIOLOGY_DEFAULTS){
 const mass=childPlan.birthMass,energy=r.newbornEnergyFraction*r.energyPerMass*mass,cost=r.tissueEnergy/r.synthesisEfficiency*mass+energy;
 if(!Number.isFinite(cost)||!(cost>0))throw new Error('План беременности не представим конечным числом.');
 return {mass,energy,cost};
}
