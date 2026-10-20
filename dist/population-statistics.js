/** N(t) на целых Т из рождений/смертей: born <= t < endTick.
 * Не пишем массив на каждый подшаг. Сортируем события один раз на отчёт;
 * интегрируем постоянные отрезки, число проходов зависит от событий/корзин. */
import {MAX_HISTORY_INTERVALS} from './food-exposure.js';
const cached=new WeakMap();
export function populationTimeline(report){
 if(cached.has(report))return cached.get(report);
 let error=null;
 if(!Number.isFinite(report.tick)||report.tick<0)error='Неизвестно время наблюдения населения.';
 if((report.omittedDetails??0)>0||(report.completed?.count??0)>(report.dead?.length??0))error='История населения неполная.';
 const events=new Map();const add=(at,delta)=>events.set(at,(events.get(at)??0)+delta);
 for(const rows of [report.dead??[],report.living??[]])for(const r of rows){
  if(!Number.isFinite(r.born)||r.born<0||!Number.isFinite(r.endTick)||r.endTick<r.born||r.endTick>report.tick+1e-9||!['dead','alive'].includes(r.status)){error='Нет точных времён рождения/смерти.';break;}
  add(Math.ceil(r.born-1e-9),1);if(r.status==='dead')add(Math.ceil(r.endTick-1e-9),-1);
 }
 let count=0;const points=[];
 if(!error)for(const [at,delta]of [...events].sort((a,b)=>a[0]-b[0])){count+=delta;points.push({at,count});}
 const result={points,error};cached.set(report,result);return result;
}
export function populationCohorts(source,{width,start=0,end}){
 const {report}=source,timeline=populationTimeline(report);
 if(timeline.error)return {points:[],error:timeline.error};
 if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||Math.ceil((end-start)/width)>MAX_HISTORY_INTERVALS)throw new Error('Неверный период населения; увеличьте интервал.');
 const observed=Math.floor(report.tick+1e-9)+1,limit=Math.min(end,source.extinct?Math.max(observed,source.targetTick??observed):observed);
 const points=[];let event=0,count=0;while(event<timeline.points.length&&timeline.points[event].at<=start)count=timeline.points[event++].count;
 for(let b=Math.floor(start/width)*width;b<limit;b+=width){
  const from=Math.max(start,b),to=Math.min(limit,b+width);let at=from,sum=0;
  while(at<to){
   while(event<timeline.points.length&&timeline.points[event].at<=at)count=timeline.points[event++].count;
   const next=Math.min(to,timeline.points[event]?.at??to),n=next-at;
   sum+=count*n;at=next;
  }
  if(to<=from)continue;
  const point={id:b/width,start:from,end:Math.min(end,b+width),observedTime:to-from,complete:to===Math.min(end,b+width),mean:sum/(to-from)};
  points.push(point);
 }return {points,error:null};
}
