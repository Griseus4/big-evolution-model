import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateLifeCohorts} from '../dist/life-cohorts.js';
import {historyDomainEnd,windowLifeCohorts,windowFoodCohorts} from '../dist/history-window.js';
import {survivalCurve,survivalAtAge} from '../dist/survival-curve.js';
import {historyChartMaximum,chartCohortAt,drawHistoryChart} from '../dist/history-charts.js';
import {foodCohorts,FOOD_EXPOSURE_SCHEMA} from '../dist/food-exposure.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const row=(id,born,age,status='dead')=>({id,parentId:null,born,age,status,observedSteps:age,moved:id,meanEnergy:50});
test('window recomputes exact edge cohorts, keeps full-life rates and reuses interior groups',()=>{
 const rows=[row(1,0,20),row(2,50,100),row(3,99,10),row(4,100,30),row(5,120,40),row(6,200,20)],report={tick:400,dead:rows,living:[],omittedDetails:0};
 const base=aggregateLifeCohorts(report),members=new Map();for(const r of rows){const id=Math.floor(r.born/100);if(!members.has(id))members.set(id,[]);members.get(id).push(r);}
 const before=structuredClone(report),window=windowLifeCohorts(base,members,400,50,120);
 assert.deepEqual(window.cohorts.map(g=>[g.start,g.end,g.born]),[[50,100,2],[100,120,1]]);
 near(window.cohorts[0].metrics.movement.mean,(2+30)/2);assert.equal(window.cohorts[0].survival.percent,50);
 assert.equal(windowLifeCohorts(base,members,400,0,200).cohorts[0],base.cohorts[0]);
 assert.deepEqual(report,before);assert.throws(()=>windowLifeCohorts(base,members,400,20,20));
 assert.equal(historyDomainEnd(300,100),400);assert.equal(historyDomainEnd(0,100),100);
 const direct=aggregateLifeCohorts(report,{birthStart:50,birthEnd:120});assert.deepEqual(direct.cohorts,window.cohorts);
});
test('food means use exact selected time edges and the fractional observed tail',()=>{
 const tick=125.5,e={schema:FOOD_EXPOSURE_SCHEMA,prefix:Float64Array.from({length:126},(_,i)=>10*(10*i+i*(i-1)/2)),substeps:5,partialSum:675};
 const full=foodCohorts(e,tick,100),window=windowFoodCohorts(full,e,tick,25,120);
 assert.deepEqual(window.map(r=>[r.start,r.end]),[[25,100],[100,120]]);near(window[0].mean,72);near(window[1].mean,119.5);
 const tail=windowFoodCohorts(full,e,tick,100,126)[0];near(tail.mean,(122*25+135*.5)/25.5);assert.equal(tail.complete,false);
 assert.equal(windowFoodCohorts(full,e,tick,0,200)[0],full[0]);
});
test('autoscale follows enabled statistics and does not stretch zero or tiny data',()=>{
 const points=[{min:0,median:.4,mean:.8,max:3}];near(historyChartMaximum(points,['min','median','mean']),.864);
 near(historyChartMaximum(points,['max']),3.24);assert.equal(historyChartMaximum([{mean:0}],['mean']),1);
 near(historyChartMaximum([{mean:.0001}],['mean']),.000108);assert.equal(historyChartMaximum(points,['mean'],100),100);
 const canvas={getBoundingClientRect:()=>({left:0,width:600})};assert.equal(chartCohortAt(canvas,58,250,100,150),1);assert.equal(chartCohortAt(canvas,600,250,100,150),2);
});
test('survival is exact at death age and keeps living unknown instead of counting death',()=>{
 const report={tick:300,dead:[row(1,0,10),row(2,1,30)],living:[row(3,2,20,'alive')],omittedDetails:0},before=structuredClone(report),curve=survivalCurve(report);
 assert.equal(survivalAtAge(curve,10).lower,100);near(survivalAtAge(curve,10.1).lower,200/3);
 const partial=survivalAtAge(curve,20.1);near(partial.lower,100/3);near(partial.upper,200/3);assert.equal(partial.unknown,1);assert.equal(partial.complete,false);
 near(survivalAtAge(curve,30.1).upper,100/3);assert.equal(survivalAtAge(curve,30.1).lower,0);assert.deepEqual(report,before);
 const closed=survivalCurve({...report,living:[]});assert.ok(closed.points.every(p=>p.complete&&p.lower===p.upper));assert.equal(closed.points.at(-1).mean,0);
});
test('survival window, origins, open births and omitted histories are explicit',()=>{
 const report={tick:250,dead:[row(1,200,20),{...row(2,210,30),parentId:1},row(3,220,40)],living:[],omittedDetails:0};
 assert.equal(survivalCurve(report,{start:200,width:20}).count,2);assert.equal(survivalCurve(report,{start:200,width:20,origin:'descendants'}).count,1);
 assert.ok(survivalCurve(report,{start:200,width:100}).points.every(p=>!p.complete));
 assert.equal(survivalCurve({...report,omittedDetails:1},{start:200}).points.length,0);
 assert.equal(survivalCurve(report,{start:0,width:100}).count,0);assert.throws(()=>survivalCurve(report,{start:-1}));
});
test('large survival cohorts cap Canvas points but retain exact queried ages',()=>{
 const report={tick:10000,dead:Array.from({length:2000},(_,i)=>row(i,0,i/10)),living:[],omittedDetails:0},curve=survivalCurve(report);
 assert.ok(curve.points.length<=512);near(survivalAtAge(curve,100).lower,50);near(survivalAtAge(curve,100.1).lower,49.95);
});

