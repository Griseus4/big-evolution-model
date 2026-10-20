import {configurationSelection,configurationsFor,plannedConfigurationMeasurements,CONFIGURATION_PROTOCOL} from './benchmark-configurations.js';
import {BENCHMARK_CASES,BENCHMARK_SUITE_ID} from './benchmark-fixtures.js';
import {BENCHMARK_MODEL_SERIES,BENCHMARK_VERSIONS,ARCHIVED_DURATION_VERSIONS} from './benchmark-versions.js';
import {timingSummary} from './benchmark-report.js';
export function configurationLayout(report){return {versionIds:report.versionIds,groups:report.groups,repeatCounts:report.repeatCounts,specs:BENCHMARK_CASES.filter(s=>report.groups.includes(s.kind))};}
export function validateConfigurationReport(report){
 const archived=report.suiteId==='fixed-mobile-food-workloads-v1'&&report.seriesId==='mobile-food-environment-v1'||report.suiteId==='fixed-target-food-workloads-v1'&&report.seriesId==='target-food-environment-v1'||report.suiteId==='fixed-moving-food-workloads-v1'&&report.seriesId==='moving-food-islands-v1'||report.suiteId==='fixed-environment-deficit-workloads-v1'&&report.seriesId==='environment-energy-deficit-v1'||report.suiteId==='fixed-duration-workloads-v1'&&report.seriesId==='duration-attention-v1'||report.suiteId==='fixed-activity-workloads-v1'&&report.seriesId==='duration-activity-v1';
 if(report.format!=='big-evolution-benchmark'||report.protocolId!==CONFIGURATION_PROTOCOL||!archived&&(report.suiteId!==BENCHMARK_SUITE_ID||report.seriesId!==BENCHMARK_MODEL_SERIES))throw new Error('Неизвестная методика сравнения версий/вычислителей.');
 const versions=archived?ARCHIVED_DURATION_VERSIONS:[...BENCHMARK_VERSIONS,...ARCHIVED_DURATION_VERSIONS.filter(v=>v.seriesId===BENCHMARK_MODEL_SERIES)];
 const selection=configurationSelection(report.selections,{groups:report.groups,repeatCounts:report.repeatCounts,versions});
 for(const key of ['versionIds','selections','configurations','groups','repeatCounts'])if(JSON.stringify(selection[key])!==JSON.stringify(report[key]))throw new Error('Некорректный выбор конфигураций.');
 if(!['running','stopped','failed','completed'].includes(report.status))throw new Error('Некорректный статус замера.');
 const specs=configurationLayout(report).specs,expected=specs.flatMap(s=>configurationsFor(report,s).map(c=>c.id+':'+s.id)),keys=new Set();let done=0;
 if(!Array.isArray(report.cases)||report.cases.length>expected.length)throw new Error('Неверный состав нагрузок.');
 for(const row of report.cases){
  const key=row.versionId+':'+row.id,spec=specs.find(s=>s.id===row.id),config=report.configurations.find(c=>c.id===row.versionId);
  if(!expected.includes(key)||keys.has(key)||!spec||!config||['work','warmup','population','seed','kind'].some(k=>row[k]!==spec[k])||!Array.isArray(row.repeats)||row.repeats.length>report.repeatCounts[row.kind]||!/^[a-f0-9]{64}$/.test(row.fixtureDigest))throw new Error('Состав/объём конфигурации расходится.');
  keys.add(key);done+=row.repeats.length;
  for(const [i,r]of row.repeats.entries())if(!Number.isFinite(r.computeMs)||r.computeMs<=0||!Number.isFinite(r.wallMs)||r.wallMs<r.computeMs||r.work!==spec.work||r.computeWorkers!==config.computeWorkers||r.repeatIndex!==i||!Number.isInteger(r.orderIndex)||r.orderIndex<0||r.orderIndex>=configurationsFor(report,spec).length||!Number.isSafeInteger(r.steps)||r.steps<0||r.steps>spec.work||(row.kind==='evaluator'&&r.steps!==0)||!Number.isSafeInteger(r.actions)||r.actions<0||!/^[a-f0-9]{64}$/.test(r.resultDigest))throw new Error('Некорректный повтор конфигурации.');
 }
 if(!Array.isArray(report.versions)||report.versions.length>report.configurations.length||new Set(report.versions.map(v=>v.id)).size!==report.versions.length)throw new Error('Неверные сведения о снимках.');
 for(const v of report.versions){const c=report.configurations.find(c=>c.id===v.id);if(!c||v.snapshotId!==c.snapshotId||v.execution?.computeWorkers!==c.computeWorkers)throw new Error('Снимок/вычислители расходятся с настройкой.');}
 if(report.completedMeasurements!==done||report.plannedMeasurements!==plannedConfigurationMeasurements(report,specs))throw new Error('Неверный прогресс замера.');
 if(report.status==='completed'&&(keys.size!==expected.length||report.cases.some(c=>c.repeats.length!==report.repeatCounts[c.kind])||report.versions.length!==report.configurations.length))throw new Error('В завершённом отчёте не хватает повторов.');
 return report;
}
export function configurationMatrix(report){
 validateConfigurationReport(report);const layout=configurationLayout(report);
 return {...layout,rows:layout.specs.map(spec=>{
  const repeatCount=report.repeatCounts[spec.kind],cells=configurationsFor(report,spec).map(c=>{
   const row=report.cases.find(r=>r.id===spec.id&&r.versionId===c.id);
   return {...c,versionId:c.id,row,timing:row?.repeats.length?timingSummary(row.repeats.map(r=>r.computeMs)):null};
  });
  const signature=row=>new Set(row.repeats.map(r=>`${r.resultDigest}:${r.actions}:${r.steps}:${r.work}`));
  for(const cell of cells){
   const base=spec.kind==='world'?cells.find(c=>c.snapshotId===cell.snapshotId):cells[0],reasons=[];
   if(!cell.row||!base.row||cell.row.repeats.length!==repeatCount||base.row.repeats.length!==repeatCount)reasons.push('неполные повторы');
   else{if(cell.row.fixtureDigest!==base.row.fixtureDigest)reasons.push('разные исходные состояния');const a=signature(cell.row),b=signature(base.row);if(a.size!==1||b.size!==1||[...a][0]!==[...b][0])reasons.push('разные результаты/действия');}
   cell.reasons=reasons;cell.comparable=!reasons.length;cell.baseWorkers=base.computeWorkers;
   cell.speedup=cell.comparable?base.timing.medianMs/cell.timing.medianMs:null;
   cell.speedPercent=cell.speedup===null?null:(cell.speedup-1)*100;
   cell.efficiency=spec.kind==='world'&&cell.speedup!==null?cell.speedup/(cell.computeWorkers/base.computeWorkers)*100:null;
   cell.stepsPerSecond=spec.kind==='world'&&cell.timing?spec.work*1000/cell.timing.medianMs:null;
  }
  return {id:spec.id,label:spec.label,kind:spec.kind,repeatCount,cells};
 })};
}
