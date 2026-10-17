import {parentPort,workerData} from 'node:worker_threads';
globalThis.self={postMessage:(m,t)=>parentPort.postMessage(m,t)};
await import(workerData?.url??'../dist/cognition-worker.js');
parentPort.on('message',data=>self.onmessage({data}));
