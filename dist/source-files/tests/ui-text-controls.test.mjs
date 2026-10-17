import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HELP,ALIASES,PAGE_TEXT,installUIText} from '../dist/ui-text.js';
import {MODEL_VERSION} from '../dist/life-history.js';
import {validateFoodSettings,FOOD_LIMITS} from '../dist/food-settings.js';
import {scheduleFoodIslands} from '../dist/food-islands.js';
import {installPerformanceTabs} from '../dist/performance-tabs.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
test('all page descriptions resolve from the shared catalog and footer follows model metadata',()=>{
 const nodes=[...html.matchAll(/data-ui-text="([^"]+)"/g)].map(m=>({dataset:{uiText:m[1]}}));
 installUIText({querySelectorAll:()=>nodes});
 for(const n of nodes)if(n.dataset.uiText==='release')assert.match(n.textContent,new RegExp(MODEL_VERSION.replaceAll('.','\\.')));else assert.equal(n.innerHTML,PAGE_TEXT[n.dataset.uiText]);
 assert.ok(nodes.length>60);assert.doesNotMatch(html,/<footer>[\s\S]*?0\.32/);
 for(const value of Object.values(PAGE_TEXT))assert.doesNotMatch(value,/<(?:progress|section|input|button)\b|\bid="/);
 for(const [key,value]of Object.entries(HELP)){assert.ok(value[0]&&value[1],key);assert.doesNotMatch(value[1],/Опасная область пока остаётся|При его достижении рождения блокируются/);}
 for(const target of Object.values(ALIASES))assert.ok(HELP[target]);
});
test('central period is capped at300 in model and every form without capping individual spread at300',()=>{
 assert.equal(FOOD_LIMITS.intervalMax,300);assert.equal(validateFoodSettings({foodRegrowInterval:300}).foodRegrowInterval,300);
 assert.throws(()=>validateFoodSettings({foodRegrowInterval:301}));
 for(const prefix of ['','world-','test-'])assert.match(html,new RegExp('id="'+prefix+'food-period"[^>]*max="300"'));
 const groups=scheduleFoodIslands(Array.from({length:20},(_,i)=>({id:i,sources:[]})),42,{foodRegrowInterval:300,foodPeriodSpread:90},0);
 assert.ok(groups.some(g=>g.period>300));assert.ok(groups.every(g=>g.period<=FOOD_LIMITS.individualIntervalMax));
});
test('performance subtabs only change visibility and maintain keyboard selection',()=>{
 const map=new Map();for(const name of ['workers','measurements'])for(const part of ['tab','panel'])map.set(`performance-${part}-${name}`,{listeners:{},setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){this.focused=true;}});
 installPerformanceTabs({getElementById:id=>map.get(id)});assert.equal(map.get('performance-panel-workers').hidden,false);
 map.get('performance-tab-workers').listeners.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(map.get('performance-panel-workers').hidden,true);assert.equal(map.get('performance-tab-measurements').focused,true);
});
