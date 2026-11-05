import test from 'node:test';import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {attachChild,carriedChild} from '../dist/child-care.js';
import {physiologyFrame,preparePhysiologyBoundary,advancePhysiologyBodies,physiologyDecisions,syncBody} from '../dist/physiology-world.js';
import {startProcess,canConceive} from '../dist/physiology-actions.js';
import {ingestFood} from '../dist/digestion.js';import {createMeat,meatAmount} from '../dist/food-resources.js';
import {dualBrainLayout,unpackDualBrain} from '../dist/dual-brain-layout.js';import {compileDualState} from '../dist/dual-brain-state.js';
import {checkPhysiologyInvariants} from '../dist/physiology-invariants.js';
import {conceive} from '../dist/pregnancy.js';
const near=(x,y)=>assert(Math.abs(x-y)<1e-9,`${x} != ${y}`);
function family(options={}){const w=new Evolution({population:2,seed:42,physiology:{meatHalfLife:Number.MAX_VALUE},genomeVersion:19,mutations:false,...options}),[parent,child]=w.agents;w.moveAgent(child,parent);attachChild(w,parent,child);return {w,parent,child};}
function begin(w,a,action,type){preparePhysiologyBoundary(w);const f=physiologyFrame(w,a),c=f.request.candidates.find(c=>c.action===action&&(type===undefined||c.foodType===type));assert(c);a.process=startProcess(a,w.executableDecision(f,c),w.subtick,w.physiology);return a.process;}
function quiet(a){const l=dualBrainLayout(a.genome);for(let j=l.gateOffset;j<l.regulatorOffset;j++)a.genome[j]=0;a.genome[l.gateOffset]=-1;Object.assign(a.brain,compileDualState(a.genome));a.resting=true;}
test('геном v19: отдельный срок ношения, исходная половина окна развития',()=>{const {parent}=family({bodyGenes:{tAdult:300}});assert.equal(parent.bodyPlan.tCarry,150);assert.equal(unpackDualBrain(parent.genome).layout.version,19);assert.equal(parent.brain.care,true);});
test('совместный шаг учитывает массу ребёнка, пассивный ребёнок не выполняет действия',()=>{const {w,parent,child}=family(),p=begin(w,parent,0),price=w.physiology.moveRate*(parent.L+child.L)/w.physiology.referenceMass*.1;p.elapsed=p.duration-1;advancePhysiologyBodies(w);assert.deepEqual([child.x,child.y],[parent.x,parent.y]);near(parent.life.physiology.motor,price);assert.equal(child.process,null);near(child.life.care.carriedTime,.1);checkPhysiologyInvariants(w);});
test('кормление трёх видов: подшаг, дробный остаток, пищевой и энергетический балансы',()=>{for(let type=0;type<3;type++){const {w,parent,child}=family();parent.foodInventory[type]=3;if(type===2)parent.carriedMeat=createMeat(3,0);ingestFood(child.digestion,type,2.3,3,w.foodEnergies);w.stats.physiology.initialFoodEnergy+=5.3*w.foodEnergies[type];syncBody(w,parent);syncBody(w,child);const p=begin(w,parent,12,type);assert.equal(p.duration,1);advancePhysiologyBodies(w);near(parent.foodInventory[type],2.3);near(child.stomach,3);near(child.life.care.received[type],.7);if(type===2)near(meatAmount(parent.carriedMeat),2.3);checkPhysiologyInvariants(w);}});
test('полный желудок не раскрывается доступностью варианта и не списывает пищу',()=>{const {w,parent,child}=family();parent.foodInventory[0]=1;ingestFood(child.digestion,0,3,3,w.foodEnergies);w.stats.physiology.initialFoodEnergy+=4*w.foodEnergies[0];syncBody(w,parent);syncBody(w,child);begin(w,parent,12,0);advancePhysiologyBodies(w);assert.equal(parent.foodInventory[0],1);assert.equal(parent.life.care.feedAttempts,1);assert.equal(parent.life.observer.interruptions.physical,1);checkPhysiologyInvariants(w);});
test('срок освобождения и смерти разрывают связь; зачатие заблокировано только во время ношения',()=>{const {w,parent,child}=family({bodyGenes:{tCarry:.2}});parent.ageSteps=parent.bodyPlan.conceptionSteps;assert.equal(canConceive(parent,2,100),false);parent.ageSteps=0;advancePhysiologyBodies(w);assert.equal(child.carrierId,parent.id);advancePhysiologyBodies(w);assert.equal(child.carrierId,null);assert.equal(parent.carryingChildId,null);const f=family();f.w.die(f.parent,'attack');assert.equal(f.child.alive,true);assert.equal(f.child.carrierId,null);assert.equal(f.child.life.care.releasedByDeath,1);const g=family();g.w.die(g.child,'attack');assert.equal(carriedChild(g.w,g.parent),null);});
test('память пассивного ребёнка обновляется без выбора, диспетчера и обучения весов',()=>{const {w,parent,child}=family();quiet(parent);const delta=child.brain.networkDelta.slice();physiologyDecisions(w);assert(child.brain.memory.size>0);assert.equal(child.life.observer.brainCalls,0);assert.equal(child.life.observer.attentionCalls,0);assert.equal(child.brain.updates,0);assert.deepEqual(child.brain.networkDelta,delta);assert.equal(child.brain.pending,null);});
test('после настоящих родов ребёнок прикрепляется с зафиксированным сроком',()=>{const w=new Evolution({population:1,seed:42,physiology:{},genomeVersion:19,bodyGenes:{tPreg:.1,tCarry:.2},mutations:false}),a=w.agents[0];a.pregnancy=conceive(a.genome,a.bodyGenes,a.bodyPlan,0,w.physiology);for(let i=0;i<21;i++)advancePhysiologyBodies(w);assert.equal(w.stats.births,1);const c=w.agents.find(c=>c.id!==a.id);assert.equal(c.carrierId,a.id);assert.equal(c.carryDue-c.carryStarted,2);checkPhysiologyInvariants(w);});

