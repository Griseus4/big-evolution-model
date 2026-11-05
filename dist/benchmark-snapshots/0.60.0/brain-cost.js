import * as care from './care-brain-layout.js';
/** Детерминированные условные операции, не время ПК. Умножение+сумма=2,
 * tanh/смещение/скалярная операция=1. Общие клетки и контекст — раз на пакет.
 * Эталон — фиксированный v13 на том же числе клеток/кандидатов. Ставки 0.10
 * и 0.03 относятся к полному циклу выбора+обучения эталона, не к каждой фазе. */
import {SET_BLOCKS,SET_PARAMETER_COUNT,CELL_HIDDEN,CONTEXT_INPUTS,CONTEXT_HIDDEN,CANDIDATE_INPUTS} from './temporal-layout.js';
import * as physiology from './physiology-brain-layout.js';
import {DECISION_COST} from './action-timing.js';
const dense=b=>2*b.weights+(b.bias===null?0:b.outputs);
const [cells,context,target,operation,direct]=SET_BLOCKS;
export function brainCostProfile(plan){
 if(plan.modular)return {care:true,physiology:true,modular:true,linearHeads:plan.modules.target.hidden===0&&plan.modules.direct.hidden===0,targetEdges:plan.modules.target.activeEdges,directEdges:plan.modules.direct.activeEdges,modules:Object.fromEntries(Object.entries(plan.modules).map(([key,m])=>[key,{forward:m.operations,backward:4*m.activeEdges+2*m.nodes.length+3*m.nodes.filter(id=>id<m.inputs+m.hidden).length}])),parameters:plan.activeParameters.length};
 return {...(plan.care?{care:true}:{}),...(plan.physiology?{physiology:true}:{}),context:2*plan.activeEdges+plan.nodes.length+plan.nodes.filter(id=>id<plan.inputs+plan.hidden).length,
  parameters:plan.activeParameters.length};
}
export function operationCounts(profile,nCells,nCandidates,nOperations=6){
 if(profile?.modular){
  const m=profile.modules,common=nCells*(m.cells.forward+care.CELL_HIDDEN)+nCells*care.CELL_HIDDEN*5+care.CONTEXT_INPUTS+m.context.forward;
  const candidate=m.target.forward+m.direct.forward+4*care.CONTEXT_HIDDEN;
  const forward=profile.linearHeads?common+nOperations*(m.operation.forward+2*profile.targetEdges+4*care.CONTEXT_HIDDEN+profile.directEdges+care.CANDIDATE_INPUTS)+nCandidates*(2*(care.CANDIDATE_INPUTS-care.OPERATION_NAMES.length)+8):common+nOperations*m.operation.forward+nCandidates*(candidate+8),single=common+m.operation.forward+candidate;
  const backward=m.context.backward+m.target.backward+m.operation.backward+m.direct.backward+nCells*(m.cells.backward+3*care.CELL_HIDDEN);
  return {forward,learning:forward+2*single+backward+12*profile.parameters};
 }
 const [cells,context,target,operation,direct]=profile?.care?care.SET_BLOCKS:profile?.physiology?physiology.SET_BLOCKS:SET_BLOCKS,CONTEXT_INPUTS=profile?.care?care.CONTEXT_INPUTS:profile?.physiology?physiology.CONTEXT_INPUTS:context.inputs,CANDIDATE_INPUTS=direct.inputs;
 const contextCost=profile?.context??dense(context)+CONTEXT_HIDDEN;
 const common=nCells*(dense(cells)+CELL_HIDDEN)+nCells*CELL_HIDDEN*5+CONTEXT_INPUTS+contextCost;
 const heads=nOperations*(CONTEXT_HIDDEN*(4+2*target.inputs)+direct.inputs),candidates=nCandidates*(2*target.inputs+8);
 const forward=common+heads+candidates,parameters=profile?.parameters??SET_PARAMETER_COUNT;
 // TD: продолжение; Q+градиент старого перехода; обновление/норма; контрольный Q.
 const single=common+CONTEXT_HIDDEN*(2*target.inputs+2*operation.inputs+4)+2*CANDIDATE_INPUTS+1;
 const backward=2*contextCost+nCells*(2*dense(cells)+5*CELL_HIDDEN)+4*CONTEXT_HIDDEN*(target.inputs+operation.inputs);
 return {forward,learning:forward+2*single+backward+12*parameters};
}
/** Фиксированная калибровка, не текущая популяция/доступность действий.
 * Та же условная единица используется для сети и подготовки её входов. */
const gateReference=operationCounts(null,7,11,6);
export const ATTENTION_REFERENCE_OPERATIONS=gateReference.forward+gateReference.learning;
export const ATTENTION_OPERATION_PRICE=DECISION_COST/ATTENTION_REFERENCE_OPERATIONS;
export const ATTENTION_PREPARATION=Object.freeze({base:10,perCell:16,activityComparison:2,final:13});
export function attentionCharge(brain,preparationOperations){return brain.dual?ATTENTION_OPERATION_PRICE*(brain.attentionStructure.operations+preparationOperations):0;}
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
