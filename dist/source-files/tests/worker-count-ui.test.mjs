/** Реальный модуль панели в минимальном DOM; не проверка отрисовки браузера. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as reports from '../dist/benchmark-report.js';
import * as fixtures from '../dist/benchmark-fixtures.js';
import * as versions from '../dist/benchmark-versions.js';
import * as settings from '../dist/computation-settings.js';
import * as scaling from '../dist/worker-benchmark-settings.js';
import * as lab from '../dist/lab-reports.js';
import * as configs from '../dist/benchmark-configurations.js';
import * as configurationReports from '../dist/configuration-benchmark-report.js';
import {UI_TEXT} from '../dist/ui-text.js';
import {MODEL_VERSION} from '../dist/life-history.js';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../dist/benchmark-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\r?\n/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url','moduleUrl');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.value='';this.checked=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);if(this.tagName==='select'&&!this.value)this.value=this.children[0]?.value??'';}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(name,fn){this.listeners[name]=fn;}
 emit(name,event={}){return this.listeners[name]?.(event);}
 setAttribute(name,value){this.attributes[name]=value;}
 querySelectorAll(selector){return this.children.flatMap(c=>[...((selector==='input'&&c.tagName==='input'||selector==='input:checked'&&c.tagName==='input'&&c.checked)?[c]:[]),...c.querySelectorAll(selector)]);}
 click(){}
}
function boot(){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 for(const kind of ['evaluator','world']){elements.get('benchmark-group-'+kind).checked=true;elements.get('benchmark-repeats-'+kind).value='2';}
 const workers=[],downloads=[];let pauses=0;
 const context=vm.createContext({...reports,...fixtures,...versions,...settings,...scaling,...lab,...configs,...configurationReports,UI_TEXT,MODEL_VERSION,
  document:{getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id);},createElement:tag=>new Element(tag)},
  navigator:{hardwareConcurrency:20,userAgent:'test-dom'},fetch:async()=>({ok:true,json:async()=>({modelVersion:MODEL_VERSION})}),
  Worker:class{constructor(){workers.push(this);}postMessage(message){this.message=structuredClone(message);}terminate(){this.closed=true;}},
  Blob,URL:class extends URL{static createObjectURL(blob){downloads.push(blob);return 'blob:test';}static revokeObjectURL(){}},moduleUrl:new URL('../dist/benchmark-ui.js',import.meta.url).href,setTimeout:()=>0,
  pauseWorld:async()=>{pauses++;},isOtherTestActive:()=>false});
 const tableSource=readFileSync(new URL('../dist/configuration-benchmark-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\r?\n/gm,'').replace(/^export /gm,'');
 vm.runInContext('{'+tableSource+';globalThis.renderConfigurationTable=renderConfigurationTable;}',context);
 vm.runInContext(source+'\nvar ui=installBenchmarkUI({pauseWorld,isOtherTestActive});',context);
 return {elements,workers,downloads,ui:context.ui,get pauses(){return pauses;}};
}
function completeReport(selection){
 return {format:'big-evolution-benchmark',version:5,modelVersion:MODEL_VERSION,seriesId:versions.BENCHMARK_MODEL_SERIES,suiteId:fixtures.BENCHMARK_SUITE_ID,
  protocolId:configs.CONFIGURATION_PROTOCOL,...selection,createdAt:new Date().toISOString(),status:'completed',
  versions:selection.configurations.map(c=>({id:c.id,snapshotId:c.snapshotId,execution:{computeWorkers:c.computeWorkers}})),
  cases:fixtures.BENCHMARK_CASES.filter(s=>selection.groups.includes(s.kind)).flatMap(spec=>configs.configurationsFor(selection,spec).map((c,i)=>({...spec,versionId:c.id,fixtureDigest:'a'.repeat(64),repeats:Array.from({length:selection.repeatCounts[spec.kind]},(_,repeatIndex)=>({repeatIndex,orderIndex:i,computeWorkers:c.computeWorkers,computeMs:100/(i+1),wallMs:101,work:spec.work,steps:spec.kind==='world'?64:0,actions:100,resultDigest:'b'.repeat(64)}))})))
 };
}
function text(element){return element.textContent+' '+element.children.map(text).join(' ');}
function selected(report){report.completedMeasurements=report.cases.reduce((n,c)=>n+c.repeats.length,0);report.plannedMeasurements=configs.plannedConfigurationMeasurements(report,fixtures.BENCHMARK_CASES);return report;}
test('nested version/count UI sends explicit configurations, grouped metrics and round-trips v5',async()=>{
 const b=boot(),e=b.elements,cards=e.get('benchmark-versions').children;
 assert.equal(cards.length,versions.BENCHMARK_VERSIONS.length);
 const latest=cards.at(-1);assert.equal(latest.children[1].querySelectorAll('input').length,9);
 for(const input of latest.children[1].querySelectorAll('input'))input.checked=[1,2].includes(Number(input.value));
 await e.get('benchmark-start').emit('click');assert.equal(b.pauses,1);assert.equal(b.workers.length,1);
 const config=b.workers[0].message.config;assert.deepEqual(config.selections,[{versionId:'0.33.2',workerCounts:[1,2]}]);assert.equal(config.configurations.length,3);
 reports.validateBenchmarkReport(b.ui.getReport());
 const report=selected(completeReport(configs.configurationSelection([{versionId:'0.33.2',workerCounts:[1,2]}],{groups:['evaluator','world'],repeatCounts:{evaluator:2,world:2}})));
 b.workers[0].onmessage({data:{type:'done',report}});assert.equal(b.workers[0].closed,true);
 const displayed=text(e.get('benchmark-results'));assert.match(displayed,/шагов\/с/);assert.match(displayed,/Эффективность/);assert.match(displayed,/×2.00/);assert.match(displayed,/один замер на версию/);assert.doesNotMatch(displayed,/Наименьшее медианное время/);
 await e.get('benchmark-export').emit('click');const exported=JSON.parse(await b.downloads[0].text());reports.validateBenchmarkReport(exported);
 const next=boot();next.ui.restoreReport(exported);assert.match(text(next.elements.get('benchmark-results')),/Эффективность/);
});
test('UI rejects empty counts and preserves unequal and partial reports without automatic recommendations',async()=>{
 const b=boot();for(const input of b.elements.get('benchmark-versions').children.at(-1).children[1].querySelectorAll('input'))input.checked=false;
 await b.elements.get('benchmark-start').emit('click');assert.equal(b.workers.length,0);assert.equal(b.pauses,0);
 assert.match(b.elements.get('benchmark-status').textContent,/число вычислителей/);
 const report=selected(completeReport(configs.configurationSelection([{versionId:'0.33.1',workerCounts:[1,4]}],{groups:['world'],repeatCounts:{world:1}})));
 report.cases[1].repeats[0].resultDigest='c'.repeat(64);b.ui.restoreReport(report);assert.match(text(b.elements.get('benchmark-results')),/разные результаты/);
 const next=boot();report.status='stopped';report.cases[0].repeats=[];selected(report);next.ui.restoreReport(report);
 assert.doesNotMatch(text(next.elements.get('benchmark-results')),/Наименьшее медианное время/);
});
