/** Версия расчёта и размер пула — разные оси опыта. Оценщик измеряется
 * единожды на версию, а каждый полный мир — на каждом выбранном размере. */
import {BENCHMARK_VERSIONS,groupedBenchmarkSelection} from './benchmark-versions.js';
export const CONFIGURATION_PROTOCOL='rotating-version-worker-v1';
export function configurationSelection(selections,{groups,repeatCounts,versions=BENCHMARK_VERSIONS}={}){
 if(!Array.isArray(selections)||!selections.length)throw new Error('Выбери хотя бы одну версию.');
 const selection=groupedBenchmarkSelection(selections.map(s=>s.versionId),{groups,repeatCounts,versions});
 const ordered=selection.versionIds.map(id=>{
  const entry=versions.find(v=>v.id===id),chosen=selections.find(s=>s.versionId===id).workerCounts;
  if(!Array.isArray(chosen)||!chosen.length||new Set(chosen).size!==chosen.length||chosen.some(n=>!entry.workerCounts.includes(n)))throw new Error(`Версия ${id}: выбери поддерживаемое число вычислителей.`);
  return {versionId:id,workerCounts:entry.workerCounts.filter(n=>chosen.includes(n))};
 });
 const configurations=ordered.flatMap(s=>[
  ...(selection.groups.includes('evaluator')?[{id:s.versionId+'@evaluator',snapshotId:s.versionId,kind:'evaluator',computeWorkers:1}]:[]),
  ...(selection.groups.includes('world')?s.workerCounts.map(n=>({id:s.versionId+'@'+n,snapshotId:s.versionId,kind:'world',computeWorkers:n})):[])
 ]);
 return {...selection,selections:ordered,configurations};
}
export const configurationsFor=(report,spec)=>report.configurations.filter(c=>c.kind===spec.kind);
export const plannedConfigurationMeasurements=(report,specs)=>specs.filter(s=>report.groups.includes(s.kind)).reduce((sum,s)=>sum+report.repeatCounts[s.kind]*configurationsFor(report,s).length,0);
