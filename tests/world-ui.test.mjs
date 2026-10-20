/** Настоящий UI-код и протокол в минимальном DOM. Это не браузерная проверка:
 * модель настоящая, вспомогательные панели и доставка сообщений контролируются. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../dist/evolution.js';
import * as cognition from '../dist/cognition.js';
import * as setLayout from '../dist/temporal-layout.js';
import * as neuralLayout from '../dist/neural-layout.js';
import * as body from '../dist/brain-parameters.js';
import * as navigation from '../dist/navigation.js';
import * as reproduction from '../dist/reproduction.js';
import * as geography from '../dist/geography.js';
import {foodLabel} from '../dist/food-settings.js';
import {mutationProfile} from '../dist/mutation-parameters.js';
import {updateTextRows} from '../dist/stable-text-list.js';
import {WorldClient} from '../dist/world-client.js';
import {WorldRuntime} from '../dist/world-runtime.js';
import * as computation from '../dist/computation-settings.js';
import {UI_TEXT,installUIText} from '../dist/ui-text.js';
import {installPerformanceTabs} from '../dist/performance-tabs.js';
import {WorldProfiler} from '../dist/world-profiler.js';
import {installEnvironmentUI} from '../dist/environment-ui.js';
import {formatNumber} from '../dist/ui-numbers.js';
import {foodProduction} from '../dist/environment-settings.js';
import {installWorldFiles} from '../dist/world-files-ui.js';
import {installScreenTabs} from '../dist/screen-tabs.js';
import {installLiveFoodControls} from '../dist/food-controls.js';
const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../dist/evolution-app.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');
const performanceUI=fs.readFileSync(new URL('../dist/performance-ui.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export /gm,'');
class Element{
 constructor(){this.listeners={};this.style={setProperty(k,v){this[k]=v;}};this.children=[];this.dataset={};this.checked=false;this.value='';this.tagName='DIV';this.scrollTop=0;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 append(...nodes){for(const n of nodes){n.parent=this;n.ownerDocument=this.ownerDocument;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 get lastElementChild(){return this.children.at(-1);}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);}
 querySelectorAll(selector){return this.children.flatMap(c=>[...(c.className===selector.slice(1)?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 setAttribute(){}
 getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true});}
 getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}
 showModal(){this.open=true;}
 close(){this.open=false;}
 click(){this.clicked=true;}
 emit(name,event={}){return this.listeners[name]?.(event);}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function boot(){
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document=new Element();document.getElementById=id=>{assert.ok(elements.has(id),`missing ${id}`);return elements.get(id);};
 document.createElement=()=>{const e=new Element();e.ownerDocument=document;return e;};document.hidden=false;
 for(const e of elements.values())e.ownerDocument=document;
 for(const [id,value]of [['seed','42'],['founders','12'],['population-limit','20'],['mutation-rate','0.06'],['speed','1']])elements.get(id).value=value;
 for(const id of ['mutations','learning','memory'])elements.get(id).checked=true;
 elements.get('chart').width=900;elements.get('chart').height=180;
 let now=0,runtime,frame,sidebarChange;const downloads=[];
 class TestClient extends WorldClient{
  constructor(options){
   const worker={postMessage:message=>{const copy=structuredClone(message);queueMicrotask(()=>runtime.handle(copy));}};
   runtime=new WorldRuntime({clock:()=>now,send:message=>{const copy=structuredClone(message);queueMicrotask(()=>worker.onmessage?.({data:copy}));}});
   super({...options,worker});
  }
 }
 let section='birth',tab='world',benchmarkActive=false;
 const context=vm.createContext({...model,...cognition,...setLayout,...neuralLayout,...body,...navigation,...reproduction,...geography,...computation,
  WorldClient:TestClient,WorldProfiler,mutationProfile,foodLabel,format:formatNumber,updateTextRows,UI_TEXT,installUIText,installPerformanceTabs,document,navigator:{hardwareConcurrency:2,userAgent:'test-dom'},
  installLabTabs:options=>({currentTab:()=>tab,refresh:()=>{},onRestart:()=>{},
   select:name=>{tab=name;options.onTabChange(name);},isBenchmarkActive:()=>benchmarkActive}),
  installSidebar:fn=>{sidebarChange=fn;return {getResidentSection:()=>section,select:()=>fn(),selectResident:name=>{section=name;fn();}};},
  installFoodControls:()=>()=>{},syncFoodControls:()=>{},readFoodControls:()=>({foodSources:30,foodRegrowInterval:20,foodIslandCount:3,foodPeriodSpread:30,foodSizeSpread:30}),
  MODEL_VERSION:model.MODEL_VERSION,fetch:async()=>({ok:true,json:async()=>({modelVersion:model.MODEL_VERSION})}),
  installHelp:()=>{},createHelpButton:()=>document.createElement('button'),
  requestAnimationFrame:fn=>frame=fn,performance:{now:()=>now},Blob,
  URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:mock';},revokeObjectURL:()=>{}},setTimeout:()=>0});
 Object.assign(context,{installEnvironmentUI,installWorldFiles,installScreenTabs,installLiveFoodControls});
 vm.runInContext(performanceUI,context);vm.runInContext(app,context);await settle();assert.equal(elements.get('error').textContent??'','');
 return {elements,document,context,downloads,setBenchmarkActive:value=>benchmarkActive=value,get runtime(){return runtime;},
  pulse:async value=>{now=value;runtime.pulse();await settle();},frame:value=>frame(value),
  section:async name=>{section=name;sidebarChange();await settle();}};
}
test('UI sends play/pause/step; frames do not move world and hiding continues',async()=>{
 const b=await boot(),e=b.elements;assert.equal(e.get('clock').textContent,'Шаг 0');
 await e.get('play').emit('click');await b.pulse(100);assert.equal(b.runtime.world.tick,1);
 await b.pulse(200);assert.equal(e.get('clock').textContent,'Шаг 2');
 b.frame(500);assert.equal(b.runtime.world.tick,2);
 b.document.hidden=true;b.document.emit('visibilitychange');await settle();await b.pulse(600);
 assert.ok(b.runtime.world.tick>1);assert.equal(b.runtime.running,true);
 b.document.hidden=false;b.document.emit('visibilitychange');await settle();
 await e.get('play').emit('click');const tick=b.runtime.world.tick;await b.pulse(900);assert.equal(b.runtime.world.tick,tick);
 await e.get('step').emit('click');assert.equal(b.runtime.world.tick,Math.round((tick+.1)*10)/10);assert.equal(b.runtime.running,false);
 await e.get('play').emit('click');vm.runInContext("labTabs.select('history')",b.context);await settle();assert.equal(b.runtime.running,true);await b.pulse(1000);assert.ok(b.runtime.world.tick>tick);assert.match(e.get('play').textContent,/Пауза/);await e.get('play').emit('click');assert.equal(b.runtime.running,false);
});
test('global play availability follows benchmark activity even without new world messages',async()=>{
 const b=await boot(),e=b.elements;vm.runInContext("labTabs.select('tests')",b.context);await settle();
 b.setBenchmarkActive(true);b.frame(300);assert.equal(e.get('play').disabled,true);
 await e.get('play').emit('click');assert.equal(b.runtime.running,false);
 b.setBenchmarkActive(false);b.frame(600);assert.equal(e.get('play').disabled,false);
 await e.get('play').emit('click');assert.equal(b.runtime.running,true);
});

test('speed menu exposes final modes and ten substeps per second draws each intermediate state',async()=>{
 const menu=html.match(/<select id="speed">([\s\S]*?)<\/select>/)[1];
 assert.deepEqual([...menu.matchAll(/value="([^"]+)"/g)].map(m=>Number(m[1])),[.02,.04,.1,8,32,64]);
 const b=await boot(),e=b.elements;e.get('speed').value='.1';await e.get('speed').emit('change');await settle();
 assert.equal(b.runtime.target,1);assert.equal(b.runtime.quantum,.1);await e.get('play').emit('click');
 for(let i=1;i<=10;i++){await b.pulse(i*100);assert.equal(b.runtime.world.subtick,i);assert.match(e.get('clock').textContent,new RegExp(`Шаг ${i/10}`));}
 e.get('speed').value='64';await e.get('speed').emit('change');await settle();assert.equal(b.runtime.target,640);assert.equal(b.runtime.quantum,1);
});

test('restart, intervention, selection and all resident sections render',async()=>{
 const b=await boot(),e=b.elements;e.get('founders').value='1001';await e.get('restart').emit('click');assert.ok(e.get('error').textContent);
 e.get('founders').value='12';await e.get('restart').emit('click');assert.equal(e.get('population').textContent,12);
 const id=b.runtime.selected.id;e.get('next-agent').emit('click');await settle();assert.notEqual(b.runtime.selected.id,id);
 for(const section of ['senses','learning','traits','short','long','features','birth'])await b.section(section);
 assert.ok(e.get('feature-learning').querySelector('.feature-values'));
 await e.get('world-food-apply').emit('click');assert.match(e.get('world-food-status').textContent,/Мир остаётся на паузе/);
 e.get('wiki-tab-actions').emit('click');assert.equal(e.get('wiki-panel-actions').hidden,false);assert.equal(e.get('wiki-panel-world').hidden,true);
});
test('genome export/import and memory switches cross the worker boundary',async()=>{
 const b=await boot(),e=b.elements;await e.get('save-genome').emit('click');assert.match(e.get('save-status').textContent,/загрузки/);
 const genome=b.runtime.world.genomeFile(b.runtime.selected);
 await e.get('load-genome').emit('change',{target:{files:[{size:5000,text:async()=>JSON.stringify(genome)}]}});
 assert.match(e.get('base-status').textContent,/загружена/);
 e.get('mutations').checked=false;e.get('memory').checked=false;e.get('learning').checked=false;
 await e.get('restart').emit('click');assert.deepEqual(b.runtime.world.agents[0].genome,genome.genes);
 assert.equal(b.runtime.world.memoryEnabled,false);assert.equal(b.runtime.world.learningEnabled,false);
 await e.get('step').emit('click');assert.match(e.get('brain-mode').textContent,/выключена/);
});
test('food Apply keeps the running UI active and reports unchanged settings accurately',async()=>{
 const b=await boot(),e=b.elements;await e.get('play').emit('click');
 assert.ok(e.get('world-food-production').textContent.includes(formatNumber(foodProduction(b.runtime.world))));
 await e.get('world-food-apply').emit('click');
 assert.ok(e.get('world-food-production').textContent.includes(formatNumber(foodProduction(b.runtime.world))));assert.match(e.get('world-food-production').textContent,/Полные источники пропускают рост/);
 assert.equal(b.runtime.running,true);assert.match(e.get('world-food-status').textContent,/Мир продолжает работу/);
 await e.get('world-food-apply').emit('click');
 assert.match(e.get('world-food-status').textContent,/Условия совпадают/);assert.equal(b.runtime.running,true);
 await b.pulse(100);assert.equal(b.runtime.world.tick,1);
});
test('performance panel renders phases and downloads actual detailed worker report v3',async()=>{
 const b=await boot(),e=b.elements;
 e.get('performance-mode').value='detailed';
 await e.get('performance-start').emit('click');await e.get('play').emit('click');
 await b.pulse(100);await b.pulse(200);b.frame(600);
 const text=e.get('performance-breakdown').children.map(row=>row.textContent).join('\n');
 assert.match(text,/Внутри общих групп/);assert.match(text,/Подготовка входов/);
 await e.get('performance-export').emit('click');
 const report=JSON.parse(await b.downloads.at(-1).text());
 assert.equal(report.version,3);assert.equal(report.detailSchema,'brain-phases-v1');
 assert.ok(report.details.length>0);assert.equal(report.context.worldMode,'dedicated-worker');
 assert.equal(b.runtime.running,true);
});
test('performance panel defaults to light mode and exports boundaries without phases',async()=>{
 const b=await boot(),e=b.elements;
 await e.get('performance-start').emit('click');assert.equal(e.get('performance-mode').disabled,true);
 await e.get('play').emit('click');await b.pulse(100);await b.pulse(200);b.frame(600);
 assert.match(e.get('performance-breakdown').children.map(row=>row.textContent).join('\n'),/не загрузка CPU/);
 await e.get('performance-export').emit('click');const r=JSON.parse(await b.downloads.at(-1).text());
 assert.equal(r.mode,'light');assert.equal(r.sampledSteps,0);assert.deepEqual(r.details,[]);
 assert.equal(r.workerTiming.metrics.task.count,2);assert.equal(r.workerTiming.cpuTimeMs,null);
 assert.equal(e.get('performance-mode').disabled,false);assert.equal(b.runtime.running,true);
});
