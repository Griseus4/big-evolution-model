import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {translateFoodGroup} from '../dist/food-island-evolution.js';
import {worldAxial,worldOffset} from '../dist/navigation.js';
import {Random} from '../dist/simulation.js';
import {advanceEnvironment} from '../dist/automatic-environment.js';
import {foodProduction} from '../dist/environment-settings.js';
import {aggregateLifeCohorts,lifeMetric} from '../dist/life-cohorts.js';
import {captureHeritable,sensitivityDistributions,HERITABLE_SCHEMA} from '../dist/heritable-statistics.js';
import {analyzeGenome} from '../dist/genome-analysis.js';
import {productionCohorts,foodProductionHistory} from '../dist/food-production-history.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`),key=p=>`${p.x},${p.y}`;

test('whole-group translation preserves axial shape across odd rows and never overlaps another source',()=>{
 const world={tile:(x,y)=>x>=0&&x<20&&y>=0&&y<20?{x,y,terrain:'land'}:null};
 for(const y of [8,9]){
  const centre={x:8,y},a=worldAxial(centre),sources=[a,{q:a.q+1,r:a.r},{q:a.q,r:a.r+1}].map(worldOffset),g={id:3,kind:'island',centre,sources},blocked={x:15,y:15};
  const before=sources.map(worldAxial),used=new Set([...sources.map(key),key(blocked)]),m=translateFoodGroup(world,g,used,new Random(42));assert.ok(m);
  const after=g.sources.map(worldAxial),dq=after[0].q-before[0].q,dr=after[0].r-before[0].r;
  const distance=Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));assert.ok(distance>=5&&distance<=20);
  for(let i=0;i<before.length;i++)assert.deepEqual(after[i],{q:before[i].q+dq,r:before[i].r+dr});assert.equal(used.size,4);assert.ok(used.has(key(blocked)));
 }
 const g={id:1,kind:'island',centre:{x:0,y:0},sources:[{x:0,y:0}]},before=structuredClone(g),used=new Set(['0,0']);
 assert.equal(translateFoodGroup({tile:(x,y)=>x===0&&y===0?{x,y,terrain:'land'}:null},g,used,new Random(1)),null);assert.deepEqual(g,before);assert.deepEqual([...used],['0,0']);
});

test('island events preserve food and life RNG, change group counts and keep valid unique schedules',()=>{
 const w=new Evolution({seed:42,population:2,automaticEnvironment:{preparationInterval:1,randomInterval:1}}),food=w.tiles.map(c=>c.food),rng=[w.random,w.cognitiveRandom,w.neuralRandom,w.mutationRandom,w.bodyRandom].map(r=>r.state),counts=new Set();
 for(let tick=1;tick<=40;tick++){
  w.tick=tick;w.subtick=tick*10;assert.ok(advanceEnvironment(w));counts.add(w.foodSettings.islandCount);assert.ok(foodProduction(w)>=2-1e-8);
  const points=w.foodIslands.flatMap(g=>g.sources);assert.equal(new Set(points.map(key)).size,points.length);assert.equal(points.length,w.foodSettings.sourceCount);assert.ok(points.length<=384);
  for(const g of w.foodIslands){assert.ok(g.sources.length);if(g.kind==='bush')assert.equal(g.sources.length,1);assert.ok(g.nextTick>w.tick);near(g.period*10,Math.round(g.period*10));for(const p of g.sources)assert.equal(w.tile(p.x,p.y).terrain,'land');}
  assert.deepEqual(w.tiles.map(c=>c.food),food);
 }
 assert.ok(counts.size>1);assert.deepEqual([w.random,w.cognitiveRandom,w.neuralRandom,w.mutationRandom,w.bodyRandom].map(r=>r.state),rng);
 const live=new Evolution({population:2,automaticEnvironment:{preparationInterval:1,randomInterval:1}});for(let i=0;i<6;i++)live.step();
 const restored=loadWorld(JSON.parse(JSON.stringify(saveWorld(live))));assert.deepEqual(restored.snapshot(),live.snapshot());
 for(let i=0;i<4;i++){live.step();restored.step();assert.deepEqual(restored.snapshot(),live.snapshot());}
});

