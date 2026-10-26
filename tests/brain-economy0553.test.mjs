import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBrainCostMultiplier} from '../dist/brain-economy.js';
import {energyPreview,previewBrain} from '../dist/energy-preview.js';
import {Evolution} from '../dist/evolution.js';
import {DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {decodeState,encodeState} from '../dist/state-codec.js';
import {acceptTemporalChoice,payAttention} from '../dist/temporal-world.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {validatePlan} from '../dist/experiment-plan.js';
import {operationCounts,decisionCharge,learningCharge} from '../dist/brain-cost.js';
const options={population:2,seed:49,brainType:DUAL_BRAIN_TYPE};
test('positive price setting reaches plans, jobs and old/current full saves',()=>{
 for(const value of [0,-1,NaN,Infinity,null])assert.throws(()=>validateBrainCostMultiplier(value));
 const plan=validatePlan({worlds:1,seeds:[42],steps:100,common:{brainCostMultiplier:.25},factors:[{key:'brainCostMultiplier',values:[.25,2]}]});
 assert.equal(plan.common.brainCostMultiplier,.25);assert.deepEqual(plan.variants.map(v=>v.settings.brainCostMultiplier),[.25,2]);
 const w=new Evolution({...options,brainCostMultiplier:.5});w.step();const file=saveWorld(w),restored=loadWorld(file);assert.equal(restored.brainCostMultiplier,.5);restored.step();w.step();assert.deepEqual(restored.stats,w.stats);
 const state=decodeState(file.state);delete state.brainCostMultiplier;assert.equal(loadWorld({...file,modelVersion:'0.55.2',state:encodeState(state)}).brainCostMultiplier,1);
 state.brainCostMultiplier=0;assert.throws(()=>loadWorld({...file,state:encodeState(state)}));
});
test('all requested cost phases and actual payment scale exactly once',()=>{
 const w=new Evolution({...options,brainCostMultiplier:2}),a=w.agents[0],before=a.energy;a.brain.learningCharge=.02;
 acceptTemporalChoice(w,a,{action:8,decisionCost:.1,computeCharge:.1});payAttention(w,a,.003);
 assert.ok(Math.abs(before-a.energy-.246)<1e-12);assert.ok(Math.abs(w.stats.brainSpent-.246)<1e-12);
 assert.equal(a.life.observer.mainDecisionEnergyCost,.2);assert.equal(a.life.observer.learningEnergyCost,.04);assert.equal(a.life.observer.attentionEnergyCost,.006);
});
test('preview accounts for food throughput, physical costs, both brains and learning',()=>{
 const brain=previewBrain(),base=energyPreview({},brain),cheap=energyPreview({brainCostMultiplier:.1},brain),untrained=energyPreview({learning:false},brain);
 assert.equal(base.food,1.1);assert.ok(base.physical>0&&base.main>0&&base.learning>0&&base.attention>0);assert.ok(cheap.net>base.net);assert.equal(untrained.learning,0);
 assert.ok(Math.abs(cheap.main/base.main-.1)<1e-12);assert.ok(Math.abs(base.net-(base.food-base.physical-base.main-base.learning-base.attention))<1e-12);
 const slow=energyPreview({digestionTime:100},brain);assert.equal(slow.food,.22);assert.ok(slow.net<0);
 const distant=energyPreview({},brain,100);assert.ok(distant.food<base.food);assert.ok(distant.net<base.net);
 assert.ok(energyPreview({brainCostMultiplier:1000},brain).net<0);assert.throws(()=>energyPreview({},brain,0));
 assert.deepEqual(energyPreview(),energyPreview());
});
test('steady preview uses actual main/learning cost functions without charging a full cycle twice',()=>{
 const brain=previewBrain(),cells=Array(7).fill({}),candidates=Array.from({length:11},(_,action)=>({action})),decision={frame:{request:{observation:{cells},candidates}}};
 const p=energyPreview({},brain),pending={choice:{batchInput:{cells}},costRate:.1,costCandidates:11,costOperations:6};
 assert.ok(Math.abs(p.main/p.calls-decisionCharge(brain,decision,.1))<1e-12);
 assert.ok(Math.abs(p.learning/p.calls-learningCharge(brain,pending,decision))<1e-12);
});
test('non-default prices retain exact local/Worker physics and learning',async()=>{
 for(const k of [.25,2]){const a=new Evolution({...options,brainCostMultiplier:k}),b=new Evolution({...options,brainCostMultiplier:k}),pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});
  try{for(let i=0;i<3;i++){a.step();await pool.step();}await pool.syncAll();assert.deepEqual(b.stats,a.stats);assert.deepEqual(b.snapshot(),a.snapshot());assert.ok(Math.abs(b.balances().energyError)<1e-8);}finally{await pool.close();}
 }
});
