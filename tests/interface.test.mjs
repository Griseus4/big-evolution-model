// A DOM/canvas smoke harness, not a browser layout test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('game.html',root),'utf8');
class Element {
 constructor(){this.listeners={};this.style={};this.children=[];this.checked=false;this.value='';this.tagName='DIV';}
 addEventListener(name,fn){this.listeners[name]=fn;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 getContext(){return new Proxy({},{get:(_,key)=>key==='measureText'?()=>({width:20}):()=>{},set:()=>true});}
 getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}
 showModal(){this.open=true;}
 close(){this.open=false;}
 emit(name,e={}){this.listeners[name]?.(e);}
}
function boot(){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const elements=new Map(ids.map(id=>[id,new Element()]));
 const document=new Element();document.getElementById=id=>elements.get(id);document.createElement=()=>new Element();
 for(const [id,v]of [['seed','42'],['scenario','mixed'],['hunger-sensitivity','1'],['fear-sensitivity','1'],['speed','1']])elements.get(id).value=v;
 elements.get('autoplay').checked=true;elements.get('memory-view').checked=true;
 elements.get('chart').width=760;elements.get('chart').height=140;
 let callback;const context=vm.createContext({document,requestAnimationFrame:fn=>callback=fn});
 const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(code,context);
 return {elements,document,frame:now=>callback(now)};
}
test('offline build is self contained and its script is valid',()=>{
 assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html));
 new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('automatic playback, pause, single step, restart and hidden-window pause work',()=>{
 const {elements:e,document,frame}=boot();assert.match(e.get('play').textContent,/Пауза/);
 frame(100);frame(300);frame(500);assert.notEqual(e.get('time').textContent,'Шаг 0');
 e.get('play').emit('click');const paused=e.get('time').textContent;frame(700);frame(900);assert.equal(e.get('time').textContent,paused);
 e.get('step').emit('click');assert.equal(Number(e.get('time').textContent.split(' ')[1]),Number(paused.split(' ')[1])+1);
 e.get('restart').emit('click');assert.equal(e.get('time').textContent,'Шаг 0');assert.match(e.get('play').textContent,/Пауза/);
 document.hidden=true;document.emit('visibilitychange');frame(1100);frame(1300);assert.equal(e.get('time').textContent,'Шаг 0');
 e.get('autoplay').checked=false;e.get('autoplay').emit('change');e.get('restart').emit('click');assert.match(e.get('play').textContent,/Автошаги/);
});
test('memory view, hovered hex and digestion fields render without UI exceptions',()=>{
 const {elements:e,frame}=boot();e.get('memory-view').checked=false;e.get('memory-view').emit('change');
 const canvas=e.get('world');canvas.emit('mousemove',{clientX:300,clientY:300});assert.match(e.get('cell-info').textContent,/Суша|Вода/);
 for(let now=100;now<10000;now+=100)frame(now);
 assert.match(e.get('digestion').textContent,/порции/);assert.match(e.get('digestion-rate').textContent,/энергии/);
 e.get('about-open').emit('click');assert.equal(e.get('about').open,true);e.get('about-close').emit('click');assert.equal(e.get('about').open,false);
});
