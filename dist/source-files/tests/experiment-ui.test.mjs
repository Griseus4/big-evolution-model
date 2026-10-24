/** Исполняем настоящий конструктор с управляемым DOM/Workers. Этот стенд
 * проверяет обработчики и данные, но не внешний вид настоящего браузера. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installExperimentUI} from '../dist/experiment-ui.js';
import {ExperimentStore} from '../dist/experiment-store.js';
import {installExperimentDesign} from '../dist/experiment-design-ui.js';
import {installExperimentRuns,environmentSeedText} from '../dist/experiment-runs-ui.js';
import {MODEL_VERSION} from '../dist/life-history.js';
import {validatePlan} from '../dist/experiment-plan.js';
import {experimentArchive,archiveOrigin} from '../dist/experiment-archive.js';
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.checked=false;this.textContent='';this.style={};this.files=[];this.dataset={};}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}if(this.tagName==='select'&&!this.value)this.value=String(nodes[0]?.value??'');}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 prepend(...nodes){for(const node of nodes)node.parent=this;this.children.unshift(...nodes);}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(){}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 after(node){this.afterNode=node;}
 showModal(){this.open=true;this.shown=(this.shown??0)+1;}
 close(){this.open=false;}
 click(){return this.listeners.click?.({target:this});}
 emit(name){return this.listeners[name]?.({target:this});}
}
function boot({running=true,pauseError=false,realTimers=false}={}){
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map(),workers=[],intervals=[];
 for(const m of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Element(m[1]);node.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]??'';elements.set(m[2],node);}
 for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const first=m[2].match(/<option[^>]*value="([^"]+)"/);if(first)elements.get(m[1]).value=first[1];}
 const state={running,epoch:1},calls={pause:0,resume:0,source:0,statistics:0,resets:[]},toolbar=new Element();
 globalThis.document={getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);},createElement:tag=>new Element(tag),querySelector:()=>toolbar};
 globalThis.Worker=class{constructor(){this.sent=[];workers.push(this);}postMessage(m){this.sent.push(m);}terminate(){this.closed=true;}};
 const oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval,oldTimeout=globalThis.setTimeout;
 globalThis.fetch=async()=>({ok:true,json:async()=>({sourceFingerprint:'test'})});globalThis.setInterval=fn=>{intervals.push(fn);return 0;};if(!realTimers)globalThis.setTimeout=()=>0;
 const ui=installExperimentUI({getSimulation:()=>({lives:{tick:77}}),getWorldState:()=>({...state}),pauseWorld:async()=>{calls.pause++;if(pauseError)throw new Error('pause failed');state.running=false;},resumeWorld:async previous=>{assert.equal(previous.epoch,state.epoch);calls.resume++;state.running=true;},sourceChanged:reset=>{calls.source++;calls.resets.push(reset);},openStatistics:()=>calls.statistics++});
 const done=(worker,status='completed')=>worker.onmessage({data:{type:'done',jobId:worker.sent.find(m=>m.type==='run').job.id,result:{status,modelVersion:MODEL_VERSION,tick:1,extinct:false,lives:{tick:1,dead:[],living:[],completed:{count:0,meanAge:null,medianAge:null},byCause:{}}}}});
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 return {ui,elements,workers,state,calls,toolbar,intervals,done,flush,restore(){globalThis.fetch=oldFetch;globalThis.setInterval=oldInterval;globalThis.setTimeout=oldTimeout;}};
}
test('personal defaults remain separate from editing and starting; restore and new use the saved plan',async()=>{
 const old=globalThis.localStorage,values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const b=boot();try{const steps=b.elements.get('constructor-steps');steps.value='123';b.elements.get('constructor-make-defaults').click();assert.match(b.elements.get('constructor-storage').textContent,/сохранены/);
  steps.value='456';b.elements.get('constructor-worlds').value='1';b.elements.get('constructor-worlds').emit('change');await b.elements.get('constructor-run').click();assert.equal(b.ui.isActive(),true);b.elements.get('constructor-force-stop').click();await b.flush();
  const saved=JSON.parse(values.get('big-evolution-experiment-preferences-v1'));assert.equal(saved.standard.steps,123);b.elements.get('constructor-restore-defaults').click();assert.equal(Number(steps.value),123);steps.value='999';b.elements.get('constructor-new').click();assert.equal(Number(steps.value),123);
 }finally{b.restore();globalThis.localStorage=old;}
});
test('draft restores raw fields, seeds and unfinished factors after reload',()=>{
 const old=globalThis.localStorage,oldEvents=globalThis.addEventListener,values=new Map();let flushDraft;globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};globalThis.addEventListener=(key,fn)=>{if(key==='pagehide')flushDraft=fn;};
 let b;try{b=boot();b.elements.get('constructor-name').value='Черновик';b.elements.get('constructor-steps').value='';const picker=b.elements.get('constructor-factor-add');picker.value='reproduction.maturity';picker.emit('change');const factor=b.elements.get('constructor-factors');descendants(factor,n=>n.tagName==='button'&&n.textContent==='+ Значение')[0].click();flushDraft();b.restore();b=boot();assert.equal(b.elements.get('constructor-name').value,'Черновик');assert.equal(b.elements.get('constructor-steps').value,'');assert.equal(descendants(b.elements.get('constructor-factors'),n=>n.type==='number').length,2);assert.equal(descendants(b.elements.get('constructor-factors'),n=>n.type==='number')[1].value,'');assert.equal(JSON.parse(values.get('big-evolution-experiment-preferences-v1')).standard,null);
 }finally{b?.restore();globalThis.localStorage=old;globalThis.addEventListener=oldEvents;}
});
test('real UI builds templates, passes independent variants, pauses and restores the main world',async()=>{
 const b=boot();try{
 assert.equal(b.elements.get('constructor-builtins').children.length,5);b.elements.get('constructor-builtins').children[1].click();assert.equal(b.elements.get('constructor-factors').children.length,1);
 for(const [id,value]of [['worlds','1'],['steps','1'],['budget','1']])b.elements.get('constructor-'+id).value=value;
 b.elements.get('constructor-worlds').emit('change');await b.elements.get('constructor-run').click();assert.equal(b.ui.isActive(),true,b.elements.get('constructor-error').textContent);assert.equal(b.state.running,false);assert.equal(b.calls.pause,1);
 assert.equal(b.workers[0].sent[0].job.worldOptions.learning,true);b.done(b.workers[0]);assert.equal(b.ui.isActive(),true);assert.equal(b.workers[1].sent[0].job.worldOptions.learning,false);b.done(b.workers[1]);await b.flush();
 assert.equal(b.calls.resume,1);assert.equal(b.state.running,true);assert.equal(b.ui.isActive(),false);
 b.elements.get('constructor-open-comparison').click();assert.equal(b.calls.statistics,1);assert.equal(b.ui.comparisons().sources.length,2);assert.equal(b.ui.getSimulation().lives.tick,1);
 }finally{b.restore();}
});
test('paused main world remains paused after force-stop; failed pause never starts a series',async()=>{
 const b=boot({running:false});try{b.elements.get('constructor-worlds').value='1';b.elements.get('constructor-worlds').emit('change');await b.elements.get('constructor-run').click();assert.equal(b.ui.isActive(),true);b.elements.get('constructor-force-stop').click();await b.flush();assert.equal(b.calls.resume,0);assert.equal(b.ui.isActive(),false);assert.ok(b.workers.every(w=>w.closed));assert.equal(b.elements.get('experiment-notification-dialog').open,true);assert.match(b.elements.get('experiment-notification-body').textContent,/Опыты завершены.*остаётся на паузе/);assert.equal(b.toolbar.afterNode,undefined);}finally{b.restore();}
 const f=boot({pauseError:true});try{await f.elements.get('constructor-run').click();await f.flush();assert.equal(f.workers.length,0);assert.equal(f.ui.isActive(),false);assert.match(f.elements.get('constructor-error').textContent,/pause failed/);}finally{f.restore();}
});
test('persistence writes immutable completed attempts once and marks interrupted metadata honestly',async()=>{
 const store=new ExperimentStore(null),tables=new Map(['runs','attempts','templates'].map(k=>[k,new Map()]));store.ready=Promise.resolve({});let writes=0;
 store.transaction=async(name,mode,action)=>{const wrap=key=>{const table=tables.get(key);return {put:(value,id)=>{writes++;table.set(id,structuredClone(value));return {result:id};},get:id=>({result:structuredClone(table.get(id))}),getAll:()=>({result:[...table.values()].map(structuredClone)}),delete:id=>{table.delete(id);return {};}};};const result=action(Array.isArray(name)?Object.fromEntries(name.map(k=>[k,wrap(k)])):wrap(name));return result.result;};
 const report={createdAt:'test',status:'running',groups:[{id:'g',attempts:[{id:'g-1',status:'completed',tick:3,lives:{tick:3,dead:[{id:1,born:0,age:3,endTick:3,status:'dead'}],living:[]}},{id:'g-2',status:'running',tick:4}]}]};
 await store.save(report);assert.equal(writes,2);await store.save(report);assert.equal(writes,3);const loaded=await store.load('test');assert.equal(loaded.status,'interrupted');assert.equal(loaded.groups[0].attempts[1].status,'interrupted');assert.equal(loaded.groups[0].attempts[0].lives.dead.length,0);assert.ok(tables.get('attempts').get('test/g-1') instanceof Blob);
 await store.delete('test');assert.equal(tables.get('runs').size,0);assert.equal(tables.get('attempts').size,0);
});
const descendants=(node,predicate)=>node.children.flatMap(n=>[...(predicate(n)?[n]:[]),...descendants(n,predicate)]);
test('common tabs retain fields; boolean factors default to both states and never duplicate rows',()=>{
 const b=boot();try{
 const common=b.elements.get('constructor-common'),rows=common.children[1].children[0].children;assert.equal(rows.length,6);assert.equal(rows.filter(r=>!r.hidden).length,1);common.children[0].children[2].click();assert.equal(rows[2].hidden,false);assert.equal(rows[0].hidden,true);assert.equal(descendants(common,n=>n.tagName==='details').length,0);
 const picker=b.elements.get('constructor-factor-add'),factors=b.elements.get('constructor-factors');picker.value='memory';picker.emit('change');assert.equal(factors.children.length,1);const boxes=descendants(factors,n=>n.type==='checkbox');assert.equal(boxes.length,2);assert.ok(boxes.every(i=>i.checked));assert.match(b.elements.get('constructor-design-summary').textContent,/Сочетаний на seed: 2/);
 picker.value='memory';picker.emit('change');assert.equal(factors.children.length,1);boxes[0].checked=false;boxes[0].emit('change');assert.match(b.elements.get('constructor-design-summary').textContent,/Сочетаний на seed: 1/);
 boxes[1].checked=false;boxes[1].emit('change');assert.equal(b.elements.get('constructor-run').disabled,true);assert.match(b.elements.get('constructor-design-summary').textContent,/хотя бы одно/);
 descendants(factors,n=>n.tagName==='button'&&n.textContent==='Убрать')[0].click();assert.equal(factors.children.length,0);assert.equal(b.elements.get('constructor-run').disabled,false);
 }finally{b.restore();}
});
test('numeric fields add/remove, reject duplicate/empty values and actually run all combinations',async()=>{
 const b=boot();try{
 for(const [id,value]of [['worlds','1'],['steps','1'],['budget','1']])b.elements.get('constructor-'+id).value=value;b.elements.get('constructor-worlds').emit('change');
 const picker=b.elements.get('constructor-factor-add'),factors=b.elements.get('constructor-factors');picker.value='learning';picker.emit('change');picker.value='reproduction.birthInterval';picker.emit('change');
 descendants(factors,n=>n.tagName==='button'&&n.textContent==='+ Значение')[0].click();let numbers=descendants(factors,n=>n.type==='number');assert.equal(numbers.length,2);assert.equal(b.elements.get('constructor-run').disabled,true);
 numbers[1].value='100';numbers[1].emit('input');assert.match(b.elements.get('constructor-design-summary').textContent,/повторяются/);numbers[1].value='200';numbers[1].emit('input');assert.match(b.elements.get('constructor-design-summary').textContent,/Сочетаний на seed: 4/);assert.equal(b.elements.get('constructor-run').disabled,false);
 await b.elements.get('constructor-run').click();for(let i=0;i<4;i++)b.done(b.workers[i]);await b.flush();assert.equal(b.workers.length,4);assert.deepEqual(b.workers.map(w=>{const o=w.sent[0].job.worldOptions;return [o.learning,o.reproduction.birthInterval,o.terrainSeed];}),[[true,100,42],[true,200,42],[false,100,42],[false,200,42]]);
 descendants(factors,n=>n.tagName==='button'&&n.textContent==='×')[1].click();numbers=descendants(factors,n=>n.type==='number');assert.equal(numbers.length,1);assert.match(b.elements.get('constructor-design-summary').textContent,/Сочетаний на seed: 2/);
 }finally{b.restore();}
});
test('scheme expands lazily, preserves open branches on value edits and contains no numeric factor values',()=>{
 const b=boot();try{
 const d=installExperimentDesign({readCommon:()=>({}),onChange:()=>{}});d.write([{key:'learning',values:[true,false]},{key:'reproduction.maturity',values:[90,120]}]);assert.equal(d.preview({worlds:2,seeds:[42,17]}),true);
 const tree=b.elements.get('constructor-design-tree'),first=tree.children[0];assert.equal(tree.children.length,2);assert.equal(first.children[1].children.length,0);first.open=true;first.emit('toggle');assert.equal(first.children[1].children.length,2);
 const branch=first.children[1].children[0].children[0];branch.open=true;branch.emit('toggle');assert.equal(branch.children[1].children.length,2);assert.ok(descendants(tree,n=>n.tagName==='summary').every(n=>!n.textContent.includes('90')&&!n.textContent.includes('120')));
 const input=descendants(b.elements.get('constructor-factors'),n=>n.type==='number')[0];input.value='100';assert.equal(d.preview({worlds:2,seeds:[42,17]}),true);assert.equal(tree.children[0],first);
 d.write([{key:'reproduction.maturity',values:Array.from({length:65},(_,i)=>i+1)}]);assert.equal(d.preview({worlds:2,seeds:[42,17]}),false);assert.match(b.elements.get('constructor-design-summary').textContent,/65.*64/);assert.equal(tree.children.length,0);
 }finally{b.restore();}
});
test('old plans are rejected without replacing the editor',async()=>{
 const b=boot();try{const picker=b.elements.get('constructor-factor-add');picker.value='memory';picker.emit('change');const file=b.elements.get('constructor-import-plan');file.files=[{size:100,text:async()=>JSON.stringify({format:'big-evolution-experiment-plan',version:1,plan:{variants:[{name:'old'}]}})}];await file.emit('change');assert.match(b.elements.get('constructor-error').textContent,/Старые планы/);assert.equal(b.elements.get('constructor-factors').children.length,1);}finally{b.restore();}
});

test('lifecycle notifications are modal and acknowledge without changing world state',async()=>{
 const b=boot();try{
  for(const [id,value]of [['worlds','1'],['steps','1'],['budget','1']])b.elements.get('constructor-'+id).value=value;b.elements.get('constructor-worlds').emit('change');
  const dialog=b.elements.get('experiment-notification-dialog'),message=b.elements.get('experiment-notification-body');
  await b.elements.get('constructor-run').click();assert.equal(dialog.open,true);assert.match(message.textContent,/приостановлен.*начаты/);assert.equal(b.state.running,false);
  b.elements.get('experiment-notification-close').click();assert.equal(dialog.open,false);assert.equal(b.state.running,false);
  b.done(b.workers[0]);await b.flush();assert.equal(dialog.open,true);assert.match(message.textContent,/завершены.*продолжает/);assert.equal(b.state.running,true);assert.equal(dialog.shown,2);
  b.elements.get('experiment-notification-close').click();assert.equal(b.calls.resume,1);
  assert.equal(b.toolbar.afterNode,undefined,'Lifecycle messages must not create a persistent banner above the page.');
 }finally{b.restore();}
});

test('variant cells contain all their worlds, retain DOM on progress and disclose failed attempts',()=>{
 const elements=new Map(['constructor-results','constructor-results-prev','constructor-results-next','constructor-results-page'].map(id=>[id,new Element()])),calls=[];
 const root={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},ui=installExperimentRuns({root,openAttempt:id=>calls.push(id),openVariant:id=>calls.push(id)});
 const report={plan:{steps:100,seeds:[42,7],variants:[{id:'a',name:'Обучение: вкл',settings:{terrainSeed:42,foodSeed:42}},{id:'b',name:'Обучение: выкл',settings:{terrainSeed:42,foodSeed:42}}]},groups:['a','b'].flatMap(variantId=>[0,1].map(index=>({id:variantId+index,variantId,index,status:'pending',attempts:[]})))};
 ui.render(report);const grid=elements.get('constructor-results'),first=grid.children[0],g=report.groups[0];assert.equal(grid.children.length,2);assert.equal(descendants(first,n=>n.tagName==='tr').length,3);
 g.status='running';g.attempts.push({id:'a0-1',number:1,seed:42,status:'completed',tick:20,extinct:true},{id:'a0-2',number:2,seed:99,status:'running',tick:12});ui.render(report);
 assert.equal(grid.children[0],first);assert.match(descendants(first,n=>n.tagName==='small')[0].textContent,/99/);assert.match(first.children[2].textContent,/вымираний 1/);
 const details=descendants(first,n=>n.tagName==='details')[0];details.open=true;details.emit('toggle');assert.equal(details.children[1].children.length,2);assert.match(details.children[1].children[0].textContent,/42.*вымирание/);
 g.attempts[1].tick=30;ui.render(report);assert.equal(details.open,true);assert.equal(descendants(first,n=>n.tagName==='details')[0],details);assert.match(details.children[1].children[1].textContent,/30.0/);
 g.status='completed';g.selectedId='a0-2';Object.assign(g.attempts[1],{status:'completed',tick:100,lives:{}});ui.render(report);
 descendants(first,n=>n.tagName==='button'&&n.textContent==='Смотреть')[0].click();first.children[3].click();assert.deepEqual(calls,['a0-2','a']);assert.match(details.children[1].children[1].textContent,/выбрана для итогов/);
 assert.match(environmentSeedText({}),/Карта: seed жителей/);assert.match(environmentSeedText({terrainSeed:17,foodSeed:23}),/17.*23/);
});

test('runs paginate combinations, bound visible rows and reset when another report is opened',()=>{
 const elements=new Map(['constructor-results','constructor-results-prev','constructor-results-next','constructor-results-page'].map(id=>[id,new Element()]));
 const root={getElementById:id=>elements.get(id),createElement:tag=>new Element(tag)},ui=installExperimentRuns({root,openAttempt(){},openVariant(){}});
 const report={plan:{steps:10,seeds:[42],variants:Array.from({length:64},(_,i)=>({id:'v'+i,name:'Условия '+i,settings:{}}))},groups:[]};
 report.groups=report.plan.variants.map(v=>({variantId:v.id,index:0,status:'pending',attempts:[]}));ui.render(report);assert.equal(elements.get('constructor-results').children.length,6);assert.equal(elements.get('constructor-results-prev').disabled,true);
 for(let i=0;i<10;i++)elements.get('constructor-results-next').click();assert.equal(elements.get('constructor-results').children.length,4);assert.equal(elements.get('constructor-results-next').disabled,true);assert.match(elements.get('constructor-results-page').textContent,/61–64/);
 ui.render({...report});assert.equal(elements.get('constructor-results').children.length,6);assert.equal(elements.get('constructor-results-prev').disabled,true);
});

test('archive import is atomic, loads requested birth periods and exports all observations',async()=>{
 const plan=validatePlan({worlds:1,seeds:[42],steps:2000,factors:[]}),v=plan.variants[0],id=v.id+'-0',rows=[0,600,1200].map((born,i)=>({id:i+1,born,age:10,endTick:born+10,parentId:null,status:'dead',cause:'age',meanEnergy:i}));
 const original={format:'big-evolution-experiment',version:1,createdAt:'2026-10-20T12:00:00.000Z',status:'completed',plan,groups:[{id,variantId:v.id,index:0,status:'completed',selectedId:id+'-1',attempts:[{id:id+'-1',number:1,seed:plan.seedMatrix[0][0],tick:2000,status:'completed',lives:{tick:2000,dead:rows,living:[],completed:{count:3,meanAge:10,medianAge:10},byCause:{age:{count:3}},omittedDetails:0}}]}]};
 const archive=await experimentArchive(original,{yieldControl:async()=>{}}),b=boot({realTimers:true});
 try{
  const input=b.elements.get('constructor-import-report');input.files=[archive];await input.emit('change');assert.equal(b.elements.get('constructor-error').textContent,'');
  b.elements.get('constructor-open-comparison').click();const context=b.ui.comparisons(),header=context.variants[0].worlds[0].report;assert.ok(archiveOrigin(header));assert.equal(header.dead.length,0);
  await b.ui.prepareStatistics({start:500,end:1000,width:100,curveStart:500});assert.deepEqual(b.ui.getSimulation().lives.dead.map(r=>r.originalId),[2]);assert.equal(b.ui.getSimulation().lives.completed.count,3);
  const before=b.ui.getSimulation().lives;input.files=[new Blob(['broken'])];await input.emit('change');assert.equal(b.ui.getSimulation().lives,before);assert.match(b.elements.get('constructor-export-state').textContent,/не открыт/);
  input.files=[];const error=b.elements.get('constructor-error').textContent;await input.emit('change');assert.equal(b.elements.get('constructor-error').textContent,error);
  const observations=await b.ui.exportObservation();assert.deepEqual(observations.dead.map(r=>r.originalId),[1,2,3]);assert.equal(observations.completed.count,3);
 }finally{b.restore();}
});
test('pinned windows outside the dashboard period load only their union and reuse normalized windows',async()=>{
 const plan=validatePlan({worlds:1,seeds:[42],steps:2000,factors:[]}),v=plan.variants[0],id=v.id+'-0',rows=[0,600,1200,1800].map((born,i)=>({id:i+1,parentId:null,born,age:10,status:'dead',cause:'age'})),report={format:'big-evolution-experiment',version:1,createdAt:'2026-10-23T12:00:00.000Z',status:'completed',plan,groups:[{id,variantId:v.id,index:0,status:'completed',selectedId:id+'-1',attempts:[{id:id+'-1',number:1,seed:plan.seedMatrix[0][0],tick:2000,status:'completed',lives:{tick:2000,dead:rows,living:[],completed:{count:4,meanAge:10,medianAge:10},byCause:{age:{count:4}},omittedDetails:0}}]}]};
 const b=boot({realTimers:true});try{b.elements.get('constructor-import-report').files=[await experimentArchive(report)];await b.elements.get('constructor-import-report').emit('change');b.elements.get('constructor-open-comparison').click();await b.ui.prepareStatistics({start:500,end:1000,width:100,curveStart:500,windows:[[1200,1300]]});const first=b.ui.getSimulation().lives;assert.deepEqual(first.dead.map(r=>r.originalId),[2,3]);const ready=b.ui.prepareStatistics({start:500,end:1000,width:100,curveStart:500,windows:[[1200,1300],[550,600]]});assert.equal(ready,null);assert.equal(b.ui.getSimulation().lives,first);assert.throws(()=>b.ui.prepareStatistics({start:500,end:1000,width:100,windows:[[1300,1200]]}),/период/);
 }finally{b.restore();}
});
test('common grouping reaches native graphs and pair sources; empty filters remain visible and do not reset the period',async()=>{
 const plan=validatePlan({worlds:2,seeds:[42,7],steps:100,factors:[{key:'learning',values:[true,false]},{key:'digestionTime',values:[2,5,20]}]}),report={format:'big-evolution-experiment',version:1,createdAt:'2026-10-23T12:00:00.000Z',status:'completed',plan,groups:plan.variants.flatMap(v=>Array.from({length:2},(_,index)=>{const id=v.id+'-'+index;return {id,variantId:v.id,index,status:'completed',selectedId:id+'-1',attempts:[{id:id+'-1',number:1,seed:plan.seedMatrix[index][0],tick:100,status:'completed',lives:{tick:100,dead:[{id:1,parentId:null,born:0,age:20,status:'dead'}],living:[],completed:{count:1,meanAge:20,medianAge:20},byCause:{},omittedDetails:0}}]};}))};
 const b=boot({realTimers:true});try{const input=b.elements.get('constructor-import-report');input.files=[await experimentArchive(report)];await input.emit('change');b.elements.get('constructor-open-comparison').click();await b.ui.prepareStatistics({start:0,end:100,width:100});assert.equal(b.ui.comparisons().sources.length,6);
  const host=b.elements.get('history-group-controls'),select=descendants(host,n=>n.tagName==='select')[0];select.value='learning';select.emit('change');assert.equal(b.calls.resets.at(-1),false);const comparison=b.ui.comparisons();assert.equal(comparison.sources.length,2);assert.ok(comparison.sources.every(s=>s.report.dead.length===6));assert.ok(comparison.variants.every(s=>s.worlds.length===6&&s.worlds[0].blockDesign));
  const field=descendants(host,n=>n.tagName==='fieldset')[0],checks=descendants(field,n=>n.type==='checkbox');for(const n of checks)n.checked=false;checks[0].emit('change');assert.equal(b.ui.getSimulation().lives.dead.length,0);assert.match(b.elements.get('experiment-stat-note').textContent,/Фильтры исключили/);
 }finally{b.restore();}
});
