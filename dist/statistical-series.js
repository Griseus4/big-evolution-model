/** Подготовка только видимых показателей. В Worker уходят числовые выборки,
 * не весь отчёт/мозги. Одни правила lifeMetric для линий, чисел и интервалов. */
import {LIFE_METRICS,lifeMetric} from './life-cohorts.js';
import {populationCohorts} from './population-statistics.js';
import {foodCohorts} from './food-exposure.js';
import {windowFoodCohorts} from './history-window.js';
import {productionCohorts} from './food-production-history.js';
const sourcesByReport=new WeakMap();
export function registerAnalysisWorlds(report,sources){sourcesByReport.set(report,sources);return report;}
export const analysisWorlds=report=>sourcesByReport.get(report)??[{id:'current',report,targetTick:report.tick,extinct:false}];
export function prepareMetric(worlds,metric,{start,end,width,origin='all',mode='dead',interruptionKind='all',survivalAge=100,summaryOnly=false}){
 const points=new Map(),blocked=new Set(),summary={id:'summary',worlds:[]};let error=null,unknownSummary=false;
 const time=['population','food','production'].includes(metric),m=LIFE_METRICS.find(m=>m.id===metric);
 const metadata=s=>({id:s.id,pairId:s.pairId,variantId:s.variantId,seed:s.seed,number:s.number,extinctions:s.extinctions,incomplete:Boolean(s.report.omittedDetails)});
 function add(id,source,values,complete=true){
  if(summaryOnly||!values.length)return;let point=points.get(id);
  if(!point){point={id,start:Math.max(start,id*width),end:Math.min(end,(id+1)*width),complete:true,worlds:[]};points.set(id,point);}
  point.complete&&=complete;point.worlds.push({...metadata(source),values:Float64Array.from(values)});
 }
 for(const source of worlds){
  const r=source.report;
  if(time){
   let rows=[];
   if(metric==='population'){const result=populationCohorts(source,{start,end,width});rows=result.points;if(result.error){error=result.error;continue;}}
   if(metric==='food')rows=windowFoodCohorts(foodCohorts(r.foodAvailability,r.tick,width),r.foodAvailability,r.tick,start,end);
   if(metric==='production')rows=productionCohorts(r.foodProductionHistory,r.tick,width,start,end);
   let sum=0,duration=0;for(const p of rows)if(Number.isFinite(p.mean)){add(p.id,source,[p.mean],p.complete);sum+=p.mean*p.observedTime;duration+=p.observedTime;}
   if(duration)summary.worlds.push({...metadata(source),values:Float64Array.of(sum/duration)});continue;
  }
  const buckets=new Map(),all=[];
  for(const rows of [r.dead??[],r.living??[]])for(const row of rows){
   if(!Number.isFinite(row.born)||!Number.isFinite(row.age)||row.born<start||row.born>=end||!['alive','dead'].includes(row.status)||origin==='founders'&&row.parentId!==null||origin==='descendants'&&row.parentId===null)continue;
   if(metric!=='survival'&&mode==='dead'&&row.status!=='dead'&&!m?.inherited)continue;
   const value=metric==='survival'?(row.age+1e-9>=survivalAge?100:0):lifeMetric(row,metric,interruptionKind);if(!Number.isFinite(value))continue;
   all.push(value);if(summaryOnly&&metric!=='survival')continue;
   const id=Math.floor(row.born/width);let bucket=buckets.get(id);if(!bucket){bucket={values:[],alive:false,unknown:false};buckets.set(id,bucket);}
   if(!summaryOnly)bucket.values.push(value);bucket.alive||=row.status==='alive';bucket.unknown||=row.status==='alive'&&row.age+1e-9<survivalAge;
  }
  let unknown=false;
  for(const [id,b]of buckets){
   const closed=r.tick+1e-9>=Math.min(end,(id+1)*width),complete=closed&&!(r.omittedDetails??0)&&(!b.alive||m?.inherited);
   if(metric==='survival'&&(!closed||b.unknown||(r.omittedDetails??0))){unknown=true;blocked.add(id);continue;}
   add(id,source,b.values,complete);
  }
  if(metric==='survival'&&unknown)unknownSummary=true;
  if(all.length&&!(metric==='survival'&&unknown))summary.worlds.push({...metadata(source),values:Float64Array.from(all)});
 }
 if(unknownSummary){summary.worlds=[];error='Доля доживших пока неизвестна: часть исходов или рождений не завершена.';}
 return {metric,time,blockDesign:worlds[0]?.blockDesign??null,weightMode:time?'worlds':null,points:[...points.values()].filter(p=>!blocked.has(p.id)).sort((a,b)=>a.id-b.id),summary,error,incomplete:worlds.some(s=>(s.report.omittedDetails??0)>0)};
}
