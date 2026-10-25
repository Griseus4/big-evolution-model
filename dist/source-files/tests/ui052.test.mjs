import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatisticsClient} from '../dist/statistics-client.js';
import {createPairStatisticsClient} from '../dist/pair-statistics-client.js';
import {metricOptions} from '../dist/metric-options.js';
import {deferredControl} from '../dist/deferred-control.js';
import {installHistoryEstimates} from '../dist/history-estimates-ui.js';
const options={width:10,origin:'all',mode:'dead',survivalAge:10,interruptionKind:'all'},report={tick:50,dead:[{id:1,born:0,parentId:null,age:20,status:'dead',meanEnergy:40,observedSteps:20}],living:[],omittedDetails:0};
const pause=()=>new Promise(r=>setTimeout(r,4));
const until=async predicate=>{const deadline=performance.now()+1000;while(!predicate()){if(performance.now()>deadline)throw new Error('Ожидаемое событие Worker не наступило.');await pause();}};
function fixture(paired){
 const workers=[],make=()=>{const w={messages:[],postMessage(m){this.messages.push(m);},terminate(){this.closed=true;}};workers.push(w);return w;};
 const client=(paired?createPairStatisticsClient:createStatisticsClient)({available:()=>true,createWorker:make}),base=paired?{a:{id:'a',worlds:[{id:'a0',pairId:0,report}]},b:{id:'b',worlds:[{id:'b0',pairId:0,report}]},options:{...options,start:0,end:30},weightMode:'worlds'}:{sources:[{id:'s',report}],options,start:0,end:30};
 const sent=()=>workers.flatMap(w=>w.messages.map(m=>({w,m}))),reply=({w,m})=>w.onmessage({data:{request:m.request,owner:m.owner,scope:m.scope,metric:paired?m.metric:m.prepared.metric,summary:{mean:40},result:{pairs:1},points:[]}});
 return {client,base,workers,sent,reply};
}
test('irrelevant local settings reuse all ready results in ordinary and paired clients',async()=>{
 for(const paired of [false,true]){const f=fixture(paired);try{
  f.client.update({...f.base,metrics:['energy']});f.reply(f.sent()[0]);await pause();
  f.client.update({...f.base,options:{...f.base.options,survivalAge:25,interruptionKind:'physical'},metrics:['energy']});assert.equal(f.sent().length,1);
  f.client.update({...f.base,metrics:['survival']});f.reply(f.sent()[1]);await pause();
  f.client.update({...f.base,options:{...f.base.options,survivalAge:25},metrics:['survival']});assert.equal(f.sent().length,3);
 }finally{f.client.dispose();}}
});
test('a local change preserves an unrelated in-flight calculation and queues only missing work',async()=>{
 for(const paired of [false,true]){const f=fixture(paired);try{
  f.client.update({...f.base,metrics:['energy','survival']});const first=f.sent()[0];
  f.client.update({...f.base,options:{...f.base.options,survivalAge:25},metrics:['energy','survival']});assert.equal(f.workers.length,1);assert.ok(!first.w.closed);
  f.reply(first);await until(()=>f.sent().length===2);assert.equal(f.sent()[1].m.prepared?.metric??f.sent()[1].m.metric,'survival');
  f.reply(f.sent()[1]);await until(()=>f.client.state().completed===2);
 }finally{f.client.dispose();}}
});
test('numeric calculation dependencies distinguish scale, inherited traits and body metrics',()=>{
 assert.deepEqual(metricOptions('energy',options),metricOptions('energy',{...options,survivalAge:999,interruptionKind:'physical'}));
 assert.deepEqual(metricOptions('population',options),metricOptions('population',{...options,origin:'founders',mode:'observed'}));
 assert.notDeepEqual(metricOptions('interruptions',options),metricOptions('interruptions',{...options,interruptionKind:'physical'}));
});
test('slider coalesces movement, flushes final input and cancels deferred work',()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout,jobs=new Map();let seq=0,calls=0;
 globalThis.setTimeout=fn=>{jobs.set(++seq,fn);return seq;};globalThis.clearTimeout=id=>jobs.delete(id);
 try{const c=deferredControl(()=>calls++);c.input();c.input();c.input();assert.equal(jobs.size,1);assert.equal(calls,0);c.flush();assert.equal(calls,1);assert.equal(jobs.size,0);c.input();c.cancel();assert.equal(jobs.size,0);}finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
test('card keeps its numerical summary until every new source result is ready',()=>{
 const make=()=>({children:[],style:{setProperty(){}},setAttribute(){},append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;}}),root={createElement:make,getElementById:make},card={m:{id:'energy',unit:'%'},canvas:make(),card:make(),view:{value:'original'}},answers=new Map(),client={update(){},get:id=>answers.get(id),state:()=>({}),suspend(){}};
 const ui=installHistoryEstimates({root,cards:[card],onChange(){},createClient:()=>client}),input={sources:[{id:'a',name:'A'},{id:'b',name:'B'}],options,start:0,end:10};
 answers.set('a',{summary:{mean:10,repeats:0,reason:'Исходы неизвестны',excluded:[{pairId:0,variants:['v1','v4']}]}});answers.set('b',{error:'Нет доступных данных',summary:{mean:20}});ui.update(input);const previous=card.numeric.children,display=card.displayEstimates;
 assert.equal(previous.length,2);assert.equal(display.get('a').summary.reason,'Исходы неизвестны');assert.equal(display.get('b').error,'Нет доступных данных');
 answers.delete('b');answers.set('a',{summary:{mean:30}});ui.update({...input,end:20});assert.equal(card.numeric.children,previous);assert.equal(card.displayEstimates,display);assert.equal(card.pending,true);
 answers.set('b',{summary:{mean:40}});ui.update({...input,end:20});assert.equal(card.pending,false);assert.notEqual(card.numeric.children,previous);assert.equal(card.displayEstimates.get('a').summary.mean,30);
});
