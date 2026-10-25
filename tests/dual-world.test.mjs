import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,actionEnergyCost} from '../dist/evolution.js';
import {Random} from '../dist/simulation.js';
import {DUAL_BRAIN_TYPE,unpackDualBrain,packDualBrain} from '../dist/dual-brain-layout.js';
import {randomDualGenome} from '../dist/dual-brain-genome.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {attentionRequest} from '../dist/attention-gate.js';
import {acceptTemporalChoice} from '../dist/temporal-world.js';

function quietGenes(timer=false){
 const d=unpackDualBrain(randomDualGenome(new Random(2)));d.fixed.fill(0);d.main.biases.fill(0);for(const edge of d.main.edges)edge.weight=0;
 d.attention.biases[0]=timer?1:-1;for(const edge of d.attention.edges)edge.weight=timer&&edge.from===17?-2:0;
 return packDualBrain(d);
}
const options={brainType:DUAL_BRAIN_TYPE,population:4,limit:10,seed:49};
test('quiet rest has no fake completion or free physiology and pays every gate check',()=>{
 const w=new Evolution({...options,population:1,baseGenome:quietGenes(),learning:false}),a=w.agents[0];
 for(let i=0;i<3;i++)w.step();
 assert.equal(w.stats.brainCalls,1);assert.equal(w.stats.gateCalls,30);assert.equal(a.resting,true);assert.equal(a.process,null);
 assert.equal(w.stats.started[8],0);assert.equal(w.stats.completed[8],0);
 assert.ok(Math.abs(w.stats.actionSpent-actionEnergyCost(8)*3)<1e-12);
 assert.ok(w.stats.attentionSpent>0);assert.ok(Math.abs(w.balances().energyError)<1e-8);
 assert.equal(a.brain.lastDecisionSubtick,0);
});
test('timer is an observation, only a main decision resets it',()=>{
 const w=new Evolution({...options,population:1,baseGenome:quietGenes(true),learning:false}),a=w.agents[0];
 w.step();assert.equal(w.stats.brainCalls,1);w.step();assert.equal(w.stats.brainCalls,2);
 assert.equal(a.brain.lastDecisionSubtick,11);w.step();assert.equal(a.brain.lastDecisionSubtick,22);
 const old=a.brain.lastDecisionSubtick;attentionRequest(a,a._cells,3,66,30);assert.equal(a.brain.lastDecisionSubtick,old);
});
test('two-network worlds reproduce body, RNG, personal learning and rest in different pools',async()=>{
 for(const learning of [false,true])for(const baseGenome of [null,quietGenes()]){
  const a=new Evolution({...options,learning,baseGenome}),b=new Evolution({...options,learning,baseGenome}),pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});
  try{
   for(let i=0;i<4;i++){a.step();await pool.step();}
   await pool.syncAll();assert.deepEqual(b.snapshot(),a.snapshot());assert.deepEqual(b.stats,a.stats);
   for(let i=0;i<a.agents.length;i++){
    assert.deepEqual(b.agents[i].brain.networkDelta,a.agents[i].brain.networkDelta);
    assert.deepEqual(b.agents[i].brain.gateBase,a.agents[i].brain.gateBase);
    assert.equal(b.agents[i].resting,a.agents[i].resting);
    assert.equal(b.agents[i].brain.lastDecisionSubtick,a.agents[i].brain.lastDecisionSubtick);
   }
   assert.ok(Math.abs(a.balances().energyError)<1e-8);
  }finally{await pool.close();}
 }
});
test('new saves continue action and rest including personal experience and timer',()=>{
 for(const baseGenome of [null,quietGenes(true)]){
  const w=new Evolution({...options,baseGenome});for(let i=0;i<3;i++)w.step();
  const restored=loadWorld(saveWorld(w));for(let i=0;i<3;i++){restored.step();w.step();}
  assert.deepEqual(restored.snapshot(),w.snapshot());assert.deepEqual(restored.stats,w.stats);
  for(let i=0;i<w.agents.length;i++)assert.deepEqual(restored.agents[i].brain.networkDelta,w.agents[i].brain.networkDelta);
 }
});
test('old full save versions and corrupted timers are rejected explicitly',()=>{
 const w=new Evolution(options);w.step();const file=saveWorld(w);assert.throws(()=>loadWorld({...file,version:3}));
 w.agents[0].brain.lastDecisionSubtick=w.subtick+1;assert.throws(()=>loadWorld(saveWorld(w)),/таймер/);
});
test('continuing preserves progress while voluntary rest cancels the process',()=>{
 const w=new Evolution({...options,population:1,learning:false}),a=w.agents[0];
 a.process={action:7,destination:{x:a.x,y:a.y},duration:10,elapsed:4};
 const process=a.process,spent=w.stats.actionSpent;
 assert.equal(acceptTemporalChoice(w,a,{action:7,continuation:true,decisionCost:0}),true);
 assert.equal(a.process,process);assert.equal(a.process.elapsed,4);
 assert.equal(acceptTemporalChoice(w,a,{action:8,decisionCost:0}),true);
 assert.equal(a.process,null);assert.equal(a.resting,true);
 assert.equal(w.stats.actionSpent,spent);assert.equal(w.stats.started[8],0);
});
