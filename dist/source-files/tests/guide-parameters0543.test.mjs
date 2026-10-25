import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_PARAMETERS,guideParameterValue,installGuideParameters} from '../dist/guide-parameters.js';
import {RULES,Evolution} from '../dist/evolution.js';
import {worldPresentation} from '../dist/world-view.js';

test('accepted world settings survive the observer protocol; defaults and missing values stay distinct',()=>{
 const world=new Evolution({population:1,seed:42,digestionTime:5,reproduction:{maturity:150,energy:60,health:50,birthInterval:200}});
 const snapshot=worldPresentation(world,{trail:{points:[]},staticMap:true});
 assert.equal(guideParameterValue('digestionTime',snapshot.metadata),5);
 assert.equal(guideParameterValue('maturity',snapshot.metadata),150);
 assert.equal(guideParameterValue('digestionTime'),RULES.foodEnergy/RULES.digestionRate);
 assert.equal(guideParameterValue('maturity',{}),null);
 assert.equal(guideParameterValue('birthEnergy',{reproduction:{health:50}}),null);
 for(const key of Object.keys(GUIDE_PARAMETERS))assert.ok(Number.isFinite(guideParameterValue(key)));
});

test('reader explicitly selects a report variant, refreshes accepted settings and never edits them',()=>{
 const nodes=new Map();const make=()=>({value:'',dataset:{},children:[],listeners:{},append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;},addEventListener(n,f){this.listeners[n]=f;}});
 for(const id of ['guide-context','guide-context-note','guide-parameter-rows'])nodes.set(id,make());
 const bound=make();bound.dataset.guideParam='digestionTime';
 const root={getElementById:id=>nodes.get(id),createElement:make,querySelectorAll:()=>[bound]};
 let world={digestionTime:5},variants=[{id:'v1',name:'Быстрый',settings:{digestionTime:2}}];
 const saved=JSON.stringify(variants),ui=installGuideParameters({root,getWorld:()=>world,getVariants:()=>variants}),select=nodes.get('guide-context');
 select.value='variant:v1';select.listeners.change();assert.equal(bound.textContent,'2 Т');assert.match(nodes.get('guide-context-note').textContent,/Быстрый/);
 select.value='world';select.listeners.change();assert.equal(bound.textContent,'5 Т');
 world={digestionTime:7};ui.refresh();assert.equal(bound.textContent,'7 Т');assert.equal(JSON.stringify(variants),saved);
 world={};ui.refresh();assert.equal(bound.textContent,'нет данных');
 variants=[];select.value='variant:v1';ui.refresh();assert.equal(select.value,'defaults');assert.equal(nodes.get('guide-parameter-rows').children.length,Object.keys(GUIDE_PARAMETERS).length);
});
