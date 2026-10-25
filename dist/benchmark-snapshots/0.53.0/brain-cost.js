/** Детерминированные условные операции, не время ПК. Умножение+сумма=2,
 * tanh/смещение/скалярная операция=1. Общие клетки и контекст — раз на пакет.
 * Эталон — фиксированный v13 на том же числе клеток/кандидатов. Ставки 0.10
 * и 0.03 относятся к полному циклу выбора+обучения эталона, не к каждой фазе. */
import {SET_BLOCKS,SET_PARAMETER_COUNT,CELL_HIDDEN,CONTEXT_INPUTS,CONTEXT_HIDDEN,CANDIDATE_INPUTS} from './temporal-layout.js';
const dense=b=>2*b.weights+(b.bias===null?0:b.outputs);
const [cells,context,target,operation,direct]=SET_BLOCKS;
export function brainCostProfile(plan){
 return {context:2*plan.activeEdges+plan.nodes.length+plan.nodes.filter(id=>id<plan.inputs+plan.hidden).length,
  parameters:plan.activeParameters.length};
}
export function operationCounts(profile,nCells,nCandidates,nOperations=6){
 const contextCost=profile?.context??dense(context)+CONTEXT_HIDDEN;
 const common=nCells*(dense(cells)+CELL_HIDDEN)+nCells*CELL_HIDDEN*5+CONTEXT_INPUTS+contextCost;
 const heads=nOperations*(CONTEXT_HIDDEN*(4+2*target.inputs)+direct.inputs),candidates=nCandidates*(2*target.inputs+8);
 const forward=common+heads+candidates,parameters=profile?.parameters??SET_PARAMETER_COUNT;
 // TD: продолжение; Q+градиент старого перехода; обновление/норма; контрольный Q.
 const single=common+CONTEXT_HIDDEN*(2*target.inputs+2*operation.inputs+4)+2*CANDIDATE_INPUTS+1;
 const backward=2*contextCost+nCells*(2*dense(cells)+5*CELL_HIDDEN)+4*CONTEXT_HIDDEN*(target.inputs+operation.inputs);
 return {forward,learning:forward+2*single+backward+12*parameters};
}
export function decisionCharge(brain,frame,rate){
 if(!brain.costProfile)return rate;
 if(frame.costFactor!==undefined)return rate*frame.costFactor;
 const cells=frame.input?.prepared?.cells?.length??frame.frame.request.observation.cells.length,candidates=frame.frame.request.candidates.length,operations=new Set(frame.frame.request.candidates.map(c=>c.action<6?0:c.action-5)).size;
 const reference=operationCounts(null,cells,candidates,operations),actual=operationCounts(brain.costProfile,cells,candidates,operations);
 frame.costFactor=actual.forward/(reference.forward+reference.learning);return rate*frame.costFactor;
}
export function learningCharge(brain,pending,decision){
 if(!brain.costProfile)return 0;
 const cells=pending.choice.batchInput.cells.length,candidates=pending.costCandidates??decision.frame.request.candidates.length,operations=pending.costOperations??6;
 const reference=operationCounts(null,cells,candidates,operations),actual=operationCounts(brain.costProfile,cells,candidates,operations);
 const next=decision.frame.request,forward=operationCounts(brain.costProfile,next.observation.cells.length,next.candidates.length,new Set(next.candidates.map(c=>c.action<6?0:c.action-5)).size).forward;
 return (pending.costRate??.1)*(actual.learning-actual.forward+forward)/(reference.forward+reference.learning);
}
