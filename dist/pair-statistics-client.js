import {preparePairSide} from './pair-statistics.js';
import {preparePairSeries} from './pair-series.js';
/** Одна выбранная пара, периодные сводки и выбранные временные ряды. Строки жизней не уходят
 * в Worker; при смене контекста старый расчёт прекращается. */
export function createPairStatisticsClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./pair-statistics-worker.js',import.meta.url),{type:'module'}),available=()=>typeof Worker!=='undefined'}={}){
 const identities=new WeakMap();let serial=0,request=0,key=null,worker=null,completed=0,total=0,error=null,results=new Map();
 const identity=r=>{if(!r)return null;if(!identities.has(r))identities.set(r,++serial);return identities.get(r);};
 function update({a,b,metrics,options,weightMode,series=false}){
  const next=JSON.stringify([[a,b].map(s=>[s.id,s.worlds.map(w=>[w.pairId,w.id,identity(w.report),w.seed,w.number,w.extinctions,w.targetTick,w.extinct])]),metrics,options,weightMode,series]);if(next===key)return;
  key=next;request++;worker?.terminate();worker=null;results=new Map();completed=0;total=metrics.length;error=null;const current=request;
  if(!available()){error='Фоновое сравнение недоступно: браузер не поддерживает Worker.';return;}
  try{worker=createWorker();}catch(e){error=e.message;return;}
  worker.onmessage=({data})=>{if(data.request!==request)return;results.set(data.metric,data);completed++;onChange();};
  worker.onerror=e=>{e.preventDefault?.();if(current!==request)return;error=e.message??'Ошибка сравнения.';worker?.terminate();worker=null;onChange();};
  (async()=>{for(const metric of metrics){
   if(current!==request||!worker)return;
   try{const prepared=series?preparePairSeries(a.worlds,b.worlds,metric,options):{a:preparePairSide(a.worlds,metric,options),b:preparePairSide(b.worlds,metric,options)},transfer=[prepared,...(prepared.points??[])].flatMap(task=>[...task.a,...task.b].map(w=>w.values.buffer));worker.postMessage({request:current,metric,...prepared,weightMode:['population','food','production'].includes(metric)?'worlds':weightMode},transfer);}
   catch(e){results.set(metric,{error:e.message});completed++;onChange();}
   await new Promise(resolve=>setTimeout(resolve,0));
  }})();
 }
 return {update,get:metric=>results.get(metric),state:()=>({completed,total,error}),suspend(){if(completed<total){request++;worker?.terminate();worker=null;key=null;}},dispose(){request++;worker?.terminate();worker=null;key=null;}};
}
