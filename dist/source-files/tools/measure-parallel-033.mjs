import {writeFileSync,mkdirSync} from 'node:fs';
mkdirSync(new URL('../.transfer/',import.meta.url),{recursive:true});
import {cpus} from 'node:os';
import * as old from '../dist/benchmark-snapshots/0.32.0/benchmark-fixtures.js';
import * as current from '../dist/benchmark-snapshots/0.33.0/benchmark-fixtures.js';
import {ParallelWorld} from '../dist/benchmark-snapshots/0.33.0/parallel-world.js';
import {benchmarkDigest} from '../dist/benchmark-state.js';
import {createCognitionWorker} from '../tests/node-cognition-worker.mjs';
const rows=[],repeats=3,steps=4,warmup=3,workerURL=new URL('../dist/benchmark-snapshots/0.33.0/cognition-worker.js',import.meta.url);
for(const spec of current.BENCHMARK_CASES.filter(s=>s.kind==='world')){
 let digest;
 for(let repeat=0;repeat<repeats;repeat++)for(const version of repeat%2?['0.33.0','0.32.0']:['0.32.0','0.33.0']){
  const world=(version==='0.32.0'?old:current).createBenchmarkFixture(spec),pool=version==='0.33.0'?new ParallelWorld(world,{workers:4,createWorker:()=>createCognitionWorker({url:workerURL})}):null;
  try{
   await pool?.ready();for(let i=0;i<warmup;i++){if(pool)await pool.step();else world.step();}
   const started=performance.now();for(let i=0;i<steps;i++){if(pool)await pool.step();else world.step();}const ms=performance.now()-started;
   await pool?.syncAll();const hash=await benchmarkDigest(world.snapshot());if(digest&&hash!==digest)throw Error('Different full state: '+spec.id);digest=hash;
   const row={case:spec.id,version,repeat,ms,stepsPerSecond:steps*1000/ms,digest:hash};rows.push(row);console.log(JSON.stringify(row));
  }finally{await pool?.close();}
 }
 writeFileSync(new URL('../.transfer/v033-paired-performance.json',import.meta.url),JSON.stringify({model:'0.33.0',runtime:process.version,cpu:cpus()[0].model,logicalThreads:cpus().length,scope:'Short paired Node run, no rendering. Four T after three T warmup, three repeats, alternating order; current and previous frozen releases.',steps,warmup,repeats,rows},null,2)+'\n');
}
