import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {experimentPreferences} from '../dist/experiment-preferences.js';
import {installChoiceTabs} from '../dist/workspace-ui.js';
test('unavailable or corrupt preference storage never prevents using the form',()=>{
 const messages=[];const p=experimentPreferences({getItem(){return '{';},setItem(){throw new Error('quota');}},m=>messages.push(m));assert.equal(p.draft(),null);assert.equal(p.standard(),null);assert.equal(p.saveDraft({meta:{steps:''}}),false);assert.equal(messages.length,2);
});
test('category tabs change the existing selector; refresh preserves selection and keyboard focus',()=>{
 class Node{constructor(text=''){this.textContent=text;this.children=[];this.events={};this.attrs={};}setAttribute(k,v){this.attrs[k]=v;}append(n){this.children.push(n);}replaceChildren(){this.children=[];}addEventListener(k,fn){(this.events[k]??=[]).push(fn);}dispatchEvent(e){for(const fn of this.events[e.type]??[])fn(e);}click(){this.dispatchEvent({type:'click'});}focus(){this.focused=true;}}
 const select=new Node(),host=new Node();select.value='resources';select.options=[['survival','Выживание'],['resources','Ресурсы']].map(([value,text])=>Object.assign(new Node(text),{value}));let changes=0;select.addEventListener('change',()=>changes++);const sync=installChoiceTabs(select,host,{createElement:()=>new Node()});assert.equal(host.children[1].attrs['aria-selected'],'true');host.children[0].click();assert.equal(select.value,'survival');assert.equal(changes,1);host.children[0].dispatchEvent({type:'keydown',key:'ArrowRight',preventDefault(){}});assert.equal(select.value,'resources');assert.equal(host.children[1].focused,true);sync();assert.equal(host.children[1].attrs['aria-selected'],'true');
});
test('desktop shell retains files/templates, fixed actions and separate sidebar/top categories',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../dist/workspace.css',import.meta.url),'utf8');
 assert.match(html,/<body class="workspace">/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/transition:grid-template-columns/);
 const sidebar=html.slice(html.indexOf('<aside id="history-drawer-left"'),html.indexOf('</aside>',html.indexOf('<aside id="history-drawer-left"')));assert.ok(sidebar.includes('history-period-from'));assert.ok(!sidebar.includes('history-display'));assert.ok(html.indexOf('history-view-tabs')>html.indexOf('</aside>',html.indexOf('<aside id="history-drawer-left"')));
 const form=html.slice(html.indexOf('<section id="test-panel-constructor"'),html.indexOf('<section id="test-panel-runs"'));for(const id of ['constructor-template-tools','constructor-builtins','constructor-common','constructor-base','constructor-import-plan'])assert.ok(form.includes('id="'+id+'"'));
});
