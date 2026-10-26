import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../dist/simulation.js';
import {randomDualGenome,mutateDualGenome,dualMutationProfiles} from '../dist/dual-brain-genome.js';
import {randomDualGenome as legacyGenome,mutateDualGenome as legacyMutate} from '../dist/benchmark-snapshots/0.55.0/dual-brain-genome.js';
import {unpackDualBrain,packDualBrain,DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {STRUCTURAL_BLOCKS} from '../dist/structural-brain.js';
import {MUTATION_GROUPS,EVOLUTION_RULES as R} from '../dist/brain-evolution-rules.js';
import {genomeMetadata,validateGenomeFile} from '../dist/genome.js';
import {dualStructureSettings} from '../dist/dual-brain-settings.js';
import {Evolution} from '../dist/evolution.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {validatePlan} from '../dist/experiment-plan.js';
import {captureHeritable} from '../dist/heritable-statistics.js';
import {analyzeGenome} from '../dist/genome-analysis.js';
import {dualBrainSettingsUI} from '../dist/dual-brain-settings-ui.js';
import {compileDualState} from '../dist/dual-brain-state.js';
import {encodeState,decodeState} from '../dist/state-codec.js';

const strong=Object.fromEntries(MUTATION_GROUPS.map(k=>[k,{rate:.99,strength:.2}]));
const flags=value=>Object.fromEntries(MUTATION_GROUPS.map(k=>[k,value]));
function block(d,key){
 const index=d.layout.mutationGroups.indexOf(key),regulators=d.regulators.slice(2*index,2*index+2);
 if(key==='behavior')return {traits:d.traits,regulators};
 if(key==='attention')return {graph:d.attention,regulators};
 if(key==='context')return {graph:d.main,regulators};
 const b=STRUCTURAL_BLOCKS.find(b=>b.key===key);
 return {parameters:d.fixed.slice(b.offset,b.offset+b.weights+(b.bias===null?0:b.outputs)),regulators};
}
test('v16 has seven named independent pairs and a strict versioned file contract',()=>{
 const genes=randomDualGenome(new Random(40)),d=unpackDualBrain(genes);
 assert.equal(d.layout.version,16);assert.equal(d.regulators.length,14);
 assert.deepEqual(Object.keys(dualMutationProfiles(genes)),MUTATION_GROUPS);
 const file={format:'big-evolution-genome',...genomeMetadata(genes),genes};
 assert.deepEqual(validateGenomeFile(file),genes);assert.deepEqual(packDualBrain(d),genes);
 assert.throws(()=>validateGenomeFile({...file,version:15}));
});
test('each pair changes exactly its own block, including each bias only once',()=>{
 for(const key of MUTATION_GROUPS){
  const profiles=Object.fromEntries(MUTATION_GROUPS.map(k=>[k,k===key?strong[k]:{rate:R.rateFloor,strength:.2}]));
  const genes=randomDualGenome(new Random(50),{initialMutation:profiles}),old=unpackDualBrain(genes);
  const child=unpackDualBrain(mutateDualGenome(genes,{next:()=>.25},{structuralMutations:false}));
  for(const other of MUTATION_GROUPS)if(other!==key)assert.deepEqual(block(child,other),block(old,other),`${key} changed ${other}`);
  const values=d=>key==='context'?[...d.main.biases,...d.main.edges.map(e=>e.weight)]:key==='attention'?[...d.attention.biases,...d.attention.edges.map(e=>e.weight)]:key==='behavior'?d.traits:block(d,key).parameters;
  const a=values(old),b=values(child);assert.ok(a.length);
  for(let i=0;i<a.length;i++)assert.ok(Math.abs(b[i]-a[i]+.1)<1e-12,`${key}: parameter ${i}`);
  assert.notDeepEqual(block(child,key).regulators,block(old,key).regulators);
 }
});
test('disabled blocks preserve weights, topology and their regulators while others can evolve',()=>{
 for(const key of MUTATION_GROUPS){
  const genes=randomDualGenome(new Random(80),{initialMutation:strong}),old=unpackDualBrain(genes);
  const child=unpackDualBrain(mutateDualGenome(genes,{next:()=>.25},{mutationEnabled:{[key]:false}}));
  assert.deepEqual(block(child,key),block(old,key),key);
  assert.notDeepEqual(child.regulators,old.regulators);
 }
 const genes=randomDualGenome(new Random(70));
 assert.deepEqual(mutateDualGenome(genes,{next:()=>{throw new Error('Disabled mutation consumed RNG');}},{mutationEnabled:flags(false)}),genes);
});
test('v15 retains its own schema, mutation RNG and missing new statistics',()=>{
 const genes=legacyGenome(new Random(71)),a=new Random(2),b=new Random(2);
 assert.deepEqual(mutateDualGenome(genes,a),legacyMutate(genes,b));assert.equal(a.state,b.state);
 const file={format:'big-evolution-genome',...genomeMetadata(genes),genes};
 assert.equal(file.version,15);assert.deepEqual(validateGenomeFile(file),genes);
 const analysis=analyzeGenome(file);
 assert.ok(analysis.properties.some(p=>p.key==='mainMutationRate'));
 assert.equal(analysis.properties.some(p=>p.key==='contextMutationRate'),false);
});
test('settings default to enabled, validate masks and preserve per-variant switches',()=>{
 assert.deepEqual(dualStructureSettings().mutationEnabled,flags(true));
 for(const value of [{context:0},{other:true},[],null])assert.throws(()=>dualStructureSettings({mutationEnabled:value}));
 const p=validatePlan({worlds:1,steps:1,common:{mutationEnabled:{cells:false}},factors:[{key:'mutationEnabled.target',values:[true,false]}]});
 assert.equal(p.variants.length,2);assert.equal(p.common.mutationEnabled.cells,false);
 assert.deepEqual(p.variants.map(v=>v.settings.mutationEnabled.target),[true,false]);
});
test('saved masks survive continuation and master mutation switch preserves the whole genome',()=>{
 const w=new Evolution({brainType:DUAL_BRAIN_TYPE,population:1,mutationEnabled:{context:false,cells:false}});w.step();
 const restored=loadWorld(saveWorld(w));assert.deepEqual(restored.mutationEnabled,w.mutationEnabled);
 restored.step();w.step();assert.deepEqual(restored.snapshot(),w.snapshot());
 const frozen=new Evolution({brainType:DUAL_BRAIN_TYPE,population:1,mutations:false}),a=frozen.agents[0];
 a.age=200;a.energy=100;a.health=100;a.lastBirthAge=-1e6;
 const child=frozen.reproduce(a);assert.ok(child);assert.deepEqual(child.genome,a.genome);
 const stats=captureHeritable(w.agents[0]);assert.ok(Number.isFinite(stats.contextMutationRate));assert.equal(stats.mainMutationRate,undefined);
});
test('per-block switches reach reproduction and a v15 world retains its legacy genome',()=>{
 for(const baseGenome of [null,legacyGenome(new Random(50))]){
  const w=new Evolution({brainType:DUAL_BRAIN_TYPE,population:1,baseGenome,mutationEnabled:baseGenome?undefined:flags(false)}),a=w.agents[0];
  if(!baseGenome){a.age=200;a.energy=100;a.health=100;a.lastBirthAge=-1e6;const child=w.reproduce(a);assert.ok(child);assert.deepEqual(child.genome,a.genome);}
  else{
   w.step();const file=saveWorld(w),state=decodeState(file.state);
   delete state.mutationEnabled;file.modelVersion='0.55.0';file.state=encodeState(state);
   const restored=loadWorld(file);w.step();restored.step();assert.deepEqual(restored.snapshot(),w.snapshot());
   assert.equal(genomeMetadata(restored.agents[0].genome).version,15);
  }
 }
});
test('splitting the regulators adds no evaluator operations or parameters',()=>{
 const old=legacyGenome(new Random(12)),d=unpackDualBrain(old);
 d.regulators=MUTATION_GROUPS.flatMap(key=>d.regulators.slice(key==='behavior'?0:key==='attention'?2:4,key==='behavior'?2:key==='attention'?4:6));
 d.layout={version:16};const current=packDualBrain(d),a=compileDualState(old),b=compileDualState(current);
 assert.deepEqual(b,a);
});
test('world controls enable all groups by default and imported founders keep usable mutation switches',()=>{
 const nodes=[],doc={createElement:tag=>{
  const node={tagName:tag,children:[],dataset:{},ownerDocument:doc,value:'',append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(){},setAttribute(){},setCustomValidity(){}};
  nodes.push(node);return node;
 }};
 let imported=false;const controls=dualBrainSettingsUI(doc,doc.createElement('div'),()=>imported);
 const toggles=nodes.filter(n=>n.type==='checkbox');assert.equal(toggles.length,MUTATION_GROUPS.length);
 assert.deepEqual(controls.read().mutationEnabled,flags(true));
 toggles[2].checked=false;assert.equal(controls.read().mutationEnabled.context,false);
 imported=true;controls.refresh();assert.equal(toggles[2].disabled,undefined);assert.equal(controls.read().mutationEnabled.context,false);
});
