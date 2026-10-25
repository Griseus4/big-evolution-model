import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {Random} from '../dist/simulation.js';
import {initialLayerCounts,initialConnectionBudget} from '../dist/brain-initialization.js';
import {structuralData,validateStructure,mutateStructure,randomStructuralGenome,FIXED_PARAMETERS} from '../dist/structural-brain.js';
import {validatePlan} from '../dist/experiment-plan.js';
import {analysisPlan,analysisVariants,analysisLayout,ANALYSIS_DEFAULT} from '../dist/analysis-builder-core.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {brainDiagramModel} from '../dist/brain-diagram-ui.js';
import {diagramLayout,fitViewport} from '../dist/brain-diagram-viewport.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';

test('table compacts empty levels, accepts exact caps and rejects invalid shapes',()=>{
 assert.deepEqual(initialLayerCounts([5,0,3,0],8,2),[5,3]);assert.deepEqual(initialLayerCounts([],0,0),[]);
 for(const value of [[-1],[1.5],[NaN],['2'],[null]])assert.throws(()=>initialLayerCounts(value));
 assert.throws(()=>initialLayerCounts([5,4],8,2));assert.throws(()=>initialLayerCounts([1,1,1],8,2));
});

test('zero, partial, adjacent and extra connectivity have exact counts and valid endpoints',()=>{
 const counts=[3,2],budget=initialConnectionBudget(counts),options={initialNeurons:counts,maxNeurons:5,maxLayers:2};
 for(const percent of [0,20,99.5,100,150,budget.maxPercent]){
  const expected=initialConnectionBudget(counts,percent),a=randomStructuralGenome(new Random(7),{...options,initialConnections:percent}),b=randomStructuralGenome(new Random(7),{...options,initialConnections:percent}),d=validateStructure(a);
  assert.deepEqual(a,b);assert.equal(d.edges.length,expected.count);assert.equal(new Set(d.edges.map(e=>`${e.from}:${e.to}`)).size,expected.count);
  const I=d.layout.inputs,n=d.layout.hidden,level=id=>id<I?0:id<I+n?d.layers[id-I]:3;
  const adjacent=d.edges.filter(e=>level(e.to)-level(e.from)===1).length;
  assert.equal(adjacent,Math.min(expected.count,budget.base));
  if(percent===budget.maxPercent)assert.equal(d.edges.length,budget.maximum);
 }
 assert.throws(()=>initialConnectionBudget(counts,budget.maxPercent+1));
});

test('all founders use the requested shape/count; genes and inhabitants still vary by seed',()=>{
 const options={population:4,initialNeurons:[2,0,3,0],initialConnections:150,maxNeurons:5,maxLayers:2};
 const a=new Evolution({...options,seed:42}),same=new Evolution({...options,seed:42}),b=new Evolution({...options,seed:43});
 for(const w of [a,b])for(const agent of w.agents){const d=structuralData(agent.genome);assert.deepEqual(d.layers,[1,1,2,2,2]);assert.equal(d.edges.length,initialConnectionBudget([2,3],150).count);}
 assert.deepEqual(a.agents.map(a=>a.genome),same.agents.map(a=>a.genome));assert.notDeepEqual(a.agents[0].genome,b.agents[0].genome);assert.notDeepEqual(a.agents[0].genome,a.agents[1].genome);
});

test('changing only initial architecture leaves other founder genes and random streams equal',()=>{
 const options={population:3,seed:42,terrainSeed:42,foodSeed:42},a=new Evolution({...options,initialNeurons:[5],initialConnections:100}),b=new Evolution({...options,initialNeurons:[2,3],initialConnections:150}),c=new Evolution({...options,initialNeurons:[],initialConnections:0});
 for(const other of [b,c]){
  for(let j=0;j<a.agents.length;j++){
   const g=a.agents[j].genome,h=other.agents[j].genome,d=structuralData(g),e=structuralData(h);
   assert.deepEqual(g.slice(0,FIXED_PARAMETERS),h.slice(0,FIXED_PARAMETERS));assert.deepEqual(g.slice(d.layout.traitOffset,d.layout.topologyOffset),h.slice(e.layout.traitOffset,e.layout.topologyOffset));assert.equal(a.agents[j].x,other.agents[j].x);assert.equal(a.agents[j].y,other.agents[j].y);
  }
  for(const key of ['random','neuralRandom','bodyRandom','mutationRandom'])assert.equal(a[key].state,other[key].state);
 }
});

