import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../dist/simulation.js';
import {randomDualGenome,validateDualBrain,mutateDualGenome,encodeMutationPair,decodeMutationPair,mutationBudget,dualMutationProfiles} from '../dist/dual-brain-genome.js';
import {unpackDualBrain,packDualBrain,dualBrainLayout} from '../dist/dual-brain-layout.js';
import {EVOLUTION_RULES as R} from '../dist/brain-evolution-rules.js';

test('default founders have two direct networks and exactly six mutation regulators',()=>{
 const genes=randomDualGenome(new Random(31)),d=validateDualBrain(genes);
 assert.deepEqual(d.main.layers,[]);assert.deepEqual(d.attention.layers,[]);
 for(const graph of [d.main,d.attention])assert.equal(graph.edges.length,graph.inputs*graph.outputs);
 assert.equal(d.regulators.length,6);
 for(const p of Object.values(dualMutationProfiles(genes))){assert.ok(p.rate>=.01&&p.rate<=.05);assert.ok(p.strength>=.05&&p.strength<=.2);}
 assert.deepEqual(packDualBrain(d),genes);
});

test('initial ranges are not evolutionary ceilings',()=>{
 const genes=randomDualGenome(new Random(2),{initialMutation:{main:{rate:.7,strength:4},attention:{rate:.8,strength:2},behavior:{rate:.5,strength:1}}});
 const p=dualMutationProfiles(genes);assert.ok(Math.abs(p.main.rate-.7)<1e-12);assert.equal(p.main.strength,4);
 for(const [rate,strength]of [[.5,10],[.99,1e200],[R.rateFloor,R.strengthFloor]]){
  const decoded=decodeMutationPair(encodeMutationPair(rate,strength));assert.ok(Number.isFinite(decoded.strength));assert.ok(Math.abs(decoded.rate-rate)<1e-12);
 }
});

test('numerical mutations use their own parental pairs, with no second output-bias mutation',()=>{
 const genes=randomDualGenome(new Random(7),{initialMutation:{main:{rate:.99,strength:.1},attention:{rate:R.rateFloor,strength:1},behavior:{rate:R.rateFloor,strength:1}}});
 const old=unpackDualBrain(genes),parent=genes.slice(),child=validateDualBrain(mutateDualGenome(genes,{next:()=>.25},{structuralMutations:false}));
 assert.deepEqual(genes,parent);assert.deepEqual(child.attention,old.attention);assert.deepEqual(child.traits,old.traits);
 assert.deepEqual(child.regulators.slice(0,4),old.regulators.slice(0,4));assert.notDeepEqual(child.regulators.slice(4),old.regulators.slice(4));
 for(let i=0;i<old.main.biases.length;i++)assert.ok(Math.abs(child.main.biases[i]-old.main.biases[i]+.05)<1e-12);
 for(let i=0;i<old.main.edges.length;i++)assert.ok(Math.abs(child.main.edges[i].weight-old.main.edges[i].weight+.05)<1e-12);
});

test('all six self-regulators can mutate and the new rate never controls this birth',()=>{
 const genes=randomDualGenome(new Random(7),{initialMutation:Object.fromEntries(['main','attention','behavior'].map(k=>[k,{rate:.9,strength:1}]))});
 const d=unpackDualBrain(genes),child=validateDualBrain(mutateDualGenome(genes,{next:()=>.25},{structuralMutations:false}));
 for(let i=0;i<6;i++)assert.ok(Math.abs(child.regulators[i]-d.regulators[i]+.5*Math.log(2))<1e-12);
});

test('zero structure grows, large strengths stay within technical bounds and survive roundtrip',()=>{
 const random=new Random(91),settings={initialMutation:{main:{rate:1,strength:1},attention:{rate:1,strength:1}},maxNeurons:8,maxLayers:3,attentionMaxNeurons:6,attentionMaxLayers:2};
 let genes=randomDualGenome(random,settings),grewMain=false,grewGate=false;
 for(let i=0;i<40;i++){
  genes=mutateDualGenome(genes,random,settings);const d=validateDualBrain(genes);
  assert.ok(d.main.layers.length<=8);assert.ok(d.attention.layers.length<=6);
  assert.ok(Math.max(0,...d.main.layers)<=3);assert.ok(Math.max(0,...d.attention.layers)<=2);
  grewMain||=d.main.layers.length>0;grewGate||=d.attention.layers.length>0;
  assert.deepEqual(packDualBrain(d),genes);
 }
 assert.ok(grewMain&&grewGate);
 const d=unpackDualBrain(genes);d.regulators=Array.from({length:3},()=>encodeMutationPair(1,1e300)).flat();genes=packDualBrain(d);
 validateDualBrain(mutateDualGenome(genes,random,{maxNeurons:0,maxLayers:0,attentionMaxNeurons:0,attentionMaxLayers:0}));
});

test('stochastic budgets have a zero outcome and allow growth from zero',()=>{
 assert.equal(mutationBudget(.1,0,10,{next:()=>.9}),0);
 assert.equal(mutationBudget(.1,0,10,{next:()=>.05}),1);
 assert.equal(mutationBudget(Number.MAX_VALUE,100,20,{next:()=>0}),20);
});

test('configurations, incomplete files and invalid topology are rejected',()=>{
 assert.throws(()=>randomDualGenome(new Random(1),{initialNeurons:[2],maxNeurons:1}));
 assert.throws(()=>randomDualGenome(new Random(1),{attentionInitialConnections:101}));
 const genes=randomDualGenome(new Random(3));assert.throws(()=>dualBrainLayout(genes.slice(1)));
 for(const change of [d=>d.main.edges[0].to=0,d=>d.attention.biases[0]=Infinity,d=>d.regulators[1]=1000]){
  const d=unpackDualBrain(genes);change(d);assert.throws(()=>validateDualBrain(packDualBrain(d)));
 }
});

test('identical seeds and settings reproduce mutations without simulation state',()=>{
 const a=new Random(71),b=new Random(71);let x=randomDualGenome(a),y=randomDualGenome(b);
 for(let i=0;i<20;i++){assert.deepEqual(x,y);x=mutateDualGenome(x,a);y=mutateDualGenome(y,b);}
 assert.deepEqual(x,y);
});
