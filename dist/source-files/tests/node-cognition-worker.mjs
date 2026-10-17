import {Worker} from 'node:worker_threads';
export function createCognitionWorker({delay=0,url=new URL('../dist/cognition-worker.js',import.meta.url)}={}){
 const node=new Worker(new URL('./cognition-worker-adapter.mjs',import.meta.url),{workerData:{url:String(url)}}),worker={postMessage:(m,t)=>node.postMessage(m,t),terminate:()=>node.terminate()};
 node.on('message',data=>{if(delay)setTimeout(()=>worker.onmessage?.({data}),delay);else worker.onmessage?.({data});});node.on('error',error=>worker.onerror?.(error));return worker;
}
