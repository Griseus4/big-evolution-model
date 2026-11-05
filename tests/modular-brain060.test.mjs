import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {Random} from '../dist/simulation.js';
import {dagConnectionBudget} from '../dist/dual-brain-settings.js';
import {randomDualGenome,validateDualBrain,dualMutationProfiles,mutateDualGenome} from '../dist/dual-brain-genome.js';
import {packModularBrain,MODULAR_GRAPH_SPECS} from '../dist/modular-brain-layout.js';
import {MODULAR_MUTATION_GROUPS} from '../dist/brain-evolution-rules.js';
import {preparePhysiologyBoundary,physiologyFrame,advancePhysiologyBodies} from '../dist/physiology-world.js';
import {prepareSetInput,setCandidateInput} from '../dist/care-inputs.js';
import {modularCommonForward,modularCandidateForward,modularCandidateValue,modularSetGradient} from '../dist/modular-brain-math.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {checkPhysiologyInvariants} from '../dist/physiology-invariants.js';
import {operationCounts} from '../dist/brain-cost.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {captureBenchmarkState,benchmarkDigest} from '../dist/benchmark-state.js';
import {validatePlan,validateWorldOptions} from '../dist/experiment-plan.js';
import {analyzeGenome} from '../dist/genome-analysis.js';
import {brainDiagramModel} from '../dist/brain-diagram-ui.js';
import {PHYSIOLOGY_FIELDS} from '../dist/physiology-settings.js';
import {CARE_GENE_FIELDS} from '../dist/care-settings.js';
import {PHYSIOLOGY_FIELD_GROUPS} from '../dist/physiology-field-groups.js';
import {PHYSIOLOGY_HELP} from '../dist/physiology-help.js';
import {processTiming,startProcess} from '../dist/physiology-actions.js';

const extras=()=>Object.fromEntries(MODULAR_GRAPH_SPECS.filter(s=>!['context','attention'].includes(s.key)).map(s=>[s.key,{initialNeurons:[2],initialConnections:100,maxNeurons:8,maxLayers:3}]));
const options=()=>({population:2,seed:42,physiology:{},genomeVersion:20,initialNeurons:[2],attentionInitialNeurons:[2],brainModules:extras()});

test('v20 содержит шесть независимых структур и активные согласованные профили',()=>{
 const settings=validateWorldOptions({brainModules:extras()}),genes=randomDualGenome(new Random(42),settings),d=validateDualBrain(genes),profiles=dualMutationProfiles(genes);
 assert.equal(d.layout.version,20);assert.deepEqual(packModularBrain(d),genes);assert.equal(Object.keys(d.graphs).length,6);
 assert.equal(profiles.behavior.shape,1);assert.equal(profiles.cells.ceiling,.1);assert.ok(Math.abs(profiles.directStructure.rate-.5)<1e-12);assert.equal(profiles.directStructure.strength,.5);
 assert.throws(()=>validateDualBrain([...genes.slice(0,-2),1,genes.at(-1)]));
});

test('градиент по всем пяти блокам совпадает с численной производной, включая скрытые смещения',()=>{
 const w=new Evolution(options()),a=w.agents[0];preparePhysiologyBoundary(w);const request=physiologyFrame(w,a).request,frame=prepareSetInput(a.brain,request);frame.candidate=setCandidateInput(a.brain,request.observation,request.candidates[0],frame).input;
 const p=a.brain.networkBase.slice();p.structure=a.brain.structure;const analytic=modularSetGradient(p,frame,new Float64Array(p.length));
 const q=()=>modularCandidateForward(p,modularCommonForward(p,frame),frame.candidate).value;
 for(const m of Object.values(p.structure.modules))for(const local of [0,m.hidden,m.parameters-1]){const i=m.offset+local,original=p[i],epsilon=1e-5;p[i]=original+epsilon;const plus=q();p[i]=original-epsilon;const minus=q();p[i]=original;const numeric=(plus-minus)/(2*epsilon);assert.ok(Math.abs(numeric-analytic.gradient[i])<2e-6,`${i}: ${numeric} != ${analytic.gradient[i]}`);}
});

test('быстрые линейные головки дают те же Q, что общий проход разреженных DAG',()=>{
 for(const percent of [0,35,100]){const w=new Evolution({population:1,seed:42,physiology:{},genomeVersion:20,brainModules:{target:{initialConnections:percent},direct:{initialConnections:percent}}}),a=w.agents[0];preparePhysiologyBoundary(w);const request=physiologyFrame(w,a).request,prepared=prepareSetInput(a.brain,request),p=a.brain.networkBase.slice();p.structure=a.brain.structure;const common=modularCommonForward(p,prepared);
  for(const candidate of request.candidates){const row=setCandidateInput(a.brain,request.observation,candidate,prepared),x=modularCandidateValue(p,common,row.input,row.operation),y=modularCandidateForward(p,common,row.input).value;assert.ok(Math.abs(x-y)<1e-12,`${percent}: ${x} != ${y}`);}}
});

