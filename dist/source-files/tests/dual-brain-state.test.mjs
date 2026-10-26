import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../dist/simulation.js';
import {randomDualGenome,validateDualBrain} from '../dist/dual-brain-genome.js';
import {compileDualState} from '../dist/dual-brain-state.js';
import {contextForward,contextBackward} from '../dist/structural-brain.js';
import {compileDag,dagParameters,dagForward,dagBackward} from '../dist/dag-network.js';
import {createControllerState} from '../dist/brain-controller.js';
import {layoutForGenes} from '../dist/neural-layout.js';
test('dual context adapter preserves generic forward and input gradients',()=>{
 const genes=randomDualGenome(new Random(33),{initialNeurons:[2,1]}),d=validateDualBrain(genes),state=compileDualState(genes),plan=compileDag(d.main),p=Float64Array.from(genes.slice(0,d.layout.parameters));
 const input=new Float64Array(plan.inputs).fill(.2),dy=new Float64Array(plan.outputs).fill(.3),generic=dagForward(plan,dagParameters(d.main),input),actual=contextForward(p,input,state.structure);
 assert.deepEqual(actual.z,generic.output);
 const gradient=new Float64Array(p.length),back=new Float64Array(plan.inputs);contextBackward(p,actual,dy,gradient,back,state.structure);
 const expected=dagBackward(plan,dagParameters(d.main),generic.values,dy);assert.deepEqual(back,expected.inputGradient);
 assert.equal(new Set(state.structure.activeParameters).size,state.structure.activeParameters.length);
});
test('controller construction recognises v17 without a dense gate or inherited personal state',()=>{
 const genes=randomDualGenome(new Random(2)),brain=createControllerState(genes);
 assert.equal(layoutForGenes(genes).version,17);assert.equal(brain.dual,true);assert.equal(brain.temporal,true);
 assert.equal(brain.attentionStructure.inputs,18);assert.equal(brain.networkBase.length,layoutForGenes(genes).parameters);
 assert.ok([...brain.networkDelta].every(v=>v===0));assert.equal(brain.memory.size,0);
});
