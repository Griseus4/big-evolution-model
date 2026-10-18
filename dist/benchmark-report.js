/** Чистые метаданные/матрицы v1–v4. Объём одного повтора прежний; число
 * повторов и выбранные группы берём из конкретного отчёта, не из UI сегодня. */
import {BENCHMARK_SUITE_ID,BENCHMARK_CASES,BENCHMARK_REPEATS} from './benchmark-fixtures.js';
import {BENCHMARK_MODEL_SERIES,BENCHMARK_PROTOCOL,MAX_BENCHMARK_REPEATS,BENCHMARK_GROUPS} from './benchmark-versions.js';
import {workerBenchmarkSelection,WORKER_BENCHMARK_PROTOCOL} from './worker-benchmark-settings.js';
import {configurationLayout,validateConfigurationReport,configurationMatrix} from './configuration-benchmark-report.js';
// Архивные отчёты читаются без загрузки старых расчётных модулей. Каждая
// нагрузка привязана к своей модели; между разными сериями ускорение не считаем.
const HISTORICAL_SERIES=Object.freeze({'fixed-activity-workloads-v1':'duration-activity-v1','fixed-duration-workloads-v1':'duration-attention-v1','fixed-neural-workloads-v1':'neural-local-body-v1',
 'fixed-food-island-workloads-v1':'neural-food-islands-v1','fixed-neighbour-workloads-v1':'neural-neighbours-v1','fixed-heritable-mutation-workloads-v1':'neural-heritable-mutation-v1'});
