import {analysisWorlds,prepareMetric} from './statistical-series.js';
/** Один Worker наблюдателя. При смене контекста старые расчёты прекращаются;
 * при выборе линии/полосы/масштаба используется готовый ответ. */
export function createStatisticsClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./statistics-worker.js',import.meta.url),{type:'module'}),available=()=>typeof Worker!=='undefined'}={}){
 const ids=new WeakMap();let serial=0,request=0,key=null,worker=null,completed=0,total=0,error=null,results=new Map();
 const identify=report=>{if(!ids.has(report))ids.set(report,++serial);return ids.get(report);};
 function update({sources,metrics,options,start,end}){
  const next=JSON.stringify([sources.map(s=>[s.id,analysisWorlds(s.report).map(w=>[w.id,identify(w.report),w.targetTick,w.extinct]),s.report.weightMode]),metrics,options,start,end]);if(next===key)return;
  key=next;request++;worker?.terminate();worker=null;results=new Map();completed=0;total=sources.length*metrics.length;error=null;
  if(!total)return;if(!available()){error='Фоновая статистика недоступна: браузер не поддерживает Worker.';return;}
  const current=request;
  try{worker=createWorker();}catch(e){error=e.message;return;}
  worker.onmessage=({data})=>{if(data.request!==request)return;if(data.points)data.byId=new Map(data.points.map(p=>[p.id,p]));results.set(data.owner+'|'+data.metric,data);completed++;onChange();};
  worker.onerror=e=>{e.preventDefault?.();if(current!==request)return;error=e.message??'Ошибка фоновой статистики.';worker?.terminate();worker=null;onChange();};
  (async()=>{
   for(const source of sources)for(const metric of metrics){
    if(current!==request||!worker)return;
    try{
     const prepared=prepareMetric(analysisWorlds(source.report),metric,{...options,start,end}),transfer=[];
     for(const task of [...prepared.points,prepared.summary])for(const w of task.worlds)transfer.push(w.values.buffer);
     worker.postMessage({request:current,owner:source.id,prepared,weightMode:source.report.weightMode??'worlds'},transfer);
    }catch(e){results.set(source.id+'|'+metric,{error:e.message});completed++;onChange();}
    // Подготовка следующей метрики также не отнимает у UI всю очередь событий.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  })();
 }
 return {update,get:(owner,metric)=>results.get(owner+'|'+metric),state:()=>({completed,total,error}),dispose(){request++;worker?.terminate();worker=null;key=null;}};
}
