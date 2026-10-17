/** Одна очередь, фиксированная нагрузка, самостоятельные снимки/RNG/опыт.
 * На нагрузку храним по одному исходному состоянию каждой выбранной версии.
 * Прогретые миры и измеренные экземпляры не сохраняем в отчёте. Время загрузки,
 * клонирования, контроля и SHA не входит в computeMs или wallMs. */
import {groupedBenchmarkSelection,benchmarkOrder,BENCHMARK_MODEL_SERIES,BENCHMARK_PROTOCOL} from './benchmark-versions.js';
import {loadSnapshotRuntime} from './benchmark-snapshot-runtime.js';
import {timingSummary} from './benchmark-report.js';
import {BENCHMARK_SUITE_ID} from './benchmark-fixtures.js';
import {MODEL_VERSION} from './life-history.js';
import {workerBenchmarkSelection,WORKER_BENCHMARK_PROTOCOL} from './worker-benchmark-settings.js';
import {runConfigurationBenchmarks} from './configuration-benchmark-runner.js';
export async function runVersionBenchmarks({versionIds,groups,repeatCounts,repeatCount,workerCounts,caseId,selections,build=null,hardware={},shouldStop=()=>false,
 onProgress=()=>{},onCase=()=>{},onReady=()=>{},loadVersion}={}){
 if(selections)return runConfigurationBenchmarks({selections,groups,repeatCounts,build,hardware,shouldStop,onProgress,onCase,onReady,loadVersion});
 const scaling=workerCounts!==undefined;
 const selection=scaling?workerBenchmarkSelection(workerCounts,caseId,repeatCount):groupedBenchmarkSelection(versionIds,{groups,repeatCounts:repeatCounts??(repeatCount!==undefined?{evaluator:repeatCount,world:repeatCount}:undefined)});
 const load=loadVersion??(scaling?(id=>loadSnapshotRuntime(selection.kernelVersion,{configurationId:id,computeWorkers:selection.workerCounts[selection.versionIds.indexOf(id)]})):loadSnapshotRuntime);
 const report={format:'big-evolution-benchmark',version:scaling?4:3,suiteId:BENCHMARK_SUITE_ID,seriesId:BENCHMARK_MODEL_SERIES,
  protocolId:scaling?WORKER_BENCHMARK_PROTOCOL:BENCHMARK_PROTOCOL,modelVersion:MODEL_VERSION,build,hardware,...selection,versions:[],
  createdAt:new Date().toISOString(),finishedAt:null,status:'running',cases:[],plannedMeasurements:0,completedMeasurements:0,
  notes:['Синтетические нагрузки; не проверка выживаемости.',
   scaling?'Один исходный мир, режимы последовательно с ротацией. Перед каждым повтором отдельный прогрев; одновременно активен только один пул.':'Версии последовательно, с ротацией порядка. Число вычислителей сохранено в execution; прогрев отдельно для версии/нагрузки, пул сохраняется с чистым опытом между повторами.',
   'Таймеры/объём соответствуют текущему suiteId. computeMs исключает уступки очереди; wallMs включает их.',
   'Загрузка, контрольные суммы, создание/клонирование и проверки вне таймеров. Частные буферы/кэши каждого повтора холодные.',
   'Совпадение итогов этих коротких нагрузок не доказывает эквивалентность во всех возможных мирах.']};
 const runtimes=new Map();
 try{
  for(const id of selection.versionIds){
   if(shouldStop())break;onProgress({versionId:id,phase:'load',label:'Загрузка снимка',repeat:0,work:0,total:0});
   const runtime=await load(id);if(runtime.suiteId!==report.suiteId)throw new Error('Другой набор нагрузок: '+id);
   runtimes.set(id,runtime);report.versions.push(runtime.manifest);onReady(report);
  }
  const allSpecs=runtimes.values().next().value?.specs??[];
  const specs=allSpecs.filter(spec=>selection.groups.includes(spec.kind)&&(!scaling||selection.caseIds.includes(spec.id)));
  if(scaling&&specs.length!==1&&!shouldStop())throw new Error('Не найдена выбранная нагрузка мира.');
  report.plannedMeasurements=specs.reduce((n,spec)=>n+selection.repeatCounts[spec.kind],0)*selection.versionIds.length;
  const progress=(data)=>onProgress({...data,completedMeasurements:report.completedMeasurements,plannedMeasurements:report.plannedMeasurements});
  for(const [selectedCaseIndex,spec]of specs.entries()){
   // Сохраняем положение нагрузки в полном наборе: выключение оценщиков
   // не меняет ротацию миров по сравнению с прежним протоколом.
   const caseIndex=allSpecs.findIndex(s=>s.id===spec.id),count=selection.repeatCounts[spec.kind];
   const common={caseNumber:selectedCaseIndex+1,caseCount:specs.length,repeatTotal:count};
   if(shouldStop())break;
   const states=new Map(),rows=new Map();let commonInitial=null,commonDigest=null;
   for(const id of benchmarkOrder(selection.versionIds,0,caseIndex)){
    if(shouldStop())break;const runtime=runtimes.get(id),other=runtime.specs.find(s=>s.id===spec.id);
    if(JSON.stringify(spec)!==JSON.stringify(other))throw new Error('Изменился состав нагрузки: '+id);
    // В сравнении размеров пула снимок создаётся ровно один раз. Каждый
    // прогрев/повтор восстанавливает его, включая память, обучение и RNG.
    const initial=scaling?(commonInitial??=runtime.capture(runtime.create(spec))):runtime.capture(runtime.create(spec));states.set(id,initial);
    const row={id:spec.id,versionId:id,label:spec.label,kind:spec.kind,work:spec.work,warmup:spec.warmup,seed:spec.seed,
     population:spec.population,fixtureDigest:scaling?(commonDigest??=await runtime.digest(initial)):await runtime.digest(initial),repeats:[]};
    rows.set(id,row);report.cases.push(row);onCase(row);
    if(!scaling){progress({...common,versionId:id,caseId:spec.id,label:spec.label,phase:'warmup',repeat:0,work:0,total:spec.warmup});
     if(!await runtime.workload(runtime.restore(initial),spec,spec.warmup,{shouldStop}))break;}
   }
   for(let repeatIndex=0;repeatIndex<count&&!shouldStop();repeatIndex++){
    for(const [orderIndex,id]of benchmarkOrder(selection.versionIds,repeatIndex,caseIndex).entries()){
     if(shouldStop())break;
     const runtime=runtimes.get(id),row=rows.get(id);let world;
     const current={...common,versionId:id,caseId:spec.id,label:spec.label,phase:'measure',repeat:repeatIndex+1};
     let measured;
     try{
      if(scaling){progress({...current,phase:'warmup',work:0,total:spec.warmup});
       if(!await runtime.workload(runtime.restore(states.get(id)),spec,spec.warmup,{shouldStop,syncResult:false}))break;}
      world=runtime.restore(states.get(id));runtime.check(world);
      progress({...current,work:0,total:spec.work});
      measured=await runtime.workload(world,spec,spec.work,{shouldStop,onProgress:p=>progress({...p,...current})});
     }catch(error){throw new Error(`${id}: ${error.message}`);}
     finally{if(scaling)await runtime.dispose?.();}
     if(!measured)break;runtime.check(world);
     const resultDigest=await runtime.digest(spec.kind==='world'?runtime.capture(world):measured.last);
     const {last,...timings}=measured;
     row.repeats.push({...timings,resultDigest,endPopulation:world.agents.length,tick:world.tick,repeatIndex,orderIndex});
     report.completedMeasurements++;row.timing=timingSummary(row.repeats.map(r=>r.computeMs));onCase(row);
     progress({...current,work:spec.work,total:spec.work});
    }
   }
   if(shouldStop())break;
   for(const row of rows.values())if(new Set(row.repeats.map(r=>`${r.resultDigest}:${r.actions}:${r.steps}`)).size!==1)throw new Error('Повторы расходятся: '+row.versionId+' / '+row.label);
   // Ссылки на состояния предыдущей нагрузки исчезают перед следующим случаем.
  }
  report.status=shouldStop()?'stopped':'completed';
 }catch(error){report.status='failed';report.error={message:error.message};}
 finally{await Promise.all([...runtimes.values()].map(runtime=>runtime.dispose?.()));}
 report.finishedAt=new Date().toISOString();return report;
}