export function timingSummary(samples){
 const sorted=samples.slice().sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
 const median=sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
 return {medianMs:median,minMs:sorted[0],maxMs:sorted.at(-1),spreadPercent:median?(sorted.at(-1)-sorted[0])/median*100:0};
}
export function benchmarkReportLayout(report){
 if(report.version===5)return configurationLayout(report);
 const grouped=report.version>=3;
 const groups=grouped?report.groups:BENCHMARK_GROUPS;
 return {versionIds:report.version>=2?report.versionIds:[report.modelVersion??'не указана'],groups,
  specs:BENCHMARK_CASES.filter(spec=>groups.includes(spec.kind)&&(report.version!==4||report.caseIds.includes(spec.id))),
  repeatCounts:grouped?report.repeatCounts:{evaluator:report.version===2?report.repeatCount:BENCHMARK_REPEATS,world:report.version===2?report.repeatCount:BENCHMARK_REPEATS}};
}
export function validateBenchmarkReport(report){
 if(report?.version===5)return validateConfigurationReport(report);
 if(report?.format!=='big-evolution-benchmark'||![1,2,3,4].includes(report.version)||![BENCHMARK_SUITE_ID,...Object.keys(HISTORICAL_SERIES)].includes(report.suiteId))throw new Error('Нужен отчёт постоянных замеров (.json). Профиль обычного мира — другой формат.');
 const multi=report.version>=2;
 if(report.version===4){
  if(typeof report.kernelVersion!=='string')throw new Error('Не указана версия расчёта.');
  const selection=workerBenchmarkSelection(report.workerCounts,report.caseIds?.[0],report.repeatCounts?.world,report.kernelVersion);
  for(const key of ['mode','versionIds','workerCounts','caseIds','groups','repeatCounts'])if(JSON.stringify(report[key])!==JSON.stringify(selection[key]))throw new Error('Некорректная конфигурация сравнения вычислителей.');
  if(report.seriesId!==(HISTORICAL_SERIES[report.suiteId]??(report.suiteId===BENCHMARK_SUITE_ID?BENCHMARK_MODEL_SERIES:null))||report.protocolId!==WORKER_BENCHMARK_PROTOCOL)throw new Error('Неизвестная методика сравнения вычислителей.');
 }else if(multi&&(report.seriesId!==(HISTORICAL_SERIES[report.suiteId]??BENCHMARK_MODEL_SERIES)||report.protocolId!==BENCHMARK_PROTOCOL||
  !Array.isArray(report.versionIds)||!report.versionIds.length||report.versionIds.length>8||new Set(report.versionIds).size!==report.versionIds.length||
  report.versionIds.some(id=>typeof id!=='string'||!/^\d+\.\d+\.\d+$/.test(id))))throw new Error('Неизвестная серия/методика или неверный выбор версий.');
 if(report.version>=3&&(!Array.isArray(report.groups)||!report.groups.length||new Set(report.groups).size!==report.groups.length||report.groups.some(g=>!BENCHMARK_GROUPS.includes(g))||
  !report.repeatCounts||Array.isArray(report.repeatCounts)||Object.keys(report.repeatCounts).some(g=>!report.groups.includes(g))))throw new Error('Некорректные группы нагрузок.');
 const layout=benchmarkReportLayout(report);
 for(const group of layout.groups){const count=layout.repeatCounts[group];if(!Number.isInteger(count)||count<1||count>MAX_BENCHMARK_REPEATS)throw new Error('Некорректное число повторов.');}
 if(!['running','completed','stopped','failed'].includes(report.status))throw new Error('Неизвестный статус замера');
 if(!Array.isArray(report.cases)||report.cases.length>layout.specs.length*layout.versionIds.length)throw new Error('Некорректный список нагрузок');
 const ids=new Set();let completedMeasurements=0;
 for(const row of report.cases){
  const spec=layout.specs.find(c=>c.id===row.id),key=multi?row.versionId+':'+row.id:row.id;
  if(!spec||ids.has(key)||(multi&&(!report.versionIds.includes(row.versionId)||row.warmup!==spec.warmup||row.seed!==spec.seed||row.population!==spec.population))||row.work!==spec.work||row.kind!==spec.kind||!Array.isArray(row.repeats)||row.repeats.length>layout.repeatCounts[spec.kind])throw new Error('Состав/объём нагрузки не совпадает');
  ids.add(key);completedMeasurements+=row.repeats.length;
  if(report.version===4&&row.repeats.some(r=>r.computeWorkers!==report.workerCounts[report.versionIds.indexOf(row.versionId)]))throw new Error('Число вычислителей расходится с режимом.');
  if(!/^[a-f0-9]{64}$/.test(row.fixtureDigest))throw new Error('Отсутствует отпечаток начального состояния');
  for(const sample of row.repeats)if(!Number.isFinite(sample.computeMs)||sample.computeMs<=0||!Number.isFinite(sample.wallMs)||sample.wallMs<sample.computeMs||sample.work!==spec.work||!Number.isSafeInteger(sample.actions)||sample.actions<0||!Number.isSafeInteger(sample.steps)||sample.steps<0||sample.steps>spec.work||(spec.kind==='evaluator'&&sample.steps!==0)||!/^[a-f0-9]{64}$/.test(sample.resultDigest))throw new Error('Некорректный повтор замера');
 }
 if(report.status==='completed'&&(ids.size!==layout.specs.length*layout.versionIds.length||report.cases.some(c=>c.repeats.length!==layout.repeatCounts[c.kind])))throw new Error('В завершённом отчёте не хватает повторов');
 if(multi&&(!Array.isArray(report.versions)||report.versions.length>report.versionIds.length||new Set(report.versions.map(v=>v.id)).size!==report.versions.length||report.versions.some(v=>!report.versionIds.includes(v.id))||(report.status==='completed'&&report.versions.length!==report.versionIds.length)))throw new Error('Потеряны или повторяются сведения о снимках');
 if(multi)for(const row of report.cases)for(const [i,r]of row.repeats.entries())if(r.repeatIndex!==i||!Number.isInteger(r.orderIndex)||r.orderIndex<0||r.orderIndex>=report.versionIds.length)throw new Error('Неверный порядок повторов');
 if(report.version===4)for(const v of report.versions)if(v.snapshotId!==report.kernelVersion||v.execution?.computeWorkers!==report.workerCounts[report.versionIds.indexOf(v.id)])throw new Error('Потеряны сведения о расчётном режиме.');
 if(report.version>=3){
  const planned=layout.specs.reduce((n,spec)=>n+layout.repeatCounts[spec.kind],0)*layout.versionIds.length;
  if(report.completedMeasurements!==undefined&&report.completedMeasurements!==completedMeasurements)throw new Error('Прогресс расходится с числом сохранённых повторов');
  if(report.plannedMeasurements!==undefined&&report.plannedMeasurements!==planned&&!(report.plannedMeasurements===0&&!report.cases.length&&report.status!=='completed'))throw new Error('План замера расходится с группами/повторами');
 }
 return report;
}
export function compareBenchmarkReports(current,previous){
 validateBenchmarkReport(current);validateBenchmarkReport(previous);
 if(current.version===5||previous.version===5)throw new Error('Версии и вычислители сравниваются внутри таблицы своего запуска.');
 if(current.suiteId!==previous.suiteId||current.seriesId!==previous.seriesId)throw new Error('Разные модели/нагрузки: это не сравнение оптимизации.');
 if(current.status!=='completed'||previous.status!=='completed')throw new Error('Для сравнения нужны два полностью завершённых отчёта.');
 if(current.protocolId!==previous.protocolId)throw new Error('Разные методики прогрева/запуска: сравнивай режимы внутри одного отчёта.');
 if((current.version===1)!==(previous.version===1))throw new Error('Старый одиночный замер и чередующаяся серия имеют разные методики.');
 if(current.version>=2){
  if(current.versionIds.length!==1||previous.versionIds.length!==1)throw new Error('Для двух многоверсионных отчётов используй их отдельные сравнительные таблицы.');
  current={...current,cases:current.cases.filter(r=>r.versionId===current.versionIds[0])};
  previous={...previous,cases:previous.cases.filter(r=>r.versionId===previous.versionIds[0])};
 }
 const deviceWarning=JSON.stringify(current.hardware)!==JSON.stringify(previous.hardware);
 // Между одиночными v2/v3 сравниваются только реально измеренные общие нагрузки.
 const common=current.cases.filter(row=>previous.cases.some(old=>old.id===row.id));
 if(!common.length)throw new Error('Нет общих завершённых нагрузок.');
 return {deviceWarning,rows:common.map(row=>{
  const old=previous.cases.find(c=>c.id===row.id),reasons=[];
  if(row.fixtureDigest!==old.fixtureDigest)reasons.push('изменилось начальное состояние');
  const signatures=c=>c.repeats.map(r=>`${r.resultDigest}:${r.actions}:${r.work}:${r.steps}`),a=signatures(row),b=signatures(old);
  if(new Set(a).size!==1||new Set(b).size!==1||a[0]!==b[0])reasons.push('изменились результаты или объём действий');
  const now=timingSummary(row.repeats.map(r=>r.computeMs)),before=timingSummary(old.repeats.map(r=>r.computeMs));
  return {id:row.id,label:row.label,comparable:!reasons.length,reasons,current:now,previous:before,
   speedup:reasons.length?null:before.medianMs/now.medianMs,timeChangePercent:reasons.length?null:(now.medianMs/before.medianMs-1)*100};
 })};
}
/** Частичные/различные результаты видимы, но не получают проценты ускорения.
 * Выключенная группа вовсе отсутствует; её строки не выглядят незавершёнными. */
