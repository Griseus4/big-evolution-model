import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../dist/simulation.js';
import {randomDualGenome,mutateDualGenome} from '../dist/dual-brain-genome.js';
import {unpackDualBrain,packDualBrain,DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {MUTATION_GROUPS} from '../dist/brain-evolution-rules.js';
import {randomDualGenome as v16Genome,mutateDualGenome as v16Mutate} from '../dist/benchmark-snapshots/0.55.3/dual-brain-genome.js';
import {Evolution as V16World} from '../dist/benchmark-snapshots/0.55.3/evolution.js';
import {Evolution} from '../dist/evolution.js';
import {LifeHistory} from '../dist/life-history.js';
import {loadWorld,saveWorld} from '../dist/world-save.js';
import {captureHeritable} from '../dist/heritable-statistics.js';
import {chartFamilies,chartApplicable} from '../dist/chart-applicability.js';
import {validatePlan} from '../dist/experiment-plan.js';
import {experimentPreferences} from '../dist/experiment-preferences.js';
import {splitMutationForm} from '../dist/mutation-form-migration.js';
const flags=active=>Object.fromEntries(MUTATION_GROUPS.map(k=>[k,active.includes(k)]));
const profiles=Object.fromEntries(MUTATION_GROUPS.map(k=>[k,{rate:1,strength:1}]));
const make=()=>randomDualGenome(new Random(74),{initialMutation:profiles});
const topology=g=>({layers:g.layers,edges:g.edges.map(({from,to})=>({from,to}))});
// Снимок ядра не включает IO. Только на время кодирования даём его двум
// известным типам текущие прототипы, затем возвращаем исходные методы.
function saveV16(w){const entries=[],seen=new Set();function walk(v){if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(['Random','LifeHistory'].includes(v.constructor.name))entries.push([v,Object.getPrototypeOf(v),v.constructor.name==='Random'?Random.prototype:LifeHistory.prototype]);if(v instanceof Map)for(const [k,x]of v){walk(k);walk(x);}else if(v instanceof Set)for(const x of v)walk(x);else if(!ArrayBuffer.isView(v))for(const x of Object.values(v))walk(x);}walk(w);try{for(const [v,,proto]of entries)Object.setPrototypeOf(v,proto);return {...saveWorld(w),modelVersion:'0.55.3'};}finally{for(const [v,proto]of entries)Object.setPrototypeOf(v,proto);}}

test('weight mutations leave both graph structures intact and structural pairs frozen',()=>{
 const parent=make(),before=unpackDualBrain(parent),child=unpackDualBrain(mutateDualGenome(parent,{next:()=>.25},{mutationEnabled:flags(['contextWeights','attentionWeights'])}));
 for(const name of ['main','attention']){assert.deepEqual(topology(child[name]),topology(before[name]));assert.notDeepEqual(child[name].edges,before[name].edges);}
 assert.deepEqual(child.regulators.slice(-4),before.regulators.slice(-4));assert.deepEqual(packDualBrain(before),parent);
});
test('structure-only mutations preserve numerical values of surviving connections',()=>{
 const before=unpackDualBrain(make()),child=unpackDualBrain(mutateDualGenome(packDualBrain(before),new Random(9),{mutationEnabled:flags(['contextStructure','attentionStructure']),maxNeurons:0,attentionMaxNeurons:0}));
 for(const name of ['main','attention']){
  const old=new Map(before[name].edges.map(e=>[e.from+':'+e.to,e.weight]));
  assert.notDeepEqual(topology(child[name]),topology(before[name]));
  for(const e of child[name].edges)if(old.has(e.from+':'+e.to))assert.equal(e.weight,old.get(e.from+':'+e.to));
  assert.deepEqual(child[name].biases,before[name].biases);
 }
 assert.deepEqual(child.fixed,before.fixed);assert.deepEqual(child.regulators.slice(0,-4),before.regulators.slice(0,-4));
});
test('topology can grow with numerical mutations disabled and master topology switch remains independent',()=>{
 const parent=make(),before=unpackDualBrain(parent),settings={mutationEnabled:flags(['contextStructure','attentionStructure'])};
 const child=unpackDualBrain(mutateDualGenome(parent,{next:()=>.75},settings));
 for(const name of ['main','attention']){assert.equal(child[name].layers.length,1);const id=child[name].inputs;assert.ok(child[name].edges.some(e=>e.to===id&&e.weight!==0));assert.ok(child[name].edges.some(e=>e.from===id&&e.weight===0));}
 const fixed=unpackDualBrain(mutateDualGenome(parent,{next:()=>.75},{...settings,structuralMutations:false}));
 assert.deepEqual(fixed.main,before.main);assert.deepEqual(fixed.attention,before.attention);
});
test('v16 mutation trajectories, regulator schema and RNG are preserved exactly',()=>{
 let current=v16Genome(new Random(87)),frozen=current;const a=new Random(23),b=new Random(23);
 for(let j=0;j<12;j++){current=mutateDualGenome(current,a);frozen=v16Mutate(frozen,b);assert.deepEqual(current,frozen);assert.equal(a.state,b.state);}
 assert.equal(unpackDualBrain(current).layout.version,16);
});
test('full v16 worlds retain seven-pair continuation including reproduction and learned state',()=>{
 const old=new V16World({brainType:DUAL_BRAIN_TYPE,population:2,seed:18});old.step();
 const current=loadWorld(saveV16(old));
 for(const w of [old,current]){const a=w.agents[0];a.age=200;a.energy=100;a.health=100;a.lastBirthAge=-1e6;assert.ok(w.reproduce(a));for(let j=0;j<6;j++)w.step();}
 assert.deepEqual(current.agents.map(a=>a.genome),old.agents.map(a=>a.genome));
 for(const key of ['random','cognitiveRandom','bodyRandom','neuralRandom','mutationRandom'])assert.equal(current[key].state,old[key].state,key);
 assert.deepEqual(saveWorld(current).state,saveV16(old).state);
 assert.equal(unpackDualBrain(current.agents.at(-1).genome).layout.version,16);
});
test('historical shared metrics and factors stay distinct from separate current ones',()=>{
 const h=captureHeritable(new Evolution({brainType:DUAL_BRAIN_TYPE,population:1}).agents[0]),f=chartFamilies({dead:[{heritable:h}]}),def=metric=>({standard:true,metric});
 assert.ok(Number.isFinite(h.contextWeightsMutationRate));assert.ok(Number.isFinite(h.contextStructureMutationRate));assert.equal(h.contextMutationRate,undefined);
 assert.equal(chartApplicable(def('contextMutationRate'),f),false);assert.equal(chartApplicable(def('contextWeightsMutationRate'),f),true);
 const old=validatePlan({worlds:1,steps:1,common:{attentionMaxNeurons:16,mutationEnabled:{context:true,attention:true}},factors:[{key:'initialMutation.context.rate',values:[.2,.5]}]},{historical:true});
 assert.equal(old.variants[1].settings.initialMutation.context.rate,.5);assert.equal(old.variants[1].settings.initialMutation.contextWeights,undefined);
 assert.throws(()=>validatePlan(old));
});
test('stored forms explicitly split common startup settings and retain an original backup',()=>{
 const original={fields:{'initialMutation.context.rate':'20','mutationEnabled.attention':false}},state={version:1,draft:original,standard:null},memory=new Map([['form',JSON.stringify(state)]]),messages=[];
 const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},store=experimentPreferences(storage,m=>messages.push(m),'form');
 assert.equal(store.draft().fields['initialMutation.contextWeights.rate'],'20');assert.equal(store.draft().fields['initialMutation.contextStructure.rate'],'20');
 assert.equal(store.draft().fields['mutationEnabled.attentionWeights'],false);assert.equal(store.draft().fields['mutationEnabled.attentionStructure'],false);
 assert.deepEqual(JSON.parse(memory.get('form-before-v17')),state);assert.match(messages.join(' '),/скопированы/);assert.deepEqual(state.draft,original);
 assert.equal(splitMutationForm(store.draft()).changed,false);
});
