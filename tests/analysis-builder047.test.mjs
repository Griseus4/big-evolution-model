import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {compileExpression} from '../dist/analysis-expression.js';
import {createAnalysisEngine,ANALYSIS_DEFAULT,validateAnalysis,analysisPlan} from '../dist/analysis-builder-core.js';
import {installAnalysisBuilder} from '../dist/analysis-builder-ui.js';
import {projectAnalysisWorld} from '../dist/analysis-projection.js';
import {experimentArchive,openExperimentArchive} from '../dist/experiment-archive.js';
const factors=[{key:'learning',values:[true,false]},{key:'digestionTime',values:[2,5,20]}];
const variants=factors[0].values.flatMap(learning=>factors[1].values.map(digestionTime=>({id:`${learning}-${digestionTime}`,settings:{learning,digestionTime}})));
const plan={name:'Два на три',worlds:5,steps:100,factors,variants};
const config=overrides=>({...ANALYSIS_DEFAULT,start:0,end:100,width:100,...overrides});
const row=(id,born,extra={})=>({id,parentId:null,born,age:30,status:'dead',children:0,eaten:2,meanEnergy:20,...extra});
async function analyze(c,makeReport=()=>({dead:[row(1,0)],living:[]})){
 const engine=createAnalysisEngine(plan,c);for(const v of variants)for(let pairId=0;pairId<plan.worlds;pairId++){
  const report=makeReport(v,pairId),fields=[...new Set(['id','born','alive',...compileExpression(c.expression).fields,...compileExpression(c.filter).fields])].filter(f=>f!=='N');
  const p=report?await projectAnalysisWorld(report,fields,{...c,needBirths:compileExpression(c.expression).births.length>0}):null;
  engine.add({id:v.id+pairId,variantId:v.id,pairId,seed:pairId,number:1,extinctions:0},p);
 }return engine.finish();
}
test('expression grammar propagates missing data, prevents execution and supports rank events',()=>{
 const expr=compileExpression('100 * eaten / age');assert.equal(expr.evaluate(k=>({eaten:3,age:20})[k]),15);assert.equal(expr.evaluate(k=>({eaten:3,age:0})[k]),null);
 assert.equal(compileExpression('missing(meanEnergy) || age >= 10 && children == 0').evaluate(k=>({meanEnergy:null,age:1,children:1})[k]),1);
 assert.equal(compileExpression('birthAge(N)').evaluate(k=>k==='N'?3:null,n=>n*10),30);
 for(const text of ['globalThis.constructor','x = 2','eval(1)','birthAge(0)','(1+2','1e999','a[0]'])assert.throws(()=>compileExpression(text));
 assert.throws(()=>validateAnalysis(config({expression:'typo'})),/Неизвестное поле/);assert.throws(()=>validateAnalysis(config({expression:'birthAge(N)'})),/N доступно/);
});
test('six variants collapse into two groups with five repeat blocks, not fifteen independent samples',async()=>{
 const output=await analyze(config({}), (v,r)=>({dead:[row(1,0,{age:v.settings.digestionTime+r})],living:[]}));
 assert.equal(output.groups.length,2);for(const c of output.cells){assert.equal(c.repeats,5);assert.equal(c.worlds,15);assert.equal(c.count,15);assert.equal(c.value,11);assert.ok(c.interval.low<=11&&c.interval.high>=11);}
 const triple=await analyze(config({group:'digestionTime',axis:'learning'}));assert.equal(triple.groups.length,3);assert.equal(triple.cells.length,6);
});
test('equal-world and equal-individual medians retain distinct meanings',async()=>{
 const reports=v=>({dead:(v.settings.digestionTime===2?[1,2,3]:[1,2,3,4,5,6,7,8,9]).map((age,i)=>row(i+1,0,{age})),living:[]});
 const filter=[{key:'digestionTime',values:[2,5]}];
 const worlds=await analyze(config({aggregate:'median',variantFilters:filter}),reports),people=await analyze(config({aggregate:'median',weight:'individuals',variantFilters:filter}),reports);
 assert.equal(worlds.cells[0].value,3);assert.equal(people.cells[0].value,3.5);
});
test('missing factor level excludes the corresponding repeat visibly; no fabricated zeros or CI',async()=>{
 const output=await analyze(config({}), (v,r)=>r===4&&v.settings.digestionTime===20?null:{dead:[row(1,0)],living:[]});
 for(const c of output.cells){assert.equal(c.repeats,4);assert.equal(c.interval,null);assert.deepEqual(c.excluded.map(e=>e.pairId),[4]);assert.equal(c.value,30);}
});
test('rank births link the complete history outside parent birth window and mark absent events missing',async()=>{
 const c=config({axis:'child',expression:'birthAge(N)',start:0,end:1,maxChild:3,mode:'all'});
 const output=await analyze(c,()=>({dead:[row(2,10,{parentId:1}),row(3,22,{parentId:1})],living:[row(1,0,{age:24,status:'alive',children:2})]}));
 for(const cell of output.cells){if(cell.x===1)assert.equal(cell.value,10);if(cell.x===2)assert.equal(cell.value,22);if(cell.x===3){assert.equal(cell.value,null);assert.equal(cell.repeats,0);assert.ok(cell.details.every(w=>w.count===0&&w.missing===1));}}
 const incomplete=await analyze(config({expression:'birthAge(2)'}),()=>({dead:[row(1,0,{children:3}),row(2,10,{parentId:1}),row(3,22,{parentId:1})],living:[]}));assert.ok(incomplete.cells.every(c=>c.value===null));
});
test('ratios, percentages and all-zero counts remain distinct from absence',async()=>{
 const percent=await analyze(config({expression:'children == 0',aggregate:'percent'}));assert.equal(percent.cells[0].value,100);
 const count=await analyze(config({filter:'age > 1000',aggregate:'count'}));assert.equal(count.cells[0].value,0);assert.equal(count.cells[0].repeats,5);
 const missing=await analyze(config({expression:'meanHealth'}));assert.equal(missing.cells[0].value,null);
});
test('archive projection reads birth links without materializing/replacing the normal window',async()=>{
 const life={tick:100,dead:[row(1,0,{children:2}),row(2,10,{parentId:1}),row(3,22,{parentId:1})],living:[]},report={format:'sample',plan,groups:[{attempts:[{lives:life}]}]};
 const archive=await experimentArchive(report),opened=await openExperimentArchive(archive,{validate:false}),archived=opened.groups[0].attempts[0].lives;
 const p=await projectAnalysisWorld(archived,['id','born'],{start:0,end:1,mode:'all',origin:'all',needBirths:true});assert.equal(p.eligible,1);assert.equal(p.timeline.id.length,3);assert.equal(archived.dead.length,0);
 await assert.rejects(()=>projectAnalysisWorld(life,['id'],config({}),()=>true),/отменён/);
});
test('real analysis Worker accepts streamed numeric worlds and returns grouped results',async()=>{
 const url=new URL('../dist/analysis-builder-worker.js',import.meta.url).href,worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true})});`,{eval:true});
 try{await once(worker,'message');worker.postMessage({type:'start',plan,config:config({confidence:false})});for(const v of variants)for(let pairId=0;pairId<5;pairId++){const p=await projectAnalysisWorld({dead:[row(1,0)],living:[]},['id','born','age','alive'],config({})),ack=once(worker,'message');worker.postMessage({type:'world',meta:{id:v.id+pairId,variantId:v.id,pairId},projection:p},Object.values(p.columns).map(a=>a.buffer));assert.equal(p.columns.age.byteLength,0);const [a]=await ack;assert.ok(a.ready);}const done=once(worker,'message');worker.postMessage({type:'finish'});const [answer]=await done;assert.equal(answer.result.cells[0].value,30);assert.equal(answer.result.cells[0].repeats,5);}finally{await worker.terminate();}
});
test('genomes become compact categories and legacy variant lists can still be compared',()=>{
 const raw={worlds:5,factors:[{key:'baseGenome',values:[{name:'A',genes:[1,2]},{name:'B',genes:[3,4]}]}],variants:[{id:'v1',settings:{baseGenome:[1,2]}},{id:'v2',settings:{baseGenome:[3,4]}}]},view=analysisPlan(raw);
 assert.equal(view.variants[0].settings.baseGenome,'1 · A');assert.equal(view.variants[1].settings.baseGenome,'2 · B');assert.equal(analysisPlan(raw),view);assert.equal(view.factors.at(-1).key,'variant');
 assert.equal(analysisPlan({worlds:1,variants:[{id:'old',settings:{}}]}).variants[0].settings.variant,'old');
});
test('editor submit builds a result and survives failed imports without changing the formula',async()=>{
 class Element{constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.style={};this.files=[];this.checked=false;this.hidden=false;}
  append(...nodes){this.children.push(...nodes);if(this.tagName==='select'&&!this.value)this.value=nodes[0]?.value??'';}insertBefore(node,before){const i=this.children.indexOf(before);this.children.splice(i<0?0:i,0,node);}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(){}addEventListener(type,fn){this.listeners[type]=fn;}getContext(){return null;}getBoundingClientRect(){return {width:700};}focus(){} }
 const host=new Element('section'),root={getElementById:id=>id==='history-builder-screen'?host:null,createElement:tag=>new Element(tag)},walk=n=>[n,...n.children.flatMap(walk)],series={plan,groups:variants.flatMap(v=>Array.from({length:5},(_,index)=>({id:v.id+index,variantId:v.id,index,status:'completed',selectedId:'a',attempts:[{id:'a',number:1,seed:index,lives:{dead:[row(1,0)],living:[]}}]})))};
 const previous=globalThis.Worker;class FakeWorker{postMessage(message){try{if(message.type==='start')this.engine=createAnalysisEngine(message.plan,message.config);else if(message.type==='world'){this.engine.add(message.meta,message.projection);queueMicrotask(()=>this.onmessage({data:{ready:true}}));}else queueMicrotask(()=>this.onmessage({data:{result:this.engine.finish()}}));}catch(e){queueMicrotask(()=>this.onmessage({data:{error:e.message}}));}}terminate(){} }
 globalThis.Worker=FakeWorker;
 try{installAnalysisBuilder({root,getExperiment:()=>series});const nodes=walk(host),form=nodes.find(n=>n.tagName==='form'),expression=nodes.find(n=>n.name==='expression');await form.listeners.submit({preventDefault(){}});assert.ok(walk(host).some(n=>n.textContent?.startsWith('Готово:')));assert.ok(walk(host).some(n=>n.tagName==='td'&&n.textContent==='30,0'));
  const input=nodes.find(n=>n.type==='file');input.files=[{size:10,text:async()=>JSON.stringify({format:'bad'})}];await input.listeners.change();assert.equal(expression.value,'age');assert.ok(walk(host).some(n=>n.textContent?.includes('Нужен шаблон анализа')));
 }finally{globalThis.Worker=previous;}
});
