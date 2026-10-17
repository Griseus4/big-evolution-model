/** Постоянный владелец личного опыта. Общей карты и мирового RNG здесь нет.
 * Оценка и подтверждение разделены: координатор расходует броски в прежнем
 * порядке, затем владелец сохраняет ровно выбранный переход обучения. */
import {RULES} from './evolution.js';
import {prepareControllerDecision,evaluateController,expectedControllerValue,controllerFeeling} from './brain-controller.js';
import {attentionRequest} from './attention-gate.js';
import {CALL_REVIEW,DT} from './action-timing.js';
import {memoryWorldPosition} from './navigation.js';
import {prepareTemporalDecision,commitTemporalBrain,observeTime,accrueTemporalReward,localTemporalObservation,localTemporalFrame} from './temporal-world.js';
import {INPUT_WIDTH,RESULT_WIDTH,RESULT,readCognitionRow} from './cognition-packet.js';
export class CognitionOwner{
 constructor(){this.agents=new Map();this.batch=null;this.result=null;this.deadId=null;}
 register(agents){for(const a of agents){if(this.agents.has(a.id))throw new Error('Повторная регистрация мозга.');this.agents.set(a.id,{...a,alive:true});}}
 evaluate({input,count,added=[],removed=[],retainedId=null,tick,subtick,priming,memoryEnabled,learningEnabled}){
  if(this.batch)throw new Error('Предыдущие решения ещё не подтверждены.');
  this.register(added);
  // Удерживается максимум один выбранный умерший, без обхода всех живых.
  if(this.deadId!==null&&this.deadId!==retainedId){this.agents.delete(this.deadId);this.deadId=null;}
  for(const d of removed){const a=this.agents.get(d.id);if(a&&d.id===retainedId){Object.assign(a.brain,d.feeling);a.brain.pending=null;a.dead=true;this.deadId=d.id;}else this.agents.delete(d.id);}
  if(input.length<count*INPUT_WIDTH)throw new Error('Неполный пакет наблюдений.');
  if(!this.result||this.result.length<count*RESULT_WIDTH)this.result=new Float64Array(input.length/INPUT_WIDTH*RESULT_WIDTH);
  const result=this.result;result.fill(0,0,count*RESULT_WIDTH);const batch=[];
  const w={tick,subtick,memoryEnabled,learningEnabled,feeling:a=>controllerFeeling(a.brain,a,RULES.stomachCapacity),
   prepareDecision:a=>{const frame={request:localTemporalFrame(a,localTemporalObservation(w,a,a.cells),a.availableMask)};return {frame,input:prepareControllerDecision(a.brain,frame.request)};},
   expectedContinuation:(a,d)=>expectedControllerValue(a.brain,null,d.frame.request,d.input)};
  for(let i=0;i<count;i++){
   const a=this.agents.get(input[i*INPUT_WIDTH]);if(!a||a.dead)throw new Error('Нет живого владельца мозга.');
   const cells=readCognitionRow(input,i*INPUT_WIDTH,a);if(memoryEnabled)observeTime(w,a,cells,priming?0:DT);
   if(!priming)accrueTemporalReward(w,a);
   let wants=priming||!a.process;
   if(!wants&&a.process.action!==9&&attentionRequest(a,cells,RULES.inventoryCapacity,RULES.stomachCapacity)){a.callReason=CALL_REVIEW;wants=true;}
   let decision=null,options=null,beforeFeeling=null;
   if(wants){decision=prepareTemporalDecision(w,a);beforeFeeling=w.feeling(a);options=evaluateController(a.brain,null,decision.frame.request,decision.input);}
   batch.push({a,decision,options,beforeFeeling});const at=i*RESULT_WIDTH;
   result[at+RESULT.decision]=wants?(a.callReason===CALL_REVIEW?2:1):0;result[at+RESULT.updates]=a.brain.updates;result[at+RESULT.short]=a.brain.memory.size;result[at+RESULT.long]=a.brain.longMemory.size;
   if(options)for(const o of options){result[at+RESULT.mask]|=1<<o.action;result[at+RESULT.probabilities+o.action]=o.probability;}
  }
  this.batch={items:batch,w};return result;
 }
 commit(selections,result){
  const batch=this.batch;if(!batch||selections.length<batch.items.length)throw new Error('Нет согласованной оценки для подтверждения.');
  for(let i=0;i<batch.items.length;i++){
   const {a,decision,options,beforeFeeling}=batch.items[i],action=selections[i];
   if(!options){if(action!==-1)throw new Error('Лишнее подтверждение выбора.');continue;}
   const option=options.find(o=>o.action===action);if(!option)throw new Error('Подтверждено недоступное действие.');
   const executable=o=>({...o,localDestination:{...o.localDestination},destination:o.action<6?memoryWorldPosition(a,o.localDestination):{x:a.x,y:a.y}});
   a.lastDecision={tick:batch.w.tick,row:option.row,options:options.map(executable),chosen:action};
   commitTemporalBrain(batch.w,a,decision,executable(option),beforeFeeling);
  }
  this.batch=null;this.result=result;
 }
 snapshot(ids){if(this.batch)throw new Error('Нельзя читать неподтверждённое состояние.');return ids.map(id=>{const a=this.agents.get(id);if(!a)throw new Error('Мозг не найден: '+id);return {id,brain:a.brain,lastDecision:a.lastDecision,cells:a.cells};});}
}
