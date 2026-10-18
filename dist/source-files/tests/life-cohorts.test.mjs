import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateLifeCohorts,lifeMetric} from '../dist/life-cohorts.js';
import {createLifeObservations,describeLifeObservations,LIFE_OBSERVATION_SCHEMA} from '../dist/life-observations.js';
import {Evolution} from '../dist/evolution.js';
import {Evolution as PreviousEvolution} from '../dist/benchmark-snapshots/0.34.0/evolution.js';
import {foodCohorts,foodExposureReport,createFoodExposure,sampleFoodExposure} from '../dist/food-exposure.js';
import {GATE_OUTPUT_BIAS} from '../dist/temporal-layout.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const row=(id,born,age,extra={})=>({id,born,age,status:'dead',parentId:null,founderId:id,generation:0,observedSteps:age,moved:0,eaten:0,meanEnergy:50,hungerSteps:0,...extra});
const report=(rows,tick=1000,extra={})=>({tick,dead:rows.filter(r=>r.status==='dead'),living:rows.filter(r=>r.status==='alive'),omittedDetails:0,...extra});

test('half-open birth intervals, exact four statistics and equal weight of individual rates',()=>{
 const input=report([row(1,0,10,{moved:1}),row(2,99.9,100,{moved:30}),row(3,100,10,{moved:0})]);
 const before=structuredClone(input),r=aggregateLifeCohorts(input),g=r.cohorts[0];
 assert.deepEqual(g.metrics.movement,{count:2,min:10,median:20,mean:20,max:30});assert.equal(r.cohorts[1].born,1);assert.deepEqual(input,before);
 assert.notEqual(g.metrics.movement.mean,31/110*100);assert.equal(lifeMetric(row(4,0,0),'movement'),null);
});
test('unknown fields do not become zero, living age never becomes lifetime, origins are separate',()=>{
 const input=report([row(1,0,15),row(2,0,100,{status:'alive',parentId:1})]);
 let r=aggregateLifeCohorts(input);assert.equal(r.cohorts[0].metrics.lifetime.count,1);assert.equal(r.cohorts[0].metrics.inventory.count,0);assert.equal(r.cohorts[0].complete,false);
 r=aggregateLifeCohorts(input,{mode:'observed'});assert.equal(r.cohorts[0].metrics.energy.count,2);assert.equal(r.cohorts[0].metrics.lifetime.count,1);
 assert.equal(aggregateLifeCohorts(input,{origin:'descendants'}).cohorts[0].born,1);assert.equal(aggregateLifeCohorts(input,{origin:'founders'}).cohorts[0].dead,1);
 assert.throws(()=>aggregateLifeCohorts(input,{width:0}));assert.throws(()=>aggregateLifeCohorts(input,{survivalAge:NaN}));
});
test('survival includes later deaths, requires all outcomes and closed births, and respects missing histories',()=>{
 const rows=[row(1,0,150),row(2,20,50),row(3,30,120,{status:'alive'})];
 let r=aggregateLifeCohorts(report(rows,150),{survivalAge:100});near(r.cohorts[0].survival.percent,200/3);
 rows[2].age=90;r=aggregateLifeCohorts(report(rows,150),{survivalAge:100});assert.equal(r.cohorts[0].survival.percent,null);
 rows[2].status='dead';r=aggregateLifeCohorts(report(rows,150),{survivalAge:100});near(r.cohorts[0].survival.percent,100/3);
 assert.equal(aggregateLifeCohorts(report(rows,99),{survivalAge:100}).cohorts[0].survival.percent,null);
 assert.equal(aggregateLifeCohorts(report(rows,1000,{omittedDetails:1})).cohorts[0].survival.percent,null);
});
test('inventory histogram supplies exact time mean and median; terminal events are not failed attempts',()=>{
 const o=createLifeObservations(3);o.inventorySubsteps.set([2,0,0,2]);o.reviews=3;o.interruptions={voluntary:2,physical:1,death:1};const summary=describeLifeObservations(o);
 assert.equal(summary.meanInventory,1.5);assert.equal(summary.medianInventory,1.5);assert.equal(summary.inventoryObservedSteps,.4);
 const r=row(1,0,2,{observations:summary});assert.equal(lifeMetric(r,'inventory'),1.5);assert.equal(lifeMetric(r,'reviews'),150);assert.equal(lifeMetric(r,'interruptions'),150);assert.equal(lifeMetric(r,'interruptions','physical'),50);
 summary.inventorySubsteps[0]=99;assert.equal(o.inventorySubsteps[0],2);
});
function controlled(){
 const w=new Evolution({population:1,foodSources:0,learning:false,memory:false}),a=w.agents[0];for(const c of w.tiles)c.terrain='land';
 a.brain.gateBase.fill(0);a.brain.gateBase[GATE_OUTPUT_BIAS]=-1;a.wanted=8;
 w.choose=function(a,prepared){const {frame,options}=this.evaluateFrame(a,prepared),choice=options.find(c=>c.action===a.wanted)??options.find(c=>c.action===8);return this.executableDecision(frame,choice);};return {w,a};
}
test('counters sample inventory before completion and distinguish reviews, voluntary, physical and terminal interruption',()=>{
 const {w,a}=controlled();a.inventory=1;a.wanted=7;w.substep();w.substep();assert.equal(a.inventory,0);assert.equal(a.life.observer.inventorySubsteps[1],2);w.substep();assert.equal(a.life.observer.inventorySubsteps[0],1);
 a.brain.gateBase[GATE_OUTPUT_BIAS]=1;a.wanted=8;w.substep();let o=a.life.observer;assert.equal(o.reviews,1);const cancelled=o.interruptions.voluntary;
 w.substep();assert.equal(o.reviews,2);assert.equal(o.interruptions.voluntary,cancelled);
 a.wanted=0;w.substep();assert.equal(o.interruptions.voluntary,cancelled+1);
 const target=a.process.destination;w.tile(target.x,target.y).terrain='water';w.substep();assert.equal(o.interruptions.physical,1);
 a.energy=0;a.stomach=0;a.health=.01;w.substep();assert.equal(o.interruptions.death,1);
 const dead=w.lifeReport().dead[0];assert.equal(dead.observations.schema,LIFE_OBSERVATION_SCHEMA);assert.equal(dead.observations.interruptions.death,1);
});
test('food integral equals direct map totals without inspecting inventory or stomach, including edits',()=>{
 const w=new Evolution({population:8,seed:42});let sum=0;
 for(let i=0;i<100;i++){sum+=w.tiles.reduce((n,c)=>n+c.food,0);w.substep();near(w.initialFood+w.stats.regrown-w.stats.gathered+w.stats.deposited,w.tiles.reduce((n,c)=>n+c.food,0));}
 const total=w.tiles.reduce((n,c)=>n+c.food,0);w.changeFoodEnvironment({foodSources:10,foodRegrowInterval:10,foodIslandCount:2,foodPeriodSpread:0,foodSizeSpread:0});assert.equal(w.tiles.reduce((n,c)=>n+c.food,0),total);
 const e=foodExposureReport(w.foodExposure),f=foodCohorts(e,w.tick,10);near(f[0].mean,sum/100);
 sum+=total;w.substep();const next=foodCohorts(foodExposureReport(w.foodExposure),w.tick,10);near(next[1].mean,total);assert.equal(next[1].complete,false);
 assert.deepEqual(foodCohorts(null,10,10),[]);
});
test('observer counters preserve complete frozen physical/cognitive trajectories and every RNG',()=>{
 for(const seed of [42,77]){const settings={seed,population:8,limit:16},a=new Evolution(settings),b=new PreviousEvolution(settings);
  for(let i=0;i<12;i++){a.step();b.step();const current=structuredClone(a.snapshot());for(const resident of current.agents){delete resident.life.observer;delete resident.life.heritable;delete resident.life.firstBirthAge;}assert.deepEqual(current,b.snapshot());}
 }
});

test('food prefix crosses allocation boundaries and keeps complete history for a new grouping width',()=>{
 const w={foodExposure:createFoodExposure(),initialFood:12,stats:{regrown:0,gathered:0,deposited:0}};
 for(let i=0;i<20500;i++)sampleFoodExposure(w);
 const e=foodExposureReport(w.foodExposure);assert.equal(e.prefix.length,2051);near(foodCohorts(e,2050,100)[20].mean,12);
 assert.throws(()=>foodCohorts(e,2050,0));assert.throws(()=>foodCohorts(e,5001,1));
});
