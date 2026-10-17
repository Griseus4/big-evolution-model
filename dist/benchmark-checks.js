import {NEURAL_BRAIN_TYPE} from './neural-layout.js';
/** Эти проверки запускает пользователь в обычном Worker проверок. Здесь
 * проверяем восстановление опыта/RNG, воспроизводимость нагрузок и отказ от
 * ложного сравнения, а не устанавливаем порог «достаточно быстрой» симуляции. */
import {Evolution,RULES} from './evolution.js';
import {BENCHMARK_CASES,BENCHMARK_SUITE_ID,createBenchmarkFixture,evaluatorRequests} from './benchmark-fixtures.js';
import {captureBenchmarkState,restoreBenchmarkState,benchmarkDigest} from './benchmark-state.js';
import {runBenchmarks} from './benchmark-runner.js';
import {timingSummary,validateBenchmarkReport,compareBenchmarkReports} from './benchmark-report.js';
import {neuralInputs} from './neural-brain.js';
import {referenceInputs} from './neural-v018-reference.js';
import {spatialContext} from './cognition.js';
import {localNeighbours} from './navigation.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const exact=(a,b,message)=>assert(a.length===b.length&&a.every((v,i)=>Object.is(v,b[i])),message);
const rejects=fn=>{let rejected=false;try{fn();}catch{rejected=true;}assert(rejected,'Неверный отчёт принят');};
function reportFixture(time=10){
 return {format:'big-evolution-benchmark',version:1,suiteId:BENCHMARK_SUITE_ID,status:'completed',hardware:{workers:1},cases:BENCHMARK_CASES.map(spec=>({
  id:spec.id,label:spec.label,kind:spec.kind,work:spec.work,fixtureDigest:'a'.repeat(64),repeats:[time,time+1,time+2].map(computeMs=>({computeMs,wallMs:computeMs+5,work:spec.work,steps:spec.kind==='world'?spec.work:0,actions:100,resultDigest:'b'.repeat(64)}))}))};
}
export const BENCHMARK_CHECKS=[
 {id:'benchmark-state-restore',label:'Замеры: снимок восстанавливает опыт, RNG, историю и независимые буферы',async run(){
  const world=new Evolution({population:6,limit:20,seed:42});
  world.agents[0].age=RULES.maxAge-1; // Проверочный пожилой основатель: снимок включает завершённую жизнь.
  for(let i=0;i<12;i++)world.step();
  assert(world.lifeHistory.all.count>0,'Фикстура не содержит завершённую жизнь');
  world.benchmarkAlias=world.agents[0].brain.position;
  const state=captureBenchmarkState(world),a=restoreBenchmarkState(state),b=restoreBenchmarkState(state);
  assert(a.benchmarkAlias===a.agents[0].brain.position,'Потеряны общие ссылки');
  assert(a.agents[0].brain.networkDelta!==b.agents[0].brain.networkDelta&&a.agents[0].brain.memory!==b.agents[0].brain.memory,'Повторы делят память');
  assert(await benchmarkDigest(state)===await benchmarkDigest(captureBenchmarkState(a)),'Состояние изменилось при восстановлении');
  const original=await benchmarkDigest(state);
  for(let i=0;i<40;i++){a.step();b.step();}
  assert(await benchmarkDigest(captureBenchmarkState(a))===await benchmarkDigest(captureBenchmarkState(b)),'Повторы расходятся');
  assert(await benchmarkDigest(state)===original,'Изменился исходный снимок');
  const again=restoreBenchmarkState(state);assert(await benchmarkDigest(captureBenchmarkState(again))===original,'Прогрев перенёс опыт в новый повтор');
 }},
 {id:'benchmark-fixture-determinism',label:'Замеры: фиксированные геномы, память, пища и входы воспроизводимы',async run(){
  for(const spec of [BENCHMARK_CASES[0],BENCHMARK_CASES[2],BENCHMARK_CASES[3]]){
   const a=createBenchmarkFixture(spec),b=createBenchmarkFixture(spec);
   assert(a.agents.length===spec.population,'Неверное число основателей');
   assert(await benchmarkDigest(captureBenchmarkState(a))===await benchmarkDigest(captureBenchmarkState(b)),'Фикстура различается');
   if(spec.filled)for(const agent of a.agents){assert(agent.brain.memory.size===agent.brain.traits.shortCapacity&&agent.brain.longMemory.size===agent.brain.traits.longCapacity,'Память не заполнена до личных лимитов');}
   if(spec.kind==='evaluator')assert(await benchmarkDigest(evaluatorRequests(a,spec))===await benchmarkDigest(evaluatorRequests(b,spec)),'Входы различаются');
  }
 }},
 {id:'benchmark-report-comparison',label:'Замеры: сравнение отклоняет другой объём, состояние и неполный отчёт',run(){
  const previous=reportFixture(20),current=reportFixture(10),comparison=compareBenchmarkReports(current,previous);
  assert(comparison.rows.every(r=>r.comparable&&r.speedup===21/11),'Медиана или отношение скоростей неверны');
  assert(timingSummary([30,10,20]).medianMs===20,'Медиана неверна');
  assert(timingSummary([10,30]).medianMs===20,'Медиана двух завершённых повторов неверна');
  const changed=structuredClone(current);changed.cases[0].fixtureDigest='c'.repeat(64);
  assert(!compareBenchmarkReports(changed,previous).rows[0].comparable,'Другое начальное состояние признано сопоставимым');
  changed.cases[1].repeats[0].resultDigest='d'.repeat(64);assert(!compareBenchmarkReports(changed,previous).rows[1].comparable,'Расхождение повторов проигнорировано');
  const bad=structuredClone(current);bad.cases[0].work++;rejects(()=>validateBenchmarkReport(bad));
  bad.cases=current.cases.slice(1);rejects(()=>validateBenchmarkReport(bad));
  rejects(()=>compareBenchmarkReports({...current,status:'stopped'},previous));
 }},
 {id:'benchmark-stop-empty',label:'Замеры: ранняя остановка не выдаёт неполный запуск за успешный',async run(){
  const report=await runBenchmarks({shouldStop:()=>true});
  assert(report.status==='stopped'&&report.cases.length===0,'Остановка не сработала');validateBenchmarkReport(report);
 }},
 {id:'optimization-memory-input-reuse',label:'Оптимизация: один поиск памяти, свежие входы и точное совпадение с 0.18',run(){
  const spec=BENCHMARK_CASES[2],world=createBenchmarkFixture(spec,{brainType:NEURAL_BRAIN_TYPE}),agent=world.agents[0],request=evaluatorRequests(world,spec)[0];
  let reads=0;class CountMap extends Map{get(key){reads++;return super.get(key);}}
  agent.brain.memory=new CountMap(agent.brain.memory);agent.brain.longMemory=new CountMap(agent.brain.longMemory);
  for(const memoryEnabled of [true,false])for(const tick of [0,20,400]){
   const o={...request.observation,memoryEnabled,tick},potentials=memoryEnabled?spatialContext(agent.brain,[o.position,...localNeighbours(agent.brain)],tick):Array(7).fill(0);
   for(const candidate of request.candidates){
    reads=0;const actual=neuralInputs(agent.brain,o,candidate,potentials);
    assert(reads<=(memoryEnabled?2:0),'Повторный поиск записи или чтение выключенной памяти');
    const reference=referenceInputs(agent.brain,o,candidate,potentials);exact(actual.input,reference.input,'Вход отличается');exact(actual.features,reference.features,'Признаки отличаются');
   }
  }
  // Пересмотр записи в том же tick должен немедленно попасть в следующий вход.
  const record=Array.from(agent.brain.memory.values()).find(r=>r.q===agent.brain.position.q&&r.r===agent.brain.position.r);
  const o=request.observation,waiting=request.candidates.find(c=>c.action===8);
  const oldPotentials=spatialContext(agent.brain,[o.position,...localNeighbours(agent.brain)],o.tick),before=neuralInputs(agent.brain,o,waiting,oldPotentials).input;
  record.food=5;record.maxFoodSeen=5;record.foodTotal+=5;record.samples++;agent.brain.spatialCache=null;
  const potentials=spatialContext(agent.brain,[o.position,...localNeighbours(agent.brain)],o.tick);
  assert(before[30]!==neuralInputs(agent.brain,o,waiting,potentials).input[30],'Пересмотр пищи не отразился во входе');
  for(const c of request.candidates)exact(neuralInputs(agent.brain,o,c,potentials).input,referenceInputs(agent.brain,o,c,potentials).input,'Устаревшее воспоминание');
 }},
];