test('survival mean and median use only completed lives in the selected birth group',()=>{
 const report={tick:200,dead:[row(1,0,10),row(2,1,20),row(3,2,90),row(4,100,1000)],living:[row(5,3,150,'alive')],omittedDetails:0},before=structuredClone(report);
 const c=survivalCurve(report);assert.deepEqual(c.completed,{count:3,mean:40,median:20});assert.deepEqual(report,before);
 const even=survivalCurve({...report,dead:report.dead.slice(0,2)});assert.deepEqual(even.completed,{count:2,mean:15,median:15});
 assert.deepEqual(survivalCurve({...report,dead:[]}).completed,{count:0,mean:null,median:null});
 assert.equal(survivalCurve({...report,omittedDetails:1}).completed.mean,null);
 assert.equal(survivalCurve(report,{start:100}).completed.mean,1000);
});

test('vertical summary markers retain their ages and separate labels when they coincide',()=>{
 const strokes=[],texts=[];let path=[];const context={setTransform(){},clearRect(){},fillRect(){},fillText(...v){texts.push(v);},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},setLineDash(){},stroke(){strokes.push({color:this.strokeStyle,path:[...path]});}};
 const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:600})};
 drawHistoryChart(canvas,{points:[{id:0,x:0,mean:100},{id:1,x:100,mean:0}],keys:['mean'],domainEnd:100,maximum:100,single:true,age:true,markers:[{label:'Медиана',value:50,color:'#e1c88c'},{label:'Среднее',value:50,color:'#86bf80'}]});
 for(const color of ['#e1c88c','#86bf80'])assert.ok(strokes.some(s=>s.color===color&&s.path.length===2&&s.path[0][0]===322&&s.path[1][0]===322&&s.path[0][1]===16&&s.path[1][1]===195));
 const labels=texts.filter(t=>/^(Медиана|Среднее):/.test(t[0]));assert.equal(labels.length,2);assert.notEqual(labels[0][2],labels[1][2]);
});

test('the known age interval remains solid when the following outcome is still unknown',()=>{
 const strokes=[];let dash=[],path=[];const context={setTransform(){},clearRect(){},fillRect(){},fillText(){},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},setLineDash(value){dash=value;},stroke(){strokes.push({dash:[...dash],path:[...path]});}};
 const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:600,left:0})};
 drawHistoryChart(canvas,{points:[{id:0,x:0,mean:100,lower:100,upper:100,complete:true},{id:1,x:2.1,mean:0,lower:0,upper:100,complete:false},{id:2,x:3,mean:0,lower:0,upper:100,complete:false}],keys:['mean'],domainEnd:3,single:true,maximum:100,age:true});
 const known=strokes.find(s=>s.path.length===2&&s.path[0][0]===58&&s.path[0][1]===16&&Math.abs(s.path[1][0]-427.6)<1e-8);
 assert.ok(known);assert.deepEqual(known.dash,[]);assert.ok(strokes.some(s=>s.dash.length&&s.path.some(p=>p[1]===195)));
});
