import {runVersionBenchmarks} from './benchmark-comparison-runner.js';
let stopped=false,busy=false;
self.onmessage=async event=>{
 if(event.data.type==='stop'){stopped=true;return;}
 if(event.data.type!=='run'||busy)return;
 busy=true;stopped=false;
 try{
  const report=await runVersionBenchmarks({...event.data.config,shouldStop:()=>stopped,
   onReady:report=>self.postMessage({type:'ready',versions:report.versions}),
   onProgress:progress=>self.postMessage({type:'progress',progress}),onCase:row=>self.postMessage({type:'case',row})});
  self.postMessage({type:'done',report});
 }catch(error){self.postMessage({type:'error',message:error.message});}
 finally{busy=false;}
};
