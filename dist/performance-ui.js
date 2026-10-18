/** Профиль основного мира. Запись не запускает и не останавливает эволюцию.
 * Большие истории жизней сюда не копируются: файл содержит только нагрузку,
 * настройки, интервалы и времена. Обычный экспорт наблюдений тоже включает профиль. */
import {MODEL_VERSION} from './life-history.js';
import {updateTextRows} from './stable-text-list.js';
const byId=id=>document.getElementById(id),fixed=n=>n==null?'—':n.toFixed(1);
export function installPerformancePanel({profiler,getSimulation,isRunning}){
 let build=null,lastRefresh=-Infinity;
 fetch('./build-info.json').then(r=>r.ok?r.json():null).then(v=>build=v).catch(()=>{});
 const runtime=()=>({modelVersion:MODEL_VERSION,build,hardware:{logicalThreads:navigator.hardwareConcurrency??null,userAgent:navigator.userAgent},pageVisibility:document.visibilityState,worldMode:'dedicated-worker',scheduler:{uiIntervalMs:200,stepsPerTask:1,targetStepsPerSecond:10*Number(byId('speed').value)}});
 const failure=error=>{byId('performance-status').textContent=error.message;};
 byId('performance-start').addEventListener('click',async()=>{
  try{await profiler.start(getSimulation(),{running:isRunning(),context:{...runtime(),measurementMode:byId('performance-mode').value||'light'}});lastRefresh=-Infinity;refresh();}catch(error){failure(error);}
 });
 byId('performance-stop').addEventListener('click',async()=>{try{await profiler.stop();lastRefresh=-Infinity;refresh();}catch(error){failure(error);}});
 byId('performance-export').addEventListener('click',async()=>{
  try{
  // Ручной экспорт закрывает текущую запись, но не ставит сам мир на паузу.
  await profiler.stop('exported');const report=profiler.report();if(!report)return;
  report.context.build??=build;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=`big-evolution-performance-seed-${report.start.seed}-step-${report.end.tick}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  lastRefresh=-Infinity;refresh();
  }catch(error){failure(error);}
 });
 function refresh(now=performance.now()){
  if(now-lastRefresh<500)return;lastRefresh=now;
  byId('performance-start').disabled=profiler.active;
  byId('performance-mode').disabled=profiler.active;
  byId('performance-stop').disabled=!profiler.active;
  byId('performance-export').disabled=!profiler.data;
  if(!profiler.data){byId('performance-status').textContent='Запись выключена. Запусти мир и нажми «Измерить 30 секунд».';return;}
  profiler.measureUI('diagnostics',()=>{
   const r=profiler.report({liveContext:false}),seconds=r.activeMs/1000;
   byId('performance-status').textContent=profiler.active?`Запись: ${fixed(seconds)}/30 активных секунд. ${isRunning()?'Мир работает.':'Пауза; время записи не расходуется.'}`:`Запись завершена: ${fixed(seconds)} активных секунд. Можно скачать JSON или начать новую запись.`;
   byId('performance-summary').textContent=`${r.mode==='light'?'Лёгкая':'Подробная'} запись. ${r.steps} Т · ${r.actions} действий жителей · ${fixed(r.rates.worldStepsPerSecond)} Т/с · ${fixed(r.rates.residentActionsPerSecond)} действий/с. Средняя стоимость 1 Т: ${fixed(r.rates.meanStepMs)} мс; самый долгий расчётный интервал: ${fixed(r.maxStepMs)} мс. Численность перед расчётом ${r.populationMin??'—'}…${r.populationMax}, средняя ${fixed(r.rates.meanPopulation)}. Подробно измерено ${r.sampledSteps} Т.`;
   const simulation=r.breakdown.filter(g=>g.scope==='sampled-simulation'),total=simulation.reduce((sum,g)=>sum+g.ms,0);
   const rows=simulation.sort((a,b)=>b.ms-a.ms).map(g=>`${g.label}: ${fixed(g.ms)} мс · ${fixed(total?g.ms*100/total:0)}% выборки · вызовов ${g.calls}`);
   if(r.workerTiming){
    const t=r.workerTiming,m=t.metrics,p=t.taskPhases;
    rows.unshift('Границы расчётного цикла (прошедшее время, не загрузка CPU):',
     `Завершено задач: ${m.task.count}; внутри них шаги ${fixed(p.stepMs)} мс, подготовка снимков ${fixed(p.presentationMs)} мс, отправка ${fixed(p.sendMs)} мс, прочее ${fixed(p.otherMs)} мс.`,
     `Между задачами: среднее ${fixed(m.interTaskGap.meanMs)} мс, максимум ${fixed(m.interTaskGap.maxMs)} мс.`,
     `От запроса до запуска: среднее ${fixed(m.queue.meanMs)} мс; запрошено ${fixed(m.requestedDelay.meanMs)} мс, с округлением таймера ${fixed(m.effectiveDelay.meanMs)} мс; превышение в среднем ${fixed(m.late.meanMs)} мс.`,
     `Подготовка/отправка вне расчётных задач (например, команды): ${fixed(t.outsideTasks.presentationMs)} / ${fixed(t.outsideTasks.sendMs)} мс.`,
     'Промежутки могут включать команды, GC и ожидание ОС. CPU-время и отдельное время GC здесь не измерены.');
   }
   if(r.details?.length){
    rows.push('Внутри общих групп — та же выборка. Эти времена уже входят в строки выше:');
    for(const detail of r.details){
     rows.push(`${detail.label}:`);
     for(const phase of [...detail.phases].sort((a,b)=>b.ms-a.ms)){
      rows.push(`  ${phase.label}: ${fixed(phase.ms)} мс · ${fixed(phase.shareOfParent===null?null:phase.shareOfParent*100)}% группы · участков ${phase.calls}`);
      if(phase.id==='afterUpdate')rows.push(`  Проверка Q после обучения целиком: ${fixed(phase.inclusiveMs)} мс (включает свои прямые проходы и сборку весов; отдельно не складывать).`);
     }
     rows.push(`  Прочая работа группы и измерителя: ${fixed(detail.unattributedMs)} мс.`);
    }
   }
   if(r.parallel){const p=r.parallel;rows.push(`Параллельный мир: ${p.workers} вычислителя, ${p.substeps} подшагов.`,
    `Упаковка наблюдений: ${fixed(p.packMs)} мс; оценка с обменом/ожиданием: ${fixed(p.evaluateMs)} мс; подтверждение решений: ${fixed(p.commitMs)} мс.`,
    `Работа владельцев суммарно: ${fixed(p.ownerWorkMs)} мс; это несколько потоков, со временем шага не складывать.`,
    `Чтение подробностей жителя: ${fixed(p.snapshotMs)} мс; передано наблюдений ${(p.inputBytes/1048576).toFixed(2)} МиБ, результатов ${(p.resultBytes/1048576).toFixed(2)} МиБ.`,
    'Внутренние группы однопоточного мозга для пула не измеряются. Все времена — прошедшее время, не загрузка CPU.');}
   rows.push('Интерфейс за весь интервал:');
   rows.push(...r.breakdown.filter(g=>g.scope==='interface').map(g=>`${g.label}: ${fixed(g.ms)} мс · вызовов ${g.calls}`));
   updateTextRows(byId('performance-breakdown'),rows);
  });
 }
 return {refresh};
}
