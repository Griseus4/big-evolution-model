/** Worker — один исполнитель очереди. В нём нет DOM, canvas и сетевой отправки.
 * UI передаёт задание, получает прогресс/отчёт. Остановка обрабатывается между
 * порциями расчёта; уже полученные результаты сохраняются в главной вкладке.
 */
import {runBrowserChecks} from './browser-checks.js';
import {runWorld} from './experiment-runner.js';
import {MODEL_VERSION} from './life-history.js';
let stopped=false,busy=false,computations=1,observing=false;
self.onmessage=async event=>{
 const message=event.data;
 if(message.type==='stop'){stopped=true;return;}
 if(message.type==='computations'){computations=message.value;return;}
 if(message.type==='observe'){observing=Boolean(message.value);return;}
 if(message.type!=='run'||busy)return;
 busy=true;stopped=false;observing=false;computations=message.computations??1;const job=message.job;
 try{
  if(job.kind==='checks'){
   const results=await runBrowserChecks(job.ids,result=>self.postMessage({type:'check',jobId:job.id,result,modelVersion:MODEL_VERSION}));
   self.postMessage({type:'done',jobId:job.id,result:{id:job.id,kind:'checks',modelVersion:MODEL_VERSION,status:results.some(r=>r.status==='failed')?'failed':'completed',results}});
  }else{
   const result=await runWorld(job,{onProgress:progress=>{if(progress.allocationError)computations=progress.computeWorkers;self.postMessage({type:'progress',jobId:job.id,progress});},shouldStop:()=>stopped,getComputations:()=>computations,observe:()=>observing,onSnapshot:lives=>self.postMessage({type:'snapshot',jobId:job.id,lives})});
   self.postMessage({type:'done',jobId:job.id,result});
  }
 }catch(error){self.postMessage({type:'done',jobId:job.id,result:{id:job.id,kind:job.kind,modelVersion:MODEL_VERSION,status:'failed',error:{message:error.message,stack:error.stack??null}}});}
 finally{busy=false;}
};
