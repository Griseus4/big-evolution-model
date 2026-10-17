import {WORLD_PROTOCOL,WorldView} from './world-view.js';
/** Асинхронные команды имеют номер мира и запроса. Старые ответы после
 * перезапуска не обновляют показ; все ожидающие запросы завершаются ошибкой
 * при аварии Worker. ACK приходит из onmessage, независимо от rAF/видимости. */
export class WorldClient{
 constructor({onState=()=>{},onError=()=>{},worker=new Worker(new URL('./world-worker.js',import.meta.url),{type:'module'})}={}){
  Object.assign(this,{worker,onState,onError});this.epoch=0;this.nextId=0;this.sequence=0;
  this.pending=new Map();this.view=new WorldView();this.ready=false;this.running=false;this.failure=null;
  worker.onmessage=event=>this.receive(event.data);
  worker.onerror=event=>this.fail(event.message||'Не удалось запустить расчётный Worker.');
  worker.onmessageerror=()=>this.fail('Не удалось прочитать сообщение расчётного Worker.');
 }
 fail(message){this.failure=message;this.ready=false;this.running=false;for(const p of this.pending.values())p.reject(new Error(message));this.pending.clear();this.onError(message);}
 request(type,payload={}){
  if(this.failure)return Promise.reject(new Error(this.failure));
  const id=++this.nextId;
  return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({protocol:WORLD_PROTOCOL,epoch:this.epoch,id,type,payload});});
 }
 async init(settings){
  const previous={epoch:this.epoch,sequence:this.sequence,view:this.view,ready:this.ready,running:this.running};
  for(const p of this.pending.values())p.reject(new Error('Опыт перезапущен.'));this.pending.clear();
  const requestedEpoch=++this.epoch;this.sequence=0;this.ready=false;this.running=false;this.view=new WorldView();
  try{return await this.request('init',{settings});}catch(error){if(!this.failure&&this.epoch===requestedEpoch)Object.assign(this,previous);throw error;}
 }
 receive(message){
  if(message.type==='fatal'){this.fail(message.error);return;}
  if(message.protocol!==WORLD_PROTOCOL||message.epoch!==this.epoch)return;
  if(message.type==='state'){
   this.worker.postMessage({protocol:WORLD_PROTOCOL,epoch:this.epoch,type:'ack',payload:{sequence:message.sequence}});
   if(message.sequence<=this.sequence)return;
   this.sequence=message.sequence;this.view.apply(message.state);this.ready=true;this.running=message.running;this.onState(message);
  }else if(message.type==='reply'){
   const p=this.pending.get(message.id);if(!p)return;this.pending.delete(message.id);
   if(message.error)p.reject(new Error(message.error));else p.resolve(message.result);
  }
 }
}
