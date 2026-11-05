import {dagForward,dagBackward} from './dag-network.js';
import {BODY_NAMES,CELL_HIDDEN,CONTEXT_HIDDEN,CONTEXT_INPUTS,OPERATION_NAMES} from './care-brain-layout.js';
const BODY=BODY_NAMES.length,OPERATIONS=OPERATION_NAMES.length,SCALE=1/Math.sqrt(CONTEXT_HIDDEN);
/** Локальные индексы DAG переводятся в срез общего массива личных весов.
 * Только выход кодировщика клеток дополнительно ограничен tanh; проекции
 * линейны на выходе, а их новые скрытые нейроны используют tanh. */
export function modularBlockForward(p,key,input,activate=false){
 const plan=p.structure.modules[key],result=dagForward(plan,p.subarray(plan.offset,plan.offset+plan.parameters),input);
 if(activate)result.output=Float64Array.from(result.output,Math.tanh);
 return result;
}
export function modularCommonForward(p,frame){
 const cellFrames=frame.cells.map(row=>modularBlockForward(p,'cells',row,true)),cells=cellFrames.map(f=>f.output),input=new Float64Array(CONTEXT_INPUTS),n=cells.length;
 input.set(frame.body);for(const row of cells)for(let h=0;h<CELL_HIDDEN;h++){input[BODY+h]+=row[h]/n;input[BODY+CELL_HIDDEN+h]+=row[h]*row[h]/n;}
 input[BODY+2*CELL_HIDDEN]=n/(n+1);input.set(frame.memory,BODY+1+2*CELL_HIDDEN);if(frame.process)input.set(frame.process,BODY+1+2*CELL_HIDDEN+frame.memory.length);
 const context=modularBlockForward(p,'context',input);return {cells,cellFrames,input,context,z:context.output,operationFrames:Array(OPERATIONS)};
}
export function modularCandidateForward(p,common,input,{reuseOperation=true}={}){
 const target=modularBlockForward(p,'target',input.subarray(OPERATIONS));let operation;
 const index=input.subarray(0,OPERATIONS).findIndex(v=>v===1);
 if(reuseOperation&&index>=0)operation=common.operationFrames[index]??(common.operationFrames[index]=modularBlockForward(p,'operation',input.subarray(0,OPERATIONS)));
 else operation=modularBlockForward(p,'operation',input.subarray(0,OPERATIONS));
 const direct=modularBlockForward(p,'direct',input);let value=direct.output[0];
 for(let h=0;h<CONTEXT_HIDDEN;h++)value+=common.z[h]*operation.output[h]*target.output[h]*SCALE;
 return {value,hidden:target.output,operation:operation.output,targetFrame:target,operationFrame:operation,directFrame:direct};
}
/** Когда цель и прямая оценка ещё линейны, сохраняем быстрый путь: одна
 * свёртка на операцию вместо полного прохода цели для каждого кандидата.
 * После появления скрытого слоя автоматически применяется общий DAG. */
export function modularCandidateValue(p,common,input,operationIndex){
 const {target,direct}=p.structure.modules;
 if(target.hidden||direct.hidden)return modularCandidateForward(p,common,input).value;
 const heads=common.heads??(common.heads=Array(OPERATIONS));let head=heads[operationIndex];
 if(!head){
  const operation=common.operationFrames[operationIndex]??(common.operationFrames[operationIndex]=modularBlockForward(p,'operation',input.subarray(0,OPERATIONS)));
  const coefficients=new Float64Array(target.inputs);let bias=p[direct.offset];
  for(const e of direct.incoming[direct.inputs]){const weight=p[direct.offset+e.index];if(e.from<OPERATIONS)bias+=weight*input[e.from];else coefficients[e.from-OPERATIONS]+=weight;}
  for(let h=0;h<CONTEXT_HIDDEN;h++){const factor=common.z[h]*operation.output[h]*SCALE;bias+=factor*p[target.offset+h];for(const e of target.incoming[target.inputs+h])coefficients[e.from]+=factor*p[target.offset+e.index];}
  head=heads[operationIndex]={bias,coefficients};
 }
 let value=head.bias;for(let i=0;i<head.coefficients.length;i++)value+=head.coefficients[i]*input[OPERATIONS+i];return value;
}
/** Производная того же Q по всем пяти блокам. Входы наблюдений постоянны;
 * градиенты всех клеток суммируются, затем используется прежний TD/след. */
export function modularSetGradient(p,frame,gradient){
 gradient.fill(0);const common=modularCommonForward(p,frame),candidate=modularCandidateForward(p,common,frame.candidate,{reuseOperation:false});
 function backward(key,forward,outputGradient,activate=false){
  const plan=p.structure.modules[key],d=activate?Float64Array.from(outputGradient,(v,j)=>v*(1-forward.output[j]**2)):outputGradient;
  const result=dagBackward(plan,p.subarray(plan.offset,plan.offset+plan.parameters),forward.values,d);
  for(const j of plan.activeParameters)gradient[plan.offset+j]+=result.gradient[j];return result.inputGradient;
 }
 backward('direct',candidate.directFrame,Float64Array.of(1));
 const dz=new Float64Array(CONTEXT_HIDDEN),dt=new Float64Array(CONTEXT_HIDDEN),dop=new Float64Array(CONTEXT_HIDDEN);
 for(let h=0;h<CONTEXT_HIDDEN;h++){dz[h]=candidate.hidden[h]*candidate.operation[h]*SCALE;dt[h]=common.z[h]*candidate.operation[h]*SCALE;dop[h]=common.z[h]*candidate.hidden[h]*SCALE;}
 backward('target',candidate.targetFrame,dt);backward('operation',candidate.operationFrame,dop);const back=backward('context',common.context,dz),n=common.cells.length;
 for(let c=0;c<n;c++){const dc=new Float64Array(CELL_HIDDEN);for(let h=0;h<CELL_HIDDEN;h++)dc[h]=(back[BODY+h]+2*common.cells[c][h]*back[BODY+CELL_HIDDEN+h])/n;backward('cells',common.cellFrames[c],dc,true);}
 return {gradient,value:candidate.value};
}