import {saveWorld,loadWorld} from '../dist/world-save.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {captureBenchmarkState,benchmarkDigest} from '../dist/benchmark-state.js';
import {mutateDualGenome,dualMutationProfiles} from '../dist/dual-brain-genome.js';
import {genomeMetadata,validateGenomeFile} from '../dist/genome.js';
import {Random} from '../dist/simulation.js';
test('v6: точное продолжение кормления, освобождения и памяти; повреждение связей отклоняется',()=>{
 const {w,parent,child}=family({bodyGenes:{tCarry:.2}});quiet(parent);const file=saveWorld(w);assert.equal(file.version,6);const copy=loadWorld(structuredClone(file));
 for(let i=0;i<4;i++){w.substep();copy.substep();assert.deepEqual(saveWorld(copy),saveWorld(w));}
 const malformed=loadWorld(file);malformed.agents[1].carrierId=999;assert.throws(()=>loadWorld(saveWorld(malformed)),/связь/);
});
test('ген и входы v19 экспортируются и мутируют; старые профили не меняют смысл',()=>{
 const {parent}=family();const data={format:'big-evolution-genome',...genomeMetadata(parent.genome),genes:parent.genome};assert.deepEqual(validateGenomeFile(data),parent.genome);
 const next=mutateDualGenome(parent.genome,new Random(123));assert.notEqual(unpackDualBrain(next).body.tCarry,parent.bodyGenes.tCarry);assert.equal(dualMutationProfiles(next).behavior.schema,undefined);
});
test('локальный расчёт и 1/4 владельца совпадают с ношением и пассивной памятью',async()=>{
 for(const workers of [1,4]){const x=family({bodyGenes:{tCarry:2}}),y=family({bodyGenes:{tCarry:2}});quiet(x.parent);quiet(y.parent);const a=begin(x.w,x.parent,0),b=begin(y.w,y.parent,0);a.elapsed=a.duration-1;b.elapsed=b.duration-1;
 const pool=new ParallelWorld(y.w,{workers,createWorker:createCognitionWorker});try{await pool.ready();for(let i=0;i<3;i++){x.w.step();await pool.step();await pool.syncAll();assert.equal(await benchmarkDigest(captureBenchmarkState(y.w)),await benchmarkDigest(captureBenchmarkState(x.w)));}}finally{await pool.close();}}
});

import {validatePlan,EXPERIMENT_PLAN_VERSION} from '../dist/experiment-plan.js';
import {analyzeGenome} from '../dist/genome-analysis.js';
import {physiologyMetric} from '../dist/physiology-metrics.js';
test('план v5, анализ v19 и показатели ухода сохраняют смысл и старые пропуски',()=>{
 const p=validatePlan({worlds:1,steps:1,factors:[{key:'bodyGenes.tCarry',values:[50,100]}]});assert.equal(EXPERIMENT_PLAN_VERSION,6);assert.equal(p.variants[0].settings.genomeVersion,20);assert.deepEqual(validatePlan(structuredClone(p),{historical:true}),p);
 const {w,parent,child}=family();const report=analyzeGenome(w.genomeFile(parent));assert.equal(report.genomeVersion,19);assert.equal(report.actions.length,13);assert(report.properties.some(p=>p.key==='body-tCarry'));
 advancePhysiologyBodies(w);const row={physiology:child.life.physiology,care:child.life.care};assert.equal(physiologyMetric(row,'carriedTime'),100);assert.equal(physiologyMetric({physiology:child.life.physiology},'carriedTime'),null);
});

import {prepareSetDecisionInput} from '../dist/care-inputs.js';
test('входы ухода не содержат энергию/желудок ребёнка или числовую личность цели',()=>{
 const {w,parent,child}=family();parent.foodInventory[0]=1;syncBody(w,parent);preparePhysiologyBoundary(w);const request=physiologyFrame(w,parent).request;
 assert.deepEqual(Object.keys(request.observation.body.child).sort(),['health','remaining','size']);const copy=structuredClone(request);for(const c of copy.candidates){c.id='opaque-'+c.id;if(c.targetHandle!==null)c.targetHandle+=1000;}
 const a=prepareSetDecisionInput(parent.brain,request),b=prepareSetDecisionInput(parent.brain,copy);assert.deepEqual(a.prepared,b.prepared);assert.deepEqual(a.rows,b.rows);
});
