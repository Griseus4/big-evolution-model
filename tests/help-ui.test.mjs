/** Проверяет настоящий установщик: скрытая загрузка, общие поля и отсутствие
 * команды паузы. Размеры/выравнивание требуют дополнительной проверки браузером. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {installHelp} from '../dist/help.js';
import {readFileSync} from 'node:fs';
class Element{
 constructor(tag='div',className=''){this.tagName=tag.toUpperCase();this.className=className;this.children=[];this.dataset={};this.listeners={};this.hidden=false;}
 append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(x=>x!==n);this.children.push(n);n.parentElement=this;}}
 before(n){const p=this.parentElement;p.children.splice(p.children.indexOf(this),0,n);n.parentElement=p;}
 closest(selector){for(let n=this;n;n=n.parentElement)if(selector==='label'?n.tagName==='LABEL':selector==='[data-help]'?Boolean(n.dataset.help):selector==='[hidden]'?n.hidden:n.className.split(' ').includes(selector.slice(1)))return n;return null;}
 querySelector(selector){return this.children.flatMap(n=>[n,...n.all()]).find(n=>selector==='small'?n.tagName==='SMALL':n.className.split(' ').includes(selector.slice(1)))??null;}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,v){this.listeners[k]=v;}
 showModal(){this.open=true;}
 close(){this.open=false;this.listeners.close?.();}
 focus(){this.focused=true;}
}
test('help attaches once to range pairs, skips hidden input and never calls pause',()=>{
 const old=globalThis.document,root=new Element(),ids=new Map(),add=(id,tag='div',parent=root)=>{const e=new Element(tag);e.id=id;ids.set(id,e);parent.append(e);return e;};
 const dialog=add('help-dialog');add('help-title');add('help-body');add('help-close','button');
 const file=add('world-load-file','input');file.hidden=true;add('world-load','button');
 const label=new Element('label');root.append(label);const seed=add('seed','input',label);seed.type='number';
 const checkboxLabel=new Element('label');root.append(checkboxLabel);const checkbox=add('show-memory','input',checkboxLabel);checkbox.type='checkbox';
 for(const prefix of ['','world-']){
  const range=new Element('div','range-setting'),heading=new Element('div','range-heading');root.append(range);range.append(heading);
  for(const suffix of ['','-number']){const input=add(prefix+'food-period-spread'+suffix,'input',suffix?heading:range);input.type=suffix?'number':'range';}
 }
 let paused=0;
 globalThis.document={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),addEventListener:(k,fn)=>root.addEventListener(k,fn),querySelectorAll:()=>root.all().filter(e=>e.dataset.help)};
 try{
  installHelp(()=>paused++);
  assert.equal(file.parentElement,root);assert.equal(root.all().filter(e=>e.dataset.help==='world-load-file').length,0);
  for(const range of root.children.filter(e=>e.className==='range-setting'))assert.equal(range.all().filter(e=>e.dataset.help).length,1);
  assert.ok(seed.parentElement.parentElement.className.includes('help-field'));assert.equal(checkbox.parentElement,checkboxLabel);
  const button=root.all().find(e=>e.dataset.help==='seed');assert.equal(button.parentElement,seed.parentElement.parentElement);
  root.listeners.click({target:button,preventDefault(){},stopPropagation(){}});assert.equal(dialog.open,true);assert.equal(paused,0);
  // Неизменённая кнопка получает фокус после закрытия; сам input не активируется.
  button.isConnected=true;dialog.close();assert.equal(button.focused,true);
 }finally{globalThis.document=old;}
});
test('world rules live in thematic reference articles and visible numbers have no float tails',async()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="rules(?:-open|-close)?"/);assert.match(html,/class="wiki-branch"/);assert.doesNotMatch(html,/>Автосреда</);
 for(let i=65;i<=71;i++)assert.equal([...html.matchAll(new RegExp('data-ui-text="description'+i+'"','g'))].length,1);
 const {PAGE_TEXT}=await import('../dist/ui-text.js');assert.doesNotMatch(PAGE_TEXT.description67,/\d[.,]\d{5,}/);assert.match(PAGE_TEXT.description68,/включая мышление/);
});
