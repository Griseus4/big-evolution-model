import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {preparePairSeries} from '../dist/pair-series.js';
import {estimatePair} from '../dist/pair-statistics.js';
import {createPairStatisticsClient} from '../dist/pair-statistics-client.js';
import {formatStatistic} from '../dist/statistics-format.js';
import {lifeMetric} from '../dist/life-cohorts.js';
import {installHistoryDifferences} from '../dist/history-differences-ui.js';
const options={start:0,end:20,width:10,mode:'dead',origin:'all',survivalAge:5};
const row=(born,value)=>({born,age:10,status:'dead',parentId:null,meanEnergy:value,meanHealth:value+10,meanFeeling:-value});
const world=(pairId,value)=>({id:'w'+pairId,pairId,number:1,seed:pairId,report:{tick:20,dead:[row(0,value),row(10,value+1)],living:[],completed:{count:2}}});
const a=Array.from({length:5},(_,i)=>world(i,10+i)),b=Array.from({length:5},(_,i)=>world(i,17+i));
const seven=ci=>{assert.ok(Math.abs(ci.low-7)<1e-10);assert.ok(Math.abs(ci.high-7)<1e-10);};
test('time-series pairs retain per-bin effects, independent buffers and actual missing repeats',()=>{
 const p=preparePairSeries(a,b,'energy',options);assert.equal(p.points.length,2);
 const buffers=[p,...p.points].flatMap(task=>[...task.a,...task.b].map(w=>w.values.buffer));assert.equal(new Set(buffers).size,buffers.length);
 for(const point of p.points){const r=estimatePair(point.a,point.b);assert.equal(r.mean.difference,7);seven(r.mean.confidence.difference);assert.equal(r.max.difference,7);}
 const missing=preparePairSeries(a,b.map((w,i)=>i===4?{...w,report:{...w.report,dead:[row(0,21)]}}:w),'energy',options),last=estimatePair(missing.points[1].a,missing.points[1].b);
 assert.equal(last.pairs,4);assert.equal(last.excluded.length,1);assert.equal(last.mean.confidence,null);
});
test('unknown age outcomes block only their own birth bin, never inventing zeros',()=>{
 const alive={...row(19,10),age:1,status:'alive'},unknown={...a[0],report:{...a[0].report,living:[alive]}};
 const p=preparePairSeries([unknown],[b[0]],'survival',options);assert.equal(p.a[0].values.length,0);assert.equal(p.points[0].a[0].values.length,1);assert.equal(p.points[1].a[0].values.length,0);
 assert.equal(estimatePair(p.points[1].a,p.points[1].b).mean,null);
 const incomplete=preparePairSeries([{...a[0],report:{...a[0].report,omittedDetails:1}}],[b[0]],'energy',options);assert.equal(incomplete.a[0].values.length,0);assert.ok(incomplete.points.every(p=>!p.a[0].values.length));
});
test('health/feeling reuse recorded observations and display rounding preserves exact data',()=>{
 const r=row(0,12.345);assert.equal(lifeMetric(r,'health'),22.345);assert.equal(lifeMetric(r,'feeling'),-12.345);assert.equal(Number.isFinite(lifeMetric({},'health')),false);
 assert.equal(formatStatistic(12.345),'12,3');assert.equal(formatStatistic(-.01),'0,0');assert.equal(formatStatistic(0),'0,0');assert.equal(formatStatistic(null),'—');assert.equal(r.meanEnergy,12.345);
});
test('real Worker returns paired point intervals, counts and spread without heavy point metadata',async()=>{
 const url=new URL('../dist/pair-statistics-worker.js',import.meta.url).href,worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true})});`,{eval:true});
 try{await once(worker,'message');const response=once(worker,'message');worker.postMessage({request:1,metric:'energy',...preparePairSeries(a,b,'energy',options),weightMode:'worlds'});const [r]=await response;assert.equal(r.result.pairs,5);assert.equal(r.points.length,2);seven(r.points[0].mean.confidence.difference);assert.deepEqual(r.points[0].spread.mean,{low:7,high:7});assert.equal(r.points[0].included,undefined);assert.equal(r.points[0].excludedCount,0);}finally{await worker.terminate();}
});
test('series client transfers every numeric buffer once and ignores obsolete results',async()=>{
 const workers=[];const client=createPairStatisticsClient({available:()=>true,createWorker:()=>{const w={postMessage(data,buffers){structuredClone(data,{transfer:buffers});this.data=data;this.buffers=buffers;},terminate(){this.closed=true;}};workers.push(w);return w;}}),input={a:{id:'a',worlds:a},b:{id:'b',worlds:b},metrics:['energy'],options,weightMode:'worlds',series:true};
 client.update(input);await new Promise(r=>setTimeout(r,5));assert.ok(workers[0].data.points.length);assert.equal(workers[0].buffers[0].byteLength,0);client.update(input);assert.equal(workers.length,1);client.update({...input,a:input.b,b:input.a});assert.equal(workers[0].closed,true);workers[0].onmessage({data:{...workers[0].data}});assert.equal(client.get('energy'),undefined);client.dispose();
});
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.value='';this.style={};this.listeners={};this.hidden=false;}
 append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(){}addEventListener(k,fn){this.listeners[k]=fn;}getContext(){return null;}
}
test('each time card has independent mode and shares the selected pair without recomputing originals',()=>{
 const root={createElement:t=>new Element(t)},cards=['energy','health'].map(id=>({m:{id,label:id},canvas:new Element('canvas'),note:new Element('p'),card:new Element('section'),numeric:new Element('div')})),calls=[];
 const answer={result:estimatePair(preparePairSeries(a,b,'energy',options).a,preparePairSeries(a,b,'energy',options).b),points:[]};
 const client={update:x=>calls.push(x),get:()=>answer,state:()=>({}),suspend(){},dispose(){}};
 const ui=installHistoryDifferences({root,cards,onChange(){},createClient:()=>client}),input={pair:{a:{id:'a',name:'A',worlds:a},b:{id:'b',name:'B',worlds:b}},options,start:0,end:20,statistic:'mean',bandMode:'confidence'};
 ui.update(input);assert.equal(calls.length,0);cards[0].view.value='difference';ui.update(input);assert.deepEqual(calls[0].metrics,['energy']);assert.equal(cards[1].view.value,'original');assert.equal(cards[0].numeric.hidden,true);assert.equal(cards[1].numeric.hidden,false);
 ui.update({...input,pair:{a:input.pair.b,b:input.pair.a}});assert.equal(calls.at(-1).a.id,'b');ui.update({...input,pair:null});assert.match(cards[0].note.textContent,/Выберите источник/);
});
