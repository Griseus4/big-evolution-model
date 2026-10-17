/** Небраузерная проверка управления. Она не проверяет реальный размер текста и цвета. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../dist/evolution.js';
import * as cognition from '../dist/cognition.js';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('dist/index.html',root),'utf8');
const app=fs.readFileSync(new URL('dist/evolution-app.js',root),'utf8').replace(/^import[\s\S]*?from '\.\/evolution\.js';\n/m,'').replace(/^import .*from '\.\/cognition\.js';\n/m,'').replace(/^import .*from '\.\/lab-tabs\.js';\n/m,'');
class Element{
 constructor(){this.listeners={};this.style={};this.children=[];this.checked=false;this.value='';this.tagName='DIV';}
 addEventListener(name,fn){this.listeners[name]=fn;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true});}
 getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}
 showModal(){this.open=true;}
 close(){this.open=false;}
 click(){this.clicked=true;}
 emit(name,event={}){return this.listeners[name]?.(event);}
}
function boot(){
 const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document=new Element();document.getElementById=id=>{assert.ok(elements.has(id),`missing ${id}`);return elements.get(id);};
 document.createElement=()=>new Element();
 for(const [id,value]of [['seed','42'],['founders','48'],['population-limit','180'],['scenario','balanced'],['mutation-rate','0.06'],['speed','8']])elements.get(id).value=value;
 for(const id of ['mutations','learning','memory','expand-legacy'])elements.get(id).checked=true;elements.get('chart').width=900;elements.get('chart').height=180;
 let frame;const context=vm.createContext({...model,...cognition,installLabTabs:()=>({currentTab:()=>'world',refresh:()=>{},onRestart:()=>{}}),document,requestAnimationFrame:fn=>frame=fn,performance:{now:()=>0},
  Blob,URL:{createObjectURL:()=> 'blob:mock',revokeObjectURL:()=>{}},setTimeout:()=>0});
 vm.runInContext(app,context);
 return {elements,document,context,frame:now=>frame(now)};
}
test('playback, pause, manual step and hidden-tab pause execute actual evolution steps',()=>{
 const {elements:e,document,frame}=boot();assert.equal(e.get('clock').textContent,'Шаг 0');
 e.get('play').emit('click');frame(0);frame(100);frame(300);assert.notEqual(e.get('clock').textContent,'Шаг 0');
 e.get('play').emit('click');const before=e.get('clock').textContent;frame(500);frame(800);assert.equal(e.get('clock').textContent,before);
 e.get('step').emit('click');assert.equal(Number(e.get('clock').textContent.split(' ')[1]),Number(before.split(' ')[1])+1);
 e.get('play').emit('click');document.hidden=true;document.emit('visibilitychange');const paused=e.get('clock').textContent;
 frame(1000);frame(1500);assert.equal(e.get('clock').textContent,paused);
});
test('settings validation, restart, selection and rules controls work',()=>{
 const {elements:e}=boot();e.get('founders').value='1001';e.get('restart').emit('click');assert.ok(e.get('error').textContent);
 e.get('founders').value='12';e.get('restart').emit('click');assert.equal(e.get('population').textContent,12);
 const before=e.get('resident-title').textContent;e.get('next-agent').emit('click');assert.notEqual(e.get('resident-title').textContent,before);
 e.get('rules-open').emit('click');assert.equal(e.get('rules').open,true);e.get('rules-close').emit('click');assert.equal(e.get('rules').open,false);
});
test('export, validated import and frozen baseline start a new experience',async()=>{
 const {elements:e,context}=boot();e.get('save-genome').emit('click');assert.match(e.get('save-status').textContent,/загрузки/);
 const genes=Array(model.GENE_COUNT).fill(.25),data={format:'big-evolution-genome',version:3,genes};
 await e.get('load-genome').emit('change',{target:{files:[{size:5000,text:async()=>JSON.stringify(data)}]}});
 assert.match(e.get('base-status').textContent,/загружена/);e.get('mutations').checked=false;e.get('restart').emit('click');
 assert.equal(vm.runInContext('sim.agents[0].genome[0]',context),.25);
 e.get('clear-base').emit('click');assert.equal(e.get('clear-base').disabled,true);
});
test('bad files are rejected and extinction disables automatic execution',async()=>{
 const {elements:e,context}=boot();await e.get('load-genome').emit('change',{target:{files:[{size:5000,text:async()=>'{bad'}]}});
 assert.match(e.get('error').textContent,/не загружен/);
 vm.runInContext('for(const a of sim.agents)sim.die(a,"starvation");sim.agents=[];update();',context);
 assert.equal(e.get('play').disabled,true);assert.equal(e.get('extinction').hidden,false);
});

test('memory and learning controls apply at restart; panels explain the actual brain',()=>{
 const {elements:e,context}=boot();e.get('step').emit('click');e.get('step').emit('click');
 assert.match(e.get('memory-summary').textContent,/Краткая память/);assert.match(e.get('learning-report').textContent,/ошибка ожидания/);
 assert.ok(e.get('memories').children.length>0);assert.ok(e.get('feature-learning').children.length>0);
 e.get('learning').checked=false;e.get('memory').checked=false;e.get('restart').emit('click');
 assert.equal(vm.runInContext('sim.learningEnabled',context),false);assert.equal(vm.runInContext('sim.memoryEnabled',context),false);
 e.get('step').emit('click');e.get('step').emit('click');
 assert.equal(vm.runInContext('sim.agents[0].brain.updates',context),0);
 assert.equal(vm.runInContext('sim.agents[0].brain.memory.size',context),0);
 assert.match(e.get('brain-mode').textContent,/выключена/);
});
test('old genome keeps its 435 numbers and optionally gets a shared reproducible extension',async()=>{
 const {elements:e,context}=boot();const genes=Array(model.BASE_GENE_COUNT).fill(.2);
 await e.get('load-genome').emit('change',{target:{files:[{size:5000,text:async()=>JSON.stringify({format:'big-evolution-genome',version:1,genes})}]}});
 assert.equal(e.get('legacy-options').hidden,false);e.get('restart').emit('click');
 assert.equal(vm.runInContext('sim.agents[0].genome[434]',context),.2);
 assert.equal(vm.runInContext('sim.agents[0].genome[435]===sim.agents[1].genome[435]',context),true);
 assert.notEqual(vm.runInContext('sim.agents[0].genome[435]',context),0);
 const first=vm.runInContext('JSON.stringify(sim.agents[0].genome)',context);e.get('restart').emit('click');
 assert.equal(vm.runInContext('JSON.stringify(sim.agents[0].genome)',context),first);
 e.get('expand-legacy').checked=false;e.get('restart').emit('click');
 assert.equal(vm.runInContext('sim.agents[0].genome[435]',context),0);
});

test('an old protected place stays visible separately after recent observations overflow',()=>{
 const {elements:e,context}=boot();
 vm.runInContext(`const b=sim.agents[0].brain;b.traits.shortCapacity=8;b.traits.longCapacity=1;
 observe(b,[{q:-3,r:-2,food:2,terrain:'land'}],{q:-3,r:-2},0);
 rememberDecision(b,{q:-3,r:-2},0);
 rememberExperience(b,{choice:{row:0,action:6},beforeFeeling:0},20,1);
 for(let i=0;i<30;i++)observe(b,[{q:100+i,r:0,food:0,terrain:'land'}],{q:0,r:0},i+2,false);
 update();`,context);
 assert.equal(e.get('memories').children.length,8);
 assert.equal(e.get('long-memories').children.length,1);
 assert.match(e.get('long-memories').children[0].textContent,/\(-3, -2\)/);
 assert.match(e.get('long-memories').children[0].textContent,/закреплено/);
 assert.ok(e.get('memories').children.every(row=>!row.textContent.includes('(-3, -2)')));
});
