import {archiveOrigin} from './experiment-archive.js';
import {retainedResults} from './retained-results.js';
import {preparePairSide} from './pair-statistics.js';
import {preparePairSeries} from './pair-series.js';
/** Одна выбранная пара, периодные сводки и выбранные временные ряды. Строки жизней не уходят
 * в Worker; при смене контекста старый расчёт прекращается. */
export function createPairStatisticsClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./pair-statistics-worker.js',import.meta.url),{type:'module'}),available=()=>typeof Worker!=='undefined'}={}){
 const identities=new WeakMap();let serial=0,request=0,key=null,worker=null,completed=0,total=0,error=null,results=new Map();const cache=retainedResults();let jobKeys=new Map(),releaseWait=null;
 const identity=r=>{if(!r)return null;r=archiveOrigin(r)??r;if(!identities.has(r))identities.set(r,++serial);return identities.get(r);};
 const resultKey=(metric,scope='')=>scope?JSON.stringify([scope,metric]):metric;
 function update(input){updateBatch([{...input,id:''}]);}
 function updateBatch(queries){
  const next=JSON.stringify(queries.map(({id,a,b,metrics,options,weightMode,series=false})=>[id,[a,b].map(s=>[s.id,s.worlds.map(w=>[w.pairId,w.id,identity(w.report),w.seed,w.number,w.extinctions,w.targetTick,w.extinct])]),metrics,options,weightMode,series]));if(next===key)return;
  const keys=new Map();for(const q of queries){const context=JSON.stringify([q.id,[q.a,q.b].map(s=>[s.id,s.worlds.map(w=>[w.pairId,w.id,identity(w.report),w.seed,w.number,w.extinctions,w.targetTick,w.extinct])]),q.options,q.weightMode,q.series??false]);for(const m of q.metrics)keys.set(resultKey(m,q.id),context+'|'+m);}jobKeys=keys;
  key=next;request++;releaseWait?.();releaseWait=null;worker?.terminate();worker=null;results=new Map();completed=0;total=queries.reduce((n,q)=>n+q.metrics.length,0);error=null;const current=request;for(const [id,k]of jobKeys){const saved=cache.get(k);if(saved){results.set(id,saved);completed++;}}if(completed===total)return;
  if(!available()){error='Фоновое сравнение недоступно: браузер не поддерживает Worker.';return;}
  try{worker=createWorker();}catch(e){error=e.message;return;}
  worker.onmessage=({data})=>{if(data.request!==request)return;results.set(resultKey(data.metric,data.scope),cache.set(jobKeys.get(resultKey(data.metric,data.scope)),data));completed++;releaseWait?.();releaseWait=null;onChange();};
  worker.onerror=e=>{e.preventDefault?.();if(current!==request)return;error=e.message??'Ошибка сравнения.';worker?.terminate();worker=null;releaseWait?.();releaseWait=null;onChange();};
  (async()=>{for(const {id,a,b,metrics,options,weightMode,series=false}of queries)for(const metric of metrics){
   if(current!==request||!worker)return;
   if(results.has(resultKey(metric,id)))continue;
   try{const prepared=series?preparePairSeries(a.worlds,b.worlds,metric,options):{a:preparePairSide(a.worlds,metric,options),b:preparePairSide(b.worlds,metric,options)},transfer=[prepared,...(prepared.points??[])].flatMap(task=>[...task.a,...task.b].flatMap(w=>[w.values.buffer,...(w.members??[]).map(m=>m.values.buffer)]));const answer=new Promise(resolve=>releaseWait=resolve);worker.postMessage({request:current,metric,scope:id,...prepared,weightMode:['population','food','production'].includes(metric)?'worlds':weightMode},transfer);await answer;}
   catch(e){results.set(resultKey(metric,id),{error:e.message});completed++;onChange();}
   await new Promise(resolve=>setTimeout(resolve,0));
  }})();
 }
 return {update,updateBatch,get:(metric,scope='')=>cache.get(jobKeys.get(resultKey(metric,scope)))??results.get(resultKey(metric,scope)),state:()=>({completed,total,error}),suspend(){if(completed<total){request++;releaseWait?.();releaseWait=null;worker?.terminate();worker=null;key=null;}},dispose(){request++;releaseWait?.();releaseWait=null;worker?.terminate();worker=null;key=null;results=new Map();cache.clear();jobKeys.clear();}};
}
