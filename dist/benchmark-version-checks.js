import {NEURAL_BRAIN_TYPE} from './neural-layout.js';
/** Пользователь запускает эти проверки в «Механизмах». Очередь проверяется
 * через маленький исполнитель-заглушку: она не измеряет скорость процессора
 * и не требует длительных миров. Отдельно проверяются реальные файлы снимков. */
import {benchmarkSelection,groupedBenchmarkSelection,benchmarkOrder,BENCHMARK_VERSIONS} from './benchmark-versions.js';
import {BENCHMARK_CASES,BENCHMARK_SUITE_ID,createBenchmarkFixture,evaluatorRequests} from './benchmark-fixtures.js';
import {BENCHMARK_MODEL_SERIES,BENCHMARK_PROTOCOL,BENCHMARK_CURRENT_KERNEL} from './benchmark-versions.js';
import {benchmarkMatrix,validateBenchmarkReport} from './benchmark-report.js';
import {runVersionBenchmarks} from './benchmark-comparison-runner.js';
import {randomExperienceSeed} from './random-seed.js';
import {neuralInputs} from './neural-brain.js';
import {referenceInputs} from './neural-v018-reference.js';
import {spatialContext} from './cognition.js';
import {localNeighbours} from './navigation.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const rejects=fn=>{let caught=false;try{fn();}catch{caught=true;}assert(caught,'Некорректные данные приняты');};
function reportFixture(){
 const ids=['0.25.0','0.25.1','0.25.2']; // синтетическая матрица, не опубликованные снимки
 return {format:'big-evolution-benchmark',version:2,suiteId:BENCHMARK_SUITE_ID,seriesId:BENCHMARK_MODEL_SERIES,protocolId:BENCHMARK_PROTOCOL,
  status:'completed',versionIds:ids,repeatCount:2,versions:ids.map(id=>({id})),cases:BENCHMARK_CASES.flatMap(spec=>ids.map((versionId,j)=>({
   id:spec.id,label:spec.label,kind:spec.kind,work:spec.work,warmup:spec.warmup,seed:spec.seed,population:spec.population,versionId,fixtureDigest:'a'.repeat(64),repeats:[0,1].map(i=>({
    computeMs:40-j*10+i,wallMs:60+i,work:spec.work,actions:100,steps:spec.kind==='world'?64:0,resultDigest:'b'.repeat(64),repeatIndex:i,orderIndex:j}))})))};
}
function fakeLoader(log,specs=[BENCHMARK_CASES[3]]){return async id=>({manifest:{id},suiteId:BENCHMARK_SUITE_ID,specs,
 create:()=>({tick:0,agents:[]}),capture:world=>structuredClone(world),restore:state=>structuredClone(state),check:()=>{},digest:async value=>value?.tick?'b'.repeat(64):'a'.repeat(64),
 async workload(world,spec,count,{shouldStop}){if(shouldStop())return null;log.push({id,count,caseId:spec.id,kind:spec.kind});if(spec.kind==='world')world.tick=count;
  return {computeMs:10,wallMs:11,work:count,actions:count*150,steps:spec.kind==='world'?count:0,last:null};}});}
