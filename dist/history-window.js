/** Окно наблюдателя: целые группы переиспользуются, пересчитываются только
 * две возможные краевые группы. Симуляция и её массивы не изменяются. */
import {aggregateLifeCohorts} from './life-cohorts.js';
import {SUBSTEPS} from './action-timing.js';
export const historyDomainEnd=(tick,width)=>(Math.floor(tick/width)+1)*width;
export function windowLifeCohorts(base,members,tick,start,end){
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start)throw new Error('Начало периода должно быть меньше конца; границы — целые неотрицательные Т.');
 const cohorts=[];
 for(const g of base.cohorts){
  if(g.end<=start||g.start>=end)continue;
  if(g.start>=start&&g.end<=end){cohorts.push(g);continue;}
  const rows=members.get(g.id)??[],partial=aggregateLifeCohorts({tick,omittedDetails:base.omittedDetails,dead:rows.filter(r=>r.status==='dead'),living:rows.filter(r=>r.status==='alive')},{...base,birthStart:start,birthEnd:end});
  cohorts.push(...partial.cohorts);
 }
 return {...base,cohorts,byId:new Map(cohorts.map(g=>[g.id,g])),domainStart:start,domainEnd:end};
}
/** Полные средние уже рассчитаны foodCohorts. На краях читаются целые
 * границы префикса; последний дробный конец берётся из partialSum.
 * Нет обхода префикса по всем Т при перемещении ползунка. */
export function windowFoodCohorts(rows,exposure,tick,start,end){
 const result=[];
 for(const row of rows){
  if(row.end<=start||row.start>=end)continue;
  if(row.start>=start&&row.end<=end){result.push(row);continue;}
  const from=Math.max(start,row.start),to=Math.min(end,row.end),observedEnd=Math.min(tick,to);
  if(observedEnd<=from)continue;
  const a=exposure?.prefix[from],b=Number.isInteger(observedEnd)?exposure?.prefix[observedEnd]:exposure?.prefix[Math.floor(observedEnd)]+exposure?.partialSum;
  result.push({...row,start:from,end:to,observedTime:observedEnd-from,complete:observedEnd===to,mean:Number.isFinite(a)&&Number.isFinite(b)?(b-a)/(SUBSTEPS*(observedEnd-from)):null});
 }
 return result;
}
