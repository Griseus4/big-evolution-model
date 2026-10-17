/** Границы задач одного Worker, миллисекунды прошедшего времени.
 * Интервал очереди может включать команды, GC и вытеснение ОС: это не CPU idle.
 * Накопители имеют постоянный размер; истории отдельных шагов здесь нет. */
export const WORKER_TIMING_SCHEMA='worker-boundaries-v1';
const bounds=[.01,.05,.1,.25,.5,1,2,5,10,20,50,100,250,500,1000];
class Distribution{
 constructor(){this.count=0;this.totalMs=0;this.minMs=null;this.maxMs=0;this.bins=new Uint32Array(bounds.length+1);}
 add(ms){ms=Math.max(0,ms);this.count++;this.totalMs+=ms;this.minMs=this.minMs===null?ms:Math.min(this.minMs,ms);this.maxMs=Math.max(this.maxMs,ms);let i=0;while(i<bounds.length&&ms>bounds[i])i++;this.bins[i]++;}
 report(){return {count:this.count,totalMs:this.totalMs,minMs:this.minMs,maxMs:this.maxMs,meanMs:this.count?this.totalMs/this.count:null,bins:Array.from(this.bins)};}
}
export class WorkerTiming{
 constructor(clock){this.clock=clock;this.active=false;this.inTask=false;this.resetBoundary();}
 start(){
  this.active=true;this.inTask=false;this.resetBoundary();this.timerCalls=0;
  this.metrics=Object.fromEntries(['task','step','interTaskGap','queue','requestedDelay','effectiveDelay','late'].map(k=>[k,new Distribution()]));
  this.phases={stepMs:0,presentationMs:0,sendMs:0,otherMs:0};
  this.outsideTasks={presentationMs:0,sendMs:0};this.presentationCalls=0;this.sendCalls=0;
 }
 now(){this.timerCalls++;return this.clock();}
 resetBoundary(){this.pendingAt=null;this.lastEnd=null;}
 scheduled(requestedDelayMs,effectiveDelayMs){
  if(!this.active)return;
  // Повторное schedule не заменяет уже ожидающее пробуждение.
  if(this.pendingAt!==null)return;
  this.pendingAt=this.now();this.requestedDelayMs=requestedDelayMs;this.effectiveDelayMs=effectiveDelayMs;
 }
 beginTask(){
  if(!this.active)return;
  const now=this.now();
  if(this.lastEnd!==null)this.metrics.interTaskGap.add(now-this.lastEnd);
  if(this.pendingAt!==null){const queue=Math.max(0,now-this.pendingAt);this.metrics.queue.add(queue);this.metrics.requestedDelay.add(this.requestedDelayMs);this.metrics.effectiveDelay.add(this.effectiveDelayMs);this.metrics.late.add(Math.max(0,queue-this.effectiveDelayMs));}
  this.pendingAt=null;this.inTask=true;this.taskStart=now;this.taskStep=0;this.taskPresentation=0;this.taskSend=0;
 }
 phase(name,start){
  if(!this.active)return;
  const ms=Math.max(0,this.now()-start);
  if(name==='step'){if(this.inTask){this.taskStep+=ms;this.metrics.step.add(ms);}return;}
  if(name==='presentation'){
   this.presentationCalls++;if(this.inTask)this.taskPresentation+=ms;else this.outsideTasks.presentationMs+=ms;
  }else if(name==='send'){
   this.sendCalls++;if(this.inTask)this.taskSend+=ms;else this.outsideTasks.sendMs+=ms;
  }
 }
 endTask(now=null){
  if(!this.active||!this.inTask)return;
  now??=this.now();const ms=Math.max(0,now-this.taskStart);this.metrics.task.add(ms);
  this.phases.stepMs+=this.taskStep;this.phases.presentationMs+=this.taskPresentation;this.phases.sendMs+=this.taskSend;
  this.phases.otherMs+=Math.max(0,ms-this.taskStep-this.taskPresentation-this.taskSend);
  this.inTask=false;this.lastEnd=now;
 }
 stop(now){if(!this.active)return;this.endTask(now);this.active=false;this.resetBoundary();}
 report(){
  if(!this.metrics)return null;
  return {schema:WORKER_TIMING_SCHEMA,unit:'ms',timerCalls:this.timerCalls,
   histogramUpperBoundsMs:[...bounds],overflowBin:bounds.length,
   metrics:Object.fromEntries(Object.entries(this.metrics).map(([k,v])=>[k,v.report()])),
   taskPhases:{...this.phases},outsideTasks:{...this.outsideTasks},presentationCalls:this.presentationCalls,sendCalls:this.sendCalls,
   currentTaskExcluded:this.inTask,pendingWakeExcluded:this.pendingAt!==null,
   cpuTimeMs:null,gcTimeMs:null,
   notes:['Фазы taskPhases разбивают завершённые задачи Worker; step включает накладные расходы профиля.',
    'queue: от принятого schedule до начала задачи, включая запрошенную задержку. late: превышение эффективной задержки таймера, не CPU idle.',
    'interTaskGap: от конца предыдущей задачи до начала следующей; может включать обработку команд, GC и планирование ОС.',
    'Гистограммы: верхние границы включительны, последняя корзина — выше последней границы; точные процентили не вычисляются.',
    'presentation/send: подготовка и синхронная отправка снимков состояния; отдельные ответы на команды не измеряются этими фазами.',
    'CPU-время потока, смены ядра и отдельное время GC требуют внешней трассы. UI и Worker могут работать параллельно.']};
 }
}
