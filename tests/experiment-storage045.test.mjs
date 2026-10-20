import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {experimentArchive,openExperimentArchive,loadArchiveWindow,materializeExperiment,encodeLifeTable,decodeLifeTable,readExperimentFile,archiveOrigin,archiveWindowReady} from '../dist/experiment-archive.js';
import {populationCohorts} from '../dist/population-statistics.js';
import {mergeLifeReports} from '../dist/experiment-statistics.js';
import {prepareMetric} from '../dist/statistical-series.js';
import {estimateWorlds} from '../dist/statistics-estimates.js';
import {ExperimentStore} from '../dist/experiment-store.js';
import {preparePairSide,estimatePair} from '../dist/pair-statistics.js';
import {preparePairSeries} from '../dist/pair-series.js';
const life=(id,born,status='dead')=>({id,born,endTick:born+15.1,age:15.1,status,parentId:id===1?null:1,cause:status==='dead'?'age':null,meanEnergy:id/3,observedSteps:15.1,eaten:id,moved:id,children:id%3,emptyEnergySteps:id/8,heritable:{schema:'test',shortCapacity:3},observations:{schema:'test',inventorySubsteps:[0,1,2],brainCalls:id}});
function fixture(){const dead=[life(1,1000),life(2,0),life(3,500),life(4,1100)],living=[life(5,1200,'alive')];return {format:'big-evolution-experiment',version:1,plan:{name:'Кириллица 🍏'},groups:[{attempts:[{id:'a',lives:{tick:1300,dead,living,completed:{count:4,meanAge:15.1,medianAge:15.1},byCause:{age:{count:4}},omittedDetails:0,foodAvailability:{prefix:[0,10,20],partialSum:0},foodProductionHistory:[{tick:0,value:2}]}}]}]};}
const quiet={yieldControl:async()=>{}};
test('compact table retains absent/null, nested/empty values, arrays, Unicode and full precision',()=>{
 const rows=[{id:1,a:null,n:{x:1.2345678901234567},arr:[1,null,'🍏'],empty:{},v:false},{id:2,n:{x:2},arr:[],empty:{},v:false}];const schemas=[],encoded=encodeLifeTable(rows,schemas);
 assert.deepEqual(decodeLifeTable(encoded.table,schemas[encoded.schema]),rows);assert.ok(encoded.table.constants.length>0);assert.ok(encoded.table.missing.length>0);
 const safe=JSON.parse('{"__proto__":{"foo":1},"constructor":2}'),s=[],e=encodeLifeTable([safe],s);assert.deepEqual(decodeLifeTable(e.table,s[e.schema])[0],safe);assert.equal({}.foo,undefined);
});
test('archive round-trip retains every field, source order and compressed JSON compatibility',async()=>{
 const original=fixture(),blob=await experimentArchive(original,quiet),opened=await readExperimentFile(blob),full=await materializeExperiment(opened);assert.deepEqual(full,original);assert.equal(blob.type,'application/octet-stream');
 assert.deepEqual(await readExperimentFile(new Blob([JSON.stringify(original)])),original);assert.deepEqual(await readExperimentFile(new Blob([gzipSync(JSON.stringify(original))])),original);
});
test('selective reading skips unrelated blocks; a new period and re-export never lose unloaded lives',async()=>{
 const original=fixture(),blob=await experimentArchive(original,quiet),opened=await openExperimentArchive(blob,{validate:false}),header=opened.groups[0].attempts[0].lives,origin=archiveOrigin(header);
 assert.equal(origin.reader.reads,0);assert.equal(header.dead.length,0);
 const window=await loadArchiveWindow(header,[[500,1000]]);assert.deepEqual(window.dead,[original.groups[0].attempts[0].lives.dead[2]]);assert.equal(window.living.length,0);assert.equal(origin.reader.reads,2);assert.equal(window.totalLiving,1);assert.equal(archiveWindowReady(window,[[500,1000]]),true);
 opened.groups[0].attempts[0].lives=window;const again=await openExperimentArchive(await experimentArchive(opened,quiet));assert.deepEqual(await materializeExperiment(again),original);
 const changed=await loadArchiveWindow(window,[[1000,1300]]);assert.deepEqual(changed.dead.map(r=>r.id),[1,4]);assert.equal(changed.living.length,1);
});
test('population and complete heading summaries survive a restricted birth window',async()=>{
 const original=fixture(),old=original.groups[0].attempts[0].lives,report=await openExperimentArchive(await experimentArchive(original,quiet)),view=await loadArchiveWindow(report.groups[0].attempts[0].lives,[[500,1000]]);
 const options={start:0,end:1301,width:100},source=r=>({id:'a',report:r,targetTick:1400,extinct:false});assert.deepEqual(populationCohorts(source(view),options),populationCohorts(source(old),options));
 for(const mode of ['worlds','individuals']){const before=mergeLifeReports([source(old)],mode),after=mergeLifeReports([source(view)],mode);assert.deepEqual(after.completed,before.completed);assert.deepEqual(after.byCause,before.byCause);assert.equal(after.totalLiving,before.totalLiving);}
});
test('mean, individual medians and bootstrap intervals match for both weights and non-aligned windows',async()=>{
 const reports=Array.from({length:5},(_,i)=>{const r=fixture();r.groups[0].attempts[0].lives.dead.push(life(10+i,600+i));return r;}),windows=[[501,1150]],options={start:501,end:1150,width:100,origin:'all',mode:'dead',survivalAge:10};
 const full=reports.map((r,i)=>({id:String(i),pairId:i,report:r.groups[0].attempts[0].lives})),part=[];
 for(let i=0;i<reports.length;i++){const r=await openExperimentArchive(await experimentArchive(reports[i],quiet));part.push({id:String(i),pairId:i,report:await loadArchiveWindow(r.groups[0].attempts[0].lives,windows)});}
 for(const metric of ['energy','movement','eating','children','survival']){
  const a=prepareMetric(full,metric,options),b=prepareMetric(part,metric,options);assert.deepEqual(b,a);for(const mode of ['worlds','individuals'])assert.deepEqual(estimateWorlds(a.summary.worlds,mode),estimateWorlds(b.summary.worlds,mode));
  const whole=preparePairSide(full,metric,options),window=preparePairSide(part,metric,options);assert.deepEqual(window,whole);assert.deepEqual(preparePairSeries(part,part,metric,options),preparePairSeries(full,full,metric,options));
  for(const mode of ['worlds','individuals']){const compared=estimatePair(window,window,mode);assert.equal(compared.pairs,5);assert.deepEqual(compared,estimatePair(whole,whole,mode));}
 }
});
test('truncated archive, corrupt gzip and malformed rows are rejected before publication',async()=>{
 const blob=await experimentArchive(fixture(),quiet);await assert.rejects(openExperimentArchive(blob.slice(0,-1)),/архив/);
 const bytes=new Uint8Array(await blob.arrayBuffer());bytes[bytes.length-4]^=255;await assert.rejects(openExperimentArchive(new Blob([bytes])));
 const bad=fixture();bad.groups[0].attempts[0].lives.dead[0].age=-1;await assert.rejects(openExperimentArchive(await experimentArchive(bad,quiet)),/строка/);
});
test('ongoing observations cannot change frozen row membership or population events during export',async()=>{
 const original=fixture(),expected=structuredClone(original);let changed=false;
 const blob=await experimentArchive(original,{yieldControl:async()=>{if(!changed){changed=true;original.groups[0].attempts[0].lives.dead.push(life(99,1250));}}});
 assert.deepEqual(await materializeExperiment(await openExperimentArchive(blob)),expected);
});
test('failed atomic persistence is retried without marking blocks as already saved',async()=>{
 const store=new ExperimentStore(null);store.ready=Promise.resolve({});let fail=true,attempts=0;
 store.transaction=async(names,mode,action)=>{assert.deepEqual(names,['attempts','runs']);if(fail)throw new Error('quota');return action({attempts:{put(blob){assert.ok(blob instanceof Blob);attempts++;}},runs:{put(){return {};}}});};
 const report={...fixture(),createdAt:'retry'};report.groups[0].attempts[0].status='completed';await assert.rejects(store.save(report),/quota/);fail=false;await store.save(report);assert.equal(attempts,1);await store.save(report);assert.equal(attempts,1);
});
test('a world finishing during compression cannot be listed as saved before its block exists',async()=>{
 const store=new ExperimentStore(null);store.ready=Promise.resolve({});let savedMeta;const blocks=new Map();
 store.transaction=async(names,mode,action)=>action({attempts:{put:(blob,key)=>blocks.set(key,blob)},runs:{put:value=>{savedMeta=value;return {};}}});
 const report={...fixture(),createdAt:'changing'};Object.assign(report.groups[0].attempts[0],{status:'completed'});const second={id:'b',status:'running',tick:0};report.groups[0].attempts.push(second);
 const pending=store.save(report);await Promise.resolve();Object.assign(second,{status:'completed',tick:1300,lives:fixture().groups[0].attempts[0].lives});await pending;
 assert.equal(savedMeta.groups[0].attempts[1].status,'running');assert.equal(blocks.has('changing/b'),false);await store.save(report);assert.equal(savedMeta.groups[0].attempts[1].status,'completed');assert.ok(blocks.get('changing/b') instanceof Blob);
});
