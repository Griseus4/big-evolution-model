import {estimatePair} from './pair-statistics.js';
self.onmessage=({data})=>{
 try{self.postMessage({request:data.request,metric:data.metric,result:estimatePair(data.a,data.b,data.weightMode)});}
 catch(error){self.postMessage({request:data.request,metric:data.metric,error:error.message});}
};
