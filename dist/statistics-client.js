import {metricOptions} from './metric-options.js';
import {archiveOrigin} from './experiment-archive.js';
import {retainedResults} from './retained-results.js';
import {analysisWorlds,prepareMetric} from './statistical-series.js';
/** Один Worker наблюдателя. При смене контекста старые расчёты прекращаются;
 * при выборе линии/полосы/масштаба используется готовый ответ. */
export function createStatisticsClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./statistics-worker.js',import.meta.url),{type:'module'}),available=()=>typeof Worker!=='undefined'}={}){
 const ids=new WeakMap();let serial=0,request=0,key=null,worker=null,completed=0,total=0,error=null,results=new Map();const cache=retainedResults();let jobKeys=new Map(),releaseWait=null,activeJob=null,tasks=[];
 const identify=report=>{report=archiveOrigin(report)??report;if(!ids.has(report))ids.set(report,++serial);return ids.get(report);};
 const owner=(scope,id)=>scope?JSON.stringify([scope,id]):id;
 function update(input){updateBatch([{...input,id:''}]);}
 function updateBatch(queries){
  const next=JSON.stringify(queries.map(({id,sources,metrics,options,start,end})=>[id,sources.map(s=>[s.id,analysisWorlds(s.report).map(w=>[w.id,identify(w.report),w.targetTick,w.extinct]),s.report.weightMode]),metrics,metrics.map(m=>metricOptions(m,options)),start,end]));if(next===key)return;
  const keys=new Map();for(const q of queries)for(const s of q.sources)for(const m of q.metrics)keys.set(owner(q.id,s.id)+'|'+m,JSON.stringify([q.id,s.id,analysisWorlds(s.report).map(w=>[w.id,identify(w.report),w.targetTick,w.extinct]),s.report.weightMode,metricOptions(m,q.options),q.start,q.end,m]));const continuing=activeJob&&[...keys.values()].includes(activeJob);jobKeys=keys;tasks=queries.flatMap(q=>q.sources.flatMap(source=>q.metrics.map(metric=>({...q,source,metric}))));
  key=next;if(!continuing){request++;releaseWait?.();releaseWait=null;worker?.terminate();worker=null;activeJob=null;}results=new Map();completed=0;total=queries.reduce((n,q)=>n+q.sources.length*q.metrics.length,0);error=null;
  for(const [id,k]of jobKeys){const saved=cache.get(k);if(saved){results.set(id,saved);completed++;}}
  if(completed===total||continuing)return;if(!available()){error='Фоновая статистика недоступна: браузер не поддерживает Worker.';return;}
  const current=request;
  try{worker=createWorker();}catch(e){error=e.message;return;}
  worker.onmessage=({data})=>{if(data.request!==request)return;if(data.points)data.byId=new Map(data.points.map(p=>[p.id,p]));results.set(data.owner+'|'+data.metric,cache.set(activeJob,data));completed++;activeJob=null;releaseWait?.();releaseWait=null;onChange();};
  worker.onerror=e=>{e.preventDefault?.();if(current!==request)return;error=e.message??'Ошибка фоновой статистики.';worker?.terminate();worker=null;activeJob=null;releaseWait?.();releaseWait=null;onChange();};
  (async()=>{
   while(tasks.length){const {id,source,metric,options,start,end}=tasks.shift();
    if(current!==request||!worker)return;
    if(results.has(owner(id,source.id)+'|'+metric))continue;
    try{
     activeJob=jobKeys.get(owner(id,source.id)+'|'+metric);const prepared=prepareMetric(analysisWorlds(source.report),metric,{...options,start,end}),transfer=[];
     for(const task of [...prepared.points,prepared.summary])for(const w of task.worlds)transfer.push(w.values.buffer);
     const answer=new Promise(resolve=>releaseWait=resolve);worker.postMessage({request:current,owner:owner(id,source.id),prepared,weightMode:source.report.weightMode??'worlds'},transfer);await answer;
    }catch(e){activeJob=null;results.set(owner(id,source.id)+'|'+metric,{error:e.message});completed++;onChange();}
    // Подготовка следующей метрики также не отнимает у UI всю очередь событий.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  })();
 }
 return {update,updateBatch,get:(source,metric,scope='')=>{const id=owner(scope,source)+'|'+metric;return cache.get(jobKeys.get(id))??results.get(id);},state:()=>({completed,total,error}),suspend(){if(completed<total){request++;releaseWait?.();releaseWait=null;worker?.terminate();worker=null;activeJob=null;tasks=[];key=null;}},dispose(){request++;releaseWait?.();releaseWait=null;worker?.terminate();worker=null;activeJob=null;tasks=[];key=null;results=new Map();cache.clear();jobKeys.clear();}};
}
