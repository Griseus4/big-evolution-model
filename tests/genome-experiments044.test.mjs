import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {Evolution as Baseline} from '../dist/benchmark-snapshots/0.39.2/evolution.js';
import {FOUNDER_SENSE_FIELDS,validateFounderSenses,compileFounderSenses} from '../dist/founder-senses.js';
import {readGenomeChoices,uniqueGenomeChoices} from '../dist/experiment-genomes.js';
import {validatePlan,validateWorldOptions} from '../dist/experiment-plan.js';
import {runWorld} from '../dist/experiment-runner.js';
import {installExperimentDesign} from '../dist/experiment-design-ui.js';
import {layoutForGenes} from '../dist/neural-layout.js';
import {randomNeuralGenome} from '../dist/genome.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
const opts={seed:77,terrainSeed:42,foodSeed:42,population:4,limit:20};
const original=new Evolution(opts),file=original.genomeFile(original.agents[0]),other=original.genomeFile(original.agents[1]);
const choices=[{name:'A.json',genes:file.genes},{name:'B.json',genes:other.genes}];
const science=w=>({agents:w.agents,food:w.foodIslands,tiles:w.tiles,rng:['random','neuralRandom','cognitiveRandom','bodyRandom','mutationRandom','foodRandom','environmentRandom'].map(k=>[k,w[k]?.state])});
test('optional coefficient omission preserves exact baseline trajectories and independent random founders',()=>{
 const current=new Evolution(opts),baseline=new Baseline(opts),empty=new Evolution({...opts,founderSenses:{}});
 for(let i=0;i<3;i++){assert.deepEqual(science(current),science(baseline));assert.deepEqual(science(current),science(empty));current.step();baseline.step();empty.step();}
 assert.notDeepEqual(current.agents[0].genome,current.agents[1].genome);
 assert.equal(validateWorldOptions().founderSenses,undefined);assert.equal(validateFounderSenses({}),undefined);
});
test('numeric edits replace only chosen genes before brains/history capture, without consuming RNG',()=>{
 const values={energy:-1.25,health:0,stomach:2.5},w=new Evolution({...opts,founderSenses:values}),edits=compileFounderSenses(values,layoutForGenes(w.agents[0].genome)),changed=new Set(edits.map(e=>e[0]));
 assert.deepEqual(w.agents.map(a=>[a.x,a.y]),original.agents.map(a=>[a.x,a.y]));assert.deepEqual(science(w).rng,science(original).rng);
 for(let i=0;i<w.agents.length;i++){const a=w.agents[i],b=original.agents[i];for(let j=0;j<a.genome.length;j++)assert.equal(a.genome[j],changed.has(j)?edits.find(e=>e[0]===j)[1]:b.genome[j]);assert.deepEqual(a.brain.traits.values,[values.energy,values.health,0,values.stomach]);assert.equal(a.life.heritable.senseHealth,0);assert.ok(a.life.heritable.senseEnergy<0);assert.ok(a.life.heritable.senseStomach>0);}
 assert.equal(FOUNDER_SENSE_FIELDS.length,3);for(const bad of [null,[],{pain:1},{energy:NaN},{energy:'1'},{health:Infinity},{stomach:8.01}])assert.throws(()=>new Evolution({...opts,founderSenses:bad}),/коэффициент|Коэффициент|Чувствительности/);
 assert.throws(()=>validatePlan({variants:[{settings:{founderSenses:null}}]}),/Чувствительности/);
});
test('file base is immutable, missing edits retain its coefficients and children inherit normally',()=>{
 const before=structuredClone(file),w=new Evolution({...opts,population:1,baseGenome:file.genes,founderSenses:{stomach:-2},mutations:false}),a=w.agents[0];
 assert.deepEqual(file,before);assert.equal(a.brain.traits.values[0],original.agents[0].brain.traits.values[0]);assert.equal(a.brain.traits.values[3],-2);
 w._primed=true;a.born=-100;a.bornSubtick=-1000;a.age=100;a.energy=80;a.process={action:9,elapsed:19,duration:20,destination:{x:a.x,y:a.y},localDestination:{...a.brain.position},direction:null};w.substep();assert.equal(w.agents.length,2);assert.deepEqual(w.agents[1].genome,a.genome);assert.equal(w.agents[1].brain.traits.values[3],-2);
 // Новый ребёнок не зажат условием опыта: другой ген родителя наследуется.
 const index=compileFounderSenses({stomach:3},layoutForGenes(a.genome))[0][0];a.genome[index]=3;a.children=0;a.energy=80;a.process={action:9,elapsed:19,duration:20,destination:{x:a.x,y:a.y},localDestination:{...a.brain.position},direction:null};w.substep();assert.equal(w.agents[2].genome[index],3);
 const clean=new Evolution({...opts,founderSenses:{energy:0,health:-1,stomach:1}});clean.step();const restored=loadWorld(saveWorld(clean));clean.step();restored.step();assert.deepEqual(saveWorld(clean),saveWorld(restored));
});
test('genome and numeric factors form a stable product, keep independent settings and roundtrip exactly',()=>{
 const factors=[{key:'baseGenome',values:choices},{key:'founderSenses.stomach',values:[-1,0,1]},{key:'founderSenses.energy',values:[-2,2]}],p=validatePlan({worlds:1,steps:1,common:{population:2,limit:10},factors});
 assert.equal(p.variants.length,12);assert.deepEqual(p.variants.map(v=>[v.settings.baseGenome[0],v.settings.founderSenses.stomach,v.settings.founderSenses.energy]),choices.flatMap(g=>[-1,0,1].flatMap(s=>[-2,2].map(e=>[g.genes[0],s,e]))));
 assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);assert.match(p.variants[0].name,/A.json/);p.variants[0].settings.founderSenses.stomach=8;assert.equal(p.variants[1].settings.founderSenses.stomach,-1);assert.equal(file.genes[0],choices[0].genes[0]);
 assert.throws(()=>uniqueGenomeChoices([choices[0],{...choices[0],name:'copy'}]),/повторяется/);assert.throws(()=>validatePlan({factors:[{key:'founderSenses.energy',values:[9]}]}),/недопустимое/);
});
test('multiple-file validation is atomic; cancellation, corruption and duplicate genes preserve existing values',async()=>{
 const valid={name:'new.json',size:100,text:async()=>JSON.stringify(other)},bad={name:'bad.json',size:2,text:async()=>'{}'},existing=[choices[0]],copy=structuredClone(existing);
 assert.equal(await readGenomeChoices([],existing),existing);await assert.rejects(readGenomeChoices([valid,bad],existing));assert.deepEqual(existing,copy);assert.equal((await readGenomeChoices([valid],existing)).length,2);await assert.rejects(readGenomeChoices([{...valid,size:100001}],existing),/большой/);await assert.rejects(readGenomeChoices([{...valid,text:async()=>JSON.stringify(file)}],existing),/повторяется/);
 assert.throws(()=>uniqueGenomeChoices([{name:'old.json',genes:randomNeuralGenome({next:()=>.5})}]),/v13/);
});
test('real world executor records the exact requested founder coefficients',async()=>{
 const p=validatePlan({worlds:1,steps:1,common:{population:2,limit:10},factors:[{key:'founderSenses.energy',values:[-1,1]}]});
 const r=await runWorld({id:'genetic',seed:42,steps:1,worldOptions:p.variants[0].settings,fullHistory:true});assert.equal(r.status,'completed');assert.deepEqual(r.settings.worldOptions.founderSenses,{energy:-1});for(const row of [...r.lives.living,...r.lives.dead])assert.ok(row.heritable.senseEnergy<0);
});
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.files=[];}
 append(...nodes){for(const n of nodes)n.parent=this;this.children.push(...nodes);}replaceChildren(...n){this.children=[];this.append(...n);}setAttribute(){}addEventListener(k,fn){this.listeners[k]=fn;}emit(k){return this.listeners[k]?.({target:this});}remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}focus(){}
}
const descend=(n,fn)=>n.children.flatMap(c=>[...(fn(c)?[c]:[]),...descend(c,fn)]);
test('editor restores genome factors, guards pending files, removes values and keeps optional senses absent',async()=>{
 const nodes=new Map(['constructor-factor-add','constructor-factors','constructor-design-summary','constructor-design-tree'].map(k=>[k,new Element()])),root={getElementById:id=>nodes.get(id),createElement:t=>new Element(t)};let error='';const ui=installExperimentDesign({root,readCommon:()=>({}),onError:e=>error=e});assert.deepEqual(ui.read(),[]);
 ui.write([{key:'baseGenome',values:[choices[0]]}]);const input=descend(nodes.get('constructor-factors'),n=>n.type==='file')[0];input.files=[];await input.emit('change');assert.equal(ui.read()[0].values.length,1);
 let release;input.files=[{name:'B.json',size:100,text:()=>new Promise(r=>release=r)}];const loading=input.emit('change');assert.throws(()=>ui.read(),/Дождитесь/);release(JSON.stringify(other));await loading;assert.equal(ui.read()[0].values.length,2);assert.equal(error,'');
 input.files=[{name:'bad',size:2,text:async()=>'{}'}];await input.emit('change');assert.ok(error);assert.equal(ui.read()[0].values.length,2);descend(nodes.get('constructor-factors'),n=>n.textContent==='×')[0].emit('click');assert.equal(ui.read()[0].values.length,1);
 const round=ui.read();ui.write(round);assert.deepEqual(ui.read(),round);nodes.get('constructor-factor-add').value='founderSenses.health';nodes.get('constructor-factor-add').emit('change');assert.ok(Number.isNaN(ui.read()[1].values[0]));
});
