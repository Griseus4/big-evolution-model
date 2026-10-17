/** Адаптер снимка. Все функции физики/мозга импортируются из его каталога,
 * включая восстановление прототипов и генерацию нагрузок. Текущий Evolution
 * не подменяет старый. Таймер/пакеты соответствуют прежнему замеру 0.20. */
import {BENCHMARK_VERSIONS,BENCHMARK_MODEL_SERIES} from './benchmark-versions.js';
const yieldQueue=()=>new Promise(resolve=>setTimeout(resolve,0));
const actions=world=>world.stats.actions.reduce((sum,n)=>sum+n,0);
export async function loadSnapshotRuntime(id,{computeWorkers,configurationId=id}={}){
 const entry=BENCHMARK_VERSIONS.find(v=>v.id===id);if(!entry)throw new Error('Неизвестный снимок');
 const base=new URL(entry.path,import.meta.url),response=await fetch(new URL('manifest.json',base));
 if(!response.ok)throw new Error('Не удалось загрузить снимок '+id);
 const original=await response.json();
 if(original.id!==id||original.seriesId!==BENCHMARK_MODEL_SERIES)throw new Error('Снимок принадлежит другой серии');
 const workers=computeWorkers??entry.computeWorkers??1;
 const manifest={...original,id:configurationId,snapshotId:id,label:configurationId===id?entry.label:`${workers} вычислителей`,execution:{computeWorkers:workers}};
 const [fixtures,state,brain,experiment]=await Promise.all([
  import(new URL('benchmark-fixtures.js',base).href),import(new URL('benchmark-state.js',base).href),
  import(new URL('brain-controller.js',base).href),import(new URL('experiment-runner.js',base).href)]);
 const parallelModule=workers>1?await import(new URL('parallel-world.js',base).href):null;
 let pool=null;
 async function workload(world,spec,count,{shouldStop,onProgress=()=>{},syncResult=true}){
  const parallel=parallelModule&&spec.kind==='world';
  if(parallel){if(pool)await pool.reset(world);else{pool=new parallelModule.ParallelWorld(world,{workers});await pool.ready();}}
  try{
  const requests=spec.kind==='evaluator'?fixtures.evaluatorRequests(world,spec):null,last=requests?Array(requests.length):null;
  const beforeActions=actions(world),beforeTick=world.tick,startWall=performance.now();
  let computeMs=0,done=0,evaluations=0,lastProgress=startWall;
  while(done<count){
   if(shouldStop())return null;
   const end=Math.min(count,done+(requests?64:1)),start=performance.now();
   for(;done<end;done++){
    if(requests){const index=done%requests.length,agent=world.agents[index];
     const options=brain.evaluateController(agent.brain,agent.genome,requests[index]);last[index]=options;evaluations+=options.length;
    }else if(parallel)await pool.step();else world.step();
   }
   computeMs+=performance.now()-start;
   const now=performance.now();if(now-lastProgress>=500){onProgress({work:done,total:count});lastProgress=now;}
   await yieldQueue();
  }
  const wallMs=performance.now()-startWall;if(shouldStop())return null;
  return {computeMs,wallMs,work:done,actions:requests?evaluations:actions(world)-beforeActions,steps:requests?0:world.tick-beforeTick,last,computeWorkers:parallel?workers:1};
  }finally{if(parallel&&syncResult&&!pool.closed)await pool.syncAll();}
 }
 return {manifest,specs:fixtures.BENCHMARK_CASES,suiteId:fixtures.BENCHMARK_SUITE_ID,
  create:fixtures.createBenchmarkFixture,capture:state.captureBenchmarkState,restore:state.restoreBenchmarkState,
  digest:state.benchmarkDigest,check:experiment.checkInvariants,workload,dispose:async()=>{await pool?.close();pool=null;}};
}
