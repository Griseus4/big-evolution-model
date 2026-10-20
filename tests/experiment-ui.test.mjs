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
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.checked=false;this.textContent='';this.style={};this.files=[];}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}if(this.tagName==='select'&&!this.value)this.value=String(nodes[0]?.value??'');}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(){}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 after(node){this.afterNode=node;}
 showModal(){this.open=true;this.shown=(this.shown??0)+1;}
 close(){this.open=false;}
 click(){return this.listeners.click?.({target:this});}
 emit(name){return this.listeners[name]?.({target:this});}
}
function boot({running=true,pauseError=false}={}){
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map(),workers=[],intervals=[];
 for(const m of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Element(m[1]);node.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]??'';elements.set(m[2],node);}
 for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const first=m[2].match(/<option[^>]*value="([^"]+)"/);if(first)elements.get(m[1]).value=first[1];}
 const state={running,epoch:1},calls={pause:0,resume:0,source:0,statistics:0},toolbar=new Element();
 globalThis.document={getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);},createElement:tag=>new Element(tag),querySelector:()=>toolbar};
 globalThis.Worker=class{constructor(){this.sent=[];workers.push(this);}postMessage(m){this.sent.push(m);}terminate(){this.closed=true;}};
 const oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval,oldTimeout=globalThis.setTimeout;
 globalThis.fetch=async()=>({ok:true,json:async()=>({sourceFingerprint:'test'})});globalThis.setInterval=fn=>{intervals.push(fn);return 0;};globalThis.setTimeout=()=>0;
 const ui=installExperimentUI({getSimulation:()=>({lives:{tick:77}}),getWorldState:()=>({...state}),pauseWorld:async()=>{calls.pause++;if(pauseError)throw new Error('pause failed');state.running=false;},resumeWorld:async previous=>{assert.equal(previous.epoch,state.epoch);calls.resume++;state.running=true;},sourceChanged:()=>calls.source++,openStatistics:()=>calls.statistics++});
 const done=(worker,status='completed')=>worker.onmessage({data:{type:'done',jobId:worker.sent.find(m=>m.type==='run').job.id,result:{status,modelVersion:MODEL_VERSION,tick:1,extinct:false,lives:{tick:1,dead:[],living:[],completed:{count:0,meanAge:null,medianAge:null},byCause:{}}}}});
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 return {ui,elements,workers,state,calls,intervals,done,flush,restore(){globalThis.fetch=oldFetch;globalThis.setInterval=oldInterval;globalThis.setTimeout=oldTimeout;}};
}
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
 const b=boot({running:false});try{b.elements.get('constructor-worlds').value='1';b.elements.get('constructor-worlds').emit('change');await b.elements.get('constructor-run').click();assert.equal(b.ui.isActive(),true);b.elements.get('constructor-force-stop').click();await b.flush();assert.equal(b.calls.resume,0);assert.equal(b.ui.isActive(),false);assert.ok(b.workers.every(w=>w.closed));}finally{b.restore();}
 const f=boot({pauseError:true});try{await f.elements.get('constructor-run').click();await f.flush();assert.equal(f.workers.length,0);assert.equal(f.ui.isActive(),false);assert.match(f.elements.get('constructor-error').textContent,/pause failed/);}finally{f.restore();}
});
test('persistence writes immutable completed attempts once and marks interrupted metadata honestly',async()=>{
 const store=new ExperimentStore(null),tables=new Map(['runs','attempts','templates'].map(k=>[k,new Map()]));let writes=0;
 store.transaction=async(name,mode,action)=>{const table=tables.get(name);const result=action({put:(value,key)=>{writes++;table.set(key,structuredClone(value));return {result:key};},get:key=>({result:structuredClone(table.get(key))}),getAll:()=>({result:[...table.values()].map(structuredClone)}),delete:key=>{table.delete(key);return {};}});return result.result;};
 const report={createdAt:'test',status:'running',groups:[{id:'g',attempts:[{id:'g-1',status:'completed',tick:3,lives:{dead:[{id:1}]}},{id:'g-2',status:'running',tick:4}]}]};
 await store.save(report);assert.equal(writes,2);await store.save(report);assert.equal(writes,3);const loaded=await store.load('test');assert.equal(loaded.status,'interrupted');assert.equal(loaded.groups[0].attempts[1].status,'interrupted');assert.equal(loaded.groups[0].attempts[0].lives.dead.length,1);
 await store.delete('test');assert.equal(tables.get('runs').size,0);assert.equal(tables.get('attempts').size,0);
});
const descendants=(node,predicate)=>node.children.flatMap(n=>[...(predicate(n)?[n]:[]),...descendants(n,predicate)]);
test('common table is fully visible; boolean factors default to both states and never duplicate rows',()=>{
 const b=boot();try{
 const common=b.elements.get('constructor-common');assert.equal(common.children[0].tagName,'table');assert.equal(common.children[0].children[0].children.length,5);assert.equal(descendants(common,n=>n.tagName==='details').length,0);
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
