/** Управляемые организмы — только испытательные примеры, не стартовая популяция.
 * Проверяем границы знаний, изменение выбора, отсроченный эффект и наследование.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,GENE_COUNT,BASE_GENE_COUNT,COGNITIVE_GENES,WORLD_WIDTH} from '../dist/evolution.js';
import {createBrain,observe,memoryBelief,getMemory,MEMORY_LIMIT,TRACE_LIMIT,FEATURE_NAMES} from '../dist/cognition.js';
const setGene=(a,key,value)=>a.genome[COGNITIVE_GENES.find(g=>g.key===key).index]=value;
function learner(s){
 const a=s.agents[0];a.genome.fill(0);setGene(a,'health',8);setGene(a,'pain',-8);
 setGene(a,'learningRate',8);setGene(a,'discount',8);a.brain=createBrain(a.genome);
 a.x=6;a.y=6;a.frameRotation=0;for(const c of s.tiles)c.risk=0;
 return a;
}
function force(s,action){s.choose=a=>s.evaluate(a).find(o=>o.action===action);}

test('experience changes aversion after injury without rewriting the genome',()=>{
 const s=new Evolution({seed:4,population:1}),a=learner(s);s.tile(7,6).risk=1;
 const genes=a.genome.slice(),before=s.evaluate(a).find(o=>o.action===0).probability;
 force(s,0);s.step();assert.ok(a.lastDamage>0);assert.equal(a.brain.updates,0);
 s.tile(7,6).risk=0;force(s,8);s.step();assert.equal(a.brain.updates,1);
 assert.ok(a.brain.lastLearning.delta<0);assert.ok(a.brain.weights[1]<0);
 a.x=6;a.y=6;a.frameRotation=0;a.pain=0;a.health=100;s.tile(7,6).risk=1;
 const after=s.evaluate(a).find(o=>o.action===0).probability;
 assert.ok(after<before,`${after} should be below ${before}`);
 assert.deepEqual(a.genome,genes);
 const memory=getMemory(a.brain,'1,0');assert.equal(memory.injuries,1);assert.equal(memory.exposures,2);
});
test('delayed digestion updates eating and the trace of preceding decisions',()=>{
 const s=new Evolution({population:1}),a=learner(s);a.genome.fill(0);
 setGene(a,'energy',8);setGene(a,'learningRate',8);setGene(a,'discount',8);setGene(a,'trace',8);
 a.brain=createBrain(a.genome);a.energy=80;a.inventory=1;
 force(s,7);s.step();const eatRow=a.brain.pending.choice.row;
 assert.equal(a.brain.updates,0);assert.equal(a.stomach,22);
 force(s,8);s.step();const afterFirst=a.brain.experience[eatRow*9+7];
 assert.ok(afterFirst>0);s.step();assert.ok(a.brain.experience[eatRow*9+7]>afterFirst);
 assert.equal(a.brain.traces.length,2);assert.ok(a.brain.traces[0].strength>0);
});
test('children inherit traits, but no memories, learned values or pending events',()=>{
 const s=new Evolution({population:1,limit:3,mutations:false}),a=learner(s);
 s.tile(7,6).risk=1;force(s,0);s.step();s.tile(7,6).risk=0;force(s,8);s.step();
 assert.ok(a.brain.updates>0&&a.brain.memory.size>0);
 a.age=100;a.health=100;a.energy=100;const child=s.reproduce(a);assert.ok(child);
 assert.deepEqual(child.genome,a.genome);assert.deepEqual(child.brain.traits,a.brain.traits);
 assert.equal(child.brain.memory.size,0);assert.equal(child.brain.longMemory.size,0);assert.equal(child.brain.recentEvents.length,0);assert.equal(child.brain.updates,0);
 assert.equal(child.brain.experience.some(v=>v!==0),false);assert.equal(child.brain.weights.some(v=>v!==0),false);
 assert.equal(child.brain.pending,undefined);assert.notEqual(child.brain.experience,a.brain.experience);
});
test('hidden changes leave remembered observations, predictions and choices untouched',()=>{
 const s=new Evolution({population:1}),a=learner(s);const distant=s.tile(15,12);
 // This cell was seen in the past; the resident is now far away.
 observe(a.brain,[{q:6,r:6,terrain:'land',food:3}],{q:6,r:6},1);
 s.tick=20;const remembered=structuredClone([...a.brain.memory]),options=s.evaluate(a);
 distant.food=0;distant.risk=1;s.observe(a);
 const old=getMemory(a.brain,'6,6');assert.equal(old.food,3);
 assert.deepEqual(old,remembered[0][1]);
 const before=s.evaluate(a);distant.food=100;distant.terrain='water';assert.deepEqual(s.evaluate(a),before);
 assert.equal(options.find(o=>o.action===0).score,s.evaluate(a).find(o=>o.action===0).score);
});
test('an exhausted remembered source is revisable and restoration is learned from observation',()=>{
 const brain=createBrain(Array(GENE_COUNT).fill(0)),p={q:1,r:1,terrain:'land'};
 observe(brain,[{...p,food:3}],p,1);observe(brain,[{...p,food:0}],p,2);
 const r=getMemory(brain,'1,1');assert.equal(memoryBelief(r,2,brain.traits).food,0);
 observe(brain,[{...p,food:2}],p,82);assert.equal(r.recoveries,1);assert.equal(r.recoveryTotal,80);
 observe(brain,[{...p,food:0}],p,83);
 assert.ok(memoryBelief(r,123,brain.traits).food>0);assert.equal(r.food,0);
 const recent=memoryBelief(r,83,brain.traits),old=memoryBelief(r,5000,brain.traits);
 assert.ok(old.confidence<recent.confidence);
});
test('subjective feeling is bounded, genetically signed, and separate from health',()=>{
 const s=new Evolution({population:1}),a=learner(s);a.genome.fill(0);setGene(a,'energy',-8);a.brain=createBrain(a.genome);
 a.energy=0;assert.equal(s.feeling(a),100);a.energy=100;assert.equal(s.feeling(a),-100);
 a.genome.fill(0);a.brain=createBrain(a.genome);assert.equal(s.feeling(a),0);
 for(const agent of new Evolution({population:100}).agents){
  assert.ok(Number.isFinite(s.feeling(agent)));assert.ok(Math.abs(s.feeling(agent))<=100);
 }
});
test('old export extends neutrally and random expansion is explicit and reproducible',()=>{
 const base=Array(BASE_GENE_COUNT).fill(.2),neutral=new Evolution({population:2,baseGenome:base,mutations:false});
 assert.deepEqual(neutral.agents[0].genome.slice(0,BASE_GENE_COUNT),base);
 assert.ok(neutral.agents[0].genome.slice(BASE_GENE_COUNT).every(v=>v===0));
 const a=new Evolution({seed:31,population:2,baseGenome:base,expandLegacy:true});
 const b=new Evolution({seed:31,population:2,baseGenome:base,expandLegacy:true});
 assert.deepEqual(a.agents[0].genome,b.agents[0].genome);
 assert.deepEqual(a.agents[0].genome,a.agents[1].genome);
 assert.deepEqual(a.agents[0].genome.slice(0,BASE_GENE_COUNT),base);
});
test('memory and trace stay bounded; learned estimates and balances remain finite',()=>{
 const brain=createBrain(Array(GENE_COUNT).fill(0));
 for(let i=0;i<400;i++)observe(brain,[{q:i%24,r:Math.floor(i/24),food:1,terrain:'land'}],{q:-1,r:-1},i);
 assert.equal(brain.memory.size,brain.traits.shortCapacity);
 const s=new Evolution({seed:82,population:8,limit:20});s.advance(500);
 for(const a of s.agents){
  assert.ok(a.brain.memory.size<=a.brain.traits.shortCapacity);
  assert.ok(a.brain.longMemory.size<=a.brain.traits.longCapacity);
  assert.ok(a.brain.memory.size+a.brain.longMemory.size<=MEMORY_LIMIT);
  assert.ok(a.brain.recentEvents.length<=TRACE_LIMIT);assert.ok(a.brain.traces.length<=TRACE_LIMIT);
  assert.equal(a.brain.weights.length,FEATURE_NAMES.length);
  assert.ok([...a.brain.experience,...a.brain.weights].every(Number.isFinite));
  assert.ok(s.evaluate(a).every(o=>Number.isFinite(o.probability)));
 }
 assert.equal(s.balances().foodError,0);assert.ok(Math.abs(s.balances().energyError)<1e-6);
});
