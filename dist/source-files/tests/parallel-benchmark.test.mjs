/** Настоящий путь снимок -> вложенный Worker -> сравнение/сброс/освобождение.
 * Нагрузка намеренно сокращена: это проверка протокола, не замер скорости. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSnapshotRuntime} from '../dist/benchmark-snapshot-runtime.js';
import {runVersionBenchmarks} from '../dist/benchmark-comparison-runner.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
test('frozen parallel benchmark preserves full digests and disposes warm workers on completion/stop',async()=>{
 const previousFetch=globalThis.fetch,previousWorker=globalThis.Worker,active=new Set();
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))});
 globalThis.Worker=class{constructor(url){const worker=createCognitionWorker({url}),close=worker.terminate;active.add(worker);worker.terminate=async()=>{await close();active.delete(worker);};return worker;}};
 const loadVersion=async id=>{const runtime=await loadSnapshotRuntime(id);runtime.specs=[{...runtime.specs.find(s=>s.kind==='world'),population:4,work:2,warmup:1}];return runtime;};
 try{
  const report=await runVersionBenchmarks({versionIds:['0.37.0'],groups:['world'],repeatCounts:{world:2},loadVersion});
  assert.equal(report.status,'completed',report.error?.message);assert.equal(report.completedMeasurements,2);assert.equal(active.size,0);
  assert.equal(new Set(report.cases.map(c=>c.fixtureDigest)).size,1);assert.equal(new Set(report.cases.flatMap(c=>c.repeats.map(r=>r.resultDigest))).size,1);
  assert.equal(report.cases.find(c=>c.versionId==='0.37.0').repeats[0].computeWorkers,4);
  let stopped=false;
  const aborted=await runVersionBenchmarks({versionIds:['0.37.0'],groups:['world'],repeatCounts:{world:2},loadVersion,shouldStop:()=>stopped,onProgress:p=>{if(p.phase==='measure')stopped=true;}});
  assert.equal(aborted.status,'stopped');assert.equal(active.size,0);
 }finally{globalThis.fetch=previousFetch;globalThis.Worker=previousWorker;await Promise.all([...active].map(w=>w.terminate()));}
});
