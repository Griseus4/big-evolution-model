import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {estimatePair,preparePairSide} from '../dist/pair-statistics.js';
import {estimateWorlds} from '../dist/statistics-estimates.js';
import {experimentWorlds,reportSources} from '../dist/experiment-statistics.js';
import {createPairStatisticsClient} from '../dist/pair-statistics-client.js';
import {installPairComparison,PAIR_METRICS} from '../dist/pair-comparison-ui.js';
import {estimateCell} from '../dist/statistics-format.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const side=values=>values.map((v,pairId)=>({pairId,id:'w'+pairId,seed:42+pairId,number:1,extinctions:0,values:Array.isArray(v)?v:[v]}));
const options={start:0,end:10,width:5,origin:'all',mode:'dead',interruptionKind:'all',survivalAge:5};
const row=(id,age=10)=>({id,parentId:null,born:0,endTick:age,age,status:'dead',observedSteps:age,meanEnergy:id,children:1,cause:'age'});
const world=(pairId,rows)=>({id:'world'+pairId,pairId,seed:pairId,number:1,targetTick:10,extinct:false,report:{tick:10,dead:rows,living:[],completed:{count:rows.length},omittedDetails:0}});

test('paired resampling preserves additive and proportional effects, even when B is shuffled',()=>{
 const a=side([10,20,30,40,50]),b=a.map(w=>({...w,seed:w.seed+100,number:2,extinctions:1,values:[w.values[0]+7]})).reverse(),r=estimatePair(a,b);
 assert.equal(r.pairs,5);for(const stat of ['mean','median']){assert.equal(r[stat].difference,7);assert.deepEqual(r[stat].confidence.difference,{low:7,high:7});}
 assert.equal(r.included[0].a.seed,42);assert.equal(r.included[0].b.seed,142);assert.equal(r.included[0].b.extinctions,1);assert.equal(r.included[0].b.values,undefined);
 const twice=a.map(w=>({...w,values:[2*w.values[0]]})),p=estimatePair(a,twice),q=estimatePair(twice,a);
 for(const stat of ['mean','median']){assert.equal(p[stat].ratio,2);assert.equal(p[stat].percent,100);assert.deepEqual(p[stat].confidence.ratio,{low:2,high:2});assert.equal(q[stat].ratio,.5);assert.equal(q[stat].percent,-50);near(q[stat].difference,-p[stat].difference);near(q[stat].confidence.difference.low,-p[stat].confidence.difference.high);}
 assert.deepEqual(estimatePair(a,twice),p);
});
test('only full original repeats enter either estimate; unmatched data remains disclosed',()=>{
 const a=side([1,2,3,4,999]),b=side([2,3,4,5]),r=estimatePair(a,b);assert.equal(r.pairs,4);assert.equal(r.availableA,5);assert.equal(r.availableB,4);assert.equal(r.mean.a,2.5);assert.equal(r.mean.b,3.5);assert.equal(r.mean.confidence,null);assert.equal(r.excluded[0].pairId,4);assert.equal(r.excluded[0].a,null);assert.match(r.excluded[0].b,/Нет мира/);
 const missing=estimatePair(a,side([1,2,3,4,5]).map(w=>({...w,values:[],reason:'Исход неизвестен.'})));assert.equal(missing.mean,null);assert.equal(missing.excluded.length,5);assert.match(missing.reason,/Нет полных пар/);
 assert.throws(()=>estimatePair([...a,a[0]],b),/повторяется/);assert.throws(()=>estimatePair([{values:[1]}],b),/Повтор/);
});
test('weighted individual medians are retained; differences are differences of estimates',()=>{
 const a=side([[1,2,3],[1,2,3,4,5,6,7,8,9]]),b=side([[2,5],[7,8,11]]);
 for(const mode of ['worlds','individuals']){const r=estimatePair(a,b,mode),ea=estimateWorlds(a,mode),eb=estimateWorlds(b,mode);near(r.mean.a,ea.mean);assert.equal(r.median.a,ea.median);assert.equal(r.median.b,eb.median);assert.equal(r.median.difference,eb.median-ea.median);}
 assert.equal(estimatePair(a,b).median.a,3);assert.equal(estimatePair(a,b,'individuals').median.a,3.5);
});
test('zero base and uncertainty crossing zero never produce a finite false ratio interval',()=>{
 const zero=estimatePair(side([0,0,0,0,0]),side([1,2,3,4,5]));assert.equal(zero.mean.ratio,null);assert.equal(zero.mean.percent,null);assert.equal(zero.mean.confidence.ratio,null);assert.equal(zero.mean.difference,3);assert.match(zero.mean.ratioReason,/нулю/);
 const uncertain=estimatePair(side([-2,-1,0,1,3]),side([2,2,2,2,2]));assert.ok(Number.isFinite(uncertain.mean.ratio));assert.equal(uncertain.mean.confidence.ratio,null);assert.equal(uncertain.mean.confidence.percent,null);assert.ok(uncertain.mean.confidence.difference);
 const negative=estimatePair(side([-10,-20,-30,-40,-50]),side([-20,-40,-60,-80,-100]));assert.equal(negative.mean.ratio,2);assert.deepEqual(negative.mean.confidence.ratio,{low:2,high:2});
});
test('summary preparation discloses unknown survival and missing history per world',()=>{
 const known=world(0,[row(1)]),unknown=world(1,[row(2)]);unknown.report.living=[{...row(3,1),born:9,endTick:10,status:'alive'}];
 const input=preparePairSide([known,unknown,{id:'x',pairId:2,report:null}],'survival',options);assert.equal(input[0].values[0],100);assert.equal(input[1].values.length,0);assert.match(input[1].reason,/неизвестна/);assert.equal(input[2].values.length,0);
 known.report.omittedDetails=1;assert.equal(preparePairSide([known],'energy',options)[0].values.length,0);
 known.report.omittedDetails=0;known.report.completed.count=2;assert.equal(preparePairSide([known],'energy',options)[0].values.length,0);
 const energy=preparePairSide([world(0,[row(1),row(2)])],'energy',{...options,start:1});assert.equal(energy[0].values.length,0);
});
test('experiment metadata keeps original repeat IDs, retry seeds and every extinction',()=>{
 const a={id:'attempt',number:2,seed:99,extinct:false,lives:{tick:10}},series={plan:{steps:10},groups:[{id:'g',variantId:'a',index:3,status:'completed',selectedId:a.id,attempts:[{id:'failed',extinct:true},a]},{id:'pending',variantId:'a',index:4,status:'pending',selectedId:null,attempts:[]}]};
 const all=experimentWorlds(series,'a');assert.equal(all.length,2);assert.equal(all[0].pairId,3);assert.equal(all[0].number,2);assert.equal(all[0].seed,99);assert.equal(all[0].extinctions,1);assert.equal(all[1].report,null);assert.equal(reportSources(series,'a').length,1);
});
test('actual pair Worker returns intervals without any simulation or raw life reports',async()=>{
 const url=new URL('../dist/pair-statistics-worker.js',import.meta.url).href,worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true})});`,{eval:true});
 try{await once(worker,'message');const response=once(worker,'message');worker.postMessage({request:2,metric:'energy',a:side([1,2,3,4,5]),b:side([2,3,4,5,6]),weightMode:'worlds'});const [r]=await response;assert.equal(r.request,2);assert.equal(r.result.mean.difference,1);near(r.result.mean.confidence.difference.low,1);near(r.result.mean.confidence.difference.high,1);}finally{await worker.terminate();}
});
test('pair client caches context and cancels obsolete responses with transferable numeric samples',async()=>{
 const workers=[];let changes=0;const client=createPairStatisticsClient({available:()=>true,onChange:()=>changes++,createWorker:()=>{const w={messages:[],postMessage(m,t){this.messages.push(m);assert.ok(t.every(b=>b instanceof ArrayBuffer));assert.equal(m.a[0].report,undefined);},terminate(){this.closed=true;}};workers.push(w);return w;}}),a={id:'a',worlds:[world(0,[row(1)])]},b={id:'b',worlds:[world(0,[row(2)])]},input={a,b,metrics:['energy'],options,weightMode:'worlds'};
 client.update(input);await new Promise(r=>setTimeout(r,5));client.update({...input,a:{...a}});assert.equal(workers.length,1);const m=workers[0].messages[0];client.update({...input,options:{...options,start:1}});assert.equal(workers[0].closed,true);workers[0].onmessage({data:{request:m.request,metric:'energy',result:{}}});assert.equal(changes,0);client.dispose();
});
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.textContent='';this.style={};}
 append(...nodes){for(const n of nodes)n.parent=this;this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 setAttribute(){}addEventListener(k,fn){this.listeners[k]=fn;}emit(k){this.listeners[k]?.({target:this});}
}
const text=n=>n.textContent+n.children.map(text).join(' ');
test('pair table swaps selectors, keeps lazy details and exposes a clear no-source state',()=>{
 const nodes=new Map(['pair-variant-a','pair-variant-b','pair-statistic','pair-rows','pair-status','pair-label-a','pair-label-b','pair-period','pair-swap'].map(id=>[id,new Element('div')])),root={getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag)},calls=[],r=estimatePair(side([1,2,3,4,5]),side([2,3,4,5,6]));
 let answer={result:r};const client={update:x=>calls.push(x),get:()=>answer,state:()=>({completed:PAIR_METRICS.length,total:PAIR_METRICS.length}),suspend(){},dispose(){}};
 const ui=installPairComparison({root,createClient:()=>client,onChange:()=>ui.update(input)}),input={comparison:{weightMode:'worlds',variants:[{id:'a',name:'Очень длинное имя A',worlds:[]},{id:'b',name:'B',worlds:[]}]},options,start:0,end:10};ui.update(input);assert.equal(calls[0].a.id,'a');assert.equal(calls[0].b.id,'b');const old=nodes.get('pair-rows').children[0];ui.update(input);assert.equal(nodes.get('pair-rows').children[0],old);
 nodes.get('pair-swap').emit('click');assert.equal(calls.at(-1).a.id,'b');assert.equal(calls.at(-1).b.id,'a');nodes.get('pair-statistic').value='median';nodes.get('pair-statistic').emit('change');assert.equal(nodes.get('pair-rows').children[0].children.length,1);
 const detail=nodes.get('pair-rows').children[0].children[0].children[0].children.find(n=>n.tagName==='details');detail.open=true;detail.emit('toggle');assert.match(text(detail),/seed 42/);
 ui.update({...input,comparison:null});assert.match(nodes.get('pair-status').textContent,/источник/);assert.equal(nodes.get('pair-rows').children.length,0);
});
test('numeric cells separate value from interval and do not attach confidence to unknown values',()=>{
 const root={createElement:t=>new Element(t)},value=estimateCell(root,123,{low:100,high:140}),missing=estimateCell(root,null,null);assert.equal(value.children.length,3);assert.equal(value.children[2].className,'estimate-interval');assert.equal(missing.children.length,1);assert.equal(text(missing),'—');
});
