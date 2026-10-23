import {estimateWorlds} from './statistics-estimates.js';
self.onmessage=({data})=>{
 try{
  const {request,owner,prepared,weightMode}=data,mode=prepared.weightMode??weightMode??'worlds';
  const estimateTask=worlds=>{const estimate=estimateWorlds(worlds,mode,{confidence:!prepared.incomplete,blockDesign:prepared.blockDesign});if(prepared.incomplete)estimate.reason='История неполная: ДИ отключён.';return estimate;};
  const summary=estimateTask(prepared.summary.worlds),points=prepared.points.map(p=>{const estimate=estimateTask(p.worlds);delete estimate.individual;return {id:p.id,start:p.start,end:p.end,complete:p.complete,...estimate};});
  self.postMessage({request,owner,metric:prepared.metric,summary,points,error:prepared.error});
 }catch(error){self.postMessage({request:data.request,owner:data.owner,metric:data.prepared?.metric,error:error.message});}
};
