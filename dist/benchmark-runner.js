/** Один Worker, фиксированный объём, три повтора. Нет профилирующих обёрток,
 * карты и сообщений на каждое действие. Таймер обрамляет пакет вычислений,
 * уступка очереди нужна для остановки; её время записано отдельно в wallMs.
 * Создание, клонирование, проверка балансов и SHA-256 находятся вне замера. */
import {MODEL_VERSION} from './life-history.js';
import {evaluateController} from './brain-controller.js';
import {checkInvariants} from './experiment-runner.js';
import {BENCHMARK_CASES,BENCHMARK_REPEATS,BENCHMARK_SUITE_ID,createBenchmarkFixture,evaluatorRequests} from './benchmark-fixtures.js';
import {captureBenchmarkState,restoreBenchmarkState,benchmarkDigest} from './benchmark-state.js';
import {timingSummary} from './benchmark-report.js';
const yieldQueue=()=>new Promise(resolve=>setTimeout(resolve,0));
const actionCount=world=>world.stats.actions.reduce((sum,n)=>sum+n,0);
/** Пакет 64 оценок либо один полный шаг мира. Мир не дробится внутри шага:
 * так порядок жителей, RNG и обучение не зависят от расписания браузера. */
async function workload(world,spec,count,{shouldStop,onProgress=()=>{}}){
 const requests=spec.kind==='evaluator'?evaluatorRequests(world,spec):null,last=requests?Array(requests.length):null;
 const beforeActions=actionCount(world),beforeTick=world.tick,wallStart=performance.now();
 let computeMs=0,done=0,actions=0,lastProgress=wallStart;
 while(done<count){
  if(shouldStop())return null;
  const end=Math.min(count,done+(requests?64:1)),start=performance.now();
  for(;done<end;done++){
   if(requests){const index=done%requests.length,agent=world.agents[index];
    const options=evaluateController(agent.brain,agent.genome,requests[index]);last[index]=options;actions+=options.length;
   }else world.step();
  }
  computeMs+=performance.now()-start;
  const now=performance.now();if(now-lastProgress>=500){onProgress({work:done,total:count});lastProgress=now;}
  // Фоновый Worker тоже уступает очередь, чтобы принять команду остановки.
  await yieldQueue();
 }
 const wallMs=performance.now()-wallStart;
 if(shouldStop())return null;
 return {computeMs,wallMs,work:done,actions:requests?actions:actionCount(world)-beforeActions,
  steps:requests?0:world.tick-beforeTick,last};
}
export async function runBenchmarks({build=null,hardware={},onProgress=()=>{},onCase=()=>{},shouldStop=()=>false}={}){
 const report={format:'big-evolution-benchmark',version:1,suiteId:BENCHMARK_SUITE_ID,modelVersion:MODEL_VERSION,build,hardware,
  createdAt:new Date().toISOString(),finishedAt:null,status:'running',cases:[],
  notes:['Синтетические нагрузки, не доказательство полезности или устойчивости геномов.',
   'Один Worker, без отрисовки. computeMs исключает прогрев, настройку, снимки, проверки, хеширование и уступки очереди; wallMs включает уступки.',
   'Каждый повтор начинается из одного снимка. Кэши пространства и частные буферы сети начинают холодными.',
   'Миры выполняют фиксированные 64 вызова шага, после вымирания время не продвигается; численность меняется; сравниваются также итоговые состояния и число действий.',
   'Повторные оценки используют неизменные входы и штатный кэш пространственных потенциалов.',
   'Нагрузка процессора, GC, температура и фоновое ограничение браузера могут влиять на время. UA не удостоверяет устройство.']};
 try{
  for(const spec of BENCHMARK_CASES){
   if(shouldStop())break;
   const initial=captureBenchmarkState(createBenchmarkFixture(spec));
   const row={id:spec.id,label:spec.label,kind:spec.kind,work:spec.work,warmup:spec.warmup,seed:spec.seed,population:spec.population,
    fixtureDigest:await benchmarkDigest(initial),repeats:[]};
   report.cases.push(row);onProgress({caseId:spec.id,label:spec.label,phase:'warmup',repeat:0,work:0,total:spec.warmup});
   // Прогреваем функции отдельным экземпляром. Его опыт и все RNG отбрасываем.
   const warm=await workload(restoreBenchmarkState(initial),spec,spec.warmup,{shouldStop});if(!warm)break;
   for(let repeat=1;repeat<=BENCHMARK_REPEATS;repeat++){
    if(shouldStop())break;
    const world=restoreBenchmarkState(initial);checkInvariants(world);
    onProgress({caseId:spec.id,label:spec.label,phase:'measure',repeat,work:0,total:spec.work});
    const measured=await workload(world,spec,spec.work,{shouldStop,onProgress:p=>onProgress({...p,caseId:spec.id,label:spec.label,phase:'measure',repeat})});
    if(!measured)break;
    checkInvariants(world);
    const resultDigest=await benchmarkDigest(spec.kind==='world'?captureBenchmarkState(world):measured.last);
    const {last,...timings}=measured;row.repeats.push({...timings,resultDigest,endPopulation:world.agents.length,tick:world.tick});
    onCase(row);
   }
   if(row.repeats.length!==BENCHMARK_REPEATS)break;
   const signatures=row.repeats.map(r=>`${r.resultDigest}:${r.actions}:${r.steps}`);
   if(new Set(signatures).size!==1)throw new Error('Повторы дали разные результаты: '+row.label);
   row.timing=timingSummary(row.repeats.map(r=>r.computeMs));
  }
  report.status=shouldStop()?'stopped':'completed';
 }catch(error){report.status='failed';report.error={message:error.message};}
 report.finishedAt=new Date().toISOString();return report;
}
