import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {STANDARD_CHARTS,CATALOGUE_METRICS,CHART_CATEGORIES,emptyCatalogue,validateCatalogue,migrateAnalysisTemplate} from '../dist/chart-catalogue.js';
import {groupedExperimentSources,groupingLayout} from '../dist/experiment-grouping.js';
import {analysisWorlds,prepareMetric} from '../dist/statistical-series.js';
import {estimateWorlds} from '../dist/statistics-estimates.js';
import {estimatePair,preparePairSide} from '../dist/pair-statistics.js';
import {preparePairSeries} from '../dist/pair-series.js';
import {ANALYSIS_DEFAULT} from '../dist/analysis-builder-core.js';
import {projectAnalysisWorld} from '../dist/analysis-projection.js';
import {createCatalogueExpressionClient} from '../dist/catalogue-expression-client.js';
const variants=[true,false].flatMap(learning=>[2,5,20].map(digestionTime=>({id:`${learning}-${digestionTime}`,name:`${learning}-${digestionTime}`,settings:{learning,digestionTime}})));
const plan={worlds:5,steps:100,factors:[{key:'learning',values:[true,false]},{key:'digestionTime',values:[2,5,20]}],variants};
const options={start:0,end:100,width:100,mode:'dead',origin:'all',survivalAge:20};
function fixture(){return {plan,groups:variants.flatMap(v=>Array.from({length:5},(_,index)=>{const id=v.id+index,age=20+index+(v.settings.learning?10:0);return {id,variantId:v.id,index,status:'completed',selectedId:id,attempts:[{id,seed:index,number:1,lives:{tick:100,omittedDetails:0,dead:[{id:1,parentId:null,born:0,age,status:'dead',children:0}],living:[],completed:{count:1,meanAge:age,medianAge:age},byCause:{}}}]};}))};}
const grouped=(s=fixture(),group='learning')=>groupedExperimentSources(s,variants,{group,split:'',variantFilters:[]},'worlds');
test('catalogue preserves every native metric, histogram and age curve in exactly one category',()=>{
 const ids=STANDARD_CHARTS.map(d=>d.id);assert.equal(new Set(ids).size,ids.length);
 for(const m of CATALOGUE_METRICS)assert.ok(STANDARD_CHARTS.some(d=>d.kind==='metric'&&d.metric===m.id));
 assert.equal(STANDARD_CHARTS.filter(d=>d.kind==='histogram').length,3);assert.equal(STANDARD_CHARTS.filter(d=>d.kind==='curve').length,1);
 for(const d of STANDARD_CHARTS)assert.equal(CHART_CATEGORIES.filter(c=>c.charts.includes(d.id)).length,1);
 assert.ok(!STANDARD_CHARTS.some(d=>d.kind==='metric'&&d.metric.startsWith('sense')));
});
test('custom native copies, formula migration, hidden standards and categories validate without changing defaults',()=>{
 const original=JSON.stringify(STANDARD_CHARTS),s=validateCatalogue({...emptyCatalogue(),hidden:['lifetime'],categories:[{id:'user-experiment',label:'Мой опыт'}],charts:[{id:'user-copy',kind:'metric',metric:'population',category:'user-experiment',name:'Население'},migrateAnalysisTemplate({...ANALYSIS_DEFAULT,axis:'child',expression:'birthAge(N)'},'user-child')]});
 assert.equal(s.charts[0].standard,false);assert.equal(s.charts[1].recipe.expression,'birthAge(N)');assert.equal(JSON.stringify(STANDARD_CHARTS),original);
 assert.throws(()=>validateCatalogue({...s,charts:[...s.charts,{...s.charts[0]}]}),/ID/);
 assert.throws(()=>validateCatalogue({...s,charts:[{...s.charts[0],metric:'unknown'}]}));
 assert.throws(()=>validateCatalogue({...s,charts:[{...s.charts[1],recipe:{expression:'eval(1)'}}]}));
});
test('six variants group either two or three ways; default source IDs and estimates retain old meaning',()=>{
 const s=fixture();assert.equal(grouped(s).length,2);assert.equal(grouped(s,'digestionTime').length,3);
 const legacy=grouped(s,'variant');assert.deepEqual(legacy.map(s=>s.id),variants.map(v=>v.id));assert.ok(legacy.every(s=>s.worlds.length===5&&!s.worlds[0].blockDesign));
 const filtered=groupingLayout(plan,variants.map(v=>v.id),{group:'learning',split:'',variantFilters:[{key:'digestionTime',values:[5]}]});assert.ok(filtered.groups.every(g=>g.variants.length===1));
});
test('native chart confidence resamples five original repeats instead of fifteen dependent worlds',()=>{
 const sources=grouped(),prepared=sources.map(s=>prepareMetric(analysisWorlds(s.report),'lifetime',options)),estimates=prepared.map(p=>estimateWorlds(p.summary.worlds,'worlds',{blockDesign:p.blockDesign}));
 assert.equal(estimates[0].worlds,15);assert.equal(estimates[0].repeats,5);assert.equal(estimates[0].mean,32);
 const independent=estimateWorlds(prepared[0].summary.worlds.slice(0,5),'worlds');assert.deepEqual(estimates[0].confidence,independent.confidence);
 const pair=estimatePair(...sources.map(s=>preparePairSide(s.worlds,'lifetime',options)));assert.equal(pair.pairs,5);assert.equal(pair.mean.difference,-10);assert.ok(Object.values(pair.mean.confidence.difference).every(v=>Math.abs(v+10)<1e-10));assert.equal(pair.included[0].a.members.length,3);
});
test('grouped difference series transfer each nested buffer once and retain the per-repeat median',()=>{
 const [a,b]=grouped(),p=preparePairSeries(a.worlds,b.worlds,'lifetime',options),buffers=[p,...p.points].flatMap(t=>[...t.a,...t.b].flatMap(w=>[w.values.buffer,...w.members.map(m=>m.values.buffer)]));assert.equal(new Set(buffers).size,buffers.length);const copy=structuredClone(p,{transfer:buffers});assert.ok(buffers.every(b=>b.byteLength===0));const r=estimatePair(copy.points[0].a,copy.points[0].b);assert.equal(r.pairs,5);assert.equal(r.included[0].a.median,30);assert.equal(r.median.difference,-10);
});
test('a missing level excludes its whole repeat and discloses the level; censored survival stays unknown',()=>{
 const s=fixture();s.groups.find(g=>g.variantId==='true-20'&&g.index===4).attempts[0].lives.dead=[];
 const source=grouped(s)[0],p=prepareMetric(analysisWorlds(source.report),'lifetime',options),r=estimateWorlds(p.summary.worlds,'worlds',{blockDesign:p.blockDesign});
 assert.equal(r.repeats,4);assert.equal(r.worlds,12);assert.deepEqual(r.excluded,[{pairId:4,variants:['true-20']}]);assert.equal(r.confidence,null);
 const life=s.groups[0].attempts[0].lives;life.living=[{id:2,parentId:null,born:1,age:1,status:'alive'}];const survival=prepareMetric(grouped(s)[0].worlds,'survival',options);assert.equal(survival.summary.worlds.length,0);
});
test('real Worker batches two definitions in one projection stream and preserves numeric transfers',async()=>{
 const url=new URL('../dist/analysis-builder-worker.js',import.meta.url).href,worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:m=>parentPort.postMessage(m)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true})});`,{eval:true});
 try{await once(worker,'message');const p={worlds:1,factors:[],variants:[{id:'a',settings:{}}]},config={...ANALYSIS_DEFAULT,...options,group:'',split:'',confidence:false};worker.postMessage({type:'start',plan:p,configs:[{id:'age',config},{id:'twice',config:{...config,expression:'2*age'}},{id:'bad',config:{...config,axis:'absent'}}]});
  const projection=await projectAnalysisWorld({dead:[{id:1,parentId:null,born:0,age:40,status:'dead'}],living:[]},['id','born','age','alive'],options),ack=once(worker,'message');worker.postMessage({type:'world',meta:{variantId:'a',pairId:0,id:'world'},projection},Object.values(projection.columns).map(a=>a.buffer));await ack;assert.equal(projection.columns.age.byteLength,0);const done=once(worker,'message');worker.postMessage({type:'finish'});const [answer]=await done;assert.deepEqual(answer.results.filter(r=>r.result).map(r=>[r.id,r.result.cells[0].value]),[['age',40],['twice',80]]);assert.match(answer.results.find(r=>r.id==='bad').error,/отсутствует/);
 }finally{await worker.terminate();}
});
test('formula client preserves factor axes, labels and grouping; all visible formulas share one Worker',async()=>{
 let creations=0,resolve;const done=new Promise(r=>resolve=r),seen=[];
 const client=createCatalogueExpressionClient({onChange:()=>resolve(),createWorker:()=>{creations++;return {postMessage(m){seen.push(m);if(m.type==='start')this.configs=m.configs;queueMicrotask(()=>this.onmessage({data:m.type==='finish'?{results:this.configs.map(c=>({id:c.id,result:{groups:[{id:JSON.stringify([['chartGroup','chosen']])}],cells:[],xs:[]}}))}:{ready:true}}));},terminate(){}};}});
 const s=grouped()[0];s.id='chosen';const cards=['first','second'].map(id=>({definition:{id,name:id,recipe:{...ANALYSIS_DEFAULT,axis:'digestionTime',expression:'age'}}}));
 client.update({cards,comparison:{variants:[s]},report:s.report,options,start:0,end:100,plan});await done;assert.equal(creations,1);const start=seen[0];assert.ok(start.plan.factors.some(f=>f.key==='digestionTime'));assert.equal(start.plan.variants[0].settings.digestionTime,2);assert.equal(start.configs.length,2);assert.equal(client.get('first').groups[0].label,s.name);
 client.update({cards,comparison:{variants:[s]},report:s.report,options,start:0,end:100,plan});assert.equal(creations,1);client.dispose();
});