export function benchmarkMatrix(report){
 if(report.version===5)return configurationMatrix(report);
 validateBenchmarkReport(report);const layout=benchmarkReportLayout(report),versionIds=layout.versionIds;
 return {...layout,rows:layout.specs.map(spec=>{
  const count=layout.repeatCounts[spec.kind];
  const cells=versionIds.map(id=>{
   const row=report.cases.find(r=>r.id===spec.id&&(report.version===1||r.versionId===id));
   return {versionId:id,row,timing:row?.repeats.length?timingSummary(row.repeats.map(r=>r.computeMs)):null};
  });
  const base=cells[0],signature=row=>new Set(row.repeats.map(r=>`${r.resultDigest}:${r.actions}:${r.work}:${r.steps}`));
  for(const cell of cells){
   const reasons=[];
   if(!cell.row||!base.row||cell.row.repeats.length!==count||base.row.repeats.length!==count)reasons.push('неполные повторы');
   else {
    if(cell.row.fixtureDigest!==base.row.fixtureDigest)reasons.push('разные начальные состояния');
    const a=signature(cell.row),b=signature(base.row);if(a.size!==1||b.size!==1||[...a][0]!==[...b][0])reasons.push('разные результаты/действия');
   }
   cell.reasons=reasons;cell.comparable=!reasons.length;
   cell.timeChangePercent=cell.comparable?(cell.timing.medianMs/base.timing.medianMs-1)*100:null;
  }
  return {id:spec.id,label:spec.label,kind:spec.kind,repeatCount:count,cells};
 })};
}
