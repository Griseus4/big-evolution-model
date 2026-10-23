import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {chartSettings,validateChartPins,chartContext,chartContextKey,normalizeChartWindows,chartPinLabel} from '../dist/chart-context.js';
import {emptyCatalogue,validateCatalogue} from '../dist/chart-catalogue.js';
import {ANALYSIS_DEFAULT} from '../dist/analysis-builder-core.js';
import {createCatalogueExpressionClient} from '../dist/catalogue-expression-client.js';
import {createStatisticsClient} from '../dist/statistics-client.js';
import {createPairStatisticsClient} from '../dist/pair-statistics-client.js';
import {createLocalChartRenderer} from '../dist/chart-local-renderer.js';
import {installChartCatalogue} from '../dist/chart-catalogue-ui.js';
const common={start:0,end:50,width:10,origin:'all',mode:'dead',survivalAge:20,interruptionKind:'all',curveStart:5};
const record=(id,born,age,extra={})=>({id,born,age,parentId:null,status:'dead',meanEnergy:age,...extra});
const report={tick:200,dead:[record(1,0,10),record(2,100,80)],living:[record(3,100,20,{status:'alive',parentId:1})],omittedDetails:0};
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw new Error('Worker result timeout');}
class BrowserWorker{
 constructor(url){this.worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(String(url))}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',e=>this.onerror?.({message:e.message}));}
 postMessage(m,transfer){this.worker.postMessage(m,transfer);}terminate(){this.worker.terminate();}
}
class Element{
 constructor(tag='div',text=''){this.tagName=tag;this.children=[];this.textContent=text;this.value='';this.hidden=false;this.style={};this.listeners={};this.attributes={};}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}if(this.tagName==='select'&&!this.value)this.value=nodes[0]?.value??'';}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,fn){this.listeners[k]=fn;}emit(k){return this.listeners[k]?.({preventDefault(){},target:this});}focus(){this.focused=true;}
 getContext(){return null;}getBoundingClientRect(){return {width:600};}
}
const walk=n=>[n,...n.children.flatMap(walk)];
test('pins override only their own setting, can be removed, and preserve independent curve semantics',()=>{
 const def={kind:'expression',pins:{period:{start:100,end:130},mode:'observed'}},ctx=chartContext(def,common);assert.deepEqual([ctx.start,ctx.end,ctx.mode,ctx.width,ctx.origin],[100,130,'observed',10,'all']);assert.equal(chartContextKey(chartContext({...def,pins:{}},common)),chartContextKey(common));assert.equal(common.start,0);
 assert.deepEqual(chartSettings({kind:'metric',metric:'population'}),['width']);assert.ok(!chartSettings({kind:'metric',metric:'lifetime'}).includes('mode'));assert.ok(!chartSettings({kind:'histogram'}).includes('width'));
 const curve=chartContext({kind:'curve'},common);assert.equal(curve.start,5);assert.equal(curve.end,15);const pinned=chartContext({kind:'curve',pins:{period:{start:100,end:130}}},common);assert.equal(pinned.end-pinned.start,30);assert.match(chartPinLabel(def),/100; 130/);
});
test('catalogue v1 inherits the panel, v2 retains pins, invalid/imported overrides are rejected atomically',()=>{
 const chart={id:'user-a',name:'A',kind:'expression',category:'resources',recipe:ANALYSIS_DEFAULT},old=validateCatalogue({version:1,categories:[],charts:[chart],hidden:[]});assert.equal(old.version,2);assert.equal(old.charts[0].pins,undefined);
 const next=validateCatalogue({...old,charts:[{...old.charts[0],pins:{period:{start:100,end:200},width:20,origin:'founders',mode:'observed'}}]});assert.deepEqual(validateCatalogue(JSON.parse(JSON.stringify(next))),next);
 for(const pins of [{width:0},{period:{start:5,end:4}},{period:{start:0,end:1.5}},{mode:'all'},{origin:'unknown'},{learning:false}])assert.throws(()=>validateChartPins(pins,chart));
 assert.throws(()=>validateChartPins({period:{start:0,end:10}},{kind:'metric',metric:'food'}));assert.equal(old.charts[0].pins,undefined);
 assert.deepEqual(normalizeChartWindows([[120,130],[0,50],[10,20],[50,60],[120,130]]),[[0,60],[120,130]]);assert.throws(()=>normalizeChartWindows([[NaN,5]]));
});
test('compact editor replaces formula, shows only applicable fields and persists/removes pins',async()=>{
 const previous=globalThis.localStorage,store=new Map(),host=new Element(),toolbar=new Element(),root={createElement:t=>new Element(t),getElementById:id=>id==='history-builder-screen'?host:toolbar};globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 try{const ui=installChartCatalogue({root,getCommon:()=>common});ui.edit();let nodes=walk(host),field=name=>nodes.find(n=>n.name==='catalogue-'+name),formula=field('expression');formula.value='age + 100';const select=nodes.find(n=>n.attributes['aria-label']==='Поля для формулы');select.value='children';nodes.find(n=>n.textContent==='Заменить формулу выбранным полем').emit('click');assert.equal(formula.value,'children');
  field('axis').value='born';field('axis').emit('change');assert.equal(field('maxChild').parent.hidden,true);field('axis').value='child';field('axis').emit('change');assert.equal(field('maxChild').parent.hidden,false);
  let add=field('pin-add');add.value='mode';add.emit('change');let mode=walk(host).find(n=>n.name==='pin-mode');mode.value='observed';await nodes.find(n=>n.tagName==='form').emit('submit');assert.equal(ui.state().charts[0].pins.mode,'observed');assert.equal(JSON.parse(store.get('big-evolution-chart-catalogue-v2')).version,2);
  const firstId=ui.state().charts[0].id;ui.edit();nodes=walk(host);nodes.find(n=>n.name==='catalogue-name').value='Вторая карточка';await nodes.find(n=>n.tagName==='form').emit('submit');ui.edit(ui.state().charts[0]);nodes=walk(host);nodes.find(n=>n.textContent==='Использовать общую настройку').emit('click');await nodes.find(n=>n.tagName==='form').emit('submit');assert.equal(ui.state().charts[0].pins,undefined);assert.equal(ui.state().charts[0].id,firstId);assert.equal(ui.state().charts[1].name,'Вторая карточка');
  ui.edit();nodes=walk(host);field('type').value='metric:food';field('type').emit('change');assert.equal(field('expression').parent.hidden,true);assert.equal(walk(host).find(n=>n.name==='catalogue-pin-add').children.length,2);
  const before=JSON.stringify(ui.state()),file=walk(toolbar).find(n=>n.type==='file');file.files=[{size:20,text:async()=>JSON.stringify({...emptyCatalogue(),format:'big-evolution-chart-catalogue',charts:[{...ui.state().charts[0],pins:{width:-1}}]})}];await file.emit('change');assert.equal(JSON.stringify(ui.state()),before);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});
test('one real formula Worker routes different pinned contexts without double-feeding engines',async()=>{
 let count=0;const client=createCatalogueExpressionClient({createWorker:()=>{count++;return new BrowserWorker(new URL('../dist/analysis-builder-worker.js',import.meta.url));}});
 const def=(id,pins)=>({definition:{id,name:id,kind:'expression',recipe:{...ANALYSIS_DEFAULT,expression:'age',aggregate:'mean'},pins}}),cards=[def('global',{}),def('pinned',{period:{start:100,end:150},mode:'observed'}),def('copy',{period:{start:100,end:150},mode:'observed'})];
 try{client.update({cards,report,options:common,start:0,end:50});await until(()=>client.get('copy'));assert.equal(client.get('global').cells[0].value,10);const cells=client.get('pinned').cells.filter(c=>c.value!==null);assert.equal(cells.length,1);assert.equal(cells[0].value,50);assert.equal(cells[0].count,2);assert.deepEqual(client.get('copy').cells.map(c=>c.value),client.get('pinned').cells.map(c=>c.value));assert.equal(client.get('copy').cells,client.get('pinned').cells);assert.equal(count,1);cards[2].definition.name='Новое имя';cards[2].definition.recipe.chart='bar';client.update({cards,report,options:common,start:0,end:50});assert.equal(count,1);assert.equal(client.get('copy').config.name,'Новое имя');assert.equal(client.get('copy').config.chart,'bar');assert.equal(client.get('global').config.chart,'line');}finally{client.dispose();}
});
test('one real statistics Worker distinguishes same metric across contexts and caches redraws',async()=>{
 let count=0;const client=createStatisticsClient({available:()=>true,createWorker:()=>{count++;return new BrowserWorker(new URL('../dist/statistics-worker.js',import.meta.url));}}),sources=[{id:'s',report}],queries=[{id:'early',sources,metrics:['lifetime'],options:common,start:0,end:50},{id:'late',sources,metrics:['lifetime'],options:common,start:100,end:150}];
 try{client.updateBatch(queries);await until(()=>client.get('s','lifetime','late'));assert.equal(client.get('s','lifetime','early').summary.mean,10);assert.equal(client.get('s','lifetime','late').summary.mean,80);client.updateBatch(queries);assert.equal(count,1);}finally{client.dispose();}
});
test('one real pair Worker retains B−A for multiple pinned contexts',async()=>{
 const a={id:'a',worlds:[{id:'a0',pairId:0,report}]},b={id:'b',worlds:[{id:'b0',pairId:0,report:{...report,dead:[record(1,0,20),record(2,100,100)]}}]};let count=0;
 const client=createPairStatisticsClient({available:()=>true,createWorker:()=>{count++;return new BrowserWorker(new URL('../dist/pair-statistics-worker.js',import.meta.url));}}),queries=[{id:'early',a,b,metrics:['lifetime'],options:{...common,start:0,end:50}},{id:'late',a,b,metrics:['lifetime'],options:{...common,start:100,end:150},series:true}];
 try{client.updateBatch(queries);await until(()=>client.get('lifetime','late'));assert.equal(client.get('lifetime','early').result.mean.difference,10);assert.equal(client.get('lifetime','late').result.mean.difference,20);assert.equal(client.get('lifetime','late').points[0].mean.difference,20);assert.equal(count,1);}finally{client.dispose();}
});
test('native copies share context jobs through redraws and separate only differing filters',async()=>{
 const previous=globalThis.Worker;let workers=0;globalThis.Worker=class extends BrowserWorker{constructor(url){super(url);workers++;}};
 const root={createElement:t=>new Element(t),getElementById:()=>new Element()},make=(id,pins)=>({definition:{id,kind:'metric',metric:'energy',pins},m:{id:'energy',unit:'энергия',label:id},card:new Element(),canvas:new Element(),note:new Element()}),cards=[make('a',{mode:'observed'}),make('b',{mode:'observed'}),make('c',{mode:'observed',origin:'founders'})];let frames=0,input;
 const renderer=createLocalChartRenderer({root,onChange:()=>{frames++;renderer.update(input);}});input={cards,common:{...common,start:100,end:150},report,pair:null,bandMode:'confidence',legend:new Set(['mean']),curveMaximum:100};
 try{renderer.update(input);await until(()=>frames>=2&&cards.every(c=>c.note.textContent.startsWith('Нажми')));assert.equal(workers,1);assert.ok(cards.every(c=>renderer.isLocal(c)));assert.ok(walk(cards[0].numeric).some(n=>n.textContent==='50,0'));assert.ok(walk(cards[2].numeric).some(n=>n.textContent==='80,0'));renderer.update(input);assert.equal(workers,1);
  input={...input,common:{...input.common,mode:'observed'}};renderer.update(input);assert.equal(renderer.isLocal(cards[0]),false);assert.equal(renderer.isLocal(cards[2]),true);cards[2].definition.pins.period={start:300,end:350};renderer.update(input);await until(()=>cards[2].note.textContent.startsWith('Нет данных'));
 }finally{renderer.dispose();if(previous===undefined)delete globalThis.Worker;else globalThis.Worker=previous;}
});
