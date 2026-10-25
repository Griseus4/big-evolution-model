import {SUBSTEPS} from './action-timing.js';
import {brainCostProfile} from './brain-cost.js';
/** Общая физика в координаторе, постоянные владельцы личного опыта.
 * Два барьера на подшаг: оценки -> мировой RNG/исполнение -> подтверждение.
 * Буферы возвращаются владельцу и переиспользуются; полные мозги передаются
 * только при рождении и по явному запросу снимка выбранного жителя/проверки. */
import {advanceTemporalBodies,prepareTemporalBoundary,prepareTemporalAgent,sampleCells,sampleLife,temporalAvailableMask,temporalSelectedChoice,acceptTemporalChoice,compactTemporalAgents,finishTemporal,payAttention,attentionDeath} from './temporal-world.js';
import {CALL_REVIEW} from './action-timing.js';
import {setCognitionSummary} from './cognition-summary.js';
import {COGNITION_PROTOCOL,INPUT_WIDTH,RESULT_WIDTH,RESULT,writeCognitionRow} from './cognition-packet.js';

import {validateComputationWorkers} from './computation-settings.js';
export {computationWorkers} from './computation-settings.js';
class Endpoint{
 constructor(worker,fail,timeout){this.worker=worker;this.pending=null;this.id=0;this.timeout=timeout;worker.onmessage=({data:m})=>{
  if(m.protocol!==COGNITION_PROTOCOL)return;const p=this.pending;if(!p||m.id!==p.id){fail(new Error('Несогласованный ответ вычислителя.'));return;}
  this.pending=null;clearTimeout(p.timer);m.error?p.reject(new Error(m.error)):p.resolve(m.value);
 };worker.onerror=e=>fail(new Error(e.message??'Вычислитель остановился.'));worker.onmessageerror=()=>fail(new Error('Не удалось прочитать ответ вычислителя.'));}
 call(type,payload,transfer=[]){
  if(this.pending)return Promise.reject(new Error('Вычислитель уже занят.'));
  return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>{this.pending=null;reject(new Error(`Вычислитель не ответил за${this.timeout/1000} секунд.`));},this.timeout);
   this.pending={id,resolve,reject,timer};try{this.worker.postMessage({protocol:COGNITION_PROTOCOL,id,type,payload},transfer);}catch(e){clearTimeout(timer);this.pending=null;reject(e);}
  });
 }
 close(error){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}return this.worker.terminate();}
}
function mirrorBrain(b){return {costProfile:b.costProfile,traits:b.traits,controllerType:b.controllerType,temporal:b.temporal,dual:b.dual,lastDecisionSubtick:b.lastDecisionSubtick,position:b.position,facing:b.facing,updates:b.updates,feelingTotal:b.feelingTotal,feelingSamples:b.feelingSamples,wellbeing:b.wellbeing,memory:new Map(),longMemory:new Map()};}
export class ParallelWorld{
 constructor(world,{workers=4,createWorker=()=>new Worker(new URL('./cognition-worker.js',import.meta.url),{type:'module'}),timeout=30000}={}){
  if(!world.temporal)throw new Error('Параллельный расчёт поддерживает модель v13.');
  validateComputationWorkers(workers);
  this.world=world;this.owners=new Map();this.rows=new WeakMap();this.batch=0;this.closed=false;this.busy=false;this.error=null;this.retained=null;
  this.metrics={workers,substeps:0,evaluateMs:0,commitMs:0,packMs:0,ownerWorkMs:0,inputBytes:0,resultBytes:0,registrations:0,snapshotMs:0};
  this.lanes=[];
  try{for(let i=0;i<workers;i++)this.lanes.push({endpoint:new Endpoint(createWorker(i),e=>this.fail(e),timeout),agents:[],added:[],addedAgents:[],removed:[],capacity:0,input:null,selections:null,result:null});}
  catch(e){this.fail(e);throw e;}
 }
 fail(error){if(this.error)return;this.error=error;this.closed=true;for(const l of this.lanes)l.endpoint.close(error);}
 async close(){if(this.closed)return;this.closed=true;await Promise.all(this.lanes.map(l=>l.endpoint.close(new Error('Мир закрыт.'))));this.owners.clear();}
 ensureOpen(){if(this.closed)throw this.error??new Error('Мир закрыт.');}
 async ready(){try{await Promise.all(this.lanes.map(l=>l.endpoint.call('ready',{})));}catch(e){this.fail(e);throw e;}}
 /** Переносим опыт без наблюдения, обучения, выбора действия или RNG.
  * Координатор освобождает полные мозги только после подтверждения всех владельцев.
  * При отказе старый пул и полные локальные копии остаются пригодны для работы. */
 async attach(){
  this.ensureOpen();if(this.busy||this.owners.size)throw new Error('Перенос доступен только в новый свободный пул.');
  const groups=this.lanes.map(()=>[]);
  for(const a of this.world.agents)groups[(a.id-1)%groups.length].push({id:a.id,x:a.x,y:a.y,brain:a.brain,lastDecision:a.lastDecision,cells:a._cells});
  try{await Promise.all(this.lanes.map((l,i)=>l.endpoint.call('register',{agents:groups[i]})));}catch(e){this.fail(e);throw e;}
  for(const a of this.world.agents){this.owners.set(a.id,(a.id-1)%groups.length);setCognitionSummary(a,a.brain.memory.size,a.brain.longMemory.size);a.brain=mirrorBrain(a.brain);a.lastDecision=null;}
  this.metrics.registrations+=this.world.agents.length;
 }
 async reset(world){
  this.ensureOpen();if(this.busy)throw new Error('Нельзя заменить выполняющийся мир.');
  try{await Promise.all(this.lanes.map(l=>l.endpoint.call('reset',{})));}catch(e){this.fail(e);throw e;}
  this.world=world;this.owners.clear();this.rows=new WeakMap();this.batch=0;this.retained=null;
  for(const l of this.lanes){l.agents.length=0;l.added.length=0;l.addedAgents.length=0;l.removed.length=0;}
 }
 get retained(){return this._retained;}
 set retained(a){if(this._retained&&!this._retained.alive&&this._retained!==a)this.owners.delete(this._retained.id);this._retained=a;}
 reserve(l,count){if(l.input&&l.capacity>=count)return;let capacity=Math.max(8,l.capacity);while(capacity<count)capacity*=2;l.capacity=capacity;l.input=new Float64Array(capacity*INPUT_WIDTH);l.selections=new Int16Array(capacity);}
 removed(a){const index=this.owners.get(a.id);if(index===undefined)return;this.lanes[index].removed.push({id:a.id,feeling:{feelingTotal:a.brain.feelingTotal,feelingSamples:a.brain.feelingSamples,wellbeing:a.brain.wellbeing}});if(a!==this.retained)this.owners.delete(a.id);}
 async cognition(priming){
  const w=this.world,packStart=performance.now();
  prepareTemporalBoundary(w);
  this.batch++;
  for(const l of this.lanes){l.agents.length=0;l.added.length=0;l.addedAgents.length=0;}
  for(const a of w.agents){
   const cells=priming?sampleCells(w,a):prepareTemporalAgent(w,a);if(!cells)continue;
   if(!priming){sampleLife(w,a);if((a.process||a.resting)&&a.process?.action!==9)w.stats.gateCalls++;}
   let index=this.owners.get(a.id);
   if(index===undefined){index=(a.id-1)%this.lanes.length;this.owners.set(a.id,index);this.lanes[index].added.push({id:a.id,x:a.x,y:a.y,brain:a.brain,lastDecision:a.lastDecision,cells:a._cells});this.lanes[index].addedAgents.push(a);this.metrics.registrations++;}
   const l=this.lanes[index];let row=this.rows.get(a);if(!row){row={l};this.rows.set(a,row);}row.i=l.agents.length;row.at=row.i*RESULT_WIDTH;row.batch=this.batch;row.cells=cells;l.agents.push(a);
  }
  for(const l of this.lanes){
   this.reserve(l,l.agents.length);
   for(let i=0;i<l.agents.length;i++){const a=l.agents[i];writeCognitionRow(l.input,i*INPUT_WIDTH,a,this.rows.get(a).cells,temporalAvailableMask(w,a));}
  }
  this.metrics.packMs+=performance.now()-packStart;
  const start=performance.now();
  const replies=await Promise.all(this.lanes.map(async l=>{
   this.metrics.inputBytes+=l.input.byteLength;
   const promise=l.endpoint.call('evaluate',{input:l.input,count:l.agents.length,added:l.added,removed:l.removed,retainedId:this.retained?.id??null,tick:w.tick,subtick:w.subtick,priming,memoryEnabled:w.memoryEnabled,learningEnabled:w.learningEnabled},[l.input.buffer]);
   // postMessage уже скопировал начальный опыт; координатор освобождает копию.
   for(const a of l.addedAgents){setCognitionSummary(a,a.brain.memory.size,a.brain.longMemory.size);a.brain=mirrorBrain(a.brain);a.lastDecision=null;}
   l.added.length=0;l.addedAgents.length=0;l.removed.length=0;return promise;
  }));
  this.metrics.evaluateMs+=performance.now()-start;
  // ID -> строка задаётся координатором, порядок ответа Worker не используется.
  for(let j=0;j<this.lanes.length;j++){
   const l=this.lanes[j],r=replies[j];l.input=r.input;l.result=r.result;this.metrics.ownerWorkMs+=r.workMs;this.metrics.resultBytes+=r.result.byteLength;l.selections.fill(-1,0,l.agents.length);
   if(r.result.length<l.agents.length*RESULT_WIDTH)throw new Error('Неполный ответ вычислителя.');
   for(let i=0;i<l.agents.length;i++){const a=l.agents[i],at=i*RESULT_WIDTH;a.brain.updates=r.result[at+RESULT.updates];setCognitionSummary(a,r.result[at+RESULT.short],r.result[at+RESULT.long]);}
  }
  for(const a of w.agents){
   const row=this.rows.get(a);if(!row||row.batch!==this.batch)continue;const {l,i,at}=row,r=l.result;
   if(!r[at+RESULT.decision]){if(a.brain.dual&&r[at+RESULT.gateCost]>0){payAttention(w,a,r[at+RESULT.gateCost]);if(a.health===0){attentionDeath(w,a);l.selections[i]=-2;this.removed(a);}}continue;}
   if(r[at+RESULT.decision]===2)a.callReason=CALL_REVIEW;
   w.recordBirthDecision(a);let roll=w.random.next(),action=-1;const mask=r[at+RESULT.mask];
   for(let k=0;k<11;k++)if(mask&(1<<k)){action=k;const p=r[at+RESULT.probabilities+k];if(!Number.isFinite(p)||p<0||p>1)throw new Error('Некорректная вероятность действия.');roll-=p;if(roll<=0)break;}
   if(action<0)throw new Error('Вычислитель не вернул доступных действий.');
   a.brain.learningCharge=r[at+RESULT.learningCost];const choice=temporalSelectedChoice(w,a,action);choice.computeCharge=r[at+RESULT.costs+action];
   if(a.brain.dual&&r[at+RESULT.gateCost])payAttention(w,a,r[at+RESULT.gateCost]);
   if(acceptTemporalChoice(w,a,choice))l.selections[i]=action;
   else{l.selections[i]=-2;this.removed(a);}
  }
  const commitStart=performance.now();
  const commits=await Promise.all(this.lanes.map(l=>l.endpoint.call('commit',{selections:l.selections,result:l.result},[l.selections.buffer,l.result.buffer])));
  for(let i=0;i<this.lanes.length;i++){this.lanes[i].selections=commits[i].selections;this.lanes[i].result=null;}
  compactTemporalAgents(w);
  this.metrics.commitMs+=performance.now()-commitStart;this.metrics.substeps+=Number(!priming);
 }
 async step(){
  this.ensureOpen();if(this.busy)throw new Error('Шаг мира уже выполняется.');this.busy=true;
  try{
   const w=this.world;if(!w.agents.length)return;
   if(!w._primed){await this.cognition(true);w._primed=true;}
   if(!w.agents.length){finishTemporal(w);return;}
   for(let i=0;i<SUBSTEPS&&w.agents.length;i++){advanceTemporalBodies(w,a=>this.removed(a));await this.cognition(false);finishTemporal(w);}
  }catch(e){this.fail(e);throw e;}finally{this.busy=false;}
 }
 async sync(agents){
  this.ensureOpen();if(this.busy)throw new Error('Снимок доступен только после полного шага.');const start=performance.now(),groups=this.lanes.map(()=>[]),lookup=new Map();
  for(const a of agents){const index=this.owners.get(a.id);if(index!==undefined){groups[index].push(a.id);lookup.set(a.id,a);}}
  await Promise.all(groups.map(async(ids,i)=>{if(!ids.length)return;const snapshots=await this.lanes[i].endpoint.call('snapshot',{ids});for(const s of snapshots){const a=lookup.get(s.id);a.brain=s.brain;a.lastDecision=s.lastDecision;a._cells=s.cells;}}));this.metrics.snapshotMs+=performance.now()-start;
 }
 async syncAll(){await this.sync(this.world.agents);}
 async syncAgent(agent){if(agent)await this.sync([agent]);}
}