test('zero hidden layers connect inputs directly and zero layer cap survives structural mutation',()=>{
 const settings={maxNeurons:0,maxLayers:0,initialNeurons:[],initialConnections:100},rng=new Random(91);let genome=randomStructuralGenome(rng,settings);
 const d=validateStructure(genome);assert.equal(d.layers.length,0);assert.equal(d.edges.length,d.layout.inputs*16);
 assert.equal(initialConnectionBudget([]).maxPercent,100);assert.throws(()=>initialConnectionBudget([],101));
 for(let i=0;i<30;i++){genome=mutateStructure(genome,rng,settings);assert.equal(validateStructure(genome).layers.length,0);}
 const w=new Evolution({...settings,population:1});w.step();
});

test('new settings roundtrip with full worlds and do not override imported genomes',()=>{
 const options={population:2,initialNeurons:[3,2],initialConnections:150,maxNeurons:6,maxLayers:3},w=new Evolution(options);
 w.step();const restored=loadWorld(saveWorld(w));assert.deepEqual(restored.initialNeurons,[3,2]);assert.equal(restored.initialConnections,150);w.step();restored.step();assert.deepEqual(w.snapshot(),restored.snapshot());
 const genome=w.agents[0].genome,base=new Evolution({...options,population:1,baseGenome:genome,initialNeurons:[],initialConnections:0});assert.deepEqual(base.agents[0].genome,genome);
});

test('custom sparse multilayer genomes execute identically in workers with learning',async()=>{
 const options={population:3,seed:71,initialNeurons:[2,3],initialConnections:150},a=new Evolution(options),b=new Evolution(options),pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});
 try{for(let j=0;j<3;j++){a.step();await pool.step();}await pool.syncAll();assert.deepEqual(b.snapshot(),a.snapshot());assert.deepEqual(b.lifeReport(),a.lifeReport());}finally{await pool.close();}
});

test('architecture and percentage factors roundtrip, reject duplicates and remain filterable',()=>{
 const input={worlds:1,seeds:[42],common:{population:1,maxNeurons:8,maxLayers:3,initialNeurons:[2,2]},factors:[{key:'initialNeurons',values:[[2,0,2],[3]]},{key:'initialConnections',values:[50,100]}]};
 const plan=validatePlan(input),restored=validatePlan(JSON.parse(JSON.stringify(plan)));assert.deepEqual(plan,restored);assert.equal(plan.variants.length,4);
 assert.throws(()=>validatePlan({...input,factors:[{key:'initialNeurons',values:[[2,0,2],[2,2]]}]}),/повторяются/);
 const view=analysisPlan(plan),c={...ANALYSIS_DEFAULT,axis:'born',start:0,end:100,width:100,group:'initialNeurons',variantFilters:[{key:'initialNeurons',values:['2 → 2']}]};
 assert.equal(analysisVariants(view,c).length,2);assert.equal(analysisLayout(view,c).groups.length,1);
 assert.throws(()=>validatePlan({...input,common:{...input.common,initialNeurons:[]},factors:[{key:'initialConnections',values:[101]}]}));
});

test('adaptive overview spreads nodes across both dimensions and fits all of them',()=>{
 const w=new Evolution({population:1,initialNeurons:[5]}),model=brainDiagramModel(w.agents[0]);
 for(const [width,height]of [[360,180],[1200,800],[280,600]]){
  const layout=diagramLayout(model,width/height),camera=fitViewport(layout,width,height),xs=layout.nodes.map(n=>camera.x+n.x*camera.scale),ys=layout.nodes.map(n=>camera.y+n.y*camera.scale);
  assert.ok(Math.max(...xs)-Math.min(...xs)>width*.7);assert.ok(Math.max(...ys)-Math.min(...ys)>height*.7);
  assert.ok(Math.min(...xs)>=0&&Math.max(...xs)<=width);assert.ok(Math.min(...ys)>=0&&Math.max(...ys)<=height);
 }
});
