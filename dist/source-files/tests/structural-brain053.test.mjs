import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {Random} from '../dist/simulation.js';
import {randomStructuralGenome,structuralLayout,structuralData,validateStructure,compileStructure,mutateStructure,packStructure,FIXED_PARAMETERS,STRUCTURAL_DEFAULTS,contextForward,contextBackward} from '../dist/structural-brain.js';
import {mutateGenome,genomeMetadata,validateGenomeFile} from '../dist/genome.js';
import {createControllerState,controllerProblems} from '../dist/brain-controller.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {captureHeritable} from '../dist/heritable-statistics.js';
import {brainDiagramModel} from '../dist/brain-diagram-ui.js';
import {validatePlan} from '../dist/experiment-plan.js';
import {validateExperimentReport} from '../dist/experiment-ui.js';
import {operationCounts,decisionCharge,learningCharge} from '../dist/brain-cost.js';
import {SET_BLOCKS,SET_PARAMETER_COUNT,CONTEXT_HIDDEN} from '../dist/temporal-layout.js';
import {worldPresentation} from '../dist/world-view.js';

test('founders have 4–6 hidden neurons, full adjacent edges, exact new genome roundtrip',()=>{
 const sizes=new Set();for(let seed=1;seed<=50;seed++){const g=randomStructuralGenome(new Random(seed*98765)),d=validateStructure(g);sizes.add(d.layout.hidden);assert.ok(d.layout.hidden>=4&&d.layout.hidden<=6);assert.equal(d.edges.length,d.layout.hidden*(d.layout.inputs+16));assert.deepEqual(validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(g),genes:g}),g);}
 assert.deepEqual([...sizes].sort(),[4,5,6]);
});
test('structural mutations preserve DAG, limits, mandatory path and original parent',()=>{
 const rng=new Random(41),settings={...STRUCTURAL_DEFAULTS,maxNeurons:12,maxLayers:3};let g=randomStructuralGenome(rng),original=g.slice();
 for(let j=0;j<250;j++){g=mutateStructure(g,rng,settings);const d=validateStructure(g);assert.ok(d.layers.length<=12);assert.ok(Math.max(0,...d.layers)<=3);assert.deepEqual(controllerProblems(createControllerState(g)),[]);}
 assert.deepEqual(original,randomStructuralGenome(new Random(41)));
});
test('adding a zero-output parallel neuron leaves scores and old parameters intact',()=>{
 const g=randomStructuralGenome(new Random(71)),d=structuralData(g),p=Float64Array.from(g.slice(0,d.layout.parameters)),input=Float64Array.from({length:d.layout.inputs},(_,j)=>Math.sin(j));
 const rolls=[.4,.8,.1,.2,.3,.6,0];const added=mutateStructure(g,{next:()=>rolls.shift()??0},STRUCTURAL_DEFAULTS);
 assert.ok(added);const t=structuralData(added),q=Float64Array.from(added.slice(0,t.layout.parameters));assert.deepEqual(contextForward(p,input,compileStructure(g)).z,contextForward(q,input,compileStructure(added)).z);
});
test('DAG reverse pass matches finite differences; zero outgoing edge can learn',()=>{
 const g=randomStructuralGenome(new Random(9)),plan=compileStructure(g),l=structuralLayout(g),p=Float64Array.from(g.slice(0,l.parameters)),input=Float64Array.from({length:l.inputs},(_,j)=>Math.cos(j)*.3),dz=Float64Array.from({length:16},(_,j)=>(j+1)/16),gradient=new Float64Array(p.length),back=new Float64Array(input.length),score=()=>contextForward(p,input,plan).z.reduce((s,v,j)=>s+v*dz[j],0);
 contextBackward(p,contextForward(p,input,plan),dz,gradient,back,plan);
 for(const index of [FIXED_PARAMETERS,FIXED_PARAMETERS+l.hidden,FIXED_PARAMETERS+l.hidden+100,p.length-1]){const old=p[index],eps=1e-6;p[index]=old+eps;const high=score();p[index]=old-eps;const low=score();p[index]=old;assert.ok(Math.abs(gradient[index]-(high-low)/(2*eps))<1e-7);}
 p[p.length-1]=0;gradient.fill(0);contextBackward(p,contextForward(p,input,plan),dz,gradient,back.fill(0),plan);assert.notEqual(gradient.at(-1),0);
});
test('zero hidden nodes, skip edges and malformed topology validation',()=>{
 const g=randomStructuralGenome(new Random(1)),d=structuralData(g),tail=g.slice(d.layout.traitOffset,d.layout.topologyOffset),simple=packStructure(g.slice(0,FIXED_PARAMETERS),[],[],[{from:0,to:d.layout.inputs,weight:.5}],tail);validateStructure(simple);assert.equal(compileStructure(simple).hidden,0);
 const bad=simple.slice();bad[structuralLayout(bad).topologyOffset]=d.layout.inputs;assert.throws(()=>validateStructure(bad));
});
test('parallel and sequential worlds preserve learning, RNG, energy and saved topology',async()=>{
 for(const learning of [false,true]){const options={population:5,limit:12,seed:49,learning},a=new Evolution(options),b=new Evolution(options),pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});
  try{for(let j=0;j<4;j++){a.step();await pool.step();}await pool.syncAll();assert.deepEqual(b.snapshot(),a.snapshot());assert.deepEqual(b.lifeReport(),a.lifeReport());assert.ok(Math.abs(a.balances().energyError)<1e-8);const restored=loadWorld(saveWorld(a));restored.step();a.step();assert.deepEqual(restored.snapshot(),a.snapshot());}finally{await pool.close();}
 }
});
test('birth inherits base genes, not lifetime deltas; structure is opt-out independently',()=>{
 const w=new Evolution({population:1,structuralMutations:false}),a=w.agents[0],g=a.genome.slice();a.brain.networkDelta.fill(1);const child=mutateGenome(g,w.random,0,0,w.cognitiveRandom,w.bodyRandom,w.neuralRandom,w);assert.deepEqual(structuralData(child).layers,structuralData(g).layers);assert.deepEqual(structuralData(child).edges.map(e=>[e.from,e.to]),structuralData(g).edges.map(e=>[e.from,e.to]));assert.deepEqual(a.genome,g);assert.ok(createControllerState(child).networkDelta.every(v=>v===0));
 const stats=captureHeritable(a);assert.equal(stats.brainNeurons,a.brain.structure.hidden);assert.ok(stats.brainConnections>0);assert.equal(brainDiagramModel(a).edges.length,stats.brainConnections);
});

