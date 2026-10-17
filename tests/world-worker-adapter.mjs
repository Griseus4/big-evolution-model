// Только Node-проверка настоящего модуля Worker; в браузерную сборку не входит.
import {parentPort} from 'node:worker_threads';
import {createCognitionWorker} from './node-cognition-worker.mjs';
globalThis.Worker=class{constructor(url){return createCognitionWorker({url});}};
globalThis.self={postMessage:message=>parentPort.postMessage(message)};
await import('../dist/world-worker.js');
parentPort.on('message',data=>self.onmessage({data}));
