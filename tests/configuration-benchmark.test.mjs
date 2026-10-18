import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationSelection,plannedConfigurationMeasurements} from '../dist/benchmark-configurations.js';
import {runConfigurationBenchmarks} from '../dist/configuration-benchmark-runner.js';
import {validateBenchmarkReport,benchmarkMatrix} from '../dist/benchmark-report.js';
import {BENCHMARK_CASES,BENCHMARK_SUITE_ID} from '../dist/benchmark-fixtures.js';
import {readFile} from 'node:fs/promises';
import {loadSnapshotRuntime} from '../dist/benchmark-snapshot-runtime.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
function loader(){
 const log=[];let active=0,peak=0,created=0;
 return {log,get active(){return active;},get peak(){return peak;},get created(){return created;},loadVersion:async c=>{
  let live=false;
  return {manifest:{id:c.id,snapshotId:c.snapshotId,execution:{computeWorkers:c.computeWorkers}},specs:BENCHMARK_CASES,suiteId:BENCHMARK_SUITE_ID,
   create:()=>{created++;return {tick:0,agents:[]};},capture:structuredClone,restore:structuredClone,check:()=>{},digest:async v=>(v?.tick?'b':Array.isArray(v)?'c':'a').repeat(64),
   workload:async(w,s,count,{shouldStop})=>{if(shouldStop())return null;if(!live){active++;peak=Math.max(peak,active);live=true;}log.push({id:c.id,kind:s.kind,count,tick:w.tick});w.tick=s.kind==='world'?count:0;
    return {computeMs:640/(c.computeWorkers===2?1.3:c.computeWorkers===10?1.5:1),wallMs:641,work:count,steps:w.tick,actions:count,computeWorkers:c.computeWorkers,last:[]};},
   dispose:async()=>{if(live){live=false;active--;}}
  };
 }};
}
test('capabilities reject unsupported frozen counts and ignore disabled repeat fields',()=>{
 assert.throws(()=>configurationSelection([{versionId:'0.33.0',workerCounts:[10]}]));
 assert.throws(()=>configurationSelection([{versionId:'0.32.0',workerCounts:[2]}]));
 assert.throws(()=>configurationSelection([{versionId:'0.37.0',workerCounts:[]}]));
 const chosen=configurationSelection([{versionId:'0.37.0',workerCounts:[10,1,2]}],{groups:['world'],repeatCounts:{world:2,evaluator:NaN}});
 assert.deepEqual(chosen.selections[0].workerCounts,[1,2,10]);assert.equal(chosen.configurations.length,3);
});
test('version/count matrix runs each evaluator once, worlds per count and rotates without overlapping pools',async()=>{
 const l=loader(),report=await runConfigurationBenchmarks({selections:[{versionId:'0.37.0',workerCounts:[1,2,10]}],groups:['evaluator','world'],repeatCounts:{evaluator:2,world:2},loadVersion:l.loadVersion});
 assert.equal(report.status,'completed',report.error?.message);validateBenchmarkReport(report);
 assert.equal(report.completedMeasurements,24);assert.equal(report.plannedMeasurements,plannedConfigurationMeasurements(report,BENCHMARK_CASES));
 assert.equal(l.peak,1);assert.equal(l.active,0);assert.equal(l.created,6);assert.ok(l.log.every(r=>r.tick===0));
 assert.equal(report.cases.filter(c=>c.kind==='evaluator').length,3);assert.equal(report.cases.filter(c=>c.kind==='world').length,9);
 const row=benchmarkMatrix(report).rows.find(r=>r.kind==='world'),two=row.cells.find(c=>c.computeWorkers===2),ten=row.cells.find(c=>c.computeWorkers===10);
 assert.ok(Math.abs(two.speedup-1.3)<1e-12);assert.ok(Math.abs(two.speedPercent-30)<1e-10);assert.ok(Math.abs(two.efficiency-65)<1e-10);assert.ok(Math.abs(ten.efficiency-15)<1e-10);
 assert.equal(benchmarkMatrix(report).rows[0].cells.length,1);
 const broken=structuredClone(report);broken.cases[0].repeats[0].computeWorkers=4;assert.throws(()=>validateBenchmarkReport(broken));
 const different=structuredClone(report);different.cases.find(c=>c.versionId.endsWith('@2')).repeats[0].resultDigest='d'.repeat(64);assert.equal(benchmarkMatrix(different).rows.find(r=>r.kind==='world').cells.find(c=>c.computeWorkers===2).speedup,null);
});
test('partial configuration runs have no acceleration and preserve completed repeats',async()=>{
 const l=loader();let stop=false;
 const report=await runConfigurationBenchmarks({selections:[{versionId:'0.37.0',workerCounts:[2,10]}],groups:['world'],repeatCounts:{world:2},loadVersion:l.loadVersion,shouldStop:()=>stop,onCase:row=>{if(row.repeats.length)stop=true;}});
 assert.equal(report.status,'stopped');assert.equal(report.completedMeasurements,1);assert.equal(l.active,0);validateBenchmarkReport(report);assert.ok(benchmarkMatrix(report).rows.every(r=>r.cells.every(c=>c.speedup===null)));
});

