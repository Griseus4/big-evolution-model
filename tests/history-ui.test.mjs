/** Настоящие модули UI/Canvas с управляемым DOM. Реальные клики/вид проверяются
 * дополнительно в браузере; здесь проверяются данные, выбор и ограничение DOM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIFE_METRICS} from '../dist/life-cohorts.js';
import {installHistoryUI} from '../dist/history-ui.js';
import {installHistoryDrawers} from '../dist/history-drawers.js';
import {createAnalysisEngine} from '../dist/analysis-builder-core.js';
import {estimateWorlds} from '../dist/statistics-estimates.js';
import {LIFE_OBSERVATION_SCHEMA} from '../dist/life-observations.js';
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.checked=true;this.textContent='';this.hidden=false;this.attributes={};this.style={setProperty:(k,v)=>{this.attributes[k]=v;}};}
 append(...children){this.children.push(...children);for(const child of children)child.parent=this;if(this.tagName==='select'&&!this.value)this.value=this.children[0]?.value??'';}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 replaceChildren(...children){this.children=[];this.append(...children);}
 addEventListener(key,fn){this.listeners[key]=fn;}
 setAttribute(k,v){this.attributes[k]=v;}
 focus(){this.focused=true;}
 emit(key,event={}){return this.listeners[key]?.({target:this,preventDefault(){},...event});}
 getBoundingClientRect(){return {width:600,left:0,height:this.height??72};}
 getContext(){return {setTransform(){},clearRect:()=>{this.clears=(this.clears??0)+1;},beginPath(){},moveTo(...v){assert.ok(v.every(Number.isFinite));},lineTo(...v){assert.ok(v.every(Number.isFinite));},stroke(){},fill(){},fillRect(...v){assert.ok(v.every(Number.isFinite));},arc(...v){assert.ok(v.every(Number.isFinite));},setLineDash(){},fillText:t=>{(this.labels??=[]).push(String(t));}};}
}
function boot({prepareSimulation=()=>null,canPrepare=()=>false,getComparisons=()=>null}={}){
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map(),created=[];
 for(const m of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]),value=m[0].match(/\bvalue="([^"]*)"/);if(value)e.value=value[1];elements.set(m[2],e);}
 for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const options=[...m[2].matchAll(/<option\b([^>]*)value="([^"]+)"([^>]*)>/g)],chosen=options.find(o=>/selected/.test(o[1]+o[3]))??options[0];if(chosen)elements.get(m[1]).value=chosen[2];}
 const rows=Array.from({length:125},(_,i)=>({id:i+1,parentId:i%2?1:null,founderId:1,generation:i%2,born:i,age:20,status:'dead',observedSteps:20,moved:i,eaten:2,hungerSteps:1,meanEnergy:60,cause:'starvation'}));
 const report={tick:300,dead:rows,living:[],omittedDetails:0,completed:{count:125,meanAge:20,medianAge:20},byCause:{starvation:{count:125}},foodAvailability:{schema:'ground-food-exposure-v1',prefix:Float64Array.from({length:301},(_,i)=>i*100),substeps:0,partialSum:0}};
 const toolbar=new Element(),sim={tick:300,lives:report},root={getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);},querySelector:selector=>selector==='.global-toolbar'?toolbar:null,createElement:tag=>{const e=new Element(tag);created.push(e);return e;}};
 const ui=installHistoryUI({root,getSimulation:()=>sim,prepareSimulation,canPrepare,getComparisons});return {elements,created,ui,sim,toolbar};
}

test('comparison hover, point selection and B−A never restore chart captions; numeric tables remain',async()=>{
 const original=globalThis.Worker;
 globalThis.Worker=class{postMessage(m){setTimeout(()=>{if(!this.closed)this.onmessage?.({data:{request:m.request,owner:m.owner,scope:m.scope,metric:m.prepared?.metric??m.metric,points:[],summary:{mean:1,median:1,worlds:1},result:{pairs:1,mean:{difference:1}}}});},0);}terminate(){this.closed=true;}};
 let b;try{
  b=boot({getComparisons:()=>{const variants=['a','b'].map((id,i)=>({id,name:'Вариант '+id,color:i?'#dfc98c':'#86bf80',worlds:[{id,pairId:0,report:b.sim.lives}]}));return {variants,sources:variants.map(v=>({...v,report:b.sim.lives})),statistic:'mean',weightMode:'worlds'};}});b.ui.refresh();
  const canvas=b.created.find(n=>n.id==='history-chart-lifetime'),card=canvas.parent,walk=n=>[n,...n.children.flatMap(walk)],message=b.created.find(n=>n.id==='history-note-lifetime');
  for(let i=0;i<100&&!walk(card).some(n=>n.className==='history-numeric-summary'&&n.children.length);i++)await new Promise(r=>setTimeout(r,4));
  assert.equal(message.textContent,'');canvas.emit('pointermove',{clientX:200});assert.equal(message.textContent,'');canvas.emit('click',{clientX:200});canvas.emit('keydown',{key:'ArrowRight'});assert.equal(message.textContent,'');assert.ok(walk(card).some(n=>n.tagName==='table'));
  const select=walk(card).find(n=>n.tagName==='select');select.value='difference';select.emit('change');await new Promise(r=>setTimeout(r,15));canvas.emit('pointermove',{clientX:300});canvas.emit('keydown',{key:'Home'});assert.equal(message.textContent,'');assert.ok(walk(card).some(n=>n.tagName==='table'));
 }finally{b?.ui.reset();globalThis.Worker=original;}
});

test('paused dashboard warms a hidden category and reopening it reuses its numerical answer',async()=>{
 const original=globalThis.Worker,requested=[];let stable=false;
 globalThis.Worker=class {postMessage(m){requested.push(m.prepared.metric);setTimeout(()=>{if(!this.closed)this.onmessage?.({data:{request:m.request,owner:m.owner,metric:m.prepared.metric,summary:{mean:1,median:1,worlds:1},points:[]}});},2);}terminate(){this.closed=true;}};
 const b=boot({canPrepare:()=>stable});try{b.ui.refresh();await new Promise(r=>setTimeout(r,220));assert.ok(!requested.includes('movement'));stable=true;b.ui.refresh(true);for(let i=0;i<100&&!requested.includes('movement');i++)await new Promise(r=>setTimeout(r,30));assert.ok(requested.includes('movement'));await new Promise(r=>setTimeout(r,20));const before=requested.filter(m=>m==='movement').length;b.elements.get('history-display').value='behavior';b.elements.get('history-display').emit('change');await new Promise(r=>setTimeout(r,20));assert.equal(requested.filter(m=>m==='movement').length,before);stable=false;b.ui.activity();b.ui.reset();}finally{b.ui.reset();globalThis.Worker=original;}
});

test('live snapshots finish the displayed batch, retain canvas/numbers while pending and skip intermediate reports',async()=>{
 const original=globalThis.Worker,workers=[],messages=[];
 globalThis.Worker=class{constructor(){workers.push(this);}postMessage(m){messages.push({worker:this,message:m});}terminate(){this.closed=true;}};
 const wait=()=>new Promise(r=>setTimeout(r,2)),reply=entry=>{const {worker:w,message:m}=entry,s={mean:20,median:20,worlds:1,confidence:null};w.onmessage({data:{request:m.request,owner:m.owner,metric:m.prepared.metric,summary:s,points:m.prepared.points.map(p=>({...p,...s}))}});},b=boot();let read=0;
 const drain=async()=>{for(let turn=0;turn<50;turn++){await wait();if(read>=messages.length)break;reply(messages[read++]);}await wait();};
 try{
  b.ui.refresh();await drain();const canvas=b.created.find(e=>e.id==='history-chart-lifetime'),card=canvas.parent,numeric=card.children.find(e=>e.className==='history-numeric-summary'),oldNodes=numeric.children;
  assert.ok(oldNodes.length);const clears=canvas.clears;b.sim.lives={...b.sim.lives,tick:301};b.ui.refresh();
  const active=messages[read].worker,count=workers.length,accepted=b.elements.get('history-summary').textContent;
  assert.equal(canvas.clears,clears);assert.equal(numeric.children,oldNodes);assert.equal(card.attributes['aria-busy'],'true');
  for(let tick=302;tick<=310;tick++){b.sim.lives={...b.sim.lives,tick};b.ui.refresh();}
  assert.equal(workers.length,count);assert.equal(active.closed,undefined);assert.equal(canvas.clears,clears);assert.equal(numeric.children,oldNodes);assert.equal(b.elements.get('history-summary').textContent,accepted);
  // Завершаем ровно текущую партию: новая берёт последний, а не каждый снимок.
  const beforeNew=workers.length;for(let turn=0;turn<30&&workers.length===beforeNew;turn++){if(read<messages.length)reply(messages[read++]);await wait();}
  assert.equal(workers.length,beforeNew+1);assert.match(b.elements.get('history-summary').textContent,/шаг 310/);assert.ok(!messages.some(e=>e.worker.closed&&e.worker!==workers[0]&&e.worker!==active));
  await drain();assert.equal(card.attributes['aria-busy'],'false');assert.notEqual(numeric.children,oldNodes);assert.ok(canvas.clears>clears);
 }finally{b.ui.reset();globalThis.Worker=original;}
});
test('returning to a live dashboard flushes finished hidden results; changing a filter cancels obsolete work immediately',async()=>{
 const original=globalThis.Worker,workers=[],messages=[],wait=()=>new Promise(r=>setTimeout(r,2));
 globalThis.Worker=class{constructor(){workers.push(this);}postMessage(m){messages.push({w:this,m});}terminate(){this.closed=true;}};
 const b=boot();let read=0;try{
  b.ui.refresh();b.sim.lives={...b.sim.lives,tick:301};b.ui.refresh();b.elements.get('panel-history').hidden=true;
  for(let turn=0;turn<30;turn++){await wait();if(read>=messages.length)break;const {w,m}=messages[read++];w.onmessage({data:{request:m.request,owner:m.owner,metric:m.prepared.metric,summary:{mean:20,median:20,worlds:1},points:[]}});}
  assert.equal(workers.length,1);b.elements.get('panel-history').hidden=false;b.ui.refresh();await wait();assert.match(b.elements.get('history-summary').textContent,/шаг 301/);assert.equal(workers.length,2);
  const previous=workers[1];b.sim.lives={...b.sim.lives,tick:302};b.elements.get('history-width').value='200';b.elements.get('history-width').emit('change');
  assert.equal(previous.closed,true);assert.equal(workers.length,3);assert.match(b.elements.get('history-summary').textContent,/шаг 302/);assert.equal(b.ui.getSummary().width,200);
 }finally{b.ui.reset();globalThis.Worker=original;}
});

test('actual brain-cost card uses three digits in estimates and axes while preserving raw observations',async()=>{
 const original=globalThis.Worker;globalThis.Worker=class{postMessage(m){setTimeout(()=>{if(this.closed)return;const p=m.prepared,estimate=w=>estimateWorlds(w,m.weightMode);this.onmessage?.({data:{request:m.request,owner:m.owner,metric:p.metric,summary:estimate(p.summary.worlds),points:p.points.map(point=>({...point,...estimate(point.worlds)})),error:p.error}});},0);}terminate(){this.closed=true;}};
 const b=boot();try{
  b.sim.lives={...b.sim.lives,dead:b.sim.lives.dead.map(row=>({...row,observations:{schema:LIFE_OBSERVATION_SCHEMA,brainCalls:100,brainEnergyCost:12.3,reviews:0,interruptions:{voluntary:0,physical:0,death:0}}}))};
  const raw=JSON.stringify(b.sim.lives);b.elements.get('history-display').value='behavior';b.elements.get('history-display').emit('change');b.ui.refresh();
  const canvas=b.created.find(e=>e.id==='history-chart-brainCost'),card=canvas.parent,walk=e=>[e,...e.children.flatMap(walk)];
  for(let turn=0;turn<100&&!walk(card).some(e=>e.className==='estimate-value'&&e.textContent==='0,123');turn++)await new Promise(r=>setTimeout(r,4));
  assert.ok(walk(card).some(e=>e.className==='estimate-value'&&e.textContent==='0,123'),JSON.stringify({hidden:card.hidden,text:walk(card).map(e=>e.textContent).filter(Boolean).slice(-15),state:b.elements.get('history-analysis-state').textContent,error:b.elements.get('history-error').textContent}));assert.ok(canvas.labels.some(t=>/^0,\d{3}$/.test(t)&&t!=='0,000'));assert.equal(JSON.stringify(b.sim.lives),raw);
 }finally{b.ui.reset();globalThis.Worker=original;}
});

test('standard copy becomes an editable native card in the same grid, with persistence, new category and restore',async()=>{
 const old=globalThis.localStorage,stored=new Map();globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
 try{const b=boot();b.ui.refresh();const walk=n=>[n,...n.children.flatMap(walk)],grid=b.elements.get('history-charts'),canvas=b.created.find(n=>n.id==='history-chart-lifetime'),card=grid.children.find(n=>n.children.includes(canvas));
  walk(card).find(n=>n.textContent==='Создать копию').emit('click');const editor=b.elements.get('history-builder-screen'),fields=walk(editor),name=fields.find(n=>n.name==='catalogue-name');name.value='Срок жизни';fields.find(n=>n.name==='catalogue-newCategory').value='Моя категория';await fields.find(n=>n.tagName==='form').emit('submit');
  let state=JSON.parse(stored.get('big-evolution-chart-catalogue-v2'));assert.equal(state.charts.length,1);assert.equal(state.charts[0].metric,'lifetime');assert.equal(state.categories[0].label,'Моя категория');assert.equal(b.elements.get('history-display').value,state.categories[0].id);
  const copy=grid.children.find(n=>n.children.some(c=>c.tagName==='h3'&&c.textContent==='Срок жизни'));assert.ok(copy&&!copy.hidden);assert.ok(walk(copy).some(n=>n.tagName==='select'&&n.value==='original'));
  walk(card).find(n=>n.textContent==='Скрыть').emit('click');assert.equal(card.hidden,true);b.elements.get('history-catalogue-controls').children.find(n=>n.textContent==='Восстановить стандартные').emit('click');state=JSON.parse(stored.get('big-evolution-chart-catalogue-v2'));assert.ok(!state.hidden.includes('lifetime'));assert.equal(state.charts.length,1);
  walk(copy).find(n=>n.textContent==='Редактировать').emit('click');fields.find(n=>n.name==='catalogue-name').value='Обновлённая копия';await fields.find(n=>n.tagName==='form').emit('submit');assert.equal(grid.children.filter(n=>n.children.some(c=>c.tagName==='h3'&&c.textContent==='Срок жизни')).length,0);assert.equal(JSON.parse(stored.get('big-evolution-chart-catalogue-v2')).charts.length,1);
  const again=boot();again.ui.refresh();assert.ok(again.elements.get('history-charts').children.some(n=>n.children.some(c=>c.tagName==='h3'&&c.textContent==='Обновлённая копия')));
 }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
test('native survival copies have independent controls and preserve the common summary',async()=>{
 const old=globalThis.localStorage;delete globalThis.localStorage;
 try{const b=boot();b.ui.refresh();b.elements.get('history-open-builder').emit('click');const editor=b.elements.get('history-builder-screen'),walk=n=>[n,...n.children.flatMap(walk)],fields=walk(editor);fields.find(n=>n.name==='catalogue-type').value='metric:survival';fields.find(n=>n.name==='catalogue-name').value='Моё дожитие';await fields.find(n=>n.tagName==='form').emit('submit');
  const summary=b.ui.getSummary(),copy=b.elements.get('history-charts').children.find(n=>n.children.some(c=>c.textContent==='Моё дожитие')),input=walk(copy).find(n=>n.type==='number');assert.ok(input);input.value=50;input.emit('change');assert.equal(b.elements.get('history-survival-age').value,'100');assert.equal(b.ui.getSummary(),summary);assert.equal(b.ui.getSummary().survivalAge,100);
 }finally{if(old!==undefined)globalThis.localStorage=old;}
});
test('creating a pinned native copy requests its extra archive window and displays its override',async()=>{
 const previous=globalThis.localStorage;delete globalThis.localStorage;const calls=[];
 try{const b=boot({prepareSimulation:input=>{calls.push(input);return null;}});b.ui.refresh();b.elements.get('history-period-to').value='50';b.elements.get('history-period-to').emit('change');const walk=n=>[n,...n.children.flatMap(walk)],original=b.elements.get('history-charts').children.find(c=>c.children.some(n=>n.id==='history-chart-lifetime'));walk(original).find(n=>n.textContent==='Создать копию').emit('click');let nodes=walk(b.elements.get('history-builder-screen'));nodes.find(n=>n.name==='catalogue-name').value='Отдельный период';const add=nodes.find(n=>n.name==='catalogue-pin-add');add.value='period';add.emit('change');nodes=walk(b.elements.get('history-builder-screen'));nodes.find(n=>n.name==='pin-period-start').value='100';nodes.find(n=>n.name==='pin-period-end').value='120';await nodes.find(n=>n.tagName==='form').emit('submit');assert.equal(b.elements.get('history-error').textContent,'');assert.deepEqual(calls.at(-1).windows,[[100,120]]);assert.equal(b.ui.getSummary().domainEnd,50);const copy=b.elements.get('history-charts').children.find(c=>c.children.some(n=>n.textContent==='Отдельный период'));assert.ok(walk(copy).some(n=>n.textContent.includes('Локальные фильтры: рождения [100; 120)')));const canvas=walk(copy).find(n=>n.tagName==='canvas');canvas.emit('pointermove',{clientX:200});assert.ok(walk(copy).filter(n=>n.className==='history-chart-message').every(n=>n.textContent===''));b.ui.reset();
 }finally{if(previous!==undefined)globalThis.localStorage=previous;}
});
test('formula cards render in the same category/grid, using the shared period and life filter',async()=>{
 const old=globalThis.Worker,oldStorage=globalThis.localStorage;delete globalThis.localStorage;let done;const finished=new Promise(r=>done=r);
 globalThis.Worker=class{postMessage(m){if(!m.type)return;if(m.type==='start')this.items=m.configs.map(c=>({id:c.id,engine:createAnalysisEngine(m.plan,c.config)}));if(m.type==='world')for(const item of this.items)item.engine.add(m.meta,m.projection);queueMicrotask(()=>{this.onmessage({data:m.type==='finish'?{results:this.items.map(i=>({id:i.id,result:i.engine.finish()}))}:{ready:true}});if(m.type==='finish')done();});}terminate(){}};
 try{const b=boot();b.ui.refresh();const walk=n=>[n,...n.children.flatMap(walk)];b.elements.get('history-open-builder').emit('click');const fields=walk(b.elements.get('history-builder-screen'));fields.find(n=>n.name==='catalogue-name').value='Моя формула';fields.find(n=>n.name==='catalogue-expression').value='age * 2';await fields.find(n=>n.tagName==='form').emit('submit');await finished;await new Promise(r=>setTimeout(r,0));
  const card=b.elements.get('history-charts').children.find(n=>n.children.some(c=>c.textContent==='Моя формула'));assert.ok(card&&!card.hidden);assert.ok(walk(card).some(n=>n.textContent==='40,0'));assert.ok(walk(card).some(n=>n.textContent==='[0; 100) Т'));assert.equal(b.elements.get('history-error').textContent,'');b.ui.reset();
 }finally{if(old===undefined)delete globalThis.Worker;else globalThis.Worker=old;if(oldStorage!==undefined)globalThis.localStorage=oldStorage;}
});
test('history UI creates metric and distribution charts, four cohort statistics and a bounded paged table',()=>{
 const b=boot();b.ui.refresh();assert.equal(b.created.filter(e=>e.tagName==='canvas').length,LIFE_METRICS.length+5);assert.equal(b.ui.getSummary().cohorts.length,2);assert.equal(b.elements.get('history-rows').children.length,2);
 b.elements.get('history-table-mode').value='lives';b.elements.get('history-table-mode').emit('input');assert.equal(b.elements.get('history-rows').children.length,50);
 const cached=b.ui.getSummary();b.elements.get('history-next').emit('click');assert.equal(b.elements.get('history-rows').children.length,50);assert.equal(b.ui.getSummary(),cached);
 b.elements.get('history-next').emit('click');assert.equal(b.elements.get('history-rows').children.length,25);assert.equal(b.elements.get('history-next').disabled,true);
 b.elements.get('history-show-min').checked=false;b.elements.get('history-show-min').emit('change');assert.equal(b.ui.getSummary(),cached);
});
test('chart selection drills into its birth interval and Escape clears it without recomputing data',()=>{
 const b=boot();b.ui.refresh();const canvas=b.created.find(e=>e.tagName==='canvas'),cached=b.ui.getSummary();canvas.emit('click',{clientX:150});
 assert.equal(b.elements.get('history-table-mode').value,'lives');assert.match(b.elements.get('history-selected').textContent,/0; 100/);assert.equal(b.elements.get('history-rows').children.length,50);assert.equal(b.ui.getSummary(),cached);
 canvas.emit('keydown',{key:'ArrowRight'});assert.match(b.elements.get('history-selected').textContent,/100; 200/);assert.equal(b.elements.get('history-rows').children.length,25);
 canvas.emit('keydown',{key:'Escape'});assert.equal(b.elements.get('history-clear-selection').disabled,true);
});
test('invalid settings preserve the previous view, origin changes recompute, and partial histories are disclosed',()=>{
 const b=boot();b.ui.refresh();const previous=b.ui.getSummary();b.elements.get('history-width').value='0';b.elements.get('history-width').emit('change');assert.ok(b.elements.get('history-error').textContent);assert.equal(b.ui.getSummary(),previous);
 b.elements.get('history-width').value='100';b.elements.get('history-origin').value='descendants';b.elements.get('history-origin').emit('change');assert.equal(b.elements.get('history-error').textContent,'');assert.equal(b.ui.getSummary().cohorts.reduce((n,c)=>n+c.born,0),62);
 b.sim.lives={...b.sim.lives,omittedDetails:5};b.ui.refresh();assert.match(b.elements.get('history-warning').textContent,/5/);assert.ok(b.ui.getSummary().cohorts.every(g=>g.survival.percent===null));
 b.ui.reset();assert.equal(b.ui.getSummary(),null);
});
test('history screens and custom chart selections preserve cohorts and shared filters',()=>{
 const b=boot();b.ui.refresh();const summary=b.ui.getSummary(),display=b.elements.get('history-display');
 display.value='resources';display.emit('change');assert.equal(b.ui.getSummary(),summary);assert.equal(b.elements.get('history-table-screen').hidden,true);
 const picker=b.created.find(e=>e.tagName==='input'&&e.attributes['aria-label']===LIFE_METRICS[0].label);picker.checked=true;picker.emit('change');assert.equal(display.value,'custom');assert.equal(b.ui.getSummary(),summary);
 display.value='table';display.emit('change');assert.equal(b.elements.get('history-table-screen').hidden,false);assert.equal(b.elements.get('history-rows').children.length,2);assert.equal(b.ui.getSummary(),summary);
});

test('survival summary discloses completed sample, living exclusions and incomplete records',()=>{
 const b=boot();b.sim.lives={...b.sim.lives,living:[{id:999,parentId:null,born:0,age:200,status:'alive'}]};b.ui.refresh();
 const text=b.elements.get('history-curve-statistics');assert.match(text.textContent,/100 завершённым/);assert.match(text.textContent,/средний 20 Т/);assert.match(text.textContent,/Живые не включены/);
 b.elements.get('history-curve-start').value='200';b.elements.get('history-curve-start').emit('change');assert.match(text.textContent,/после первой завершённой/);
 b.sim.lives={...b.sim.lives,omittedDetails:1};b.ui.refresh();assert.match(text.textContent,/история неполная/);
});

test('live history waits for a fresh report and preserves selected cohort and filters',()=>{
 const b=boot();b.ui.refresh();b.elements.get('history-table-mode').value='lives';b.elements.get('history-table-mode').emit('input');
 const canvas=b.created.find(e=>e.tagName==='canvas');canvas.emit('click',{clientX:150});
 const previous=b.ui.getSummary();b.sim.tick=301;b.ui.refresh();assert.equal(b.ui.getSummary(),previous);
 b.sim.lives={...b.sim.lives,tick:301,dead:[...b.sim.lives.dead,{...b.sim.lives.dead[0],id:1000}]};b.ui.refresh();
 assert.notEqual(b.ui.getSummary(),previous);assert.match(b.elements.get('history-selected').textContent,/0; 100/);assert.equal(b.elements.get('history-table-mode').value,'lives');assert.match(b.elements.get('history-page').textContent,/строк 101/);
});

test('genome, reproduction, production and distribution screens expose the new statistics',()=>{
 const b=boot(),h={schema:'heritable-statistics-v1',senseEnergy:-40,senseHealth:40,senseStomach:20,shortCapacity:20,longCapacity:10,mutationRate:1,mutationStrength:.5};
 b.sim.lives={...b.sim.lives,dead:b.sim.lives.dead.map(r=>({...r,children:2,firstBirthAge:10,emptyEnergySteps:5,heritable:h})),foodProductionHistory:[{tick:0,value:2},{tick:100,value:4}]};b.ui.refresh();
 const display=b.elements.get('history-display');for(const mode of ['genome','reproduction','resources','distributions']){display.value=mode;display.emit('change');assert.equal(b.elements.get('history-error').textContent,'');}
 const note=b.created.find(e=>e.id==='history-histogram-note-senseEnergy');assert.equal(note.textContent,'');
 const g=b.ui.getSummary().cohorts[0];assert.equal(g.metrics.firstBirth.mean,10);assert.equal(g.metrics.reproduced.mean,100);assert.equal(g.metrics.hunger.mean,25);assert.equal(g.metrics.senseEnergy.mean,-40);
});

test('shared numeric window filters charts and table; independent age cohort stays unchanged',()=>{
 const b=boot();b.ui.refresh();const curve=b.ui.getCurve();
 b.elements.get('history-period-from').value='50';b.elements.get('history-period-to').value='120';b.elements.get('history-period-to').emit('change');
 assert.deepEqual(b.ui.getSummary().cohorts.map(g=>[g.start,g.end,g.born]),[[50,100,50],[100,120,20]]);assert.equal(b.ui.getCurve(),curve);
 b.elements.get('history-table-mode').value='lives';b.elements.get('history-table-mode').emit('input');assert.match(b.elements.get('history-page').textContent,/строк 70/);
 b.elements.get('history-curve-start').value='100';b.elements.get('history-curve-start').emit('change');assert.equal(b.ui.getCurve().count,25);assert.equal(b.ui.getSummary().domainStart,50);
 b.elements.get('history-period-all').emit('click');assert.equal(b.ui.getSummary().domainStart,0);assert.equal(b.ui.getCurve().start,100);
});
test('local curve and metric controls leave the common cohorts and unrelated requests unchanged',async()=>{
 const old=globalThis.Worker,requests=[];globalThis.Worker=class{postMessage(m){requests.push(m.prepared.metric);setTimeout(()=>{if(!this.closed)this.onmessage?.({data:{request:m.request,owner:m.owner,metric:m.prepared.metric,points:[],summary:{mean:1}}});},0);}terminate(){this.closed=true;}};
 const b=boot();try{b.ui.refresh();for(let i=0;i<100&&!requests.includes('survival');i++)await new Promise(r=>setTimeout(r,4));await new Promise(r=>setTimeout(r,15));const summary=b.ui.getSummary(),before=requests.length;
  b.elements.get('history-curve-start').value='100';b.elements.get('history-curve-start').emit('change');assert.equal(b.ui.getSummary(),summary);assert.equal(requests.length,before);
  b.elements.get('history-curve-age-max').value='50';b.elements.get('history-curve-age-max').emit('change');assert.equal(requests.length,before);
  b.elements.get('history-survival-age').value='50';b.elements.get('history-survival-age').emit('change');await new Promise(r=>setTimeout(r,15));assert.equal(b.ui.getSummary(),summary);assert.ok(requests.slice(before).every(m=>m==='survival'));
 }finally{b.ui.reset();globalThis.Worker=old;}
});

test('range handles cannot cross and invalid numeric boundaries preserve the last valid window',()=>{
 const b=boot();b.ui.refresh();b.elements.get('history-period-start').value='350';b.elements.get('history-period-start').emit('input');assert.equal(b.ui.getSummary().domainStart,350);
 b.elements.get('history-period-end').value='100';b.elements.get('history-period-end').emit('input');assert.equal(b.ui.getSummary().domainEnd,351);
 const cached=b.ui.getSummary();b.elements.get('history-period-to').value='350';b.elements.get('history-period-to').emit('change');assert.equal(b.ui.getSummary(),cached);assert.ok(b.elements.get('history-error').textContent);
});

test('fixed age axis survives cohort changes and live refresh without pointer or keyboard captions',()=>{
 const b=boot();b.ui.refresh();const summary=b.ui.getSummary(),curve=b.ui.getCurve(),field=b.elements.get('history-curve-age-max'),slider=b.elements.get('history-curve-age-slider'),canvas=b.created.find(e=>e.id==='history-chart-age-survival'),note=b.created.find(e=>e.id==='history-note-age-survival');
 field.value='50';field.emit('change');assert.equal(b.ui.getSummary(),summary);assert.equal(b.ui.getCurve(),curve);assert.equal(slider.value,50);
 canvas.emit('pointermove',{clientX:322});assert.equal(note.textContent,'');
 canvas.emit('keydown',{key:'End'});assert.equal(note.textContent,'');
 b.elements.get('history-curve-slider').value='100';b.elements.get('history-curve-slider').emit('input');b.elements.get('history-curve-slider').emit('change');assert.equal(field.value,50);assert.equal(slider.value,50);assert.equal(b.ui.getCurve().start,100);
 b.sim.lives={...b.sim.lives,tick:301};b.ui.refresh();assert.equal(field.value,50);
 const current=b.ui.getCurve();field.value='0';field.emit('change');assert.equal(b.ui.getCurve(),current);assert.match(b.elements.get('history-error').textContent,/положительное целое/);
 slider.value='80';slider.emit('input');assert.equal(field.value,80);assert.equal(b.elements.get('history-error').textContent,'');
 field.value='1500';field.emit('change');assert.equal(slider.max,1500);canvas.emit('keydown',{key:'End'});assert.equal(note.textContent,'');
 b.ui.reset();b.ui.refresh();assert.equal(field.value,1500);
});

test('drawer positions follow the actual navigation height after wrapping',()=>{
 const original=globalThis.ResizeObserver,observers=[];
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(target){this.target=target;}};
 try{const b=boot(),controls=b.elements.get('panel-history'),observer=observers.find(o=>o.target===b.toolbar);assert.ok(observer);assert.equal(controls.attributes['--history-toolbar-height'],'72px');b.toolbar.height=128;observer.callback();assert.equal(controls.attributes['--history-toolbar-height'],'128px');}
 finally{globalThis.ResizeObserver=original;}
});

test('chart picker groups each chart once and keeps all sensitivities only as distributions',()=>{
 const b=boot();b.ui.refresh();const groups=b.elements.get('history-chart-options').children;
 assert.deepEqual(groups.map(g=>g.children[0].textContent),['Выживание','Поведение','Ресурсы','Размножение','Наследуемые свойства','Распределения']);
 const labels=groups.flatMap(g=>g.children.slice(1).map(label=>label.children[0].attributes['aria-label']));assert.equal(new Set(labels).size,labels.length);
 for(const m of LIFE_METRICS.filter(m=>m.signed)){assert.ok(!b.created.some(e=>e.id==='history-chart-'+m.id));assert.ok(b.created.some(e=>e.id==='history-histogram-'+m.id));assert.ok(!labels.includes(m.label));assert.ok(labels.includes('Распределение: '+m.label));}
 const display=b.elements.get('history-display');display.value='all';display.emit('change');
 for(const group of groups)for(const label of group.children.slice(1))assert.equal(label.children[0].checked,true);
 const item=groups[5].children[3].children[0];item.checked=false;item.emit('change');assert.equal(display.value,'custom');assert.equal(item.checked,false);
});

test('toolbar button docks statistics controls; Escape commits input and restores focus',()=>{
 const elements=new Map(),root={activeElement:null,getElementById:id=>elements.get(id)};
 elements.set('history-layout',new Element());
 elements.set('history-drawer-left-body',new Element());
 for(const side of ['left']){const drawer=new Element('details'),handle=new Element('summary'),field=new Element('input');drawer.contains=e=>e===handle||e===field;handle.focus=()=>{root.activeElement=handle;};field.blur=()=>{field.committed=true;root.activeElement=null;};drawer.field=field;elements.set('history-drawer-'+side,drawer);elements.set('history-drawer-'+side+'-handle',handle);}
 installHistoryDrawers(root);
 for(const side of ['left']){const drawer=elements.get('history-drawer-'+side),handle=elements.get('history-drawer-'+side+'-handle');
  drawer.open=false;drawer.emit('mouseenter');drawer.emit('focusin',{target:drawer.field});assert.equal(drawer.open,false);
  handle.emit('click');assert.equal(drawer.open,true);assert.equal(elements.get('history-layout').attributes['data-open'],'true');handle.emit('click');assert.equal(drawer.open,false);
  drawer.open=true;root.activeElement=drawer.field;drawer.emit('mouseleave');drawer.emit('focusout',{relatedTarget:null});assert.equal(drawer.open,true);
  let stopped=false;drawer.emit('keydown',{key:'Escape',stopPropagation(){stopped=true;}});assert.equal(drawer.open,false);assert.equal(root.activeElement,handle);assert.equal(stopped,true);assert.equal(drawer.field.committed,true);
 }
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),left=html.slice(html.indexOf('id="history-drawer-left"'),html.indexOf('id="history-charts"'));
 assert.ok(!html.includes('id="history-drawer-top"'));
 for(const id of ['history-survival-age','history-origin','history-stat-mode','history-interruption-kind','history-width','history-period-from','history-period-to','history-line-controls','history-display','history-chart-options','experiment-stat-source','experiment-stat-weight','experiment-stat-line'])assert.ok(left.includes(`id="${id}"`));
});
