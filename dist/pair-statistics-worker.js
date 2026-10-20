import {estimatePair} from './pair-statistics.js';
import {quantile} from './statistics-estimates.js';
self.onmessage=({data})=>{
 try{const points=data.points?.map(p=>{const result=estimatePair(p.a,p.b,data.weightMode),spread={};for(const stat of ['mean','median']){const values=result.included.map(w=>w.b[stat]-w.a[stat]).sort((a,b)=>a-b);spread[stat]=values.length>1?{low:quantile(values,.25),high:quantile(values,.75)}:null;}const {included,excluded,...estimate}=result;return {id:p.id,start:p.start,end:p.end,complete:p.complete,...estimate,excludedCount:excluded.length,spread};});self.postMessage({request:data.request,metric:data.metric,result:estimatePair(data.a,data.b,data.weightMode),points});}
 catch(error){self.postMessage({request:data.request,metric:data.metric,error:error.message});}
};
