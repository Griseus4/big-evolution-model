import test from 'node:test';
import assert from 'node:assert/strict';
import {retainedResults} from '../dist/retained-results.js';
import {statisticsPreparation} from '../dist/statistics-preparation.js';
import {experimentOutcomes} from '../dist/experiment-outcomes.js';
import {transientStatus} from '../dist/transient-status.js';
import {createStatisticsClient} from '../dist/statistics-client.js';
import {createPairStatisticsClient} from '../dist/pair-statistics-client.js';
import {experimentArchive,openExperimentArchive,loadArchiveWindow} from '../dist/experiment-archive.js';
const options={width:10,origin:'all',mode:'dead',survivalAge:10,interruptionKind:'all'};
const report={tick:50,dead:[{id:1,parentId:null,born:0,age:20,status:'dead',meanEnergy:40,observedSteps:20,moved:5}],living:[],completed:{count:1,meanAge:20,medianAge:20},byCause:{},omittedDetails:0};
function workers(){const list=[];return {list,create(){const w={messages:[],postMessage(m){this.messages.push(m);},terminate(){this.closed=true;}};list.push(w);return w;}};}
test('numeric results survive category switches and changed data cannot reuse the old answer',()=>{
 const w=workers(),c=createStatisticsClient({available:()=>true,createWorker:()=>w.create()}),base={sources:[{id:'s',report}],options,start:0,end:30};
 try{c.update({...base,metrics:['energy']});const m=w.list[0].messages[0];w.list[0].onmessage({data:{request:m.request,owner:'s',metric:'energy',summary:{mean:40},points:[]}});c.update({...base,metrics:['movement']});assert.equal(w.list.length,2);c.update({...base,metrics:['energy']});assert.equal(w.list.length,2);assert.equal(c.get('s','energy').summary.mean,40);c.update({...base,sources:[{id:'s',report:{...report}}],metrics:['energy']});assert.equal(w.list.length,3);assert.equal(c.get('s','energy'),undefined);}finally{c.dispose();}
});
test('paired result returns immediately after leaving and reopening comparison',()=>{
 const w=workers(),c=createPairStatisticsClient({available:()=>true,createWorker:()=>w.create()}),base={a:{id:'a',worlds:[{id:'a0',pairId:0,report}]},b:{id:'b',worlds:[{id:'b0',pairId:0,report}]},options:{...options,start:0,end:30},weightMode:'worlds'};
 try{c.update({...base,metrics:['energy']});const m=w.list[0].messages[0];w.list[0].onmessage({data:{request:m.request,metric:'energy',result:{pairs:1,mean:{difference:0}}}});c.update({...base,metrics:[]});c.update({...base,metrics:['energy']});assert.equal(w.list.length,1);assert.equal(c.get('energy').result.pairs,1);}finally{c.dispose();}
});
test('statistics preparation keeps only one numerical payload in flight per Worker',async()=>{
 for(const paired of [false,true]){const w=workers(),c=paired?createPairStatisticsClient({available:()=>true,createWorker:()=>w.create()}):createStatisticsClient({available:()=>true,createWorker:()=>w.create()}),input=paired?{a:{id:'a',worlds:[{id:'a0',pairId:0,report}]},b:{id:'b',worlds:[{id:'b0',pairId:0,report}]},options:{...options,start:0,end:30}}:{sources:[{id:'s',report}],options,start:0,end:30};try{c.update({...input,metrics:['energy','movement']});await new Promise(r=>setTimeout(r,5));assert.equal(w.list[0].messages.length,1);const m=w.list[0].messages[0];w.list[0].onmessage({data:{request:m.request,owner:'s',metric:'energy',result:{},points:[]}});await new Promise(r=>setTimeout(r,5));assert.equal(w.list[0].messages.length,2);}finally{c.dispose();}}
});
test('extinctions distinguish retried attempts, final worlds, errors and stopped work',()=>{
 const attempt=(id,extinct,status='completed')=>({id,extinct,status});
 const r={plan:{variants:[{id:'v',name:'Обучение'}]},groups:[{variantId:'v',status:'completed',selectedId:'ok',attempts:[attempt('e',true),attempt('ok',false)]},{variantId:'v',status:'completed',selectedId:'e3',attempts:[attempt('e1',true),attempt('e2',true),attempt('e3',true)]},{variantId:'v',status:'failed',attempts:[attempt('err',false,'failed')]},{variantId:'v',status:'stopped',attempts:[attempt('stop',false,'stopped')]},{variantId:'v',status:'pending',attempts:[]}]};
 assert.deepEqual(experimentOutcomes(r)[0],{id:'v',name:'Обучение',attempts:5,extinctAttempts:4,worlds:2,extinctWorlds:1,unknownAttempts:2,unknownWorlds:3});
});
test('background prepares one graph only after visible results, and stops when simulation runs',()=>{
 let allowed=true,ready=false,serial=0,events=0;const timers=new Map(),q=statisticsPreparation({allowed:()=>allowed,ready:()=>ready,onChange:()=>events++,schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id)}),tick=()=>{const batch=[...timers.values()];timers.clear();for(const fn of batch)fn();},report={};
 q.sync([report,'p1'],['a','b']);q.pulse();tick();assert.equal(events,0);ready=true;tick();assert.equal(q.current(),'a');assert.equal(events,1);q.pulse();tick();assert.equal(q.current(),'b');allowed=false;q.sync([report,'p1'],['a','b']);q.pulse();tick();assert.equal(q.current(),null);assert.equal(events,2);allowed=true;q.sync([report,'p2'],['new']);q.pulse();tick();assert.equal(q.current(),'new');q.reset();assert.equal(timers.size,0);
});
test('retained answers obey entry/point limits and reading touches the recent answer',()=>{
 const cache=retainedResults({maxEntries:2,maxPoints:5});cache.set('a',{points:[1]});cache.set('b',{points:[2]});cache.get('a');cache.set('c',{points:[3]});assert.equal(cache.get('b'),undefined);assert.ok(cache.get('a'));cache.set('d',{points:[1,2,3]});assert.equal(cache.size(),1);assert.ok(cache.get('d'));
});
test('a later error survives an earlier success timer',()=>{
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;const jobs=new Map();let serial=0;globalThis.setTimeout=fn=>{jobs.set(++serial,fn);return serial;};globalThis.clearTimeout=id=>jobs.delete(id);try{const node={},set=transientStatus(node);set('Сохранено',{success:true});const old=jobs.values().next().value;set('Ошибка');old();assert.equal(node.textContent,'Ошибка');set('Сохранено',{success:true});jobs.values().next().value();assert.equal(node.textContent,'');}finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});
test('extending a compressed archive window retains already calculated numeric results',async()=>{
 const file=await experimentArchive({groups:[{attempts:[{id:'one',lives:report}]}]}),archive=await openExperimentArchive(file),life=archive.groups[0].attempts[0].lives,first=await loadArchiveWindow(life,[[0,10]]),second=await loadArchiveWindow(first,[[0,30]]),w=workers(),c=createStatisticsClient({available:()=>true,createWorker:()=>w.create()});
 const input={sources:[{id:'s',report:first}],options,start:0,end:10,metrics:['energy']};try{c.update(input);const m=w.list[0].messages[0];w.list[0].onmessage({data:{request:m.request,owner:'s',metric:'energy',summary:{mean:40},points:[]}});c.update({...input,sources:[{id:'s',report:second}]});assert.equal(w.list.length,1);assert.equal(c.get('s','energy').summary.mean,40);}finally{c.dispose();}
});