test('birth properties match the genome analyzer, do not change over life, and missing values stay unknown',()=>{
 const w=new Evolution({population:1}),a=w.agents[0],h=captureHeritable(a),analysis=analyzeGenome(w.genomeFile(a));
 for(const [id,key]of [['senseEnergy','energy'],['senseHealth','health'],['senseStomach','stomach']])near(h[id],analysis.properties.find(p=>p.key===key).share*100);
 near(Math.abs(h.senseEnergy)+Math.abs(h.senseHealth)+Math.abs(h.senseStomach),100);const before=structuredClone(a.life.heritable);w.step();assert.deepEqual(a.life.heritable,before);
 const r={status:'alive',parentId:null,born:0,age:10,children:1,observedSteps:10,emptyEnergySteps:3,hungerSteps:9,firstBirthAge:5,heritable:h,observations:{schema:'life-observer-v1',brainCalls:7}},report={tick:200,dead:[],living:[r],omittedDetails:0};
 const g=aggregateLifeCohorts(report).cohorts[0];assert.equal(g.metrics.senseEnergy.count,1);assert.equal(g.metrics.children.count,0);assert.equal(g.metrics.lifetime.count,0);
 near(lifeMetric(r,'hunger'),30);near(lifeMetric(r,'brainCalls'),70);assert.equal(lifeMetric(r,'firstBirth'),5);assert.equal(lifeMetric({},'senseEnergy'),null);
});

test('sensitivity histogram has fixed bins, retains both signs and includes the +100 endpoint',()=>{
 const rows=[-100,-40,0,40,100].map((v,id)=>({id,born:10,parentId:null,status:'alive',heritable:{schema:HERITABLE_SCHEMA,senseEnergy:v,senseHealth:0,senseStomach:0}}));
 const d=sensitivityDistributions([...rows,{born:10,parentId:null}],{start:0,end:100})[0];assert.equal(d.count,5);assert.equal(d.positive,2);assert.equal(d.negative,2);assert.equal(d.zero,1);assert.equal(d.bins[0],1);assert.equal(d.bins[39],1);near(d.points.reduce((n,p)=>n+p.mean,0),100);
 assert.equal(sensitivityDistributions(rows,{start:100,end:200})[0].count,0);
});

test('potential production integrates events and selected edges by time, including repeated event timestamps',()=>{
 const history=[{tick:0,value:2},{tick:5,value:4},{tick:5,value:6},{tick:12,value:1}],rows=productionCohorts(history,15,10);near(rows[0].mean,4);near(rows[1].mean,3);assert.equal(rows[1].complete,false);
 const clipped=productionCohorts(history,15,10,3,13);near(clipped[0].mean,34/7);near(clipped[1].mean,13/3);
 assert.deepEqual(productionCohorts(null,20,10),[]);const w=new Evolution({population:1});const timeline=foodProductionHistory(w);near(timeline[0].value,foodProduction(w));
 w.changeFoodEnvironment({foodSources:40,foodRegrowInterval:20,foodIslandCount:1,foodSizeSpread:0,foodPeriodSpread:0});near(foodProductionHistory(w).at(-1).value,2);
});

test('first birth age is recorded on completion and four substeps per second preserves physical timing',async()=>{
 const w=new Evolution({population:1}),a=w.agents[0];w._primed=true;a.born=-100;a.bornSubtick=-1000;a.age=100;a.energy=80;a.process={action:9,elapsed:19,duration:20,destination:{x:a.x,y:a.y},localDestination:{...a.brain.position},direction:null};w.substep();assert.equal(a.children,1);assert.ok(a.life.firstBirthAge>=100);assert.equal(w.lifeReport().living.find(r=>r.id===a.id).firstBirthAge,a.life.firstBirthAge);assert.equal(w.agents[1].life.heritable.schema,HERITABLE_SCHEMA);
 let now=0,id=0;const runtime=new WorldRuntime({clock:()=>now,send(message){if(message.type==='state')void command('ack',{sequence:message.sequence});}}),command=(type,payload={})=>runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});
 await command('init',{settings:{population:1}});await command('speed',{value:.4,substeps:true});await command('running',{value:true});
 for(const t of [249,250,500,750,1000]){now=t;await runtime.pulse();}near(runtime.world.tick,.4);assert.equal(runtime.running,true);
});

test('a subsequent birth in an old life with unknown first birth never invents its first age',()=>{
 const w=new Evolution({population:1}),a=w.agents[0];w._primed=true;a.born=-100;a.age=100;a.energy=80;a.children=1;delete a.life.firstBirthAge;a.process={action:9,elapsed:19,duration:20,destination:{x:a.x,y:a.y},localDestination:{...a.brain.position},direction:null};w.substep();assert.equal(a.children,2);assert.equal(w.lifeReport().living.find(r=>r.id===a.id).firstBirthAge,null);
});
