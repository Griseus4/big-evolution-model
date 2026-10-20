import test from 'node:test';
import assert from 'node:assert/strict';
import {weightedSummary,worldWeights} from '../dist/weighted-statistics.js';
import {mergeLifeReports} from '../dist/experiment-statistics.js';
import {aggregateLifeCohorts} from '../dist/life-cohorts.js';
import {windowLifeCohorts} from '../dist/history-window.js';
import {survivalCurve,survivalAtAge} from '../dist/survival-curve.js';
import {foodCohorts} from '../dist/food-exposure.js';
import {sensitivityDistributions,HERITABLE_SCHEMA} from '../dist/heritable-statistics.js';
import {createComparisonCharts} from '../dist/comparison-charts.js';
const row=(age,i=0)=>({id:i+1,parentId:null,born:0,age,status:'dead',observedSteps:age,moved:age/10,eaten:age/20,meanEnergy:age,children:0,cause:'age',heritable:{schema:HERITABLE_SCHEMA,senseEnergy:age===20?-40:40,senseHealth:0,senseStomach:0}});
const report=(rows,food)=>({tick:200,dead:rows,living:[],omittedDetails:0,foodAvailability:{schema:'ground-food-exposure-v1',prefix:Float64Array.from({length:201},(_,i)=>i*food*10),substeps:0,partialSum:0},foodProductionHistory:[{tick:0,value:food/10}]});
const sources=[{id:'small',report:report([row(20)],10)},{id:'large',report:report(Array.from({length:10},(_,i)=>row(100,i)),30)}];
test('raw weighted samples give equal world means and a median, not an average of medians',()=>{
 const rows=[{worldId:'a',value:0},{worldId:'a',value:100},{worldId:'b',value:50},{worldId:'b',value:60},{worldId:'b',value:70}];
 const s=weightedSummary(rows.map(r=>r.value),worldWeights(rows));assert.ok(Math.abs(s.mean-55)<1e-10);assert.equal(s.median,60);
 for(const values of [[1],[1,2],[1,2,3],[1,2,3,4]]){const a=weightedSummary(values),b=weightedSummary(values,values.map(()=>.1));assert.ok(Math.abs(a.mean-b.mean)<1e-10);for(const key of ['min','max','median','count'])assert.equal(a[key],b[key]);}
});
test('world and individual modes differ appropriately; IDs stay unique and food is averaged per world',()=>{
 const worlds=mergeLifeReports(sources,'worlds'),individuals=mergeLifeReports(sources,'individuals');assert.equal(new Set(worlds.dead.map(r=>r.id)).size,11);
 const a=aggregateLifeCohorts(worlds).cohorts[0],b=aggregateLifeCohorts(individuals).cohorts[0];assert.ok(Math.abs(a.metrics.lifetime.mean-60)<1e-10);assert.ok(Math.abs(b.metrics.lifetime.mean-1020/11)<1e-10);assert.equal(a.metrics.lifetime.min,b.metrics.lifetime.min);assert.equal(a.metrics.lifetime.max,b.metrics.lifetime.max);
 assert.equal(foodCohorts(worlds.foodAvailability,200,100)[0].mean,20);assert.equal(worlds.foodProductionHistory[0].value,2);
});
test('weighted survival and distributions preserve censoring instead of inventing deaths',()=>{
 const r=mergeLifeReports(sources,'worlds'),curve=survivalCurve(r);assert.ok(Math.abs(survivalAtAge(curve,50).lower-50)<1e-10);
 const d=sensitivityDistributions(r.dead,{start:0,end:100,weightMode:'worlds'})[0];assert.ok(Math.abs(d.points.filter(p=>p.x<0).reduce((n,p)=>n+p.mean,0)-50)<1e-10);
 r.living=[{...r.dead[0],id:'alive',status:'alive',age:10}];const q=survivalAtAge(survivalCurve(r),50);assert.ok(q.upper>q.lower);assert.equal(q.unknown,1);
});
test('missing reports and observations remain missing, and incomplete histories disable survival',()=>{
 assert.equal(mergeLifeReports([]),null);const r=mergeLifeReports([{id:'x',report:{tick:100,dead:[row(20)],living:[],omittedDetails:2}}]);assert.equal(r.foodAvailability,null);assert.equal(survivalAtAge(survivalCurve(r),10),null);assert.equal(aggregateLifeCohorts(r).cohorts[0].survival.percent,null);
});
test('shared comparison cards draw finite variant lines, distributions and censoring bounds',()=>{
 const labels=[],colors=new Set(),context={setTransform(){},clearRect(){},beginPath(){},moveTo(...v){assert.ok(v.every(Number.isFinite));},lineTo(...v){assert.ok(v.every(Number.isFinite));},stroke(){colors.add(this.strokeStyle);},fill(){},fillRect(...v){assert.ok(v.every(Number.isFinite));},setLineDash(){},fillText(value){labels.push(value);}};
 const canvas=()=>({getContext:()=>context,getBoundingClientRect:()=>({width:600})});
 const cards=['lifetime','food','production','survival'].map(id=>({m:{id},canvas:canvas(),card:{hidden:false},note:{}})),histograms=['senseEnergy','senseHealth','senseStomach'].map(id=>({m:{id},canvas:canvas(),card:{hidden:false},note:{}}));
 const variants=sources.map((s,i)=>({id:'v'+i,name:s.id,color:i?'#ff0000':'#00ff00',report:mergeLifeReports([s])}));
 assert.equal(createComparisonCharts()({sources:variants,options:{width:100,survivalAge:100,origin:'all',mode:'dead',interruptionKind:'all'},start:0,end:200,statistic:'mean',chartCards:cards,histogramCards:histograms,curveCanvas:canvas(),curveMaximum:120,curveStart:0,curveVisible:true}),true);
 assert.ok(colors.has('#ff0000'));assert.ok(colors.has('#00ff00'));assert.ok(labels.includes('Время мира, Т'));assert.ok(cards.every(c=>c.note.textContent.includes('small')));
});
