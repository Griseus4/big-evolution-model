import {createAnalysisEngine} from './analysis-builder-core.js';
let engine,engines=null,owners=[],errors=[],byOwner=new Map();
self.onmessage=({data})=>{try{
 if(data.type==='start'){engines=data.configs?[]:null;owners=[];errors=[];byOwner=new Map();if(engines){for(const c of data.configs)try{const e=createAnalysisEngine(data.plan,c.config);engines.push(e);byOwner.set(c.id,e);owners.push(c.id);}catch(error){errors.push({id:c.id,error:error.message});}}engine=engines?null:createAnalysisEngine(data.plan,data.config);}
 else if(data.type==='world'){for(const e of data.owners?data.owners.map(id=>byOwner.get(id)).filter(Boolean):engines??[engine])e.add(data.meta,data.projection);self.postMessage({ready:true});}
 else if(data.type==='finish'){if(engines){const results=engines.map((e,i)=>({id:owners[i],result:e.finish()}));engines=null;self.postMessage({results:[...results,...errors]});}else{const result=engine.finish();engine=null;self.postMessage({result});}}
}catch(error){engine=null;engines=null;self.postMessage({error:error.message});}};
