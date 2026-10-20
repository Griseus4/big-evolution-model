import {validatePlan,selectAttempt,allocateComputations,workerCost} from './experiment-plan.js';
import {MODEL_VERSION} from './life-history.js';
/** Очередь групп попыток. Данные неудачных запусков не заменяются удачными.
 * Вычислители перераспределяются после подтверждения предыдущей перестройки. */
export class ExperimentSeries{
 constructor({createWorker=()=>new Worker(new URL('./experiment-worker.js',import.meta.url),{type:'module'}),onChange=()=>{},onFinish=()=>{},build=null}={}){Object.assign(this,{createWorker,onChange,onFinish,build});this.slots=[];this.active=false;this.observed=null;}
 start(input){
  if(this.active)throw new Error('Серия уже выполняется.');
  const plan=validatePlan(input);this.stopping=false;this.observed=null;
  this.report={format:'big-evolution-experiment',version:1,modelVersion:MODEL_VERSION,build:this.build,createdAt:new Date().toISOString(),status:'running',dataRevision:0,plan,groups:plan.variants.flatMap(v=>plan.seeds.map((_,index)=>({id:`${v.id}-${index}`,variantId:v.id,index,status:'pending',attempts:[],selectedId:null})))};
  this.pending=this.report.groups.slice();this.active=true;this.pump();this.changed();return this.report;
 }
 changed(){this.onChange(this.report);}
 used(){return this.slots.reduce((n,s)=>n+workerCost(Math.max(s.actual,s.requested??1)),0);}
 pump(){
  if(!this.active)return;
  const plan=this.report.plan;
  if(this.slots.some(s=>s.requested!==null))return;
  if(this.pending.length&&!this.stopping){
   const cost=workerCost(plan.allocation==='fixed'?plan.maxWorkers:1);
   if(this.used()+cost>plan.budget){const slot=this.slots.find(s=>s.actual>1);if(slot&&plan.allocation==='auto')this.allocate(slot,1);return;}
   while(this.pending.length&&this.used()+cost<=plan.budget){
    const group=this.pending.shift(),variant=plan.variants.find(v=>v.id===group.variantId),number=group.attempts.length+1;
    const attempt={id:`${group.id}-${number}`,number,seed:plan.seedMatrix[group.index][number-1],status:'running',tick:0};group.attempts.push(attempt);group.status='running';
    let worker;try{worker=this.createWorker();}catch(error){attempt.status='failed';attempt.error={message:error.message};group.status='failed';continue;}
    const slot={worker,group,attempt,actual:plan.allocation==='fixed'?plan.maxWorkers:1,requested:null,population:variant.settings.population,cap:plan.maxWorkers};this.slots.push(slot);
    worker.onmessage=({data})=>this.message(slot,data);worker.onerror=e=>{e.preventDefault?.();this.failed(slot,e.message??'Ошибка Worker');};worker.onmessageerror=()=>this.failed(slot,'Нечитаемый ответ Worker');
    worker.postMessage({type:'run',computations:slot.actual,job:{id:attempt.id,kind:'world',seed:attempt.seed,steps:plan.steps,population:variant.settings.population,limit:variant.settings.limit,worldOptions:variant.settings,fullHistory:true,saveGenomes:false}});
   }
  }
  if(!this.pending.length&&!this.stopping){
   const counts=allocateComputations(plan,this.slots.map(s=>s.population),false);
   for(let i=0;i<this.slots.length;i++){const slot=this.slots[i],count=Math.min(counts[i],slot.cap);if(count!==slot.actual){this.allocate(slot,count);break;}}
  }
  if(!this.slots.length&&!this.pending.length)this.finish();
 }
 allocate(slot,count){slot.requested=count;slot.worker.postMessage({type:'computations',value:count});}
 message(slot,data){
  if(!this.active||!this.slots.includes(slot)||data.jobId!==slot.attempt.id)return;
  const {attempt,group}=slot;
  if(data.type==='progress'){
   attempt.progress=data.progress;attempt.tick=data.progress.tick;slot.population=data.progress.population??slot.population;
   if(data.progress.allocationChanged||data.progress.allocationError){slot.actual=data.progress.computeWorkers;slot.requested=null;if(data.progress.allocationError){slot.cap=slot.actual;attempt.allocationError=data.progress.allocationError;}this.pump();}
  }else if(data.type==='snapshot'){
   this.report.dataRevision++;const previous=attempt.live,dead=previous?.dead??[];for(const row of data.lives.dead)dead.push(row);attempt.live={...data.lives,dead};attempt.liveRevision=(attempt.liveRevision??0)+1;
  }else if(data.type==='done'){
   this.report.dataRevision++;const result=data.result;if(result.modelVersion!==MODEL_VERSION){this.failed(slot,'Версия вычислителя не совпадает с интерфейсом.');return;}
   Object.assign(attempt,{...result,number:attempt.number,seed:attempt.seed});delete attempt.live;delete attempt.progress;
   this.remove(slot);
   if(attempt.status==='completed'&&attempt.extinct&&group.attempts.length<3&&!this.stopping){group.status='pending';this.pending.push(group);}
   else{group.status=attempt.status;group.selectedId=selectAttempt(group.attempts,this.report.plan.steps)?.id??null;}
   this.pump();
  }
  this.changed();
 }
 failed(slot,message){Object.assign(slot.attempt,{status:'failed',error:{message}});slot.group.status='failed';slot.group.selectedId=selectAttempt(slot.group.attempts,this.report.plan.steps)?.id??null;this.remove(slot);this.pump();this.changed();}
 remove(slot){slot.worker.terminate();this.slots=this.slots.filter(s=>s!==slot);}
 observe(ids=[]){this.observed=new Set(ids);for(const s of this.slots){const value=this.observed.has(s.attempt.id);if(s.observing!==value){s.observing=value;s.worker.postMessage({type:'observe',value});}}}
 stop(force=false){
  if(!this.active)return;this.stopping=true;this.report.status='stopping';
  for(const group of this.pending){group.status=group.attempts.length?'stopped':'not-started';group.selectedId=selectAttempt(group.attempts,this.report.plan.steps)?.id??null;}this.pending=[];
  for(const slot of [...this.slots])if(force){slot.attempt.status='interrupted';slot.group.status='interrupted';slot.group.selectedId=selectAttempt(slot.group.attempts,this.report.plan.steps)?.id??null;this.remove(slot);}else slot.worker.postMessage({type:'stop'});
  this.pump();this.changed();
 }
 finish(){if(!this.active)return;this.active=false;this.report.status=this.stopping?'stopped':this.report.groups.some(g=>g.status==='failed')?'completed-with-errors':'completed';this.report.finishedAt=new Date().toISOString();this.changed();this.onFinish(this.report);}
}
