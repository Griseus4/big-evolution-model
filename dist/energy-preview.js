import {RULES,actionEnergyCost,validateDigestionTime} from './model-rules.js';
import {ACTION_DURATIONS,SUBSTEPS,DECISION_COST} from './action-timing.js';
import {operationCounts,attentionCharge,ATTENTION_PREPARATION as PREP} from './brain-cost.js';
import {validateBrainCostMultiplier,scaledBrainCost} from './brain-economy.js';
import {compileDualState} from './dual-brain-state.js';
import {randomDualGenome} from './dual-brain-genome.js';
import {dualStructureSettings} from './dual-brain-settings.js';
import {Random} from './simulation.js';
import {ACTIVITY_COUNT} from './activity-perception.js';
/** Эталон наблюдателя. Ни карты, ни жителя, ни игрового RNG здесь нет.
 * Все суммы — энергия/Т установившегося цикла до заполнения запаса. */
export const ENERGY_PREVIEW=Object.freeze({moves:12,maxMoves:10000,calls:1,cells:7,candidates:11,operations:6,seed:553});
export function previewBrain(options={}){
 const genes=options.baseGenome??randomDualGenome(new Random(ENERGY_PREVIEW.seed),dualStructureSettings({...options,initialMutation:undefined}));
 return compileDualState(genes);
}
export function energyPreview(options={},brain=previewBrain(options),moves=ENERGY_PREVIEW.moves){
 if(!Number.isSafeInteger(moves)||moves<1||moves>ENERGY_PREVIEW.maxMoves)throw new Error(`Перемещений на порцию: целое от 1 до ${ENERGY_PREVIEW.maxMoves}.`);
 const k=validateBrainCostMultiplier(options.brainCostMultiplier),digestion=validateDigestionTime(options.digestionTime),p=ENERGY_PREVIEW;
 const moveT=moves*ACTION_DURATIONS[0]/SUBSTEPS,gatherT=ACTION_DURATIONS[6]/SUBSTEPS,eatT=ACTION_DURATIONS[7]/SUBSTEPS;
 const activeT=moveT+gatherT+eatT,cycleT=Math.max(activeT,digestion),waitT=cycleT-activeT;
 const forced=(moves+2+Number(waitT>0))/cycleT,calls=Math.max(p.calls,forced),gateChecks=Math.max(0,SUBSTEPS-forced);
 const reference=operationCounts(null,p.cells,p.candidates,p.operations),actual=operationCounts(brain.costProfile,p.cells,p.candidates,p.operations),total=reference.forward+reference.learning;
 // Обычная ставка без скидки повторения: осторожная оценка. При одинаковом
 // контексте learningCharge равна actual.learning / эталон полного цикла.
 const main=scaledBrainCost(calls*DECISION_COST*actual.forward/total,k),learning=options.learning===false?0:scaledBrainCost(calls*DECISION_COST*actual.learning/total,k);
 // Верхняя подготовка входов при неизменных наблюдениях; проверки в момент
 // обязательного выбора не выполняются. При пересмотре оплачены обе сети.
 const preparation=PREP.base+PREP.final+p.cells*(PREP.perCell+PREP.activityComparison*ACTIVITY_COUNT);
 const attention=scaledBrainCost(gateChecks*attentionCharge(brain,preparation),k);
 const physical=(moveT*actionEnergyCost(0)+gatherT*actionEnergyCost(6)+eatT*actionEnergyCost(7)+waitT*actionEnergyCost(8))/cycleT;
 const food=RULES.foodEnergy/cycleT,ceiling=RULES.foodEnergy/digestion,spent=physical+main+learning+attention;
 if(![spent,food,ceiling].every(Number.isFinite))throw new Error('Параметры выходят за численный диапазон калькулятора.');
 return {food,ceiling,physical,main,learning,attention,spent,net:food-spent,cycleT,calls,gateChecks,moving:moveT/cycleT,hidden:brain.structure.hidden,active:brain.structure.nodes.filter(id=>id<brain.structure.inputs+brain.structure.hidden).length};
}