test('previous duration-series v5 reports remain readable without enabling old kernels in new runs',async()=>{
 const l=loader(),current=await runConfigurationBenchmarks({selections:[{versionId:'0.37.0',workerCounts:[1,2]}],groups:['world'],repeatCounts:{world:1},loadVersion:l.loadVersion});
 const previousPatch=JSON.parse(JSON.stringify(current).replaceAll('0.37.0','0.36.0'));previousPatch.seriesId='environment-energy-deficit-v1';previousPatch.suiteId='fixed-environment-deficit-workloads-v1';validateBenchmarkReport(previousPatch);assert.throws(()=>configurationSelection(previousPatch.selections));
 const previous=JSON.parse(JSON.stringify(current).replaceAll('0.37.0','0.33.2'));
 previous.seriesId='duration-attention-v1';previous.suiteId='fixed-duration-workloads-v1';
 validateBenchmarkReport(previous);assert.equal(benchmarkMatrix(previous).rows[0].cells[1].speedup,1.3);
 assert.throws(()=>configurationSelection(previous.selections));
 previous.seriesId=current.seriesId;assert.throws(()=>validateBenchmarkReport(previous));
});

test('actual version/count executor preserves full hashes across frozen versions and releases workers',async()=>{
 const savedFetch=globalThis.fetch,savedWorker=globalThis.Worker,active=new Set();let peak=0;
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))});
 globalThis.Worker=class{constructor(url){const worker=createCognitionWorker({url}),close=worker.terminate;active.add(worker);peak=Math.max(peak,active.size);worker.terminate=async()=>{await close();active.delete(worker);};return worker;}};
 const loadVersion=async c=>{const runtime=await loadSnapshotRuntime(c.snapshotId,{computeWorkers:c.computeWorkers,configurationId:c.id});runtime.specs=runtime.specs.filter(s=>['world-150','evaluator-empty'].includes(s.id)).map(s=>({...s,population:4,work:s.kind==='world'?2:16,warmup:1}));return runtime;};
 try{
  const report=await runConfigurationBenchmarks({selections:[{versionId:'0.37.0',workerCounts:[1,2,4]}],groups:['evaluator','world'],repeatCounts:{evaluator:2,world:2},loadVersion});
  assert.equal(report.status,'completed',report.error?.message);assert.equal(report.completedMeasurements,8);assert.equal(active.size,0);assert.ok(peak<=4);
  for(const kind of ['evaluator','world'])assert.equal(new Set(report.cases.filter(c=>c.kind===kind).flatMap(c=>c.repeats.map(r=>r.resultDigest))).size,1);
 }finally{globalThis.fetch=savedFetch;globalThis.Worker=savedWorker;await Promise.all([...active].map(w=>w.terminate()));}
});
