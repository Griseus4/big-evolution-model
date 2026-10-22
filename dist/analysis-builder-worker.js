import {createAnalysisEngine} from './analysis-builder-core.js';
let engine;
self.onmessage=({data})=>{try{
 if(data.type==='start')engine=createAnalysisEngine(data.plan,data.config);
 else if(data.type==='world'){engine.add(data.meta,data.projection);self.postMessage({ready:true});}
 else if(data.type==='finish'){const result=engine.finish();engine=null;self.postMessage({result});}
}catch(error){engine=null;self.postMessage({error:error.message});}};
