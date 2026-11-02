import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
const shape=w=>({tick:w.tick,random:w.random.state,stats:w.stats,agents:w.agents.map(a=>({id:a.id,x:a.x,y:a.y,L:a.L,M:a.M,energy:a.energy,health:a.health,stomach:a.stomach,food:a.foodInventory,process:a.process,pregnancy:a.pregnancy,genome:a.genome,delta:a.brain.networkDelta,eligibility:a.brain.eligibility,pending:a.brain.pending,memory:a.brain.memory,longMemory:a.brain.longMemory,attention:a.brain.attention,life:a.life}))});
test('единые фазы: локально и два владельца, порядок жителей и задержка ответа',async()=>{
 const options={seed:71,population:8,physiology:{},learning:true,memory:true},reference=new Evolution(options),w=new Evolution(options);
 w.agents.reverse();const pool=new ParallelWorld(w,{workers:2,createWorker:()=>createCognitionWorker({delay:1})});
 try{await pool.ready();for(let i=0;i<4;i++){reference.step();await pool.step();}await pool.syncAll();assert.deepEqual(shape(w),shape(reference));}
 finally{await pool.close();}
});
import {captureBenchmarkState,benchmarkDigest} from '../dist/benchmark-state.js';
test('наблюдение после последнего перемещения не откатывает личную навигацию и продолжение',async()=>{
 const options={seed:801,population:9,physiology:{},learning:true,memory:true},a=new Evolution(options),b=new Evolution(options),pool=new ParallelWorld(b,{workers:4,createWorker:createCognitionWorker});
 try{for(let i=0;i<4;i++){a.step();await pool.step();await pool.syncAll();assert.equal(await benchmarkDigest(captureBenchmarkState(b)),await benchmarkDigest(captureBenchmarkState(a)));}}finally{await pool.close();}
});
