/** Один владелец мира. Каждая задача планировщика исполняет не более одного
 * целого шага: очередь команд получает управление между физическими шагами.
 * Показ/ACK не управляют расчётом. После сна долг ограничен 250 мс, шаги
 * не укрупняются, RNG и очередность Evolution.step остаются прежними. */
import {Evolution} from './evolution.js';
import {ResidentTrail,attachResidentTrail} from './resident-trail.js';
import {PerformanceProfiler} from './performance-profiler.js';
import {worldPresentation,WORLD_PROTOCOL,WORLD_UI_INTERVAL} from './world-view.js';
import {computationWorkers} from './computation-settings.js';
import {clearCognitionSummary} from './cognition-summary.js';
import {saveWorld,loadWorld,MAX_WORLD_SAVE_BYTES} from './world-save.js';
import {configureEnvironment,environmentStatus} from './automatic-environment.js';
export class WorldRuntime{
 constructor({send,clock=()=>performance.now(),wake=()=>{},cancel=()=>{},executorFactory=null}){
  Object.assign(this,{send,clock,wake,cancel,executorFactory});this.executor=null;this.epoch=0;this.sequence=0;this.world=null;
  this.running=false;this.visible=true;this.target=10;this.credit=0;this.lastTime=clock();
  this.lastPaint=-Infinity;this.inFlight=null;this.staticDirty=true;this.historyDirty=true;
  this.section='birth';this.tab='world';this.trail=new ResidentTrail();
  this.profiler=new PerformanceProfiler({clock});this.rateStart=clock();this.rateTick=0;this.actualRate=0;
  this.presentationMs=0;this.messages=0;
  this.parallelBaseline=null;this.parallelFrozen=null;this.computeMode='auto';
 }
 schedule(){if(this.running){const delay=Math.max(0,(1-this.credit)*1000/this.target);if(this.wake(delay)!==false)this.profiler.workerTiming.scheduled(delay,delay>0?Math.ceil(delay):0);}}
 resetTime(){this.profiler.workerTiming.resetBoundary();this.credit=0;this.lastTime=this.clock();this.rateStart=this.lastTime;this.rateTick=this.world?.tick??0;this.actualRate=0;}
 setRunning(value){this.running=Boolean(value&&this.world?.agents.length);this.profiler.setRunning(this.running);this.freezeParallel();this.resetTime();this.cancel();this.schedule();}
 async pulse(){
  if(!this.running)return;
  const timing=this.profiler.workerTiming;timing.beginTask();
  try{
  const now=this.clock(),elapsed=Math.max(0,Math.min(250,now-this.lastTime));this.lastTime=now;
  this.credit=Math.min(Math.max(1,this.target*.25),this.credit+elapsed*this.target/1000);
  // Дробные миллисекунды могут оставить 0.9999999999999999 вместо единицы.
  // Допуск относится только к часам планировщика, не к физике/числам мозга.
  if(this.credit>=1-1e-12){
   const start=timing.active?timing.now():null;
   try{if(this.executor){if(this.profiler.active)await this.profiler.runAsyncStep(()=>this.executor.step());else await this.executor.step();}else this.world.step();}finally{if(start!==null)timing.phase('step',start);}
   this.credit=Math.max(0,this.credit-1);this.historyDirty=true;
  }
  const end=this.clock();
  if(end-this.rateStart>=1000){this.actualRate=(this.world.tick-this.rateTick)*1000/(end-this.rateStart);this.rateStart=end;this.rateTick=this.world.tick;}
  this.profiler.frame({target:this.target,budgetLimited:false,gapMs:elapsed});
  if(!this.world.agents.length)this.setRunning(false);
  if(this.lastEnvironmentRevision!==this.world.environmentRevision)this.staticDirty=true;
  if(this.executor)await this.publish(false);else this.publish(false);this.schedule();
  }finally{
   timing.endTask();
   // Длительность записи проверяется после целого шага и закрытия задачи.
   this.profiler.setRunning(this.running);
   this.freezeParallel();
  }
 }
 async publish(force=false){
  const now=this.clock();
  if(!this.world||(!force&&(!this.visible||this.inFlight!==null||now-this.lastPaint<WORLD_UI_INTERVAL)))return;
  if(this.executor)await this.executor.syncAgent(this.selected);
  const timing=this.profiler.workerTiming,measuring=timing.active,prepareStart=measuring?timing.now():null;
  const start=this.clock(),state=worldPresentation(this.world,{selected:this.selected,trail:this.trail,
   section:this.section,history:(this.tab==='history'||this.restored)&&this.historyDirty,staticMap:this.staticDirty});
  this.lastEnvironmentRevision=this.world.environmentRevision;this.restored=false;
  state.execution={computeWorkers:this.executor?.lanes.length??1,mode:this.computeMode};
  this.presentationMs+=this.clock()-start;this.messages++;
  if(measuring)timing.phase('presentation',prepareStart);
  const sequence=++this.sequence;this.inFlight=sequence;this.lastPaint=now;this.staticDirty=false;
  if(state.lives)this.historyDirty=false;
  const message={protocol:WORLD_PROTOCOL,type:'state',epoch:this.epoch,sequence,running:this.running,
   actualRate:this.actualRate,state,profile:this.profile()};
  // Сюда входит только синхронный send/postMessage, а не доставка/ACK/DOM.
  const sendStart=measuring?timing.now():null;
  try{this.send(message);}finally{if(measuring)timing.phase('send',sendStart);}
 }
 profile(){
  const report=this.profiler.report();if(!report)return null;
  report.context.worldMode='dedicated-worker';report.context.scheduler={targetStepsPerSecond:this.target,uiIntervalMs:WORLD_UI_INTERVAL,stepsPerTask:1};
  report.context.computeWorkers??=this.executor?.lanes.length??1;
  if(report.context.computeWorkers>1&&(this.parallelFrozen||this.parallelBaseline)){report.parallel=this.parallelFrozen??this.parallelMetrics();report.detailSchema='parallel-phases-v1';report.notes.push('Параллельный stepMs включает ожидание владельцев. parallel.ownerWorkMs суммирует время нескольких потоков и не складывается с stepMs. Традиционные внутренние группы однопоточного оценщика здесь не измеряются.');}
  report.scheduler.computeBudgetMs=null;report.scheduler.maxStepsPerFrame=null;
  report.scheduler.unit='worker-tasks';report.scheduler.budgetLimitedFrames=null;
  const timing=report.workerTiming;
  report.workerTransport={presentationMs:timing.taskPhases.presentationMs+timing.outsideTasks.presentationMs,
   sendMs:timing.taskPhases.sendMs+timing.outsideTasks.sendMs,messages:timing.sendCalls};
  report.notes=report.notes.filter(n=>!n.includes('скрытая вкладка'));
  report.notes.push('Активное время включает работу скрытой вкладки. UI измеряется отдельно в главном потоке.','workerTiming: только завершённые задачи/участки; текущая отправка попадёт в следующий отчёт. ACK ограничивает снимки, не расчёт.');
  report.unattributedNote='Остаток Worker включает ожидание цели, подготовку/отправку снимков и прочую работу; UI исполняется параллельно, это не процент простоя CPU.';
  return report;
 }
 parallelMetrics(){return Object.fromEntries(Object.entries(this.executor.metrics).map(([k,v])=>[k,k==='workers'?v:v-(this.parallelBaseline?.[k]??0)]));}
 freezeParallel(){if(this.executor&&this.parallelBaseline&&!this.profiler.active&&!this.parallelFrozen)this.parallelFrozen=this.parallelMetrics();}
 async changeComputations(mode){
  const count=computationWorkers(mode,globalThis.navigator?.hardwareConcurrency??2,this.world.agents.length);
  if(count===(this.executor?.lanes.length??1)){this.computeMode=mode;return {computeWorkers:count,changed:false};}
  let next=null;const previous=this.executor;
  try{
   // Полный перенос — однократная операция пользователя на границе шага.
   // До подтверждения нового пула старый не закрывается и не меняет опыт.
   if(previous){await previous.syncAll();if(this.selected&&!this.selected.alive)await previous.syncAgent(this.selected);}
   if(count>1){next=this.executorFactory?.(this.world,{computeWorkers:count});if(!next)throw new Error('Параллельные вычислители недоступны.');await next.ready();await next.attach();}
  }catch(error){await next?.close();throw new Error(`Не удалось переключить вычислители: ${error.message} Сохранён прежний режим.`);}
  // Профиль одной конфигурации завершается до замены владельца метрик.
  this.profiler.stop('compute-workers-changed');this.freezeParallel();
  this.executor=next;this.computeMode=mode;if(next)next.retained=this.selected;else for(const agent of this.world.agents)clearCognitionSummary(agent);
  await previous?.close();this.resetTime();this.cancel();this.schedule();
  return {computeWorkers:count,changed:true};
 }
 async handle(message){
  if(message.protocol!==WORLD_PROTOCOL)return;
  const {id,epoch,type,payload={}}=message;
  if(type!=='init'&&epoch!==this.epoch)return;
  try{
   let result=null;
   if(type==='init'){
    // Создание проверяем до замены текущего мира: ошибка не уничтожает опыт.
    const next=new Evolution(payload.settings),executor=this.executorFactory?.(next,payload.settings)??null;
    if(executor)try{await executor.ready();}catch(error){throw new Error(`Не удалось запустить ${executor.lanes.length} вычислителей: ${error.message} Попробуйте меньшее число вычислителей.`);}
    this.profiler.stop('world-restarted');this.setRunning(false);if(this.executor)await this.executor.close();this.executor=executor;
    this.world=next;this.computeMode=payload.settings?.computeWorkers??'auto';this.epoch=epoch;this.sequence=0;this.inFlight=null;
    this.selected=next.agents[0]??null;attachResidentTrail(next,this.trail);this.trail.select(next,this.selected);
    if(this.executor)this.executor.retained=this.selected;
    this.staticDirty=true;this.historyDirty=true;this.resetTime();
   }else if(type==='ack'){if(this.inFlight===payload.sequence)this.inFlight=null;return;}
   else if(type==='running')this.setRunning(payload.value);
   else if(type==='computations')result=await this.changeComputations(payload.value);
   else if(type==='environment'){result=configureEnvironment(this.world,payload);this.staticDirty=true;}
   else if(type==='save-world'){
    if(this.executor)await this.executor.syncAll();
    result={name:`big-evolution-world-seed-${this.world.seed}-step-${this.world.tick}.json`,json:JSON.stringify(saveWorld(this.world))};
   }else if(type==='load-world'){
    if(typeof payload.json!=='string'||payload.json.length>MAX_WORLD_SAVE_BYTES)throw new Error('Недопустимый размер сохранения.');
    const next=loadWorld(JSON.parse(payload.json)),previous=this.executor;let executor=null;
    try{executor=this.executorFactory?.(next,{computeWorkers:this.computeMode})??null;if(executor){await executor.ready();await executor.attach();}}
    catch(error){await executor?.close();throw new Error('Не удалось подготовить загруженный мир: '+error.message);}
    this.profiler.stop('world-loaded');this.setRunning(false);this.executor=executor;this.world=next;
    this.selected=next.agents[0]??null;this.trail=new ResidentTrail();attachResidentTrail(next,this.trail);this.trail.select(next,this.selected);if(executor)executor.retained=this.selected;
    await previous?.close();this.staticDirty=true;this.historyDirty=true;this.restored=true;this.resetTime();result={seed:next.seed,tick:next.tick};
   }
   else if(type==='speed'){
    if(!Number.isFinite(payload.value)||payload.value<=0)throw new Error('Некорректная скорость.');
    this.target=payload.value;this.resetTime();this.cancel();this.schedule();
   }else if(type==='step'){this.setRunning(false);if(this.executor){if(this.profiler.active)await this.profiler.runAsyncStep(()=>this.executor.step());else await this.executor.step();}else this.world.step();this.historyDirty=true;}
   else if(type==='select'){
    const a=this.world.agents.find(a=>a.id===payload.id);
    if(a){this.selected=a;this.trail.select(this.world,a);if(this.executor)this.executor.retained=a;}
   }else if(type==='view'){
    this.visible=payload.visible;this.tab=payload.tab;this.section=payload.section;
    if(this.tab!=='world')this.setRunning(false);
   }else if(type==='food'){
    // Команда обрабатывается между целыми шагами; сохраняем режим запуска
    // и при успешном вмешательстве, и при ошибке валидации настроек.
    result=this.world.changeFoodEnvironment(payload);this.staticDirty=true;this.historyDirty=true;
   }else if(type==='genome')result=this.selected?this.world.genomeFile(this.selected):null;
   else if(type==='observation'){
    this.setRunning(false);const s=this.world;
    result={seed:s.seed,tick:s.tick,reproduction:s.reproduction,foodSettings:s.foodSettings,
     settings:{scenario:s.scenario,geography:s.geography,foodSettings:s.foodSettings,initialFoodSettings:s.initialFoodSettings,
      initialPopulation:s.initialPopulation,limit:s.limit,brainType:s.brainType,mutationProtocol:s.mutationProtocol,
      mutationRate:s.mutationRate,mutations:s.mutations,learning:s.learningEnabled,memory:s.memoryEnabled},
     geography:s.geographyInfo,automaticEnvironment:environmentStatus(s),environmentChanges:s.environmentChanges,initialFoodIslands:s.initialFoodIslands,
     foodIslands:s.foodIslands,foodCycleStart:s.foodCycleStart,nextRegrowthTick:s.nextFoodRegrowth(),
     stats:s.stats,balances:s.balances(),history:s.history,...s.lifeReport()};
   }else if(type==='profile-start'){
    this.profiler.start(this.world,{running:this.running,context:{...payload,computeWorkers:this.executor?.lanes.length??1},mode:payload.measurementMode??'detailed'});
    this.parallelBaseline=this.executor?{...this.executor.metrics}:null;this.parallelFrozen=null;
   }else if(type==='profile-stop'){this.profiler.stop(payload.reason??'manual');this.freezeParallel();result=this.profile();}
   else throw new Error('Неизвестная команда мира: '+type);
   // Принудительный снимок нужен для подтверждения команды даже в скрытом
   // окне. Обычный поток ограничен одним неподтверждённым снимком.
   // Синхронный режим остаётся синхронным до отправки reply для прежних клиентов.
   if(this.executor)await this.publish(true);else this.publish(true);
   this.send({protocol:WORLD_PROTOCOL,type:'reply',epoch:this.epoch,id,tick:this.world.tick,result});
  }catch(error){if(this.executor?.error)this.setRunning(false);this.send({protocol:WORLD_PROTOCOL,type:'reply',epoch,id,error:error.message});}
 }
}
