import {preparePairSide} from './pair-statistics.js';
import {preparePairSeries} from './pair-series.js';
/** Одна выбранная пара, периодные сводки и выбранные временные ряды. Строки жизней не уходят
 * в Worker; при смене контекста старый расчёт прекращается. */
export function createPairStatisticsClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./pair-statistics-worker.js',import.meta.url),{type:'module'}),available=()=>typeof Worker!=='undefined'}={}){
 const identities=new WeakMap();let serial=0,request=0,key=null,worker=null,completed=0,total=0,error=null,results=new Map();
 const identity=r=>{if(!r)return null;if(!identities.has(r))identities.set(r,++serial);return identities.get(r);};
 const resultKey=(metric,scope='')=>scope?JSON.stringify([scope,metric]):metric;
 function update(input){updateBatch([{...input,id:''}]);}
 function updateBatch(queries){
  const next=JSON.stringify(queries.map(({id,a,b,metrics,options,weightMode,series=false})=>[id,[a,b].map(s=>[s.id,s.worlds.map(w=>[w.pairId,w.id,identity(w.report),w.seed,w.number,w.extinctions,w.targetTick,w.extinct])]),metrics,options,weightMode,series]));if(next===key)return;
  key=next;request++;worker?.terminate();worker=null;results=new Map();completed=0;total=queries.reduce((n,q)=>n+q.metrics.length,0);error=null;const current=request;if(!total)return;
  if(!available()){error='Фоновое сравнение недоступно: браузер не поддерживает Worker.';return;}
  try{worker=createWorker();}catch(e){error=e.message;return;}
  worker.onmessage=({data})=>{if(data.request!==request)return;results.set(resultKey(data.metric,data.scope),data);completed++;onChange();};
  worker.onerror=e=>{e.preventDefault?.();if(current!==request)return;error=e.message??'Ошибка сравнения.';worker?.terminate();worker=null;onChange();};
  (async()=>{for(const {id,a,b,metrics,options,weightMode,series=false}of queries)for(const metric of metrics){
   if(current!==request||!worker)return;
   try{const prepared=series?preparePairSeries(a.worlds,b.worlds,metric,options):{a:preparePairSide(a.worlds,metric,options),b:preparePairSide(b.worlds,metric,options)},transfer=[prepared,...(prepared.points??[])].flatMap(task=>[...task.a,...task.b].flatMap(w=>[w.values.buffer,...(w.members??[]).map(m=>m.values.buffer)]));worker.postMessage({request:current,metric,scope:id,...prepared,weightMode:['population','food','production'].includes(metric)?'worlds':weightMode},transfer);}
   catch(e){results.set(resultKey(metric,id),{error:e.message});completed++;onChange();}
   await new Promise(resolve=>setTimeout(resolve,0));
  }})();
 }
 return {update,updateBatch,get:(metric,scope='')=>results.get(resultKey(metric,scope)),state:()=>({completed,total,error}),suspend(){if(completed<total){request++;worker?.terminate();worker=null;key=null;}},dispose(){request++;worker?.terminate();worker=null;key=null;results=new Map();}};
}
