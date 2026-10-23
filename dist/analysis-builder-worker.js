import {createAnalysisEngine} from './analysis-builder-core.js';
let engine,engines=null,owners=[],errors=[];
self.onmessage=({data})=>{try{
 if(data.type==='start'){engines=data.configs?[]:null;owners=[];errors=[];if(engines){for(const c of data.configs)try{engines.push(createAnalysisEngine(data.plan,c.config));owners.push(c.id);}catch(error){errors.push({id:c.id,error:error.message});}}engine=engines?null:createAnalysisEngine(data.plan,data.config);}
 else if(data.type==='world'){for(const e of engines??[engine])e.add(data.meta,data.projection);self.postMessage({ready:true});}
 else if(data.type==='finish'){if(engines){const results=engines.map((e,i)=>({id:owners[i],result:e.finish()}));engines=null;self.postMessage({results:[...results,...errors]});}else{const result=engine.finish();engine=null;self.postMessage({result});}}
}catch(error){engine=null;engines=null;self.postMessage({error:error.message});}};
