/** Проверяет настоящий установщик: скрытая загрузка, общие поля и отсутствие
 * команды паузы. Размеры/выравнивание требуют дополнительной проверки браузером. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installHelp} from '../dist/help.js';
import {readFileSync} from 'node:fs';
class Element{
 constructor(tag='div',className=''){this.tagName=tag.toUpperCase();this.className=className;this.children=[];this.dataset={};this.listeners={};this.hidden=false;this.style={};}
 append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);this.children.push(n);n.parentElement=this;}}
 before(n){const p=this.parentElement;p.children.splice(p.children.indexOf(this),0,n);n.parentElement=p;}
 closest(selector){for(let n=this;n;n=n.parentElement)if(selector==='label'?n.tagName==='LABEL':selector==='[data-help]'?Boolean(n.dataset.help):selector==='[hidden]'?n.hidden:n.className.split(' ').includes(selector.slice(1)))return n;return null;}
 querySelector(selector){if(selector==='.range-heading label')return this.querySelector('.range-heading')?.querySelector('label');return this.children.flatMap(n=>[n,...n.all()]).find(n=>selector==='small'?n.tagName==='SMALL':selector==='label'?n.tagName==='LABEL':selector==='[data-help]'?Boolean(n.dataset.help):n.className.split(' ').includes(selector.slice(1)))??null;}
 get childNodes(){const self=this;return [...(this.textContent?[{nodeType:3,textContent:this.textContent,before(n){self.children.unshift(n);n.parentElement=self;},remove(){self.textContent='';}}]:[]),...this.children];}
 contains(n){return n===this||this.all().includes(n);}
 removeAttribute(k){delete this[k];}
 matches(){return Boolean(this.open);}
 showPopover(){this.open=true;}
 hidePopover(){this.open=false;}
 getBoundingClientRect(){return {left:20,top:20,bottom:40,width:250,height:80};}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,v){this.listeners[k]=v;}
 showModal(){this.open=true;}
 close(){this.open=false;this.listeners.close?.();}
 focus(){this.focused=true;}
}
test('label help works by focus, touch and keyboard, deduplicates ranges and never pauses',()=>{
 const saved=Object.fromEntries(['document','innerWidth','innerHeight','addEventListener','setTimeout','clearTimeout'].map(k=>[k,globalThis[k]])),root=new Element(),ids=new Map();
 const add=(id,tag='div',parent=root)=>{const e=new Element(tag);e.id=id;ids.set(id,e);parent.append(e);return e;};
 const hidden=add('world-load-file','input');hidden.hidden=true;add('world-load','button');
 const label=new Element('label');label.textContent='Номер опыта';root.append(label);const seed=add('seed','input',label);seed.type='number';
 const checkLabel=new Element('label');checkLabel.textContent='Память';root.append(checkLabel);const check=add('show-memory','input',checkLabel);check.type='checkbox';
 for(const prefix of ['','world-']){const range=new Element('div','range-setting'),heading=new Element('div','range-heading'),caption=new Element('label');caption.textContent='Разброс';root.append(range);range.append(heading);heading.append(caption);for(const suffix of ['','-number']){const input=add(prefix+'food-period-spread'+suffix,'input',suffix?heading:range);input.type=suffix?'number':'range';}}
 globalThis.document={body:root,getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),addEventListener:(k,fn)=>root.addEventListener(k,fn)};globalThis.innerWidth=900;globalThis.innerHeight=600;globalThis.addEventListener=()=>{};
 let clock=0,serial=0;const timers=new Map();globalThis.setTimeout=(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:clock+delay});return id;};globalThis.clearTimeout=id=>timers.delete(id);const advance=ms=>{clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}};
 try{installHelp();const help=root.all().find(e=>e.dataset.help==='seed'),tooltip=root.all().find(e=>e.id==='help-tooltip');
  assert.equal(seed.parentElement,label);assert.equal(check.parentElement,checkLabel);assert.equal(hidden.parentElement,root);
  for(const range of root.children.filter(e=>e.className==='range-setting'))assert.equal(range.all().filter(e=>e.dataset.help).length,1);
  assert.ok(help);assert.equal(help.textContent,'Номер опыта');assert.ok(!root.all().some(e=>e.textContent==='?'));
  root.listeners.focusin({target:help});assert.ok(!tooltip.open);advance(699);assert.ok(!tooltip.open);advance(1);assert.equal(tooltip.open,true);assert.match(tooltip.textContent,/seed|номер/i);
  root.listeners.click({target:help,preventDefault(){},stopPropagation(){}});root.listeners.pointerout({target:help,pointerType:'touch'});advance(200);assert.equal(tooltip.open,true,'touch release keeps help visible');
  root.listeners.keydown({target:help,key:'Escape'});assert.equal(tooltip.open,false);root.listeners.pointerover({target:help});advance(300);root.listeners.pointerout({target:help});advance(700);assert.equal(tooltip.open,false,'leaving cancels pending tooltip');
  root.listeners.keydown({target:help,key:'Enter',preventDefault(){}});assert.equal(tooltip.open,true);
  root.listeners.click({target:root});assert.equal(tooltip.open,false);assert.equal(check.checked,undefined);
 }finally{for(const [key,value]of Object.entries(saved))globalThis[key]=value;}
});
test('world rules live in thematic reference articles and visible numbers have no float tails',async()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="rules(?:-open|-close)?"/);assert.match(html,/class="wiki-branch"/);assert.doesNotMatch(html,/>Автосреда</);
 for(let i=65;i<=71;i++)assert.equal([...html.matchAll(new RegExp('data-ui-text="description'+i+'"','g'))].length,1);
 const {PAGE_TEXT}=await import('../dist/ui-text.js');assert.doesNotMatch(PAGE_TEXT.description67,/\d[.,]\d{5,}/);assert.match(PAGE_TEXT.description68,/включая мышление/);
});