test('мутации весов и структуры раздельны у каждого блока; выключение сохраняет и регуляторы',()=>{
 const genes=randomDualGenome(new Random(42),{genomeVersion:20,brainModules:extras()}),off=Object.fromEntries(MODULAR_MUTATION_GROUPS.map(k=>[k,false]));
 assert.deepEqual(mutateDualGenome(genes,new Random(23),{mutationEnabled:off}),genes);
 for(const spec of MODULAR_GRAPH_SPECS){const key=spec.key==='context'?'contextWeights':spec.key==='attention'?'attentionWeights':spec.key,next=mutateDualGenome(genes,new Random(7),{mutationEnabled:{...off,[key]:true}}),before=validateDualBrain(genes),after=validateDualBrain(next);assert.deepEqual(after.graphs[spec.key].layers,before.graphs[spec.key].layers);assert.notDeepEqual(after.graphs[spec.key].biases,before.graphs[spec.key].biases);for(const other of MODULAR_GRAPH_SPECS.filter(s=>s.key!==spec.key))assert.deepEqual(after.graphs[other.key],before.graphs[other.key]);}
});

test('каждый блок может изменить структуру без изменения числовых параметров других блоков',()=>{
 const genes=randomDualGenome(new Random(3),{genomeVersion:20,brainModules:extras()}),off=Object.fromEntries(MODULAR_MUTATION_GROUPS.map(k=>[k,false]));
 for(const spec of MODULAR_GRAPH_SPECS){let changed=false;for(let seed=1;seed<=12&&!changed;seed++){const before=validateDualBrain(genes),next=mutateDualGenome(genes,new Random(seed),{mutationEnabled:{...off,[spec.key+'Structure']:true}}),after=validateDualBrain(next);changed=JSON.stringify(after.graphs[spec.key])!==JSON.stringify(before.graphs[spec.key]);for(const other of MODULAR_GRAPH_SPECS.filter(s=>s.key!==spec.key))assert.deepEqual(after.graphs[other.key],before.graphs[other.key]);}assert.ok(changed,spec.key);}
});

test('сохранение v7 точно продолжает личное обучение и физические балансы',()=>{
 const w=new Evolution(options());for(let i=0;i<30;i++)w.substep();const file=saveWorld(w);assert.equal(file.version,7);const copy=loadWorld(file);for(let i=0;i<5;i++){w.substep();copy.substep();}checkPhysiologyInvariants(w);assert.deepEqual(saveWorld(copy),saveWorld(w));assert.ok(w.agents.some(a=>a.brain.updates>0));
});

test('новые сети исполняются одинаково локально и в 1/4 владельцах',async()=>{
 for(const workers of [1,4]){const x=new Evolution(options()),y=new Evolution(options()),pool=new ParallelWorld(y,{workers,createWorker:createCognitionWorker});try{await pool.ready();for(let i=0;i<2;i++){x.step();await pool.step();await pool.syncAll();assert.equal(await benchmarkDigest(captureBenchmarkState(y)),await benchmarkDigest(captureBenchmarkState(x)));}}finally{await pool.close();}}
});

test('анализ, план и схема показывают скрытые нейроны дополнительных блоков',()=>{
 const w=new Evolution(options()),a=w.agents[0],report=analyzeGenome(w.genomeFile(a));assert.equal(report.genomeVersion,20);const plan=validatePlan({worlds:1,steps:1,factors:[],common:{brainModules:extras()}});assert.equal(plan.common.genomeVersion,20);
 for(const key of ['cells','target','operation','direct']){const model=brainDiagramModel(a,key);assert.equal(model.nodes.filter(n=>n.layer===1).length,2);assert.ok(model.edges.length>0);}
});

test('стоимость учитывает дополнительные действующие нейроны и связи',()=>{
 const simple=new Evolution({population:1,physiology:{},genomeVersion:20}),complexOptions=options();for(const spec of MODULAR_GRAPH_SPECS){const percent=dagConnectionBudget(spec.inputs,spec.outputs,[2]).maxPercent;if(spec.key==='context')complexOptions.initialConnections=percent;else if(spec.key==='attention')complexOptions.attentionInitialConnections=percent;else complexOptions.brainModules[spec.key].initialConnections=percent;}const complex=new Evolution(complexOptions);const x=operationCounts(simple.agents[0].brain.costProfile,7,11,6),y=operationCounts(complex.agents[0].brain.costProfile,7,11,6);assert.ok(y.forward>x.forward);assert.ok(y.learning>x.learning);
});

test('каждый физический параметр доступен в единственной группе и объясняет оба направления',()=>{
 const keys=PHYSIOLOGY_FIELD_GROUPS.flatMap(g=>g.keys);assert.equal(new Set(keys).size,keys.length);assert.deepEqual(keys.slice().sort(),Object.keys(PHYSIOLOGY_FIELDS).sort());
 for(const [prefix,fields]of [['physiology',PHYSIOLOGY_FIELDS],['bodyGenes',CARE_GENE_FIELDS]])for(const key of Object.keys(fields)){const text=PHYSIOLOGY_HELP[prefix+'.'+key]?.[1];assert.match(text,/Если увеличить:/);assert.match(text,/Если уменьшить:/);}
});

test('длительность и двигательная цена зачатия регулируются независимо от беременности',()=>{
 const w=new Evolution({population:1,physiology:{conceiveSteps:4,conceiveRate:2},genomeVersion:20}),a=w.agents[0],timing=processTiming(a,{action:9},w.physiology);assert.equal(timing.steps,4);assert.ok(timing.total>0);assert.equal(a.bodyPlan.tPreg,50);a.born=-200;a.bornSubtick=-2000;a.age=200;a.ageSteps=2000;a.process=startProcess(a,{id:'conceive',action:9,destination:{x:a.x,y:a.y},localDestination:{...a.brain.position}},0,w.physiology);for(let j=0;j<3;j++){advancePhysiologyBodies(w);assert.equal(a.pregnancy,null);}advancePhysiologyBodies(w);assert.ok(a.pregnancy);assert.ok(a.life.physiology.motor>0);
});
