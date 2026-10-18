/** Настоящие модули UI/Canvas с управляемым DOM. Реальные клики/вид проверяются
 * дополнительно в браузере; здесь проверяются данные, выбор и ограничение DOM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installHistoryUI} from '../dist/history-ui.js';
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.checked=true;this.textContent='';this.hidden=false;this.attributes={};}
 append(...children){this.children.push(...children);if(this.tagName==='select'&&!this.value)this.value=this.children[0]?.value??'';}
 replaceChildren(...children){this.children=[];this.append(...children);}
 addEventListener(key,fn){this.listeners[key]=fn;}
 setAttribute(k,v){this.attributes[k]=v;}
 emit(key,event={}){return this.listeners[key]?.({target:this,preventDefault(){},...event});}
 getBoundingClientRect(){return {width:600,left:0};}
 getContext(){return {setTransform(){},clearRect(){},beginPath(){},moveTo(...v){assert.ok(v.every(Number.isFinite));},lineTo(...v){assert.ok(v.every(Number.isFinite));},stroke(){},fill(){},fillRect(...v){assert.ok(v.every(Number.isFinite));},arc(...v){assert.ok(v.every(Number.isFinite));},setLineDash(){},fillText(){}};}
}
function boot(){
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),elements=new Map(),created=[];
 for(const m of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]),value=m[0].match(/\bvalue="([^"]*)"/);if(value)e.value=value[1];elements.set(m[2],e);}
 for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const options=[...m[2].matchAll(/<option\b([^>]*)value="([^"]+)"([^>]*)>/g)],chosen=options.find(o=>/selected/.test(o[1]+o[3]))??options[0];if(chosen)elements.get(m[1]).value=chosen[2];}
 const rows=Array.from({length:125},(_,i)=>({id:i+1,parentId:i%2?1:null,founderId:1,generation:i%2,born:i,age:20,status:'dead',observedSteps:20,moved:i,eaten:2,hungerSteps:1,meanEnergy:60,cause:'starvation'}));
 const report={tick:300,dead:rows,living:[],omittedDetails:0,completed:{count:125,meanAge:20,medianAge:20},byCause:{starvation:{count:125}},foodAvailability:{schema:'ground-food-exposure-v1',prefix:Float64Array.from({length:301},(_,i)=>i*100),substeps:0,partialSum:0}};
 const sim={tick:300,lives:report},root={getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);},createElement:tag=>{const e=new Element(tag);created.push(e);return e;}};
 const ui=installHistoryUI({root,getSimulation:()=>sim});return {elements,created,ui,sim};
}
test('history UI creates eleven charts, four cohort statistics and a bounded paged table',()=>{
 const b=boot();b.ui.refresh();assert.equal(b.created.filter(e=>e.tagName==='canvas').length,11);assert.equal(b.ui.getSummary().cohorts.length,2);assert.equal(b.elements.get('history-rows').children.length,2);
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

test('shared numeric window filters charts and table; independent age cohort stays unchanged',()=>{
 const b=boot();b.ui.refresh();const curve=b.ui.getCurve();
 b.elements.get('history-period-from').value='50';b.elements.get('history-period-to').value='120';b.elements.get('history-period-to').emit('change');
 assert.deepEqual(b.ui.getSummary().cohorts.map(g=>[g.start,g.end,g.born]),[[50,100,50],[100,120,20]]);assert.equal(b.ui.getCurve(),curve);
 b.elements.get('history-table-mode').value='lives';b.elements.get('history-table-mode').emit('input');assert.match(b.elements.get('history-page').textContent,/строк 70/);
 b.elements.get('history-curve-start').value='100';b.elements.get('history-curve-start').emit('change');assert.equal(b.ui.getCurve().count,25);assert.equal(b.ui.getSummary().domainStart,50);
 b.elements.get('history-period-all').emit('click');assert.equal(b.ui.getSummary().domainStart,0);assert.equal(b.ui.getCurve().start,100);
});
test('range handles cannot cross and invalid numeric boundaries preserve the last valid window',()=>{
 const b=boot();b.ui.refresh();b.elements.get('history-period-start').value='350';b.elements.get('history-period-start').emit('input');assert.equal(b.ui.getSummary().domainStart,350);
 b.elements.get('history-period-end').value='100';b.elements.get('history-period-end').emit('input');assert.equal(b.ui.getSummary().domainEnd,351);
 const cached=b.ui.getSummary();b.elements.get('history-period-to').value='350';b.elements.get('history-period-to').emit('change');assert.equal(b.ui.getSummary(),cached);assert.ok(b.elements.get('history-error').textContent);
});
