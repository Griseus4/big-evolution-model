/** Потенциальная выработка — кусочно-постоянная функция событий среды.
 * Интегрируется по времени, не по среднему числу кустов или среднему периоду. */
import {MAX_HISTORY_INTERVALS} from './food-exposure.js';
const production=groups=>groups?.reduce((n,g)=>n+g.sources.length/g.period,0);
export function foodProductionHistory(w){
 const initial=production(w.initialFoodIslands);if(!Number.isFinite(initial))return null;
 const rows=[{tick:0,value:initial}];
 for(const e of w.environmentChanges){const value=e.after?.production??production(e.islands);if(Number.isFinite(value))rows.push({tick:e.tick,value});else return null;}
 return rows;
}
export function productionCohorts(history,tick,width,start=0,end=Infinity){
 if(!history?.length)return [];
 if(!Number.isSafeInteger(width)||width<1||Math.ceil((Math.min(tick,end)-start)/width)>MAX_HISTORY_INTERVALS)throw new Error('Слишком много интервалов выработки; увеличь ширину.');
 let index=0,value=history[0].value;while(index+1<history.length&&history[index+1].tick<=start)value=history[++index].value;
 const result=[];
 for(let b=Math.floor(start/width)*width;b<Math.min(tick,end);b+=width){
  const from=Math.max(start,b),to=Math.min(tick,end,b+width);if(to<=from)continue;let at=from,area=0;
  while(index+1<history.length&&history[index+1].tick<to){const e=history[++index];area+=(e.tick-at)*value;at=e.tick;value=e.value;}
  area+=(to-at)*value;result.push({id:b/width,start:from,end:Math.min(end,b+width),observedTime:to-from,complete:to===Math.min(end,b+width),mean:area/(to-from)});
 }
 return result;
}
