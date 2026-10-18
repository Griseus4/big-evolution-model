import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {workerBenchmarkSelection,WORKER_BENCHMARK_PROTOCOL} from '../dist/worker-benchmark-settings.js';
import {COMPUTATION_WORKER_COUNTS} from '../dist/computation-settings.js';
import {runVersionBenchmarks} from '../dist/benchmark-comparison-runner.js';
import {benchmarkMatrix,validateBenchmarkReport} from '../dist/benchmark-report.js';
import {BENCHMARK_CASES,BENCHMARK_SUITE_ID} from '../dist/benchmark-fixtures.js';
import {loadSnapshotRuntime} from '../dist/benchmark-snapshot-runtime.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {BENCHMARK_VERSION_CHECKS} from '../dist/benchmark-version-checks.js';

test('existing version queues and v2/v3 reports keep their former protocol',async()=>{
 for(const check of BENCHMARK_VERSION_CHECKS.filter(c=>c.id.startsWith('benchmark-')&&c.id!=='benchmark-snapshot-integrity'))await check.run();
});

test('worker comparison validates explicit counts, one world and independent repeats',()=>{
 const selection=workerBenchmarkSelection([...COMPUTATION_WORKER_COUNTS].reverse(),'world-400',3);
 assert.deepEqual(selection.workerCounts,COMPUTATION_WORKER_COUNTS);assert.deepEqual(selection.caseIds,['world-400']);
 for(const counts of [[],[1],[1,1],[1,3],[1,20]])assert.throws(()=>workerBenchmarkSelection(counts,'world-150',3));
 assert.throws(()=>workerBenchmarkSelection([1,4],'evaluator-empty',3));
 for(const repeats of [0,101,NaN,1.5])assert.throws(()=>workerBenchmarkSelection([1,4],'world-150',repeats));
});

function controlledLoader(log,{failMeasure=false,stopWarmup=false,onStop=()=>{}}={}){
 let creations=0,active=0,peak=0;
 return {get creations(){return creations;},get active(){return active;},get peak(){return peak;},loadVersion:async id=>{
  const workers=Number(id.split('@')[1]);let live=false;
  return {manifest:{id,snapshotId:id.split('@')[0],label:`${workers} вычислителей`,execution:{computeWorkers:workers}},suiteId:BENCHMARK_SUITE_ID,specs:BENCHMARK_CASES,
   create:()=>{creations++;return {tick:0,agents:[]};},capture:structuredClone,restore:structuredClone,check:()=>{},
   digest:async world=>(world.tick?'b':'a').repeat(64),
   async workload(world,spec,count,{shouldStop}){
    if(shouldStop())return null;
    if(!live){live=true;active++;peak=Math.max(peak,active);}
    log.push({id,count,tick:world.tick});world.tick=count;
    if(stopWarmup&&count===spec.warmup){onStop();return null;}
    if(failMeasure&&workers===4&&count===spec.work)throw new Error('test unavailable');
    return {computeMs:100/workers,wallMs:101,computeWorkers:workers,work:count,steps:count,actions:count*150,last:null};
   },dispose:async()=>{if(live){active--;live=false;}}
  };
 }};
}

test('one captured world, rotated modes, per-repeat warmup and only one active pool',async()=>{
 const log=[],loader=controlledLoader(log);
 const report=await runVersionBenchmarks({workerCounts:[4,1,14],caseId:'world-150',repeatCount:3,loadVersion:loader.loadVersion});
 assert.equal(report.status,'completed',report.error?.message);validateBenchmarkReport(report);
 assert.equal(report.version,4);assert.equal(report.protocolId,WORKER_BENCHMARK_PROTOCOL);
 assert.equal(report.completedMeasurements,9);assert.equal(loader.creations,1);assert.equal(loader.peak,1);assert.equal(loader.active,0);
 assert.ok(log.every(r=>r.tick===0));assert.equal(log.length,18);
 const ids=report.versionIds;
 assert.deepEqual(log.filter(r=>r.count===64).map(r=>r.id),[...ids,...ids.slice(1),ids[0],ids[2],ids[0],ids[1]]);
 for(let i=0;i<log.length;i+=2){assert.equal(log[i].count,8);assert.equal(log[i+1].count,64);assert.equal(log[i].id,log[i+1].id);}
 const matrix=benchmarkMatrix(report);assert.equal(matrix.rows.length,1);assert.ok(matrix.rows[0].cells.every(c=>c.comparable));
 const corrupt=structuredClone(report);corrupt.cases[0].repeats[0].computeWorkers=16;assert.throws(()=>validateBenchmarkReport(corrupt));
 const divergent=structuredClone(report);divergent.cases[1].repeats[0].resultDigest='c'.repeat(64);
 assert.equal(benchmarkMatrix(divergent).rows[0].cells[1].timeChangePercent,null);
});

test('stop and worker failure preserve partial reports and release every active pool',async()=>{
 let stopped=false;const loader=controlledLoader([],{stopWarmup:true,onStop:()=>stopped=true});
 const report=await runVersionBenchmarks({workerCounts:[1,4],caseId:'world-400',repeatCount:2,loadVersion:loader.loadVersion,shouldStop:()=>stopped});
 assert.equal(report.status,'stopped');assert.equal(report.completedMeasurements,0);assert.equal(loader.active,0);validateBenchmarkReport(report);
 const failed=controlledLoader([],{failMeasure:true});
 const failure=await runVersionBenchmarks({workerCounts:[1,4],caseId:'world-400',repeatCount:2,loadVersion:failed.loadVersion});
 assert.equal(failure.status,'failed');assert.equal(failure.completedMeasurements,1);assert.match(failure.error.message,/@4: test unavailable/);assert.equal(failed.active,0);validateBenchmarkReport(failure);
});

test('actual frozen worker modes keep full digests and never retain inactive pools',async()=>{
 const savedFetch=globalThis.fetch,savedWorker=globalThis.Worker,active=new Set();let peak=0;
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))});
 globalThis.Worker=class{constructor(url){const worker=createCognitionWorker({url}),close=worker.terminate;active.add(worker);peak=Math.max(peak,active.size);worker.terminate=async()=>{await close();active.delete(worker);};return worker;}};
 const loadVersion=async id=>{const [kernel,workers]=id.split('@');const runtime=await loadSnapshotRuntime(kernel,{computeWorkers:Number(workers),configurationId:id});runtime.specs=[{...BENCHMARK_CASES[3],population:9,work:2,warmup:1}];return runtime;};
 try{
  const report=await runVersionBenchmarks({workerCounts:[1,4,14],caseId:'world-150',repeatCount:2,loadVersion});
  assert.equal(report.status,'completed',report.error?.message);assert.equal(report.completedMeasurements,6);assert.equal(active.size,0);assert.ok(peak<=14);
  assert.equal(new Set(report.cases.map(c=>c.fixtureDigest)).size,1);assert.equal(new Set(report.cases.flatMap(c=>c.repeats.map(r=>r.resultDigest))).size,1);
 }finally{globalThis.fetch=savedFetch;globalThis.Worker=savedWorker;await Promise.all([...active].map(w=>w.terminate()));}
});