export const BENCHMARK_VERSION_CHECKS=[
 {id:'benchmark-version-order',label:'Версии: выбор и ротация не меняют исходные списки',run(){
  const ids=['A','B','C'];assert(benchmarkOrder(ids,0).join()==='A,B,C'&&benchmarkOrder(ids,1).join()==='B,C,A'&&benchmarkOrder(ids,2).join()==='C,A,B','Нет ротации');
  assert(ids.join()==='A,B,C','Изменён исходный список');
  const available=BENCHMARK_VERSIONS.map(v=>v.id);assert(benchmarkSelection(available,10).repeatCount===10,'Потеряны 10 повторов');
  assert(available.includes(BENCHMARK_CURRENT_KERNEL),'Текущее расчётное ядро отсутствует в списке замеров');
  assert(benchmarkSelection(available,100).repeatCount===100,'Верхняя граница 100 недоступна');
  for(const count of [0,101,1.5,NaN])rejects(()=>benchmarkSelection(available,count));rejects(()=>benchmarkSelection([],10));rejects(()=>benchmarkSelection([available[0],available[0]],10));
 }},
 {id:'benchmark-version-report',label:'Версии: неполные/различные итоги не получают проценты ускорения',run(){
  const historical=reportFixture();historical.suiteId='fixed-heritable-mutation-workloads-v1';historical.seriesId='neural-heritable-mutation-v1';
  validateBenchmarkReport(historical);
  const report=reportFixture();validateBenchmarkReport(report);const matrix=benchmarkMatrix(report);
  assert(matrix.rows.every(row=>row.cells.every(c=>c.comparable)&&row.cells[1].timeChangePercent<0),'Совпадающие итоги не сравниваются');
  report.cases[1].repeats[0].resultDigest='c'.repeat(64);assert(!benchmarkMatrix(report).rows[0].cells[1].comparable,'Изменившийся результат признан ускорением');
  report.cases[1].repeats.pop();rejects(()=>validateBenchmarkReport(report));report.status='stopped';assert(benchmarkMatrix(report).rows[0].cells[1].timeChangePercent===null,'Неполный запуск сравнивается');
  report.seriesId='other';rejects(()=>validateBenchmarkReport(report));
 }},
 {id:'benchmark-version-queue',label:'Версии: повторы чередуются, прогрев не попадает в результаты',async run(){
  const ids=BENCHMARK_VERSIONS.map(v=>v.id),log=[];
  const report=await runVersionBenchmarks({versionIds:ids,repeatCount:3,loadVersion:fakeLoader(log)});
  assert(report.status==='completed'&&report.cases.every(c=>c.repeats.length===3),'Не все версии измерены');
  const measured=log.filter(r=>r.count===64);assert(measured.map(r=>r.id).join()===Array.from({length:3},(_,i)=>benchmarkOrder(ids,i)).flat().join(),'Очередь не чередуется');
  assert(log.filter(r=>r.count===8).length===ids.length,'Неверное число прогревов');
 }},
 {id:'benchmark-version-stop',label:'Версии: остановка сохраняет повторы и не объявляет запуск завершённым',async run(){
  const ids=BENCHMARK_VERSIONS.map(v=>v.id),log=[];
  const report=await runVersionBenchmarks({versionIds:ids,repeatCount:10,loadVersion:fakeLoader(log),shouldStop:()=>log.filter(r=>r.count===64).length>=1});
  assert(report.status==='stopped'&&report.cases.reduce((n,c)=>n+c.repeats.length,0)===1,'Остановка потеряла итог или продолжила очередь');
 }},
 {id:'benchmark-snapshot-integrity',label:'Версии: модули всех снимков совпадают с сохранёнными SHA-256',async run(){
  for(const entry of BENCHMARK_VERSIONS){
   const root=new URL(entry.path,import.meta.url),response=await fetch(new URL('manifest.json',root));assert(response.ok,'Нет манифеста снимка');
   const manifest=await response.json();assert(manifest.id===entry.id&&manifest.seriesId===BENCHMARK_MODEL_SERIES,'Другая версия/серия');
   for(const [name,expected]of Object.entries(manifest.files)){
    const file=await fetch(new URL(name,root));assert(file.ok,'Нет файла '+name);
    const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    const actual=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');assert(actual===expected,'Изменился снимок '+entry.id+'/'+name);
   }
  }
 }},
 {id:'benchmark-group-selection',label:'Группы: независимые повторы и выключенные поля проверяются правильно',run(){
  const ids=BENCHMARK_VERSIONS.map(v=>v.id),defaults=groupedBenchmarkSelection(ids);
  assert(defaults.repeatCounts.evaluator===50&&defaults.repeatCounts.world===15,'Начальные повторы неверны');
  const only=groupedBenchmarkSelection(ids,{groups:['world'],repeatCounts:{evaluator:NaN,world:100}});
  assert(only.groups.join()==='world'&&only.repeatCounts.world===100&&!('evaluator' in only.repeatCounts),'Выключенная группа вмешалась');
  rejects(()=>groupedBenchmarkSelection(ids,{groups:[]}));rejects(()=>groupedBenchmarkSelection(ids,{groups:['unknown']}));
  rejects(()=>groupedBenchmarkSelection(ids,{groups:['world'],repeatCounts:{world:101}}));
 }},
 {id:'benchmark-group-report',label:'Группы: v3 сохраняет разные числа, исключает невыбранное и читает v2',run(){
  const legacy=reportFixture();validateBenchmarkReport(legacy);assert(benchmarkMatrix(legacy).rows.length===6,'Потерян v2');
  const report={...legacy,version:3,groups:['evaluator','world'],repeatCounts:{evaluator:2,world:1},cases:structuredClone(legacy.cases)};
  for(const row of report.cases)if(row.kind==='world')row.repeats=row.repeats.slice(0,1);
  validateBenchmarkReport(report);assert(benchmarkMatrix(report).rows.every(row=>row.repeatCount===(row.kind==='world'?1:2)),'Потеряны разные числа повторов');
  report.groups=['world'];report.repeatCounts={world:1};report.cases=report.cases.filter(row=>row.kind==='world');
  assert(benchmarkMatrix(report).rows.length===3,'Выключенные нагрузки показаны как недостающие');
  report.cases[0].repeats=[];rejects(()=>validateBenchmarkReport(report));report.status='stopped';validateBenchmarkReport(report);
  assert(benchmarkMatrix(report).rows[0].cells[0].timeChangePercent===null,'Частичный мир получил ускорение');
 }},
 {id:'benchmark-group-queue',label:'Группы: очередь исполняет только выбранные нагрузки и правильно считает прогресс',async run(){
  const ids=BENCHMARK_VERSIONS.map(v=>v.id),log=[];
  const report=await runVersionBenchmarks({versionIds:ids,groups:['world'],repeatCounts:{world:2},loadVersion:fakeLoader(log,BENCHMARK_CASES)});
  assert(report.status==='completed'&&report.cases.length===3*ids.length,'Не все выбранные нагрузки завершены');
  assert(log.every(row=>row.kind==='world'),'Оценщик запущен без галочки');
  assert(report.completedMeasurements===6*ids.length&&report.plannedMeasurements===6*ids.length,'Прогресс неправильный');validateBenchmarkReport(report);
  for(const [caseIndex,spec]of BENCHMARK_CASES.entries())if(spec.kind==='world'){
   const measured=log.filter(row=>row.caseId===spec.id&&row.count===spec.work);
   assert(measured.map(row=>row.id).join()===Array.from({length:2},(_,i)=>benchmarkOrder(ids,i,caseIndex)).flat().join(),'Изменён порядок после выключения группы');
  }
 }},
 {id:'random-seed-entropy',label:'Случайный seed: границы/повтор номера, энтропия независима от мира',run(){
  const values=[0,42,99];let reads=0;
  assert(randomExperienceSeed(42,buffer=>{buffer[0]=values[reads++];})===99&&reads===3,'Не исключены ноль/прежний номер');
  assert(randomExperienceSeed(42,buffer=>{buffer[0]=4294967295;})===4294967295,'Верхняя граница потеряна');
  rejects(()=>randomExperienceSeed(42,buffer=>{buffer[0]=0;}));
 }},
 {id:'input-full-initialization',label:'Оптимизация 0.24: новые массивы полностью заполнены, числа и владение прежние',run(){
  const spec=BENCHMARK_CASES[2],world=createBenchmarkFixture(spec,{brainType:NEURAL_BRAIN_TYPE}),agent=world.agents[0],request=evaluatorRequests(world,spec)[0];
  let previous=null;
  for(const memoryEnabled of [true,false])for(const tick of [0,400]){
   const o={...request.observation,memoryEnabled,tick},potentials=memoryEnabled?spatialContext(agent.brain,[o.position,...localNeighbours(agent.brain)],tick):Array(7).fill(0);
   for(const candidate of request.candidates){
    const actual=neuralInputs(agent.brain,o,candidate,potentials),expected=referenceInputs(agent.brain,o,candidate,potentials);
    assert(Object.keys(actual.input).length===32&&Object.keys(actual.features).length===9,'В массиве остались незаписанные слоты');
    for(const key of ['input','features','senses'])assert(actual[key].length===expected[key].length&&actual[key].every((v,i)=>Object.is(v,expected[key][i])),'Изменились '+key);
    if(previous)assert(previous.input!==actual.input&&previous.features!==actual.features&&previous.senses!==actual.senses,'Исторические данные переиспользованы');
    previous=actual;
   }
  }
 }},
];
