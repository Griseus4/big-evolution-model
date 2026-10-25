import test from 'node:test';
import assert from 'node:assert/strict';
import {chartFamilies,chartApplicable} from '../dist/chart-applicability.js';
import {Evolution} from '../dist/evolution.js';
import {DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {RESULT,RESULT_WIDTH} from '../dist/cognition-packet.js';
const def=metric=>({standard:true,metric});
test('current, historical and mixed reports retain their own chart families',()=>{
 const v16={heritable:{mainNeurons:0,contextMutationRate:2,mutationRate:null}},old={heritable:{brainNeurons:4,mutationRate:3}},v15={heritable:{mainNeurons:0,mainMutationRate:2}};
 const f=chartFamilies({dead:[v16],living:[]});
 for(const id of ['brainNeurons','brainActiveConnections','structuralRate','mutationRate','mainMutationRate'])assert.equal(chartApplicable(def(id),f),false,id);
 for(const id of ['mainNeurons','contextMutationRate','attentionNeurons','shortCapacity'])assert.equal(chartApplicable(def(id),f),true,id);
 assert.equal(chartApplicable({...def('mainMutationRate'),standard:false},f),true);
 const mixed=chartFamilies({dead:[old,v15,v16]});
 for(const id of ['brainNeurons','mutationRate','mainMutationRate','contextMutationRate'])assert.equal(chartApplicable(def(id),mixed),true,id);
 assert.equal(chartApplicable(def('contextMutationRate'),chartFamilies({dead:[old]})),false);
 assert.equal(chartApplicable(def('mainNeurons'),chartFamilies({dead:[],living:[]})),true);
});
function corruptWorker(corrupt){
 const raw=createCognitionWorker(),bridge={postMessage:(m,t)=>raw.postMessage(m,t),terminate:()=>raw.terminate()};
 raw.onmessage=e=>{const r=e.data.value?.result;if(r)corrupt(r);bridge.onmessage?.(e);};raw.onerror=e=>bridge.onerror?.(e);return bridge;
}
for(const kind of ['choice','gate','learning'])test('invalid '+kind+' cost stops a real Worker world',async()=>{
 const w=new Evolution({brainType:DUAL_BRAIN_TYPE,population:2,seed:49}),pool=new ParallelWorld(w,{workers:1,createWorker:()=>corruptWorker(r=>{
  for(let at=0;at<r.length;at+=RESULT_WIDTH){
   if(kind==='choice')for(let k=0;k<11;k++)r[at+RESULT.costs+k]=0;
   if(kind==='gate')r[at+RESULT.gateCost]=0;
   if(kind==='learning')r[at+RESULT.learningCost]=NaN;
  }
 })});
 try{await assert.rejects(async()=>{for(let i=0;i<3;i++)await pool.step();},/стоимость/);assert.ok(pool.closed);if(kind==='choice')assert.equal(w.stats.brainCalls,0);}finally{await pool.close();}
});
