import {WorldRuntime} from './world-runtime.js';
import {ParallelWorld,computationWorkers} from './parallel-world.js';
// MessageChannel уступает очередь команд между шагами без вложенного
// setTimeout(0), который браузер может ограничивать минимальной задержкой.
const channel=new MessageChannel();let queued=false,timer=null;
const cancel=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
const runtime=new WorldRuntime({send:message=>self.postMessage(message),cancel,executorFactory:(world,settings)=>{
 const workers=computationWorkers(settings?.computeWorkers,globalThis.navigator?.hardwareConcurrency??2,world.agents.length);
 return workers>1?new ParallelWorld(world,{workers}):null;
},wake:delay=>{
 if(timer!==null||queued)return false;
 if(delay>0){timer=setTimeout(()=>{timer=null;if(!queued){queued=true;channel.port2.postMessage(null);}},Math.ceil(delay));}
 else{queued=true;channel.port2.postMessage(null);}
 return true;
}});
// Единственная очередь включает await: команда/экспорт не видят полуподшаг.
let tasks=Promise.resolve();
const enqueue=fn=>{tasks=tasks.then(fn).catch(error=>{runtime.setRunning(false);self.postMessage({type:'fatal',error:error.message});});};
channel.port1.onmessage=()=>{queued=false;enqueue(()=>runtime.pulse());};
self.onmessage=event=>enqueue(()=>runtime.handle(event.data));
