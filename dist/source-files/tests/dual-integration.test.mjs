import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {Random} from '../dist/simulation.js';
import {DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {randomDualGenome} from '../dist/dual-brain-genome.js';
import {dualStructureSettings,dagConnectionBudget} from '../dist/dual-brain-settings.js';
import {validateWorldOptions,validatePlan} from '../dist/experiment-plan.js';
import {runWorld} from '../dist/experiment-runner.js';
import {analyzeGenome} from '../dist/genome-analysis.js';
import {brainDiagramModel} from '../dist/brain-diagram-ui.js';
import {captureHeritable} from '../dist/heritable-statistics.js';
import {describeLifeObservations} from '../dist/life-observations.js';
import {encodeLifeTable,decodeLifeTable} from '../dist/experiment-archive.js';

test('settings validate both independent limits and allow optional high founder regulators',()=>{
 const value=dualStructureSettings({attentionMaxNeurons:3,attentionMaxLayers:2,attentionInitialNeurons:[1,2],initialMutation:{attention:{rate:.8,strength:4}}});
 assert.equal(value.attentionMaxNeurons,3);assert.equal(value.initialMutation.attention.strength,4);
 assert.throws(()=>dualStructureSettings({attentionInitialNeurons:[65]}));
 assert.throws(()=>dualStructureSettings({initialMutation:{context:{rate:NaN}}}));
 assert.equal(dagConnectionBudget(18,1,[],100).count,18);
 assert.throws(()=>dagConnectionBudget(18,1,[],101));
});
test('experiment plans preserve new settings and old reports do not invent them',()=>{
 const common=validateWorldOptions({attentionInitialNeurons:[2],attentionMaxNeurons:3,initialMutation:{context:{rate:.9,strength:2}}});
 assert.deepEqual(common.attentionInitialNeurons,[2]);assert.equal(common.initialMutation.context.rate,.9);
 assert.equal(validateWorldOptions(common,{historical:true}).attentionMaxNeurons,3);
 assert.equal(validateWorldOptions({},{historical:true}).attentionMaxNeurons,undefined);
 const plan=validatePlan({worlds:1,steps:1,common,factors:[]});assert.ok(plan.variants.length);
});
test('analysis and diagram show both actual graphs without evaluating or mutating the brain',()=>{
 const w=new Evolution({population:1,brainType:DUAL_BRAIN_TYPE,attentionInitialNeurons:[2],initialNeurons:[1]}),a=w.agents[0],state=w.random.state;
 const analysis=analyzeGenome(w.genomeFile(a));assert.equal(analysis.genomeVersion,16);
 for(const key of ['contextMutationRate','behaviorMutationStrength','attentionNeurons'])assert.ok(analysis.properties.some(p=>p.key===key));
 assert.equal(brainDiagramModel(a,'gate').nodes.length,21);assert.ok(brainDiagramModel(a,'context').nodes.length>0);
 assert.equal(w.random.state,state);assert.equal(a.brain.updates,0);
});
test('new statistics use distinct fields and survive compact tables without lost absence',()=>{
 const w=new Evolution({population:1,brainType:DUAL_BRAIN_TYPE}),a=w.agents[0];w.step();
 const heritable=captureHeritable(a);assert.equal(heritable.mainNeurons,0);assert.equal(heritable.attentionNeurons,0);
 assert.equal(heritable.brainNeurons,undefined);assert.equal(heritable.structuralRate,undefined);
 const row={heritable,observations:describeLifeObservations(a.life.observer)},schemas=[];
 const encoded=encodeLifeTable([row,{observations:{schema:'life-observer-v1'}}],schemas),decoded=decodeLifeTable(encoded.table,schemas[encoded.schema]);
 assert.deepEqual(decoded,[row,{observations:{schema:'life-observer-v1'}}]);
 assert.ok(Number.isFinite(row.observations.attentionEnergyCost));assert.ok(Number.isFinite(row.observations.learningEnergyCost));
});
test('short actual experiment runs current dual schema and exports its observations',async()=>{
 const report=await runWorld({id:'dual-test',kind:'world',steps:2,population:2,limit:4,seed:42,worldOptions:{learning:true,memory:true,attentionInitialNeurons:[1]},scenario:'custom',fullHistory:true});
 assert.equal(report.status,'completed',report.error);assert.equal(report.settings.brainType,DUAL_BRAIN_TYPE);
 assert.equal(report.tick,2);assert.equal(report.error,null);
});
test('changing only founder mutation override does not shift other inherited numerical traits',()=>{
 const a=randomDualGenome(new Random(19)),b=randomDualGenome(new Random(19),{initialMutation:{context:{rate:.8,strength:2}}});
 // Основная структура и фиксированные веса находятся до регуляторов.
 const w=new Evolution({population:1,brainType:DUAL_BRAIN_TYPE,baseGenome:a}),v=new Evolution({population:1,brainType:DUAL_BRAIN_TYPE,baseGenome:b});
 assert.deepEqual(w.agents[0].brain.networkBase,v.agents[0].brain.networkBase);assert.deepEqual(w.agents[0].brain.traits,v.agents[0].brain.traits);
});
