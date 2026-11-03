import {physiologySettings,bodyGeneValues,foodEnergies,DIGESTION_GROUP_FRACTION} from './physiology-settings.js';
import {bodyPlan,createBody,bodyCapacities,basalRate,motorRate,movementSteps} from './body-physiology.js';
import {unpackDualBrain} from './dual-brain-layout.js';
import {operationCounts,attentionCharge,ATTENTION_PREPARATION as PREP} from './brain-cost.js';
import {SUBSTEPS,DECISION_COST} from './action-timing.js';
import {validateBrainCostMultiplier,scaledBrainCost} from './brain-economy.js';
import {ENERGY_PREVIEW} from './energy-preview.js';
/** Приближённый стационарный цикл без мира, беременности и накопления в E.
 * Один тип пищи; запас собирается до объёма одного приёма. Число сборов
 * усреднено по длинному циклу с сохранением дробных остатков.
 * Кольцевое округление даёт интервал удержания, а не обещание усвоить Q. */
export function physiologyEnergyPreview(options,brain,moves,{foodType=0,callsPerT=1}={}){
 if(!Number.isInteger(foodType)||foodType<0||foodType>2||!Number.isFinite(callsPerT)||callsPerT<0)throw new Error('Некорректный сценарий питания/решений.');
 const r=physiologySettings(options.physiology),g=bodyPlan(options.baseGenome?unpackDualBrain(options.baseGenome).body:bodyGeneValues(options.bodyGenes??{})),a=createBody(g,r),c=bodyCapacities(a,r),k=validateBrainCostMultiplier(options.brainCostMultiplier),p=ENERGY_PREVIEW;
 const portion=Math.min(r.inventoryCapacity,c.volume),gathers=portion/Math.min(r.portionPerAction,r.inventoryCapacity),movements=moves*portion;
 const moveT=movements*movementSteps(a,r)/SUBSTEPS,gatherT=gathers*r.gatherSteps/SUBSTEPS,eatT=r.eatSteps/SUBSTEPS,activeT=moveT+gatherT+eatT;
 const group=Math.max(1,Math.floor(g.retentionSteps*DIGESTION_GROUP_FRACTION)),retention=(g.retentionSteps-(group-1)/2)/SUBSTEPS;
 const cycleT=Math.max(activeT,portion*retention/c.volume),waitT=cycleT-activeT,Q=foodEnergies(r)[foodType],ceiling=[g.Fg,g.Ff,g.Fm][foodType]*c.volume*Q*SUBSTEPS;
 const food=Math.min(portion*Q/cycleT,ceiling*Math.min(retention,cycleT)/cycleT),forced=(movements+gathers+1+Number(waitT>0))/cycleT,calls=Math.max(callsPerT,forced),gateChecks=Math.max(0,SUBSTEPS-forced);
 const reference=operationCounts(null,p.cells,p.candidates,p.operations),actual=operationCounts(brain.costProfile,p.cells,p.candidates,p.operations),denominator=reference.forward+reference.learning;
 const main=scaledBrainCost(calls*DECISION_COST*actual.forward/denominator,k),learning=options.learning===false?0:scaledBrainCost(calls*DECISION_COST*actual.learning/denominator,k),preparation=PREP.base+PREP.final+p.cells*(PREP.perCell+PREP.activityComparison*13+6)+12;
 const attention=scaledBrainCost(gateChecks*attentionCharge(brain,preparation),k),base=basalRate(a,g,r),motor=(moveT*motorRate(a,'move',r)+gatherT*motorRate(a,'gather',r)+eatT*motorRate(a,'eat',r))/cycleT,physical=base+motor,spent=physical+main+learning+attention;
 if(![spent,food,cycleT].every(Number.isFinite))throw new Error('Сценарий выходит за численный диапазон.');
 return {food,ceiling,base,motor,physical,main,learning,attention,spent,net:food-spent,cycleT,calls,gateChecks,moving:moveT/cycleT,foodType,portion,gathers,retention,hidden:brain.structure.hidden,active:brain.structure.nodes.filter(id=>id<brain.structure.inputs+brain.structure.hidden).length};
}
