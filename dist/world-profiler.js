/** Измеритель UI не владеет миром. Числовой профиль приходит из Worker;
 * времена DOM/canvas добавляются отдельно и не вычитаются из времени Worker,
 * поскольку два потока могут исполняться одновременно. */
import {PERFORMANCE_LABELS} from './performance-profiler.js';
export class WorldProfiler{
 constructor(client){this.client=client;this.data=null;this.groups={};this.stack=[];this.busy=false;}
 get active(){return this.busy||this.data?.status==='recording';}
 accept(report){this.data=report;}
 async start(world,{context={}}={}){
  this.busy=true;this.groups={};
  try{await this.client.request('profile-start',context);}finally{this.busy=false;}
 }
 async stop(reason='manual'){
  if(!this.active)return;
  this.busy=true;try{this.data=await this.client.request('profile-stop',{reason});}finally{this.busy=false;}
 }
 measureUI(group,fn){
  if(!this.active||!this.client.running)return fn();
  const frame={start:performance.now(),children:0};this.stack.push(frame);
  try{return fn();}finally{
   const elapsed=performance.now()-frame.start;this.stack.pop();
   if(this.stack.length)this.stack.at(-1).children+=elapsed;
   const g=this.groups[group]??={ms:0,calls:0};g.ms+=Math.max(0,elapsed-frame.children);g.calls++;
  }
 }
 report(){
  if(!this.data)return null;
  const report=structuredClone(this.data);
  for(const [id,g]of Object.entries(this.groups)){
   report.groups[id]={...g};report.breakdown.push({id,label:PERFORMANCE_LABELS[id],...g,scope:'interface'});
  }
  report.uiThread={measuredMs:Object.values(this.groups).reduce((n,g)=>n+g.ms,0),note:'Время главного потока; может перекрываться с временем расчёта Worker.'};
  return report;
 }
}
