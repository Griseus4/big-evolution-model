/** Замороженный эталон сети 0.18 для пользовательских регрессионных проверок.
 * Не используется обычным миром, UI или массовыми опытами. Не оптимизировать
 * вместе с production: иначе сравнение потеряет независимую прежнюю формулу.
 * Геном/память создаёт текущая модель; здесь сохранены входы, Q, градиент и TD.
 */
import {createBrain,getMemory,memoryBelief,actionFeatures,spatialContext} from './cognition.js';
import {cognitiveTraits,COGNITIVE_GENES,bodySenses} from './brain-parameters.js';
import {BASE_GENE_COUNT,ACTION_COUNT} from './policy-layout.js';
import {localNeighbours,positionKey} from './navigation.js';
import {NEURAL_BRAIN_TYPE,INPUT_COUNT,HIDDEN_COUNT,PARAMETER_COUNT,NEURAL_GENE_COUNT,HIDDEN_BIAS,OUTPUT_WEIGHTS,OUTPUT_BIAS,TRAIT_OFFSET,NEURAL_TRAIT_INDICES} from './neural-layout.js';
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export const NEURAL_TEMPERATURE=.35;
export function referenceForward(base,delta,input){
 const hidden=new Float64Array(HIDDEN_COUNT);
 for(let h=0;h<HIDDEN_COUNT;h++){
  let sum=base[HIDDEN_BIAS+h]+delta[HIDDEN_BIAS+h];
  for(let i=0;i<INPUT_COUNT;i++)sum+=(base[h*INPUT_COUNT+i]+delta[h*INPUT_COUNT+i])*input[i];
  hidden[h]=Math.tanh(sum);
 }
 let value=base[OUTPUT_BIAS]+delta[OUTPUT_BIAS];
 for(let h=0;h<HIDDEN_COUNT;h++)value+=(base[OUTPUT_WEIGHTS+h]+delta[OUTPUT_WEIGHTS+h])*hidden[h];
 return {value,hidden};
}
/** Производная Q по каждому эффективному параметру, включая смещения.
 * d tanh(z)/dz = 1−tanh(z)^2; конечные разности проверяет пользователь.
 */
export function referenceGradient(base,delta,input,hidden){
 const gradient=new Float64Array(PARAMETER_COUNT);gradient[OUTPUT_BIAS]=1;
 for(let h=0;h<HIDDEN_COUNT;h++){
  gradient[OUTPUT_WEIGHTS+h]=hidden[h];
  const factor=(base[OUTPUT_WEIGHTS+h]+delta[OUTPUT_WEIGHTS+h])*(1-hidden[h]*hidden[h]);
  gradient[HIDDEN_BIAS+h]=factor;
  for(let i=0;i<INPUT_COUNT;i++)gradient[h*INPUT_COUNT+i]=factor*input[i];
 }
 return gradient;
}
export function referenceInputs(brain,observation,candidate,potentials){
 const o=observation,{action,localDestination,cell}=candidate;
 const senses=bodySenses(o.body,o.capacities.inventory,o.capacities.stomach);
 const features=actionFeatures(brain,{action,destination:localDestination,current:o.position,cell,previousAction:o.previousAction,energy:o.body.energy,tick:o.tick,potentials});
 if(!o.memoryEnabled)features.fill(0,3);
 const record=o.memoryEnabled?getMemory(brain,positionKey(localDestination)):null;
 const belief=record?memoryBelief(record,o.tick,brain.traits):null;
 const input=Array(INPUT_COUNT).fill(0);input[action]=1;
 input.splice(11,21,o.body.energy/100,o.body.health/100,o.body.pain/100,...senses,...features,
  Number(o.currentFood),cell.food/10,Number(cell.hazard),Number(o.previousAction===action),
  belief?.confidence??0,(belief?.food??0)/10,record?Math.max(0,o.tick-record.lastSeen)/brain.traits.memoryAge:0);
 return {input:input.map(v=>clamp(v,-1,1)),features,senses};
}
export function referenceEvaluate(brain,request){
 const o=request.observation,positions=[o.position,...localNeighbours(brain)];
 const potentials=o.memoryEnabled?spatialContext(brain,positions,o.tick):Array(7).fill(0);
 const delta=o.learningEnabled?brain.networkDelta:new Float64Array(PARAMETER_COUNT);
 return request.candidates.map(candidate=>{
  if(!Number.isInteger(candidate.action)||candidate.action<0||candidate.action>=ACTION_COUNT)throw new Error('Неизвестное действие сети.');
  const {input,features,senses}=referenceInputs(brain,o,candidate,potentials);
  const value=referenceForward(brain.networkBase,delta,input).value;
  return {...candidate,row:0,input,features,senses,score:value/NEURAL_TEMPERATURE,learningValue:value};
 });
}
export function referenceLearn(brain,choice,{beforeFeeling,afterFeeling,nextValue,terminal,tick}){
 const {alpha,discount,trace,forgetting}=brain.traits;
 const forward=referenceForward(brain.networkBase,brain.networkDelta,choice.input);
 const gradient=referenceGradient(brain.networkBase,brain.networkDelta,choice.input,forward.hidden);
 const norm=Math.max(1,Math.sqrt(gradient.reduce((sum,v)=>sum+v*v,0)));
 const reward=.04*afterFeeling/100+(terminal?0:discount*afterFeeling/100)-beforeFeeling/100;
 const delta=clamp(reward+(terminal?0:discount*nextValue)-forward.value,-2,2);
 for(let i=0;i<PARAMETER_COUNT;i++){
  const e=discount*trace*brain.eligibility[i]+gradient[i]/norm;
  brain.eligibility[i]=e;
  brain.networkDelta[i]=clamp(brain.networkDelta[i]*(1-forgetting)+alpha*delta*e,-4,4);
 }
 const afterValue=referenceForward(brain.networkBase,brain.networkDelta,choice.input).value;
 brain.updates++;brain.lastLearning={tick,action:choice.action,row:null,reward,delta,beforeValue:forward.value,afterValue,change:afterValue-forward.value,traceKind:'накопленный градиент',traceLength:null};
 if(terminal)brain.eligibility.fill(0);
}
