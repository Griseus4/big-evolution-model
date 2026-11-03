import {validateCareLinks} from './child-care.js';
import {validateBody} from './body-physiology.js';
import {validateDualBrain} from './dual-brain-genome.js';
import {controllerProblems} from './brain-controller.js';
export function checkPhysiologyInvariants(w){
 validateCareLinks(w);
 const b=w.balances(),p=w.stats.physiology,energyTolerance=1e-7+1e-9*(p.initialFoodEnergy+p.initialEnergy+p.absorbed.reduce((s,v)=>s+v,0)),require=(yes,text)=>{if(!yes)throw new Error(text);};
 require([b.energyError,b.massError,b.foodError].every(Number.isFinite)&&Math.abs(b.energyError)<=energyTolerance&&Math.abs(b.massError)<=energyTolerance&&Math.abs(b.foodError)<=energyTolerance,'Нарушен баланс энергии, ткани или пищи новой модели.');
 require(w.agents.length+w.stats.deaths===w.initialPopulation+w.stats.births&&w.lifeHistory.all.count===w.stats.deaths,'Нарушен баланс жизней.');
 for(const a of w.agents){validateBody(a,w.physiology);validateDualBrain(a.genome);require(a.health>0&&a.inventory<=w.physiology.inventoryCapacity+1e-9&&a.stomach<=a.stomachCapacity+1e-9,'Недопустимое тело/запас.');const errors=controllerProblems(a.brain);require(!errors.length,errors.join('; '));require(a.brain.outcomeExpectation.every(Number.isFinite),'Неконечное ожидание исхода.');}
 return {...b,energyTolerance};
}
