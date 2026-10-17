/** Измеритель наблюдателя. Ничего не передаёт мозгу, не вызывает шаги и RNG.
 * Таймер — elapsed time синхронного JS (включая возможную сборку мусора),
 * а не загрузка CPU. Подробно разбирается каждый десятый шаг. Полный шаг
 * измеряется всегда; выключение возвращает исходные методы экземпляра мира.
 */
import {swapComputeProbe} from './performance-probe.js';
import {WorkerTiming} from './worker-timing.js';
export const PERFORMANCE_REPORT_VERSION=3;
export const PERFORMANCE_DETAIL_SCHEMA='brain-phases-v1';
export const PERFORMANCE_LABELS={worldOther:'Тело, действия и прочая работа мира',memory:'Наблюдения и память мест',evaluation:'Подготовка вариантов и оценка мозга',selection:'Выбор и запись решения',learning:'Последствия, закрепление памяти и TD',history:'Сводки и завершение жизней',panel:'Общая панель и показатели',resident:'Подробная панель жителя',chart:'График',map:'Карта',otherTabs:'Другие вкладки',diagnostics:'Панель измерений'};
export const PERFORMANCE_DETAIL_LABELS={observation:'Наблюдения и доступные варианты мира',inputs:'Подготовка входов и признаков памяти',weights:'Сборка действующих весов',forward:'Прямой числовой проход и оценки Q',probabilities:'Вероятности операций и целей',gradient:'Обратный проход градиента',updates:'Норма, след и обновление личных весов',copies:'Копирование входов и данных решений',afterUpdate:'Проверка Q после обучения (прочая работа)'};
const sumActions=s=>s.stats.actions.reduce((n,v)=>n+v,0);
export function performanceContext(s){return {seed:s.seed,tick:s.tick,population:s.agents.length,initialPopulation:s.initialPopulation,limit:s.limit,brainType:s.brainType,mutations:s.mutations,mutationRate:s.mutationRate,memory:s.memoryEnabled,learning:s.learningEnabled,foodSettings:{...s.foodSettings},geography:s.geography,environmentRevision:s.environmentRevision,reproduction:{...s.reproduction},places:{short:s.agents.reduce((n,a)=>n+a.brain.memory.size,0),long:s.agents.reduce((n,a)=>n+a.brain.longMemory.size,0)}};}
export class PerformanceProfiler{
 constructor({clock=()=>performance.now(),sampleEvery=10,durationMs=30000}={}){
  if(!Number.isInteger(sampleEvery)||sampleEvery<1||!Number.isFinite(durationMs)||durationMs<=0)throw new Error('Некорректные настройки измерителя.');
  this.clock=clock;this.sampleEvery=sampleEvery;this.durationMs=durationMs;this.active=false;this.data=null;this.stack=[];this.detailStack=[];this.restores=[];this.sampled=false;this.workerTiming=new WorkerTiming(clock);
 }
 start(world,{running=false,context={},mode='detailed'}={}){
  if(!['light','detailed'].includes(mode))throw new Error('Неизвестный режим измерений.');
  if(this.active)this.stop('restarted');
  const now=this.clock();this.world=world;this.lastTime=now;this.running=running;
  this.data={format:'big-evolution-performance',version:PERFORMANCE_REPORT_VERSION,createdAt:new Date().toISOString(),status:'recording',reason:null,targetActiveMs:this.durationMs,sampleEvery:this.sampleEvery,context,start:performanceContext(world),end:null,activeMs:0,steps:0,actions:0,stepsWhilePaused:0,actionsWhilePaused:0,stepMsWhilePaused:0,stepMs:0,minStepMs:null,maxStepMs:0,stepsOverFrameBudget:0,populationSum:0,populationMin:null,populationMax:0,sampledSteps:0,sampledStepMs:0,sampledActions:0,groups:{},scheduler:{computeBudgetMs:8,maxStepsPerFrame:400,targetStepsPerSecond:[],budgetLimitedFrames:0,frames:0,frameGapSamples:0,frameGapTotalMs:0,maxFrameGapMs:0},notes:['Подробные группы: каждый десятый шаг; доли относятся только к этой выборке.','Вложенное время вычитается из родителя; группы не складываются с полным временем шага.','Таймер учитывает синхронный JS и возможную сборку мусора, но не измеряет загрузку процессора.','Карта/DOM: время подготовки и команд; последующая раскладка браузера и GPU сюда не входят.','Пауза и скрытая вкладка не входят в активные секунды. Инструмент сам не запускает мир.','Измеритель добавляет работу; число вызовов таймера сохранено, его полная накладная стоимость не вычитается.']};
  this.mode=mode;this.data.mode=mode;this.data.sampleEvery=mode==='detailed'?this.sampleEvery:null;
  this.data.detailSchema=PERFORMANCE_DETAIL_SCHEMA;this.data.detailGroups={};
  if(mode==='light')this.data.notes[0]='Лёгкая запись: полные шаги и границы задач, без выборки внутренних этапов.';
  if(mode==='detailed')this.data.notes.push('Внутренние этапы: та же выборка шагов. Их время уже входит в общие группы; не складывать два уровня.','Этапы невложенные (ms); inclusiveMs дополнительно включает вложенные этапы и не суммируется.','Время этапа включает его временные массивы и возможную GC. Аллокации/сборка мусора отдельно не измеряются.');
  this.timerCalls=1;this.active=true;this.workerTiming.start();
  const wrap=(name,group)=>{const own=Object.getOwnPropertyDescriptor(world,name),original=world[name],profiler=this;
   world[name]=function(...args){return profiler.sampled?profiler.measure(group,()=>original.apply(this,args)):original.apply(this,args);};
   this.restores.push(()=>{if(own)Object.defineProperty(world,name,own);else delete world[name];});
  };
  // Оценка продолжения имеет тот же exclusive-бакет, что полный оценщик:
  // перенос в скалярный путь не должен приписывать её время TD-градиенту.
  if(mode==='detailed')for(const [name,group]of [['observe','memory'],['prepareDecision','evaluation'],['evaluateFrame','evaluation'],['expectedContinuation','evaluation'],['choose','selection'],['learnPending','learning'],['record','history'],['die','history']])if(typeof world[name]==='function')wrap(name,group);
  if(mode==='detailed'&&typeof world.decisionFrame==='function'){
   const own=Object.getOwnPropertyDescriptor(world,'decisionFrame'),original=world.decisionFrame,profiler=this;
   world.decisionFrame=function(...args){
    if(!profiler.sampled)return original.apply(this,args);
    const mark=profiler.beginDetail('observation');try{return original.apply(this,args);}finally{profiler.endDetail(mark);}
   };
   this.restores.push(()=>{if(own)Object.defineProperty(world,'decisionFrame',own);else delete world.decisionFrame;});
  }
  const own=Object.getOwnPropertyDescriptor(world,'step'),original=world.step,profiler=this;
  world.step=function(...args){return profiler.runStep(()=>original.apply(this,args));};
  this.restores.push(()=>{if(own)Object.defineProperty(world,'step',own);else delete world.step;});
 }
 now(){this.timerCalls++;return this.clock();}
 /** Отдельный стек сохраняет старые общие группы целиком. Детализация
  * привязана к ближайшей общей группе; одинаковые этапы оценки/TD раздельны. */
 beginDetail(phase){
  const frame={profiler:this,parent:this.stack.at(-1)?.group??'worldOther',phase,start:this.now(),children:0};
  this.detailStack.push(frame);return frame;
 }
 endDetail(frame){
  const elapsed=Math.max(0,this.now()-frame.start);this.detailStack.pop();
  const outer=this.detailStack.at(-1);if(outer&&outer.parent===frame.parent)outer.children+=elapsed;
  const group=this.data.detailGroups[frame.parent]??={};
  const bucket=group[frame.phase]??={ms:0,inclusiveMs:0,calls:0};
  bucket.ms+=Math.max(0,elapsed-frame.children);bucket.inclusiveMs+=elapsed;bucket.calls++;
 }
 /** Exclusive time: ребёнок занимает часть родителя, но учитывается только
  * в своей группе. Стек гарантированно закрывается и при исключении. */
 measure(group,fn){
  const frame=this.beginGroup(group);
  try{return fn();}finally{this.endGroup(frame);}
 }
 beginGroup(group){const frame={profiler:this,group,start:this.now(),children:0};this.stack.push(frame);return frame;}
 endGroup(frame){
   const elapsed=Math.max(0,this.now()-frame.start);this.stack.pop();
   if(this.stack.length)this.stack.at(-1).children+=elapsed;
   const bucket=this.data.groups[frame.group]??={ms:0,calls:0};bucket.ms+=Math.max(0,elapsed-frame.children);bucket.calls++;
 }
 measureUI(group,fn){return this.active&&this.running?this.measure(group,fn):fn();}
 runStep(fn){
  const s=this.world,d=this.data,population=s.agents.length,tick=s.tick,before=sumActions(s);
  this.sampled=this.mode==='detailed'&&d.steps%this.sampleEvery===0;const start=this.now();
  const previousProbe=swapComputeProbe(this.sampled?this:null);
  try{return this.sampled?this.measure('worldOther',fn):fn();}finally{
   const elapsed=Math.max(0,this.now()-start),actions=sumActions(s)-before;
   if(s.tick!==tick){d.steps++;d.actions+=actions;if(!this.running){d.stepsWhilePaused++;d.actionsWhilePaused+=actions;d.stepMsWhilePaused+=elapsed;}d.stepMs+=elapsed;d.minStepMs=d.minStepMs===null?elapsed:Math.min(d.minStepMs,elapsed);d.maxStepMs=Math.max(d.maxStepMs,elapsed);d.stepsOverFrameBudget+=Number(elapsed>8);d.populationSum+=population;d.populationMin=d.populationMin===null?population:Math.min(d.populationMin,population);d.populationMax=Math.max(d.populationMax,population);
    if(this.sampled){d.sampledSteps++;d.sampledStepMs+=elapsed;d.sampledActions+=actions;}}
   swapComputeProbe(previousProbe);this.sampled=false;
  }
 }
 /** Параллельный шаг: elapsed включает барьеры. Нельзя закрывать таймер
  * синхронной обёрткой до разрешения Promise или суммировать времена ядер. */
 async runAsyncStep(fn){
  const s=this.world,d=this.data,population=s.agents.length,tick=s.tick,before=sumActions(s),start=this.now();
  try{return await fn();}finally{
   const elapsed=Math.max(0,this.now()-start),actions=sumActions(s)-before;
   if(s.tick!==tick){d.steps++;d.actions+=actions;if(!this.running){d.stepsWhilePaused++;d.actionsWhilePaused+=actions;d.stepMsWhilePaused+=elapsed;}d.stepMs+=elapsed;d.minStepMs=d.minStepMs===null?elapsed:Math.min(d.minStepMs,elapsed);d.maxStepMs=Math.max(d.maxStepMs,elapsed);d.stepsOverFrameBudget+=Number(elapsed>8);d.populationSum+=population;d.populationMin=d.populationMin===null?population:Math.min(d.populationMin,population);d.populationMax=Math.max(d.populationMax,population);}
  }
 }
 /** Вызывать при переключении паузы, а также из rAF: без отсечения длинного
  * кадра. Интервал относится к предыдущему состоянию running. */
 setRunning(running,now=null){
  if(!this.active)return;now??=this.clock();
  if(this.running)this.data.activeMs+=Math.max(0,now-this.lastTime);
  this.lastTime=now;this.running=running;
  if(this.data.activeMs>=this.durationMs)this.stop('duration',now);
 }
 frame({target,budgetLimited,gapMs=null}){
  if(!this.active)return;const s=this.data.scheduler;s.frames++;s.budgetLimitedFrames+=Number(budgetLimited);
  if(gapMs!==null){s.frameGapSamples++;s.frameGapTotalMs+=gapMs;s.maxFrameGapMs=Math.max(s.maxFrameGapMs,gapMs);}
  if(s.targetStepsPerSecond.at(-1)!==target)s.targetStepsPerSecond.push(target);
 }
 stop(reason='manual',now=null){
  if(!this.active)return;now??=this.clock();
  if(this.running)this.data.activeMs+=Math.max(0,now-this.lastTime);
  this.active=false;this.sampled=false;this.running=false;
  this.workerTiming.stop(now);
  for(const restore of this.restores.reverse())restore();this.restores=[];
  this.data.end=performanceContext(this.world);this.data.finishedAt=new Date().toISOString();this.data.reason=reason;this.data.status='completed';
 }
 report({liveContext=true}={}){
  if(!this.data)return null;
  const d=structuredClone(this.data);if(this.active){if(liveContext)d.end=performanceContext(this.world);if(this.running)d.activeMs+=Math.max(0,this.clock()-this.lastTime);}
  d.timerCalls=this.timerCalls;
  d.workerTiming=this.workerTiming.report();
  d.scheduler.meanFrameGapMs=d.scheduler.frameGapSamples?d.scheduler.frameGapTotalMs/d.scheduler.frameGapSamples:null;
  d.rates={worldStepsPerSecond:d.activeMs?(d.steps-d.stepsWhilePaused)*1000/d.activeMs:null,residentActionsPerSecond:d.activeMs?(d.actions-d.actionsWhilePaused)*1000/d.activeMs:null,meanStepMs:d.steps?d.stepMs/d.steps:null,meanPopulation:d.steps?d.populationSum/d.steps:null};
  d.samplingCostComparison={sampledMsPerAction:d.sampledActions?d.sampledStepMs/d.sampledActions:null,unsampledMsPerAction:d.actions>d.sampledActions?(d.stepMs-d.sampledStepMs)/(d.actions-d.sampledActions):null,note:'Разные шаги, не парный тест: разница может отражать нагрузку и GC, а не только измеритель.'};
  d.sampleCoverage=d.steps?d.sampledSteps/d.steps:0;
  d.breakdown=Object.entries(d.groups).map(([id,g])=>({id,label:PERFORMANCE_LABELS[id],...g,scope:['panel','resident','chart','map','otherTabs','diagnostics'].includes(id)?'interface':'sampled-simulation'}));
  d.details=Object.entries(d.detailGroups).map(([parent,groups])=>{
   const totalMs=d.groups[parent]?.ms??0,coveredMs=Object.values(groups).reduce((n,g)=>n+g.ms,0);
   return {parent,label:PERFORMANCE_LABELS[parent],totalMs,coveredMs,unattributedMs:Math.max(0,totalMs-coveredMs),
    phases:Object.entries(groups).map(([id,g])=>({id,label:PERFORMANCE_DETAIL_LABELS[id],...g,shareOfParent:totalMs?g.ms/totalMs:null}))};
  });
  const uiMs=d.breakdown.filter(g=>g.scope==='interface').reduce((n,g)=>n+g.ms,0);
  d.unattributedActiveMs=Math.max(0,d.activeMs-(d.stepMs-d.stepMsWhilePaused)-uiMs);
  d.unattributedNote='Остаток включает ожидание кадров, браузерную раскладку, сборку мусора вне измеренных вызовов и работу измерителя; это не процент простоя CPU.';
  return d;
 }
}
