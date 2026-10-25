/** Общая ситуация вычисляется один раз на прямой выбор жителя.
 * Q(s,a)=sum(z(s)*operation(a)*target(a))/sqrt(16)+linear(a).
 * У разных операций разные критерии одной цели. Веса всех блоков наследуются,
 * личные добавки и записи памяти — нет. Пакет не означает многопоточность.
 */
import {FEATURE_NAMES} from './cognition.js';
import {beginComputePart,endComputePart} from './performance-probe.js';
/** Один алгоритм прямого прохода/градиента, две именованные схемы. */
export function createSetBrainEngine(layout,inputs){
const {SET_BLOCKS,SET_PARAMETER_COUNT,CELL_HIDDEN,CONTEXT_HIDDEN,CONTEXT_INPUTS,CANDIDATE_INPUTS,OPERATION_NAMES}=layout;
const BODY_INPUTS=layout.BODY_NAMES.length;
const {prepareSetInput,setCandidateInput}=inputs;
const [CELLS,CONTEXT,TARGET,OPERATION,DIRECT]=SET_BLOCKS,SCALE=1/Math.sqrt(CONTEXT_HIDDEN),TEMPERATURE=.35;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const workspaces=new WeakMap();
function work(brain){let w=workspaces.get(brain);if(!w){w={parameters:new Float64Array(brain.networkBase.length),gradient:new Float64Array(brain.networkBase.length),candidateInput:new Float64Array(CANDIDATE_INPUTS),features:Array(FEATURE_NAMES.length)};workspaces.set(brain,w);}return w;}
function effective(brain,enabled){const mark=beginComputePart('weights');try{const p=work(brain).parameters;for(const i of (brain.structure?.activeParameters??p.keys()))p[i]=brain.networkBase[i]+(enabled?brain.networkDelta[i]:0);p.structure=brain.structure;return p;}finally{endComputePart(mark);}}
function dense(p,block,input,activate=true,reuse=null){
 const output=reuse??new Float64Array(block.outputs);
 for(let h=0;h<block.outputs;h++){let value=block.bias===null?0:p[block.bias+h];for(let i=0;i<block.inputs;i++)value+=p[block.offset+h*block.inputs+i]*input[i];output[h]=activate?Math.tanh(value):value;}
 return output;
}
function setCommonForward(p,frame){
 const mark=beginComputePart('forward');try{
  const cells=frame.cells.map(row=>dense(p,CELLS,row)),input=new Float64Array(CONTEXT_INPUTS),n=cells.length;
  input.set(frame.body);
  for(const row of cells)for(let h=0;h<CELL_HIDDEN;h++){input[BODY_INPUTS+h]+=row[h]/n;input[BODY_INPUTS+CELL_HIDDEN+h]+=row[h]*row[h]/n;}
  input[BODY_INPUTS+2*CELL_HIDDEN]=n/(n+1);input.set(frame.memory,BODY_INPUTS+1+2*CELL_HIDDEN);if(frame.process)input.set(frame.process,BODY_INPUTS+1+2*CELL_HIDDEN+frame.memory.length);
  return {cells,input,...(layout.contextForward?layout.contextForward(p,input,p.structure):{z:dense(p,CONTEXT,input)})};
 }finally{endComputePart(mark);}
}
function setCandidateForward(p,common,input){
 const mark=beginComputePart('forward');try{
  const hidden=dense(p,TARGET,input.subarray(6),false),operation=dense(p,OPERATION,input.subarray(0,6),false);
  let value=p[DIRECT.bias];
  for(let i=0;i<input.length;i++)value+=p[DIRECT.offset+i]*input[i];
  for(let h=0;h<CONTEXT_HIDDEN;h++)value+=common.z[h]*operation[h]*hidden[h]*SCALE;
  return {value,hidden,operation};
 }finally{endComputePart(mark);}
}
/** Линейную проекцию цели выносим за перебор целей. На каждую операцию
 * строится один вектор коэффициентов; каждое назначение требует 15 умножений.
 * Это та же функция, что setCandidateForward, с иной группировкой сумм. */
function operationHead(p,common,operation,reuse=null){
 const coefficients=reuse?.coefficients??p.slice(DIRECT.offset+6,DIRECT.bias);let bias=p[DIRECT.bias]+p[DIRECT.offset+operation];
 if(reuse)for(let i=0;i<coefficients.length;i++)coefficients[i]=p[DIRECT.offset+6+i];
 for(let h=0;h<CONTEXT_HIDDEN;h++){
  const factor=common.z[h]*p[OPERATION.offset+h*OPERATION.inputs+operation]*SCALE;
  bias+=factor*p[TARGET.bias+h];for(let i=0;i<TARGET.inputs;i++)coefficients[i]+=factor*p[TARGET.offset+h*TARGET.inputs+i];
 }
 if(reuse){reuse.bias=bias;return reuse;}return {coefficients,bias};
}
/** Числовые рабочие буферы не покидают вызов оценщика и не являются опытом.
 * Размер растёт только при увеличении числа вариантов; используем активный
 * префикс, чтобы старые значения не участвовали после уменьшения пакета. */
function probabilityBuffers(workspace,length){
 let s=workspace.probabilities;
 if(!s||s.scores.length<length){s={scores:new Float64Array(length),values:new Float64Array(length),operations:new Uint8Array(length),
  probabilities:new Float64Array(length),counts:new Float64Array(OPERATION_NAMES.length),totals:new Float64Array(OPERATION_NAMES.length)};workspace.probabilities=s;}
 return s;
}
/** Единственная формула вероятностей для обычного выбора и скалярного TD.
 * Порядок exp, суммы, деления и накопления по операциям прежний. */
function normalizeProbabilities(s,length){
 s.counts.fill(0);s.totals.fill(0);
 for(let i=0;i<length;i++)s.counts[s.operations[i]]++;
 let peak=-Infinity;for(let i=0;i<length;i++)peak=Math.max(peak,s.scores[i]-Math.log(s.counts[s.operations[i]]));
 let total=0;for(let i=0;i<length;i++){s.probabilities[i]=Math.exp(s.scores[i]-Math.log(s.counts[s.operations[i]])-peak);total+=s.probabilities[i];}
 for(let i=0;i<length;i++){s.probabilities[i]/=total;s.totals[s.operations[i]]+=s.probabilities[i];}
}
function headValue(head,input){let value=head.bias;for(let i=0;i<head.coefficients.length;i++)value+=head.coefficients[i]*input[i+6];return value;}
/** Равные Q дают равные вероятности доступных операций. Внутри операции
 * цели имеют softmax(Q/T). Оценка операции — log(mean(exp(Q/T))).
 * Совместная вероятность получается одним устойчивым softmax(Q/T-log(n)).
 * Это сознательно новая политика; старые контроллеры её не используют. */
function operationProbabilities(options,scratch=null){
 const mark=beginComputePart('probabilities');try{
  if(!options.length)return options;
  const s=scratch??probabilityBuffers({},options.length);
  for(let i=0;i<options.length;i++){s.scores[i]=options[i].score;s.operations[i]=options[i].operation;}
  normalizeProbabilities(s,options.length);
  for(let i=0;i<options.length;i++){const o=options[i];o.probability=s.probabilities[i];o.operationProbability=s.totals[o.operation];o.targetProbability=s.totals[o.operation]?o.probability/s.totals[o.operation]:0;}
  return options;
 }finally{endComputePart(mark);}
}
function checkDecisionInput(brain,request,decision){
 if(decision&&(decision.brain!==brain||decision.request!==request))throw new Error('Пакет входов принадлежит другому решению.');
}
function evaluateSetBrain(brain,request,detailed=true,decision=null){
 checkDecisionInput(brain,request,decision);
 const buffers=work(brain),p=effective(brain,request.observation.learningEnabled),prepared=decision?.prepared??prepareSetInput(brain,request),common=setCommonForward(p,prepared);
 const displayMark=beginComputePart('copies');let displayInput;
 try{displayInput=detailed?Array.from(common.input):null;}finally{endComputePart(displayMark);}
 const heads=Array(OPERATION_NAMES.length);
 const options=request.candidates.map((candidate,index)=>{
  // У продолжения нет снимка кандидата, его вход/признаки переиспользуются.
  const row=decision?.rows[index]??setCandidateInput(brain,request.observation,candidate,prepared,detailed?null:buffers.candidateInput,detailed?null:buffers.features);
  const forwardMark=beginComputePart('forward');let value;
  try{
   const head=heads[row.operation]??(heads[row.operation]=operationHead(p,common,row.operation));value=headValue(head,row.input);
  }finally{endComputePart(forwardMark);}
  const copyMark=beginComputePart('copies');try{return {...candidate,row:0,operation:row.operation,score:value/TEMPERATURE,learningValue:value,
   ...(detailed?{features:row.features,senses:prepared.senses.slice(),input:displayInput,candidateInput:Array.from(row.input),batchInput:{body:prepared.body,cells:prepared.cells,memory:prepared.memory,candidate:row.input,...(prepared.process?{process:prepared.process}:{})}}:{})};
  }finally{endComputePart(copyMark);}
 });
 return operationProbabilities(options,probabilityBuffers(buffers,options.length));
}
function expectedSetValue(brain,request,decision=null){
 checkDecisionInput(brain,request,decision);
 const buffers=work(brain),p=effective(brain,request.observation.learningEnabled),prepared=decision?.prepared??prepareSetInput(brain,request),common=setCommonForward(p,prepared);
 const count=request.candidates.length,s=probabilityBuffers(buffers,count);
 // Головки операций тоже временны: каждый вызов заново заполняет коэффициенты
 // текущими весами. Между обучением и выбором значения не кэшируются.
 const heads=buffers.continuationHeads??(buffers.continuationHeads=Array.from({length:OPERATION_NAMES.length},()=>({coefficients:new Float64Array(TARGET.inputs),bias:0})));
 const ready=buffers.continuationReady??(buffers.continuationReady=new Uint8Array(OPERATION_NAMES.length));ready.fill(0);
 for(let i=0;i<count;i++){
  const row=decision?.rows[i]??setCandidateInput(brain,request.observation,request.candidates[i],prepared,buffers.candidateInput,buffers.features);
  const mark=beginComputePart('forward');let value;
  try{
   const operation=row.operation,head=ready[operation]?heads[operation]:operationHead(p,common,operation,heads[operation]);ready[operation]=1;value=headValue(head,row.input);
  }finally{endComputePart(mark);}
  s.values[i]=value;s.scores[i]=value/TEMPERATURE;s.operations[i]=row.operation;
 }
 const mark=beginComputePart('probabilities');
 try{
  normalizeProbabilities(s,count);
  let expected=0;for(let i=0;i<count;i++)expected+=s.probabilities[i]*s.values[i];
  return expected;
 }finally{endComputePart(mark);}
}
/** Дифференцируем выбранный Q через оба кодировщика и общую ситуацию.
 * Мягкого поиска памяти нет: входные наблюдения/оценки памяти — константы.
 * Усреднение и второй момент по клеткам имеют производные 1/n и 2*h/n. */
function setGradient(p,frame,gradient=new Float64Array(SET_PARAMETER_COUNT)){
 const mark=beginComputePart('gradient');try{
  gradient.fill(0);const common=setCommonForward(p,frame),candidate=setCandidateForward(p,common,frame.candidate),back=new Float64Array(CONTEXT_INPUTS);
  gradient[DIRECT.bias]=1;for(let i=0;i<frame.candidate.length;i++)gradient[DIRECT.offset+i]=frame.candidate[i];
  const outputGradient=new Float64Array(CONTEXT_HIDDEN);
  for(let h=0;h<CONTEXT_HIDDEN;h++){
   const dz=candidate.hidden[h]*candidate.operation[h]*SCALE*(layout.contextBackward?1:1-common.z[h]**2),dr=common.z[h]*candidate.operation[h]*SCALE;
   outputGradient[h]=dz;if(!layout.contextBackward)gradient[CONTEXT.bias+h]=dz;gradient[TARGET.bias+h]=dr;
   if(!layout.contextBackward)for(let i=0;i<CONTEXT_INPUTS;i++){gradient[CONTEXT.offset+h*CONTEXT_INPUTS+i]=dz*common.input[i];back[i]+=dz*p[CONTEXT.offset+h*CONTEXT_INPUTS+i];}
   for(let i=0;i<TARGET.inputs;i++)gradient[TARGET.offset+h*TARGET.inputs+i]=dr*frame.candidate[i+6];
   for(let i=0;i<OPERATION.inputs;i++)gradient[OPERATION.offset+h*OPERATION.inputs+i]=common.z[h]*candidate.hidden[h]*SCALE*frame.candidate[i];
  }
  if(layout.contextBackward)layout.contextBackward(p,common,outputGradient,gradient,back,p.structure);
  const n=frame.cells.length;
  for(let c=0;c<n;c++)for(let h=0;h<CELL_HIDDEN;h++){
   const activation=common.cells[c][h],d=(back[BODY_INPUTS+h]+2*activation*back[BODY_INPUTS+CELL_HIDDEN+h])*(1-activation**2)/n;
   gradient[CELLS.bias+h]+=d;for(let i=0;i<CELLS.inputs;i++)gradient[CELLS.offset+h*CELLS.inputs+i]+=d*frame.cells[c][i];
  }
  return {gradient,value:candidate.value};
 }finally{endComputePart(mark);}
}
function learnSetBrain(brain,choice,{beforeFeeling,afterFeeling,nextValue,terminal,tick,reward:timeReward,elapsed=1,temporal=false}){
 const w=work(brain),p=effective(brain,true),{gradient,value:beforeValue}=setGradient(p,choice.batchInput,w.gradient),{alpha,discount,trace,forgetting}=brain.traits;
 const updateMark=beginComputePart('updates');let reward,delta;
 try{
  let squared=0;for(const v of gradient)squared+=v*v;const norm=Math.max(1,Math.sqrt(squared));
  reward=timeReward??(.04*afterFeeling/100+(terminal?0:discount*afterFeeling/100)-beforeFeeling/100);delta=clamp(reward+(terminal?0:(temporal?discount**elapsed:discount)*nextValue)-beforeValue,-2,2);
  const fade=temporal?(discount*trace)**elapsed:discount*trace;const retain=temporal?1:1-forgetting;
  for(const i of (brain.structure?.activeParameters??p.keys())){const e=fade*brain.eligibility[i]+gradient[i]/norm;brain.eligibility[i]=e;brain.networkDelta[i]=clamp(brain.networkDelta[i]*retain+alpha*delta*e,-4,4);}
 }finally{endComputePart(updateMark);}
 const afterMark=beginComputePart('afterUpdate');let afterValue;
 try{const after=effective(brain,true);afterValue=setCandidateForward(after,setCommonForward(after,choice.batchInput),choice.batchInput.candidate).value;}finally{endComputePart(afterMark);}
 brain.updates++;brain.lastLearning={tick,action:choice.action,row:null,reward,delta,beforeValue,afterValue,change:afterValue-beforeValue,traceKind:'градиент общего мозга Б',traceLength:null};
 if(terminal)brain.eligibility.fill(0);
}

return {setCommonForward,setCandidateForward,operationProbabilities,evaluateSetBrain,expectedSetValue,setGradient,learnSetBrain};
}