test('historical experiment genome factors remain readable without conversion or invented metrics',()=>{
 const w=new Evolution({population:1,brainType:'set-duration-activity-v1'}),g=w.agents[0].genome,factors=[{key:'baseGenome',values:[{name:'legacy.json',genes:g}]}];
 assert.throws(()=>validatePlan({worlds:1,factors}),/v14/);
 const plan=validatePlan({worlds:1,steps:1,factors},{historical:true}),report={format:'big-evolution-experiment',version:1,modelVersion:'0.52.2',plan,groups:[{id:'v1-0',variantId:'v1',index:0,status:'pending',attempts:[],selectedId:null}]};
 assert.doesNotThrow(()=>validateExperimentReport(report));assert.equal(captureHeritable(w.agents[0]).brainNeurons,undefined);
});

test('reference full-cycle rates stay 0.10/0.03; phases are not charged twice',()=>{
 const context=SET_BLOCKS[1],profile={context:2*context.weights+context.outputs+CONTEXT_HIDDEN,parameters:SET_PARAMETER_COUNT},brain={costProfile:profile},frame={frame:{request:{observation:{cells:Array(7)},candidates:Array.from({length:11},(_,action)=>({action}))}}};
 const counts=operationCounts(null,7,11);assert.deepEqual(operationCounts(profile,7,11),counts);
 for(const rate of [.1,.03]){const choice=decisionCharge(brain,frame,rate),learning=learningCharge(brain,{choice:{batchInput:{cells:Array(7)}},costCandidates:11,costOperations:6,costRate:rate},frame);assert.ok(Math.abs(choice+learning-rate)<1e-12);assert.ok(choice<rate);}
});

test('scheme and preferences presentation never activate the evaluator or RNG',()=>{
 const w=new Evolution({population:1}),selected=w.agents[0],rng=w.random.state;
 w.evaluate=()=>{throw new Error('unwanted network evaluation');};
 for(const section of ['traits','features'])assert.doesNotThrow(()=>worldPresentation(w,{selected,trail:{points:[]},section}));
 assert.equal(w.random.state,rng);
});
