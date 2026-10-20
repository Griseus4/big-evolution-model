import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {jsonBlob,jsonParts,snapshotExperiment} from '../dist/json-export.js';
import {populationCohorts,populationTimeline} from '../dist/population-statistics.js';
import {prepareMetric,registerAnalysisWorlds} from '../dist/statistical-series.js';
import {estimateWorlds} from '../dist/statistics-estimates.js';
import {createStatisticsClient} from '../dist/statistics-client.js';
import {weightedSummary,worldWeights} from '../dist/weighted-statistics.js';
import {drawHistoryChart} from '../dist/history-charts.js';
const row=(id,born,endTick,status='dead')=>({id,parentId:null,born,endTick,age:endTick-born,status,observedSteps:endTick-born,meanEnergy:id,children:id,moved:id,eaten:id,cause:status==='dead'?'age':null});
const source=(id,dead,living=[],tick=5)=>({id,report:{tick,dead,living,omittedDetails:0,completed:{count:dead.length}}});
const options={start:0,end:6,width:3,mode:'dead',origin:'all',survivalAge:1,interruptionKind:'all'};

test('chunked JSON matches standard plain-data semantics, yields UI time and survives Unicode boundaries',async()=>{
 const data={number:NaN,negativeZero:-0,omit:undefined,text:'Кириллица 😀 " \\ \n',typed:new Float64Array([1,2,NaN]),sparse:[,undefined,3],dead:Array.from({length:500},(_,i)=>({...row(i,0,1),text:'🍏'.repeat(70)}))};
 let yields=0,bytes=0;const blob=await jsonBlob(data,{chunkSize:257,yieldControl:async()=>{yields++;},onProgress:n=>{assert.ok(n>=bytes);bytes=n;}});
 const expected=JSON.stringify(data,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);assert.deepEqual(JSON.parse(await blob.text()),JSON.parse(expected));assert.equal(blob.size,new TextEncoder().encode(expected).length);assert.ok(yields>10);assert.equal(bytes,blob.size);
 const cycle={};cycle.self=cycle;await assert.rejects(jsonBlob(cycle),/Циклическая/);assert.throws(()=>[...jsonParts({n:1n})],/BigInt/);
});
test('export snapshot freezes attempt/row membership while reusing immutable completed records',()=>{
 const life=row(1,0,1),report={plan:{},groups:[{attempts:[{tick:1,live:{dead:[life],living:[]}}]}]},copy=snapshotExperiment(report);report.groups[0].attempts[0].live.dead.push(row(2,0,1));report.groups[0].attempts.push({tick:2});report.groups[0].attempts[0].tick=2;
 assert.equal(copy.groups[0].attempts.length,1);assert.equal(copy.groups[0].attempts[0].tick,1);assert.deepEqual(copy.groups[0].attempts[0].live.dead,[life]);assert.equal(copy.groups[0].attempts[0].live.dead[0],life);
});
test('population reconstructs exact integer-time membership, fractional events and both clipped edges',()=>{
 const s=source('a',[row(1,0,2),row(2,1,4)],[row(3,3,5,'alive')]);const p=populationCohorts(s,{start:0,end:6,width:1}).points;
 assert.deepEqual(p.map(p=>p.mean),[1,2,1,2,1,1]);assert.deepEqual(populationCohorts(s,{start:1,end:5,width:3}).points.map(p=>p.mean),[1.5,1.5]);assert.equal(populationTimeline(s.report),populationTimeline(s.report));
 const fractional=source('f',[row(1,.1,1.1)],[],2);assert.deepEqual(populationCohorts(fractional,{start:0,end:3,width:1}).points.map(p=>p.mean),[0,1,0]);
 const bad=source('bad',[{...row(1,0,2),endTick:undefined}]);assert.match(populationCohorts(bad,{start:0,end:6,width:3}).error,/точных/);
});
test('extinction adds zeros to target, manual stop does not; incomplete history is never a zero population',()=>{
 const s={...source('a',[row(1,0,2)],[],2),targetTick:6};
 assert.equal(populationCohorts({...s,extinct:true},{start:0,end:6,width:6}).points[0].mean,2/6);
 const stopped=populationCohorts(s,{start:0,end:6,width:6}).points[0];assert.equal(stopped.observedTime,3);assert.equal(stopped.complete,false);assert.equal(stopped.mean,2/3);
 const incomplete={...s,report:{...s.report,omittedDetails:1}};assert.equal(populationCohorts(incomplete,{start:0,end:6,width:6}).points.length,0);
});
test('population compares world temporal means and does not substitute a pooled time median',()=>{
 const a={...source('a',[row(1,0,2)],[],2),extinct:true,targetTick:6},b=source('b',[],[row(1,0,5,'alive'),row(2,0,5,'alive')]);
 const tasks=prepareMetric([a,b],'population',{...options,width:6}),estimate=estimateWorlds(tasks.summary.worlds,'worlds');assert.equal(estimate.mean,(1/3+2)/2);assert.equal(estimate.median,(1/3+2)/2);assert.equal(estimate.worlds,2);
});
test('weighted individual median is preserved for both modes, including half-mass ties',()=>{
 const data=[{id:'a',values:[1,2,3]},{id:'b',values:[1,2,3,4,5,6,7,8,9]}];assert.equal(estimateWorlds(data).median,3);assert.equal(estimateWorlds(data,'individuals').median,3.5);
 for(let k=1;k<=8;k++){
  const worlds=Array.from({length:5},(_,i)=>({id:String(i),values:Array.from({length:1+(i+k)%7},(_,j)=>(i*17+j*3+k)%11)})),rows=worlds.flatMap(w=>w.values.map(value=>({worldId:w.id,value})));
  for(const mode of ['worlds','individuals']){const expected=weightedSummary(rows.map(r=>r.value),mode==='worlds'?worldWeights(rows):null),actual=estimateWorlds(worlds,mode);assert.ok(Math.abs(actual.mean-expected.mean)<1e-9);assert.equal(actual.median,expected.median);}
 }
});
test('bootstrap is repeatable, rejects too few worlds and discloses observed zero variation',()=>{
 const worlds=[1,2,3,4,5].map(v=>({id:String(v),values:[v]})),a=estimateWorlds(worlds),b=estimateWorlds(worlds);assert.deepEqual(a,b);assert.equal(a.mean,3);assert.equal(a.median,3);assert.equal(a.smallSample,true);for(const stat of ['mean','median']){assert.ok(a.confidence[stat].low>=1);assert.ok(a.confidence[stat].high<=5);assert.ok(a.confidence[stat].high>a.confidence[stat].low);}
 assert.equal(estimateWorlds(worlds.slice(0,4)).confidence,null);assert.equal(estimateWorlds(worlds).worlds,5);
 const zero=estimateWorlds(worlds.map(w=>({...w,values:[7]})));assert.deepEqual(zero.confidence.mean,{low:7,high:7});assert.match(zero.reason,/не доказывает/);
 assert.throws(()=>estimateWorlds([{id:'x',values:[NaN]}]),/Нечисловое/);
});
test('birth filters, lifetime mode and survival censoring share existing life semantics',()=>{
 const s=source('a',[row(1,0,2),row(2,3,5)],[row(3,4,5,'alive')]);
 assert.equal(prepareMetric([s],'energy',{...options,start:3}).summary.worlds[0].values.length,1);assert.equal(prepareMetric([s],'energy',{...options,start:3,mode:'observed'}).summary.worlds[0].values.length,2);
 const unknown=prepareMetric([s,source('b',[row(1,0,5)],[],5)],'survival',{...options,survivalAge:3});assert.equal(unknown.summary.worlds.length,0);assert.ok(!unknown.points.some(p=>p.id===1));
});
test('actual statistics worker receives only prepared numeric samples and returns intervals',async()=>{
 const url=new URL('../dist/statistics-worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true})});`,{eval:true});
 try{await once(worker,'message');const response=once(worker,'message');worker.postMessage({request:1,owner:'a',weightMode:'worlds',prepared:{metric:'population',summary:{worlds:[1,2,3,4,5].map(v=>({id:String(v),values:Float64Array.of(v)}))},points:[]}});const [result]=await response;assert.equal(result.summary.mean,3);assert.ok(result.summary.confidence.median);assert.equal(result.request,1);}finally{await worker.terminate();}
});
test('analysis client reuses raw-world context, cancels old work and ignores late responses',async()=>{
 const workers=[];let updates=0;const client=createStatisticsClient({available:()=>true,onChange:()=>updates++,createWorker:()=>{const w={messages:[],postMessage(data,transfer){this.messages.push(data);assert.ok(transfer.every(b=>b instanceof ArrayBuffer));},terminate(){this.closed=true;}};workers.push(w);return w;}}),world=source('a',[row(1,0,2)]),report=registerAnalysisWorlds({weightMode:'worlds'},[world]);
 const input={sources:[{id:'v1',report}],metrics:['energy'],options,start:0,end:6};client.update(input);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(workers.length,1);assert.equal(workers[0].messages.length,1);
 const replacement=registerAnalysisWorlds({weightMode:'worlds'},[world]);client.update({...input,sources:[{id:'v1',report:replacement}]});assert.equal(workers.length,1);
 const message=workers[0].messages[0];client.update({...input,end:5});assert.equal(workers[0].closed,true);workers[0].onmessage({data:{request:message.request,owner:'v1',metric:'energy',points:[]}});assert.equal(updates,0);client.dispose();
});
test('confidence limits affect scale; histogram variants are adjacent and retain their colors',()=>{
 const rects=[],strokes=[],labels=[],context={setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes.push(this.strokeStyle);},fill(){},fillRect(...args){assert.ok(args.every(Number.isFinite));rects.push({args,color:this.fillStyle});},setLineDash(){},fillText(t){labels.push(t);}};
 const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:600})};drawHistoryChart(canvas,{points:[{id:0,x:0,a:1,b:2}],keys:['a','b'],lines:[{id:'a',color:'#00ff00'},{id:'b',color:'#ffff00'}],width:5,domainStart:-100,domainEnd:100,histogram:true});assert.deepEqual(rects.map(r=>r.color),['#00ff00','#ffff00']);assert.ok(rects[0].args[0]<rects[1].args[0]);
 drawHistoryChart(canvas,{points:[{id:0,x:0,mean:1,low:.5,high:100}],keys:['mean'],domainStart:0,domainEnd:1,bands:[{low:'low',high:'high',color:'#00ff00'}]});assert.ok(labels.includes('108'));assert.ok(strokes.includes('#86bf80'));
});
