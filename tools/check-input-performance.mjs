/** Короткое парное сравнение, не полная серия браузерных замеров.
 * Подготовка/восстановление/контроль результата вынесены за замер. */
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {BENCHMARK_CASES} from '../dist/benchmark-fixtures.js';
import {benchmarkDigest} from '../dist/benchmark-state.js';
import {BENCHMARK_VERSIONS} from '../dist/benchmark-versions.js';
import {MODEL_VERSION} from '../dist/life-history.js';
import * as newFixtures from '../dist/benchmark-fixtures.js';
import * as newState from '../dist/benchmark-state.js';
import * as newBrain from '../dist/brain-controller.js';
const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
const baseline=process.argv[2]??'0.30.1';
assert.ok(BENCHMARK_VERSIONS.some(v=>v.id===baseline),'Неизвестная база сравнения');
const base=new URL(`../dist/benchmark-snapshots/${baseline}/`,import.meta.url);
const [oldFixtures,oldState,oldBrain]=await Promise.all(['benchmark-fixtures.js','benchmark-state.js','brain-controller.js'].map(name=>import(new URL(name,base).href)));
const implementations={before:{fixtures:oldFixtures,state:oldState,brain:oldBrain},
 after:{fixtures:newFixtures,state:newState,brain:newBrain}};
const report={format:'big-evolution-short-input-comparison',versions:[baseline,MODEL_VERSION],
 runtime:process.version,profileEnabled:false,gcBeforeTrial:typeof global.gc==='function',repeats:5,cases:[]};
for(const id of ['evaluator-memory','evaluator-all-actions','expected-memory','expected-all-actions','world-1000']){
 const expected=id.startsWith('expected-'),fixtureId=id.replace(/^expected-/,'evaluator-');
 const spec=BENCHMARK_CASES.find(s=>s.id===fixtureId),world=oldFixtures.createBenchmarkFixture(spec);
 const count=spec.kind==='world'?8:2048;
 for(let i=0;i<2;i++)world.step();
 const state=oldState.captureBenchmarkState(world),times={before:[],after:[]};let expectedDigest;
 for(let repeat=-1;repeat<report.repeats;repeat++){
  for(const name of repeat%2===0?['after','before']:['before','after']){
   const implementation=implementations[name],sim=implementation.state.restoreBenchmarkState(state);
   const requests=spec.kind==='evaluator'?implementation.fixtures.evaluatorRequests(sim,spec):null;
   let last;
   // При --expose-gc убираем накопленный мусор подготовки до таймера.
   // Броски/расчёт мира этот вызов не меняет; флаг сохраняется в отчёте.
   global.gc?.();
   const start=performance.now();
   for(let i=0;i<count;i++){
    if(requests){const index=i%requests.length,agent=sim.agents[index];
     last=expected?implementation.brain.expectedControllerValue(agent.brain,agent.genome,requests[index]):implementation.brain.evaluateController(agent.brain,agent.genome,requests[index]);
    }else sim.step();
   }
   const elapsed=performance.now()-start;
   const digest=await benchmarkDigest({state:implementation.state.captureBenchmarkState(sim),last});
   expectedDigest??=digest;assert.equal(digest,expectedDigest,`${id}/${repeat}/${name}: результат различается`);
   if(repeat>=0)times[name].push(elapsed);
  }
 }
 const beforeMs=median(times.before),afterMs=median(times.after);
 const result={id,work:count,times,beforeMs,afterMs,speedup:beforeMs/afterMs,digest:expectedDigest};
 report.cases.push(result);console.log(`${id}: ${beforeMs.toFixed(2)} -> ${afterMs.toFixed(2)} ms; x${result.speedup.toFixed(3)}; digests match`);
}
await mkdir(new URL('../.transfer/',import.meta.url),{recursive:true});
await writeFile(new URL(`../.transfer/input-performance-${MODEL_VERSION}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
