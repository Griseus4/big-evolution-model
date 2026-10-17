import {configurationSelection,configurationsFor,plannedConfigurationMeasurements,CONFIGURATION_PROTOCOL} from './benchmark-configurations.js';
import {BENCHMARK_MODEL_SERIES,benchmarkOrder} from './benchmark-versions.js';
import {BENCHMARK_SUITE_ID,BENCHMARK_CASES} from './benchmark-fixtures.js';
import {MODEL_VERSION} from './life-history.js';
import {loadSnapshotRuntime} from './benchmark-snapshot-runtime.js';
import {timingSummary} from './benchmark-report.js';
export async function runConfigurationBenchmarks({selections,groups,repeatCounts,build=null,hardware={},shouldStop=()=>false,onReady=()=>{},onProgress=()=>{},onCase=()=>{},loadVersion}={}){
 const selection=configurationSelection(selections,{groups,repeatCounts});
 const report={format:'big-evolution-benchmark',version:5,protocolId:CONFIGURATION_PROTOCOL,seriesId:BENCHMARK_MODEL_SERIES,suiteId:BENCHMARK_SUITE_ID,
  modelVersion:MODEL_VERSION,...selection,build,hardware,status:'running',createdAt:new Date().toISOString(),finishedAt:null,versions:[],cases:[],completedMeasurements:0,
  plannedMeasurements:plannedConfigurationMeasurements(selection,BENCHMARK_CASES),notes:[
   'Оценщик один раз на версию; полные миры — на выбранных числах вычислителей.',
   'Режимы последовательно с ротацией; отдельный прогрев перед каждым повтором, одновременно активен один пул.',
   'Единое исходное состояние в рамках версии/нагрузки. Загрузка, перенос опыта, прогрев, контрольные суммы и уступки очереди вне computeMs; обмен и барьеры шага внутри.',
   'Эффективность масштабирования не является загрузкой CPU. Автоматического подбора режима нет.']};
 const runtimes=new Map();
 const load=loadVersion??(c=>loadSnapshotRuntime(c.snapshotId,{computeWorkers:c.computeWorkers,configurationId:c.id}));
 const progress=p=>onProgress({...p,completedMeasurements:report.completedMeasurements,plannedMeasurements:report.plannedMeasurements});
 try{
  for(const config of report.configurations){if(shouldStop())break;progress({versionId:config.id,phase:'load',label:'Подготовка версии',work:0,total:0});
   const runtime=await load(config);runtimes.set(config.id,runtime);
   if(runtime.suiteId!==report.suiteId)throw new Error('Другой набор нагрузок: '+config.id);
   report.versions.push(runtime.manifest);onReady(report);
  }
  const allSpecs=runtimes.values().next().value?.specs??[],specs=allSpecs.filter(s=>report.groups.includes(s.kind));
  if(!shouldStop()&&!specs.length)throw new Error('Нет выбранных нагрузок.');
  for(const [caseIndex,spec]of specs.entries()){
   if(shouldStop())break;
   const configs=configurationsFor(report,spec),ids=configs.map(c=>c.id),states=new Map(),digests=new Map(),rows=new Map();
   const common={caseId:spec.id,label:spec.label,caseNumber:caseIndex+1,caseCount:specs.length,repeatTotal:report.repeatCounts[spec.kind]};
   for(const c of configs){
    if(shouldStop())break;const runtime=runtimes.get(c.id);
    if(JSON.stringify(runtime.specs.find(s=>s.id===spec.id))!==JSON.stringify(spec))throw new Error('Изменился состав нагрузки: '+c.id);
    if(!states.has(c.snapshotId)){const state=runtime.capture(runtime.create(spec));states.set(c.snapshotId,state);digests.set(c.snapshotId,await runtime.digest(state));}
    const row={...spec,versionId:c.id,fixtureDigest:digests.get(c.snapshotId),repeats:[]};rows.set(c.id,row);report.cases.push(row);onCase(row);
   }
   for(let repeatIndex=0;repeatIndex<common.repeatTotal&&!shouldStop();repeatIndex++){
    for(const [orderIndex,id]of benchmarkOrder(ids,repeatIndex,allSpecs.findIndex(s=>s.id===spec.id)).entries()){
     if(shouldStop())break;const c=configs.find(c=>c.id===id),runtime=runtimes.get(id),state=states.get(c.snapshotId),row=rows.get(id);
     const current={...common,versionId:id,repeat:repeatIndex+1};let measured,world;
     try{
      progress({...current,phase:'warmup',work:0,total:spec.warmup});
      if(!await runtime.workload(runtime.restore(state),spec,spec.warmup,{shouldStop,syncResult:false}))break;
      world=runtime.restore(state);runtime.check(world);progress({...current,phase:'measure',work:0,total:spec.work});
      measured=await runtime.workload(world,spec,spec.work,{shouldStop,onProgress:p=>progress({...p,...current,phase:'measure'})});
     }catch(error){throw new Error(`${id}: ${error.message}`);}finally{await runtime.dispose?.();}
     if(!measured)break;runtime.check(world);
     const resultDigest=await runtime.digest(spec.kind==='world'?runtime.capture(world):measured.last),{last,...timings}=measured;
     row.repeats.push({...timings,resultDigest,endPopulation:world.agents.length,tick:world.tick,repeatIndex,orderIndex});row.timing=timingSummary(row.repeats.map(r=>r.computeMs));
     report.completedMeasurements++;onCase(row);progress({...current,phase:'measure',work:spec.work,total:spec.work});
    }
   }
   if(!shouldStop())for(const row of rows.values())if(new Set(row.repeats.map(r=>`${r.resultDigest}:${r.actions}:${r.steps}`)).size!==1)throw new Error('Повторы расходятся: '+row.versionId);
  }
  report.status=shouldStop()?'stopped':'completed';
 }catch(error){report.status='failed';report.error={message:error.message};}
 finally{await Promise.all([...runtimes.values()].map(r=>r.dispose?.()));}
 report.finishedAt=new Date().toISOString();return report;
}
