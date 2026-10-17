/** Выбор снимков не импортирует их физику в UI. Один Worker считает версии
 * последовательно; главному потоку возвращаются только времена и отпечатки.
 * Таблица перестраивается только после нового результата, не на каждом RAF. */
import {MODEL_VERSION} from './life-history.js';
import {timingSummary,validateBenchmarkReport,compareBenchmarkReports,benchmarkMatrix,benchmarkReportLayout} from './benchmark-report.js';
import {BENCHMARK_SUITE_ID,BENCHMARK_CASES} from './benchmark-fixtures.js';
import {BENCHMARK_VERSIONS,BENCHMARK_MODEL_SERIES,BENCHMARK_PROTOCOL,groupedBenchmarkSelection} from './benchmark-versions.js';
import {extractBenchmarkReport,interruptedLabReport} from './lab-reports.js';
const byId=id=>document.getElementById(id),ms=n=>n.toFixed(1)+' мс';
const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
let repeatPanelSequence=0;
const openRepeatKeys=host=>new Set([...host.querySelectorAll('button[data-repeat-key][aria-expanded="true"]')].map(button=>button.dataset.repeatKey));
function renderTable(host,report,open=openRepeatKeys(host)){
 const matrix=benchmarkMatrix(report),multiple=matrix.versionIds.length>1;
 const table=node('table',undefined,'benchmark-table'),head=node('thead'),tr=node('tr');
 tr.append(node('th','Нагрузка'));
 for(const id of matrix.versionIds)tr.append(node('th','Версия '+id));
 tr.append(node('th',multiple?'Совпадение результатов':'Повторы'));head.append(tr);table.append(head);
 let currentKind=null;
 for(const row of matrix.rows){
  if(row.kind!==currentKind){currentKind=row.kind;const groupBody=node('tbody'),group=node('tr',undefined,'benchmark-group'),label=node('th',row.kind==='evaluator'?'Оценка действий':'Полные миры');label.colSpan=matrix.versionIds.length+2;group.append(label);groupBody.append(group);table.append(groupBody);}
  const body=node('tbody'),line=node('tr'),label=node('th',row.label);line.append(label);
  for(const cell of row.cells){
   const td=node('td');
   if(!cell.timing)td.textContent='Ожидает запуска';
   else {
    td.append(node('strong',ms(cell.timing.medianMs)));
    td.append(node('small',`Диапазон ${ms(cell.timing.minMs)}…${ms(cell.timing.maxMs)} · разброс ${cell.timing.spreadPercent.toFixed(1)}%`));
    if(multiple){const delta=cell.timeChangePercent;
     td.append(node('small',delta===null?'Сравнение пока недоступно':cell===row.cells[0]?'Исходная точка':`${delta>=0?'+':''}${delta.toFixed(1)}% времени`,delta!==null&&cell!==row.cells[0]?(delta<0?'benchmark-better':'benchmark-slower'):''));
    }
   }
   line.append(td);
  }
  const reasons=[...new Set(row.cells.flatMap(c=>c.reasons))];
  line.append(node('td',multiple?(reasons.length?reasons.join('; '):'Совпадают'):`${row.cells[0].row?.repeats.length??0}/${row.repeatCount}`,
   multiple&&!reasons.length?'benchmark-better':''));body.append(line);table.append(body);
  // Одна кнопка на нагрузку раскрывает общие строки повторов. Версии стоят
  // рядом на одной высоте даже у неполного отчёта; номер — исходный repeatIndex.
  // DOM подробностей создаётся только при раскрытии, а не после каждого замера.
  const count=Math.max(0,...row.cells.map(cell=>cell.row?.repeats.length??0));
  if(!count)continue;
  const repeats=node('tbody',undefined,'benchmark-repeat-rows');repeats.id='benchmark-repeat-panel-'+(++repeatPanelSequence);repeats.hidden=true;
  const button=node('button','Показать повторы','benchmark-repeat-toggle');button.type='button';button.dataset.repeatKey=row.id;
  button.setAttribute('aria-controls',repeats.id);button.setAttribute('aria-label','Повторы: '+row.label);
  let populated=false;
  function setExpanded(expanded){
   if(expanded&&!populated){
    for(let index=0;index<count;index++){
     const sampleLine=node('tr'),number=node('th','Повтор '+(index+1));number.scope='row';sampleLine.append(number);
     for(const cell of row.cells){
      const td=node('td'),sample=cell.row?.repeats[index];
      if(!sample)td.textContent='Ещё не завершён';
      else {td.append(node('strong',ms(sample.computeMs)),node('small',`${ms(sample.wallMs)} с уступками`),node('small',`${sample.actions} ${row.kind==='world'?'действий':'вариантов'} · ${sample.steps} шагов`));}
      sampleLine.append(td);
     }
     sampleLine.append(node('td',''));repeats.append(sampleLine);
    }
    populated=true;
   }
   repeats.hidden=!expanded;button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'Скрыть повторы':'Показать повторы';
  }
  button.addEventListener('click',()=>setExpanded(repeats.hidden));label.append(button);table.append(repeats);setExpanded(open.has(row.id));
 }
 const scroll=node('div',undefined,'table-scroll');scroll.append(table);host.replaceChildren(scroll);
}
export function installBenchmarkUI({pauseWorld,isOtherTestActive,onBusyChange=()=>{},onReportChange=()=>{}}){
 let worker=null,report=null,previous=null,build=null,stopping=false,dirty=true;
 fetch('./build-info.json').then(r=>r.ok?r.json():null).then(v=>build=v).catch(()=>{});
 const active=()=>worker!==null;
 const versions=byId('benchmark-versions');
 versions.replaceChildren(...BENCHMARK_VERSIONS.map(version=>{
  const label=node('label',undefined,'benchmark-version'),input=node('input');input.type='checkbox';input.value=version.id;input.checked=true;
  label.append(input,node('span',version.label));return label;
 }));
 function renderProgress(){
  if(!report){byId('benchmark-progress').textContent='';byId('benchmark-progress-bar').value=0;return;}
  const layout=benchmarkReportLayout(report);
  const total=report.plannedMeasurements??layout.specs.reduce((n,spec)=>n+layout.repeatCounts[spec.kind],0)*layout.versionIds.length;
  const done=report.completedMeasurements??report.cases.reduce((n,row)=>n+row.repeats.length,0);
  byId('benchmark-progress').textContent=`Завершено ${done}/${total} повторов${total?` · ${(done/total*100).toFixed(1)}%`:''}. Доля повторов, не прогноз оставшегося времени.`;
  byId('benchmark-progress-bar').max=Math.max(1,total);byId('benchmark-progress-bar').value=done;
 }
 function update(){
  byId('benchmark-start').disabled=active()||isOtherTestActive();byId('benchmark-stop').disabled=!active()||stopping;
  byId('benchmark-export').disabled=!report||active();byId('benchmark-previous').disabled=active();
  for(const kind of ['evaluator','world']){byId('benchmark-group-'+kind).disabled=active();byId('benchmark-repeats-'+kind).disabled=active()||!byId('benchmark-group-'+kind).checked;}
  renderProgress();
  for(const input of versions.querySelectorAll('input'))input.disabled=active();
  if(!dirty)return;dirty=false;
  if(report){try{renderTable(byId('benchmark-results'),report);}catch(error){byId('benchmark-results').textContent='Не удалось разобрать отчёт: '+error.message;}}
  const host=byId('benchmark-comparison'),pastOpen=openRepeatKeys(host);host.replaceChildren();
  if(!previous)return;
  host.append(node('h3','Загруженный прошлый отчёт'));
  const past=node('div');renderTable(past,previous,pastOpen);host.append(past);
  if(!report||active())return;
  try{
   const comparison=compareBenchmarkReports(report,previous);
   host.append(node('p',comparison.deviceWarning?'Характеристики устройства различаются; влияние версии не установлено.':'Отдельные запуски: фоновая нагрузка и температура могли различаться.','note'));
   const table=node('table',undefined,'benchmark-table'),head=node('tr');head.append(node('th','Нагрузка'),node('th','Изменение времени'));table.append(head);
   for(const row of comparison.rows){const tr=node('tr');tr.append(node('th',row.label),node('td',row.comparable?`${row.timeChangePercent>=0?'+':''}${row.timeChangePercent.toFixed(1)}%`:row.reasons.join('; ')));table.append(tr);}
   const scroll=node('div',undefined,'table-scroll');scroll.append(table);host.append(scroll);
  }catch(error){host.append(node('p',error.message,'note'));}
 }
 function finish(message){worker?.terminate();worker=null;stopping=false;dirty=true;byId('benchmark-status').textContent=message;update();if(report)onReportChange(report,true);pauseWorld();onBusyChange();}
 function fail(message){if(report){report.status='failed';report.finishedAt=new Date().toISOString();report.error={message};}finish(message);}
 byId('benchmark-start').addEventListener('click',async()=>{
  if(active()||isOtherTestActive())return;
  try{
   const selection=groupedBenchmarkSelection([...versions.querySelectorAll('input:checked')].map(i=>i.value),{groups:['evaluator','world'].filter(kind=>byId('benchmark-group-'+kind).checked),repeatCounts:{evaluator:Number(byId('benchmark-repeats-evaluator').value),world:Number(byId('benchmark-repeats-world').value)}});
   if(typeof Worker==='undefined')throw new Error('Этот браузер не поддерживает Worker.');
   await pauseWorld();
   if(active()||isOtherTestActive())return;
   report={format:'big-evolution-benchmark',version:3,suiteId:BENCHMARK_SUITE_ID,seriesId:BENCHMARK_MODEL_SERIES,protocolId:BENCHMARK_PROTOCOL,
    modelVersion:MODEL_VERSION,build,...selection,versions:[],createdAt:new Date().toISOString(),status:'running',cases:[],completedMeasurements:0,plannedMeasurements:BENCHMARK_CASES.filter(spec=>selection.groups.includes(spec.kind)).reduce((n,spec)=>n+selection.repeatCounts[spec.kind],0)*selection.versionIds.length};
   onReportChange(report);dirty=true;
   worker=new Worker(new URL('./benchmark-worker.js',import.meta.url),{type:'module'});onBusyChange();update();
   byId('benchmark-status').textContent='Подготовка выбранных снимков…';
   worker.onmessage=event=>{
    const data=event.data;
    if(data.type==='ready'){report.versions=data.versions;onReportChange(report);}
    if(data.type==='progress'){const p=data.progress;if(p.completedMeasurements!==undefined)report.completedMeasurements=p.completedMeasurements;if(p.plannedMeasurements!==undefined)report.plannedMeasurements=p.plannedMeasurements;renderProgress();byId('benchmark-status').textContent=`${p.caseNumber?`Нагрузка ${p.caseNumber}/${p.caseCount} · `:''}${p.versionId} · ${p.label} · ${p.phase==='load'?'загрузка':p.phase==='warmup'?'прогрев':`повтор ${p.repeat}/${p.repeatTotal}`} · ${p.work}/${p.total}${stopping?' · остановка…':''}`;}
    if(data.type==='case'){const index=report.cases.findIndex(c=>c.id===data.row.id&&c.versionId===data.row.versionId);if(index<0)report.cases.push(data.row);else report.cases[index]=data.row;report.completedMeasurements=report.cases.reduce((n,row)=>n+row.repeats.length,0);onReportChange(report);dirty=true;update();}
    if(data.type==='done'){report=data.report;
     if(report.modelVersion!==MODEL_VERSION){fail('Сборка Worker расходится с интерфейсом. Обнови страницу.');return;}
     finish(report.status==='completed'?'Замеры завершены. Отрицательное изменение времени означает ускорение. Скачай JSON.':report.status==='stopped'?'Остановлено. Полученные повторы сохранены; отчёт неполный.':`Ошибка: ${report.error?.message??'неизвестная'}`);}
    if(data.type==='error')fail('Ошибка Worker: '+data.message);
   };
   worker.onerror=event=>{event.preventDefault();fail('Ошибка Worker: '+event.message);};worker.onmessageerror=()=>fail('Не удалось прочитать результат Worker.');
   worker.postMessage({type:'run',config:{...selection,build:{...build,modelVersion:MODEL_VERSION},hardware:{userAgent:navigator.userAgent,logicalThreads:navigator.hardwareConcurrency??null,deviceMemoryGB:navigator.deviceMemory??null,workers:1}}});
  }catch(error){byId('benchmark-status').textContent=error.message;if(worker||report?.status==='running')fail(error.message);else update();}
 });
 byId('benchmark-stop').addEventListener('click',()=>{if(!worker)return;stopping=true;worker.postMessage({type:'stop'});byId('benchmark-status').textContent='Остановка после текущего пакета…';update();});
 byId('benchmark-export').addEventListener('click',()=>{
  if(!report||active())return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=node('a');
  a.href=url;a.download=`big-evolution-benchmark-${report.createdAt.replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 byId('benchmark-previous').addEventListener('change',async event=>{
  try{const file=event.target.files?.[0];if(!file)return;if(file.size>64_000_000)throw new Error('Файл больше 64 МБ. Загрузи отдельный JSON замеров.');previous=validateBenchmarkReport(extractBenchmarkReport(JSON.parse(await file.text())));dirty=true;update();}
  catch(error){byId('benchmark-status').textContent=error.message;}
 });
 for(const kind of ['evaluator','world'])byId('benchmark-group-'+kind).addEventListener('change',update);
 update();return {isActive:active,refresh:update,getReport:()=>report,restoreReport:saved=>{
  if(report||active()||!saved)return;
  try{report=interruptedLabReport(validateBenchmarkReport(saved));dirty=true;byId('benchmark-status').textContent=report.interruptedByReload?'Запуск прерван перезагрузкой. Полученные повторы сохранены.':'Восстановлен последний отчёт замеров.';update();}
  catch(error){byId('benchmark-status').textContent='Прежний отчёт не загружен: '+error.message;report=null;}
 }};
}
