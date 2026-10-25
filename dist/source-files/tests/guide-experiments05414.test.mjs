import test from 'node:test';
import assert from 'node:assert/strict';
import {guidePlanExample,guideOutcomesExample,GUIDE_METRIC_MEANINGS} from '../dist/guide-experiments-text.js';
import {LIFE_METRICS,aggregateLifeCohorts} from '../dist/life-cohorts.js';
import {survivalCurve,survivalAtAge} from '../dist/survival-curve.js';
import {populationCohorts} from '../dist/population-statistics.js';
test('factor example forms six variants while outcomes distinguish attempts from selected worlds',()=>{
 const p=guidePlanExample();assert.equal(p.variants.length,6);assert.equal(p.seedMatrix[0].length,3);
 const o=guideOutcomesExample();assert.equal(o.attempts,2);assert.equal(o.extinctAttempts,1);assert.equal(o.worlds,1);assert.equal(o.extinctWorlds,0);
});
test('young living members remain unknown instead of dying at the end of observation',()=>{
 const report={tick:100,dead:[{id:1,born:0,age:80,endTick:80,status:'dead',parentId:null}],living:[{id:2,born:70,age:30,endTick:100,status:'alive',parentId:null}]};
 const curve=survivalCurve(report,{start:0,width:100}),point=survivalAtAge(curve,50);
 assert.equal(point.lower,50);assert.equal(point.upper,100);assert.equal(point.unknown,1);
 const cohort=aggregateLifeCohorts(report,{width:100,survivalAge:50}).cohorts[0];assert.equal(cohort.survival.sufficient,false);assert.equal(cohort.survival.percent,null);
});
test('population continues with zero only for a confirmed extinction and planned end',()=>{
 const report={tick:4,dead:[{born:0,endTick:4,status:'dead'}],living:[]};
 const dead=populationCohorts({report,extinct:true,targetTick:10},{width:5,start:0,end:10});
 assert.equal(dead.points.length,2);assert.equal(dead.points[1].mean,0);assert.equal(dead.points[0].mean,.8);
 const stopped=populationCohorts({report,extinct:false,targetTick:10},{width:5,start:0,end:10});assert.equal(stopped.points.length,1);
});
test('every current non-heritable metric has a documented denominator and meaning',()=>{
 for(const m of LIFE_METRICS)assert.ok(m.inherited||GUIDE_METRIC_MEANINGS[m.id],m.id);
});
