import {FOOD_EXPOSURE_SCHEMA} from './food-exposure.js';
import {weightedSummary,worldWeights} from './weighted-statistics.js';
import {registerAnalysisWorlds} from './statistical-series.js';
/** Лёгкая проекция выбранных попыток, без копий мозгов. Кэш UI хранит её до
 * смены исходных отчётов/режима, не перестраивает на каждом кадре. */
export function mergeLifeReports(sources,weightMode='worlds'){
 if(!sources.length)return null;
 const dead=[],living=[];let omittedDetails=0;
 for(const {id,report} of sources){for(const key of ['dead','living'])for(const row of report[key]??[])(key==='dead'?dead:living).push({...row,id:`${id}:${row.id}`,originalId:row.id,worldId:id});omittedDetails+=report.omittedDetails??0;}
 const ages=weightedSummary(dead.map(r=>r.age),weightMode==='worlds'?worldWeights(dead):null),byCause={};for(const r of dead){byCause[r.cause]??={count:0};byCause[r.cause].count++;}
 const environmentTick=Math.min(...sources.map(s=>s.report.tick)),prefixLength=Math.min(...sources.map(s=>s.report.foodAvailability?.prefix?.length??0));
 let foodAvailability=null;
 if(prefixLength){const prefix=new Float64Array(prefixLength);for(const s of sources)for(let i=0;i<prefixLength;i++)prefix[i]+=s.report.foodAvailability.prefix[i]/sources.length;foodAvailability={schema:FOOD_EXPOSURE_SCHEMA,prefix,partialSum:0,substeps:0};}
 const histories=sources.map(s=>s.report.foodProductionHistory),foodProductionHistory=[];
 if(histories.every(h=>h?.length)){
  const ticks=[...new Set(histories.flatMap(h=>h.filter(e=>e.tick<=environmentTick).map(e=>e.tick)))].sort((a,b)=>a-b),indices=histories.map(()=>0);
  for(const tick of ticks){let value=0;histories.forEach((h,i)=>{while(indices[i]+1<h.length&&h[indices[i]+1].tick<=tick)indices[i]++;value+=h[indices[i]].value/histories.length;});foodProductionHistory.push({tick,value});}
 }
 return registerAnalysisWorlds({tick:Math.max(...sources.map(s=>s.report.tick)),environmentTick,weightMode,worldCount:sources.length,dead,living,omittedDetails,completed:{count:dead.length,meanAge:ages.mean,medianAge:ages.median},byCause,foodAvailability,foodProductionHistory},sources);
}
export function experimentWorlds(series,variantId){return series.groups.filter(g=>g.variantId===variantId).map(g=>{const a=g.attempts.find(a=>a.id===g.selectedId);return {id:a?.id??g.id,pairId:g.index,seed:a?.seed??null,number:a?.number??null,extinctions:g.attempts.filter(a=>a.extinct).length,report:g.status==='completed'?a?.lives??null:null,targetTick:series.plan.steps,extinct:Boolean(a?.extinct)};});}
export const reportSources=(series,variantId)=>experimentWorlds(series,variantId).filter(s=>s.report);
