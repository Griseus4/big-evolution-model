/** Вкладки, история и пул браузерных испытаний.
 * Этот модуль получает только интерфейс наблюдателя обычной игры. Испытания
 * создают отдельные миры в Workers и не двигают мир на вкладке «Мир».
 * Отчёты скачиваются локально; автоматической отправки куда-либо нет.
 */
import {mutationProfile} from './mutation-parameters.js';
import {MODEL_VERSION,CAUSE_LABELS,lifeRow} from './life-history.js';
import {DEFAULT_SEEDS,BRAIN_MODES,validateExperimentConfig,experimentJobs,summarizeExperiments} from './experiment-runner.js';
import {BROWSER_CHECKS} from './browser-checks.js';
import {validateGenomeFile,RULES} from './evolution.js';
import {reproductionLabel,reproductionSummary} from './reproduction.js';
import {ACTIONS} from './evolution.js';
import {foodLabel} from './food-settings.js';
import {readFoodControls,installFoodControls} from './food-controls.js';
import {geographyLabel} from './geography.js';
import {installGenomeAnalysis} from './genome-analysis-ui.js';
import {installBenchmarkUI} from './benchmark-ui.js';
import {createLabReportBundle,interruptedLabReport} from './lab-reports.js';
import {installExperimentUI,downloadExperiment} from './experiment-ui.js';
import {installHistoryUI} from './history-ui.js';
import {createHelpButton} from './help.js';
const byId=id=>document.getElementById(id),number=v=>v===null||v===undefined?'—':Number(v).toFixed(1);
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function cell(value){const td=document.createElement('td');td.textContent=value;return td;}
export function installLabTabs({getSimulation,pauseWorld,onTabChange,getPerformanceReport=()=>null,getWorldObservation,getWorldState,suspendWorld,resumeWorld}){
 const tabs=['world','history','tests','analysis','about'];
 installGenomeAnalysis();
 let current='world',constructorUI=null;
 const testPages=['constructor','runs','benchmark','mechanisms'];
 let preferences;try{preferences=globalThis.localStorage;}catch{}
 const historyUI=installHistoryUI({getSimulation:()=>constructorUI?.getSimulation()??getSimulation(),getComparisons:()=>constructorUI?.comparisons(),prepareSimulation:options=>constructorUI?.prepareStatistics(options),getExperiment:()=>constructorUI?.analysisSeries()});
 const reports={mechanisms:null,benchmark:null,long:null};
 let testPage='constructor';
 let jobReport=null,active=false,stopping=false,pending=[],workers=[],benchBase=null,build=null,benchmarkUI=null;
 const hardware=navigator.hardwareConcurrency||2;
 byId('test-parallel').value=String(Math.min(4,Math.max(1,Math.floor(hardware/2))));
 byId('hardware-note').textContent=`Браузер сообщает ${hardware} логических потоков. Начальное число рабочих миров можно увеличить или уменьшить.`;
 byId('test-seeds').value=DEFAULT_SEEDS.join(', ');
 fetch('./build-info.json').then(r=>{if(!r.ok)throw new Error('Нет отпечатка сборки');return r.json();}).then(data=>build=data).catch(()=>{});
 // Один последний отчёт на раздел. В основном потоке нет копий миров:
 // IndexedDB сохраняет только результаты, не продолжение живой симуляции.
 const database=typeof indexedDB==='undefined'?Promise.resolve(null):new Promise(resolve=>{
  const request=indexedDB.open('big-evolution-lab-reports',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('reports');request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null);
 });
 const persistTimers=new Map();
 async function persist(key=jobReport?.kind==='checks'?'mechanisms':'long'){
  const db=await database,data=reports[key];if(!data)return;
  if(!db){byId('tests-storage-note').textContent='Локальное сохранение недоступно. Скачай JSON перед закрытием.';return;}
  try{const tx=db.transaction('reports','readwrite');tx.objectStore('reports').put(data,key);tx.onerror=()=>{byId('tests-storage-note').textContent='Браузер не смог сохранить отчёт. Скачай JSON перед закрытием.';};}
  catch{byId('tests-storage-note').textContent='Локальное сохранение недоступно. Скачай JSON перед закрытием.';}
 }
 function queuePersist(key=jobReport?.kind==='checks'?'mechanisms':'long'){
  clearTimeout(persistTimers.get(key));persistTimers.set(key,setTimeout(()=>{persistTimers.delete(key);persist(key);},1500));
 }
 async function restore(){
  const db=await database;if(!db)return;
  const tx=db.transaction('reports','readonly'),store=tx.objectStore('reports');
  const read=key=>new Promise(resolve=>{const r=store.get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>resolve(null);});
  const [mechanisms,benchmark,long,last]=await Promise.all(['mechanisms','benchmark','long','last'].map(read));
  const saved={mechanisms:mechanisms??(last?.kind==='checks'?last:null),benchmark,long:long??(last?.kind==='worlds'?last:null)};
  for(const key of ['mechanisms','benchmark','long'])if(!reports[key]&&saved[key]){
   reports[key]=interruptedLabReport(saved[key]);if(key==='benchmark')benchmarkUI?.restoreReport(reports[key]);
  }
  renderTests();
 }
 restore();
 function updateExportButton(){byId('tests-export').disabled=!Object.values(reports).some(Boolean);}
 function selectTestPage(name){
  testPage=name;document.querySelector('.diagnostics-menu').open=['benchmark','mechanisms'].includes(name);try{preferences?.setItem('big-evolution-experiment-page',name);}catch{}byId('constructor-actions').hidden=name!=='constructor';byId('legacy-test-status').hidden=!['mechanisms','benchmark','long'].includes(name);
  for(const tab of [...testPages,'long']){
   const selected=tab===name;byId(`test-tab-${tab}`).setAttribute('aria-selected',String(selected));byId(`test-tab-${tab}`).tabIndex=selected?0:-1;byId(`test-panel-${tab}`).hidden=!selected;
  }
  renderTests();
 }
 try{const saved=preferences?.getItem('big-evolution-experiment-page');if(testPages.includes(saved))testPage=saved;}catch{}
 for(const name of testPages){
  const button=byId(`test-tab-${name}`);button.addEventListener('click',()=>selectTestPage(name));
  button.addEventListener('keydown',event=>{
   const names=testPages;let index=names.indexOf(testPage);
   if(event.key==='ArrowRight')index=(index+1)%names.length;else if(event.key==='ArrowLeft')index=(index+names.length-1)%names.length;
   else if(event.key==='Home')index=0;else if(event.key==='End')index=names.length-1;else return;
   event.preventDefault();selectTestPage(names[index]);byId(`test-tab-${names[index]}`).focus();
  });
 }

 function selectTab(name){
  current=name;onTabChange?.(name);
  for(const tab of tabs){byId(`tab-${tab}`).setAttribute('aria-selected',String(tab===name));byId(`tab-${tab}`).tabIndex=tab===name?0:-1;byId(`panel-${tab}`).hidden=tab!==name;}
  byId('history-drawer-left-handle').hidden=name!=='history';if(name==='history')renderHistory(true);if(name==='tests')renderTests();
 }
 for(const name of tabs){
  const button=byId(`tab-${name}`);button.tabIndex=name==='world'?0:-1;button.addEventListener('click',()=>selectTab(name));
  button.addEventListener('keydown',event=>{let index=tabs.indexOf(current);if(event.key==='ArrowRight')index=(index+1)%tabs.length;else if(event.key==='ArrowLeft')index=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;event.preventDefault();selectTab(tabs[index]);byId(`tab-${tabs[index]}`).focus();});
 }
 function renderHistory(force=false){if(current==='history'||force)historyUI.refresh(force);}
 async function exportWorldObservation(){
  if(constructorUI?.report()){try{const selected=await constructorUI.exportObservation();await downloadExperiment('big-evolution-experiment-lives.json',{format:'big-evolution-lives',version:4,modelVersion:MODEL_VERSION,...selected});}catch(error){byId('history-error').textContent='Ошибка экспорта: '+error.message;}return;}
  try{
  const s=await getWorldObservation();download(`big-evolution-lives-seed-${s.seed}-step-${s.tick}.json`,
   {format:'big-evolution-lives',version:4,modelVersion:MODEL_VERSION,build,createdAt:new Date().toISOString(),seed:s.seed,
    actionLabels:ACTIONS.slice(),reproduction:{...s.reproduction},rules:{...RULES,regrowInterval:s.foodSettings.regrowInterval,birthThreshold:s.reproduction.energy,birthHealth:s.reproduction.health},
    settings:s.settings,
    performance:getPerformanceReport(),geography:s.geography,
    environmentChanges:s.environmentChanges,initialFoodIslands:s.initialFoodIslands,foodIslands:s.foodIslands,foodCycleStart:s.foodCycleStart,nextRegrowthTick:s.nextRegrowthTick,
    foodProductionHistory:s.foodProductionHistory,foodAvailability:s.foodAvailability?{...s.foodAvailability,prefix:Array.from(s.foodAvailability.prefix)}:null,
    stats:s.stats,balances:s.balances,history:s.history,tick:s.tick,completed:s.completed,founders:s.founders,descendants:s.descendants,byCause:s.byCause,dead:s.dead,living:s.living,omittedDetails:s.omittedDetails,
    notes:['Это наблюдение для анализа, не сохранение для продолжения симуляции.','Лежащая еда при вмешательствах сохранена; новые источники не получают дополнительного запаса.','История графика ограничена 800 точками; журнал вмешательств содержит все изменения.']});
  }catch(error){byId('error').textContent=error.message;}
 }
 byId('history-export').addEventListener('click',exportWorldObservation);
 function newReport(kind,config){return {format:'big-evolution-tests',version:4,modelVersion:MODEL_VERSION,build,actionLabels:ACTIONS.slice(),
  createdAt:new Date().toISOString(),finishedAt:null,status:'running',kind,config,
  hardware:{logicalThreads:hardware,workers:kind==='checks'?1:config.parallel},checks:[],jobs:[],
  notes:['Отчёт содержит ошибки механизмов отдельно от результатов эволюции.','Расчёт выполнен на устройстве пользователя. Отчёт не содержит пошаговых снимков.','Субъективное чувство разных геномов не является общей шкалой приспособленности.']};}
 function configFromUI(){
  return validateExperimentConfig({seeds:byId('test-seeds').value.split(/[\s,;]+/).filter(Boolean).map(Number),steps:Number(byId('test-steps').value),parallel:Number(byId('test-parallel').value),population:Number(byId('test-founders').value),limit:Number(byId('test-limit').value),geography:byId('test-geography').value,reproduction:byId('test-reproduction').value,...readFoodControls('test-'),modes:BRAIN_MODES.filter(m=>byId(`mode-${m.id}`).checked).map(m=>m.id),mutations:byId('test-mutations').checked,saveGenomes:byId('test-save-genomes').checked,upgradeMutationGenes:byId('tests-upgrade-mutations').checked,baseGenome:benchBase});
 }
 async function start(kind,ids=null){
  if(active||benchmarkUI?.isActive()||constructorUI?.isActive())return;if(typeof Worker==='undefined'){byId('tests-error').textContent='Этот браузер не поддерживает Workers. Открой лабораторию в другом браузере.';return;}
  try{
   const reportKey=kind==='checks'?'mechanisms':'long';jobReport=reports[reportKey];
   const config=kind==='checks'?{ids:ids??BROWSER_CHECKS.map(c=>c.id)}:configFromUI();
   // Повтор одной проверки дополняет только тот же отчёт/сборку.
   // Новый запуск заменяет один раздел, остальные отчёты остаются на месте.
   const retry=kind==='checks'&&ids&&jobReport?.modelVersion===MODEL_VERSION&&jobReport.build?.sourceFingerprint&&jobReport.build.sourceFingerprint===build?.sourceFingerprint;
   if(!retry)jobReport=newReport(kind,config);
   reports[reportKey]=jobReport;
   jobReport.status='running';jobReport.finishedAt=null;
   const jobs=kind==='checks'?[{id:`checks-${jobReport.jobs.length+1}`,kind:'checks',ids:config.ids}]:experimentJobs(config);
   jobReport.jobs.push(...jobs.map(job=>({id:job.id,kind:job.kind,brainType:job.brainType,seed:job.seed,scenario:job.scenario,geography:job.geography,reproduction:job.reproduction,foodSources:job.foodSources,foodRegrowInterval:job.foodRegrowInterval,foodIslandCount:job.foodIslandCount,foodPeriodSpread:job.foodPeriodSpread,foodSizeSpread:job.foodSizeSpread,individualFood:job.individualFood,mode:job.mode,status:'pending',progress:null,result:null})));
   pending=jobs.slice();active=true;stopping=false;await pauseWorld();byId('tests-error').textContent='';
   if(!active||stopping)return;
   for(let i=0;i<Math.min(kind==='checks'?1:config.parallel,jobs.length);i++){
    const worker=new Worker(new URL('./experiment-worker.js',import.meta.url),{type:'module'}),slot={worker,job:null};workers.push(slot);
    worker.onmessage=e=>message(slot,e.data);worker.onerror=e=>{e.preventDefault();workerFailure(slot,e.message||'Worker завершился с ошибкой');};worker.onmessageerror=()=>workerFailure(slot,'Не удалось прочитать сообщение Worker');
    dispatch(slot);
   }
   renderTests();queuePersist();
  }catch(error){byId('tests-error').textContent=error.message;if(jobReport){jobReport.errors??=[];jobReport.errors.push({message:error.message,at:new Date().toISOString()});}if(active)stop(true);}
 }
 function dispatch(slot){
  if(!active||stopping||!pending.length){finishIfReady();return;}
  slot.job=pending.shift();const row=jobReport.jobs.find(r=>r.id===slot.job.id);row.status='running';slot.worker.postMessage({type:'run',job:slot.job});
 }
 function message(slot,data){
  if(!active||!slot.job||slot.job.id!==data.jobId)return;const row=jobReport.jobs.find(r=>r.id===data.jobId);
  if(data.type==='check'){jobReport.checks.push({...data.result,attempt:Date.now()});queuePersist();}
  if(data.type==='progress')row.progress=data.progress;
  if(data.type==='done'){
   row.result=data.result;row.status=data.result.status;
   if(data.result.modelVersion!==MODEL_VERSION){row.status='failed';row.result.error={message:'Версия рабочего расчёта расходится с интерфейсом. Обнови страницу.'};}
   slot.job=null;queuePersist();dispatch(slot);
  }
  renderTests();
 }
 function workerFailure(slot,message){
  if(!slot.job)return;const row=jobReport.jobs.find(r=>r.id===slot.job.id);row.status='failed';row.result={status:'failed',error:{message},lastProgress:row.progress};slot.job=null;slot.worker.terminate();
  // Аварийный Worker заменяется, остальные миры продолжают независимый расчёт.
  if(!stopping&&pending.length){try{slot.worker=new Worker(new URL('./experiment-worker.js',import.meta.url),{type:'module'});slot.worker.onmessage=e=>message(slot,e.data);slot.worker.onerror=e=>{e.preventDefault();workerFailure(slot,e.message);};slot.worker.onmessageerror=()=>workerFailure(slot,'Ошибка сообщения Worker');dispatch(slot);}catch(error){pending=[];stopping=true;byId('tests-error').textContent=error.message;}}
  finishIfReady();renderTests();queuePersist();
 }
 function finishIfReady(){
  if(!active||workers.some(s=>s.job)||(!stopping&&pending.length))return;
  active=false;jobReport.status=stopping?'stopped':(jobReport.jobs.some(r=>r.status==='failed')||jobReport.checks.some(c=>c.status==='failed'))?'completed-with-errors':'completed';jobReport.finishedAt=new Date().toISOString();
  workers.forEach(s=>s.worker.terminate());workers=[];if(jobReport.kind!=='checks')jobReport.aggregates=summarizeExperiments(jobReport.jobs);persist();renderTests();
 }
 function stop(force=false){
  if(!active)return;stopping=true;pending=[];jobReport.status='stopping';for(const row of jobReport.jobs)if(row.status==='pending')row.status='not-started';
  for(const slot of workers){if(force&&slot.job){const row=jobReport.jobs.find(r=>r.id===slot.job.id);row.status='interrupted';slot.worker.terminate();slot.job=null;}else slot.worker.postMessage({type:'stop'});}
  finishIfReady();renderTests();queuePersist();
 }
 function renderTests(){
  const busy=active||benchmarkUI?.isActive()||constructorUI?.isActive();
  byId('run-checks').disabled=busy;byId('run-experiments').disabled=busy;benchmarkUI?.refresh();constructorUI?.refresh();
  byId('tests-stop').disabled=!active;byId('tests-force-stop').disabled=!active;
  updateExportButton();byId('tests-base-file').disabled=active;byId('tests-upgrade-mutations').disabled=active;byId('tests-clear-base').disabled=active||!benchBase;
  const mechanismReport=reports.mechanisms??{checks:[],jobs:[]},longReport=reports.long??{checks:[],jobs:[],build:null};
  const labels={running:'Выполняется',stopping:'Останавливается',stopped:'Остановлено',interrupted:'Прервано обновлением страницы',failed:'Ошибка',completed:'Завершено','completed-with-errors':'Завершено с ошибками'};
  const describe=(key,label)=>{const r=reports[key];return `${label}: ${r?`${labels[r.status]??r.status} · v${r.modelVersion??'неизвестно'}${key==='mechanisms'?` · результатов ${r.checks.length}, ошибок ${r.checks.filter(c=>c.status==='failed').length}`:''}`:'не запускалось'}`;};
  byId('tests-summary').textContent=[describe('mechanisms','Механизмы'),describe('benchmark','Скорость'),describe('long','Длинные испытания')].join(' | ');
  const running=active?jobReport.jobs.filter(j=>j.status==='running'):[];
  byId('tests-progress').textContent=running.map(j=>j.kind==='checks'?`Проверки: получено ${jobReport.checks.length} результатов`:`seed ${j.seed}, ${BRAIN_MODES.find(m=>m.id===j.mode)?.label}: ${j.progress?.tick??0}/${jobReport.config.steps} шагов, живых ${j.progress?.population??'—'}`).join(' · ');
  // Скрытые тяжёлые таблицы строим только при открытии их подвкладки.
  if(testPage==='mechanisms'){
  byId('check-results').replaceChildren(...mechanismReport.checks.map(check=>{
   const row=document.createElement('div');row.className=`check-result ${check.status}`;const text=document.createElement('span');text.textContent=`${check.status==='passed'?'✓':'✕'} ${check.label} (${Math.round(check.durationMs)} мс)${check.error?' — '+check.error.message:''}`;row.append(text);
   if(check.status==='failed'){const button=document.createElement('button');button.textContent='Повторить';button.disabled=busy;button.addEventListener('click',()=>start('checks',[check.id]));row.append(button,createHelpButton('retry-check'));}return row;
  }));
  }
  if(testPage==='long'){
  longReport.aggregates=summarizeExperiments(longReport.jobs);
  byId('experiment-aggregates').replaceChildren(...longReport.aggregates.map(g=>{const p=document.createElement('p');p.className='note';p.textContent=`${geographyLabel(g.geography)} · ${reproductionLabel(g.reproduction)} · ${foodLabel(g)} · ${BRAIN_MODES.find(m=>m.id===g.mode)?.label}: завершено ${g.completed}/${g.planned}, дожили ${g.survivedToEnd}/${g.completed}, ошибок ${g.failed}. Средняя наблюдаемая длительность ${number(g.meanObservedPopulationDuration)}, численность в конце ${number(g.meanEndPopulation)}, рождений ${number(g.meanBirths)}.`;return p;}));
  byId('experiment-results').replaceChildren(...longReport.jobs.filter(j=>j.kind==='world').map(job=>{
   const tr=document.createElement('tr'),r=job.result,p=r?.summary;const status=job.status==='completed'?(r.extinct?'Вымерла':'Дожила до конца'):job.status==='failed'?'Ошибка механики':job.status==='running'?'Расчёт':job.status==='pending'?'В очереди':'Прервано';
   tr.className=job.status==='failed'?'failed':'';tr.append(...[job.seed,foodLabel(job)+' · '+reproductionLabel(job.reproduction??r?.reproduction?.id),BRAIN_MODES.find(m=>m.id===job.mode)?.label,status,r?.tick??job.progress?.tick??0,p?.population??job.progress?.population??'—',p?.births??'—',number(r?.lives?.completed?.meanAge),r?.lives?.completed?.causes?.starvation??'—'].map(cell));
   if(r?.error)tr.title=r.error.message;return tr;
  }));
  if(!active)byId('tests-genomes').replaceChildren(...longReport.jobs.flatMap(job=>(job.result?.genomeSamples?.at(-1)?.genomes??[]).map(sample=>({job,sample}))).map(({job,sample})=>{
   const row=document.createElement('div');row.className='genome-sample';const label=document.createElement('span');label.textContent=`seed ${sample.genome.source.seed}, ${foodLabel(job)}, ${BRAIN_MODES.find(m=>m.id===job.mode)?.label}, шаг ${sample.tick}, №${sample.life.id} · ${{'most-children':'больше потомков','oldest':'больше возраст','highest-generation':'дальше поколение'}[sample.criterion]??sample.criterion} · значение ${sample.value}`;
   const button=document.createElement('button');button.textContent='Скачать геном';button.addEventListener('click',()=>download(`genome-seed-${sample.genome.source.seed}-${job.scenario}-${job.mode}-id-${sample.life.id}.json`,{...sample.genome,benchmarkContext:{jobId:job.id,mode:job.mode,scenario:job.scenario,foodSources:job.foodSources,foodRegrowInterval:job.foodRegrowInterval,build:longReport.build}}));row.append(label,button,createHelpButton('save-genome'));return row;
  }));
  }
 }
 byId('run-checks').addEventListener('click',()=>start('checks'));byId('run-experiments').addEventListener('click',()=>start('worlds'));
 byId('tests-stop').addEventListener('click',()=>stop());byId('tests-force-stop').addEventListener('click',()=>stop(true));
 byId('tests-export').addEventListener('click',()=>{if(reports.long)reports.long.aggregates=summarizeExperiments(reports.long.jobs);const bundle=createLabReportBundle(reports,MODEL_VERSION);if(Object.keys(bundle.sections).length)download(`big-evolution-lab-${bundle.exportedAt.replace(/[:.]/g,'-')}.json`,bundle);});
 byId('tests-base-file').addEventListener('change',async event=>{try{const file=event.target.files?.[0];if(!file)return;if(file.size>100000)throw new Error('Файл генома больше 100 КБ');benchBase=validateGenomeFile(JSON.parse(await file.text()));byId('tests-upgrade-mutations').checked=false;byId('tests-mutation-upgrade-options').hidden=Boolean(mutationProfile(benchBase));byId('tests-base-label').textContent='Один загруженный геном для всех основателей испытаний.';byId('tests-error').textContent='';renderTests();}catch(error){byId('tests-error').textContent=error.message;}});
 byId('tests-clear-base').addEventListener('click',()=>{benchBase=null;byId('tests-mutation-upgrade-options').hidden=true;byId('tests-upgrade-mutations').checked=false;byId('tests-base-file').value='';byId('tests-base-label').textContent='Случайные геномы с нуля.';renderTests();});
 // При закрытии браузер прекращает расчёт; запись прогресса делается и в процессе.
 window.addEventListener('pagehide',()=>{for(const key of ['mechanisms','benchmark','long'])if(reports[key])persist(key);});
 // Настройки испытаний независимы от обычного мира и снимком уходят в jobs.
 installFoodControls('test-');
 benchmarkUI=installBenchmarkUI({pauseWorld,isOtherTestActive:()=>active||Boolean(constructorUI?.isActive()),onBusyChange:()=>renderTests(),onReportChange:(next,finished)=>{reports.benchmark=next;updateExportButton();if(finished)persist('benchmark');else queuePersist('benchmark');}});
 constructorUI=installExperimentUI({getSimulation,getWorldState,pauseWorld:suspendWorld,resumeWorld,
  isOtherActive:()=>active||benchmarkUI.isActive(),onBusyChange:()=>renderTests(),openStatistics:()=>selectTab('history'),
  sourceChanged:(reset=false)=>{if(reset)historyUI.reset();renderHistory(true);}});
 selectTestPage(testPage);
 const initialTab=new URL(location.href).searchParams.get('tab');
 if(tabs.includes(initialTab))selectTab(initialTab);
 renderTests();return {isBenchmarkActive:()=>active||benchmarkUI.isActive()||constructorUI.isActive(),refresh:()=>renderHistory(),onRestart:()=>{historyUI.reset();if(current==='history')renderHistory(true);},currentTab:()=>current,exportWorldObservation};
}
