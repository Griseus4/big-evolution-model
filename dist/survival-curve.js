/** Возрастная кривая одной группы рождения, без гипотез о судьбе живых.
 * Сплошная линия — точный исход. При цензурировании lower/upper — границы
 * среди уже родившихся, а не оценка вероятности и не смерть молодой особи.
 * Сортируются два собственных массива возрастов, затем один проход порогов. */
import {SUBSTEPS} from './action-timing.js';
const MAX_POINTS=512,EPS=1e-9;
function outcome(curve,age,d,a){const lower=100*(curve.count-d-a)/curve.count,upper=100*(curve.count-d)/curve.count;return {x:age,mean:lower,lower,upper,unknown:a,reached:curve.count-d-a,complete:curve.birthClosed&&a===0};}
/** Точный порог для подсказки, независимо от прореживания рисунка. */
export function survivalAtAge(curve,age){
 if(!Number.isFinite(age)||age<0||!curve.count||curve.omittedDetails)return null;
 const before=rows=>{let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid]+EPS<age)lo=mid+1;else hi=mid;}return lo;};
 return outcome(curve,age,before(curve.observedAges.dead),before(curve.observedAges.alive));
}
export function survivalCurve(report,{start=0,width=100,origin='all'}={}){
 if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(width)||width<1||!['all','founders','descendants'].includes(origin))throw new Error('Неверный период рождения для кривой дожития.');
 const end=start+width,dead=[],alive=[];let excludedInvalid=0,totalDeadAge=0;
 for(const rows of [report.dead??[],report.living??[]])for(const r of rows){
  if(origin==='founders'&&r.parentId!==null||origin==='descendants'&&r.parentId===null)continue;
  if(!Number.isFinite(r.born)||!Number.isFinite(r.age)||r.born<0||r.age<0||!['dead','alive'].includes(r.status)){excludedInvalid++;continue;}
  if(r.born>=start&&r.born<end){if(r.status==='dead'){dead.push(r.age);totalDeadAge+=r.age;}else alive.push(r.age);}
 }
 dead.sort((a,b)=>a-b);alive.sort((a,b)=>a-b);
 const count=dead.length+alive.length,birthClosed=report.tick+EPS>=end,omittedDetails=report.omittedDetails??0;
 const maximumAge=Math.max(dead.at(-1)??0,alive.at(-1)??0),domainEnd=Math.max(1,Math.ceil(maximumAge+1/SUBSTEPS));
 // Это возраст смерти только завершённых жизней, а не прогноз для живых.
 // Медиана использует уже отсортированный массив; в кадровом цикле работы нет.
 const n=dead.length,middle=n>>>1,completed={count:n,mean:n&&!omittedDetails?totalDeadAge/n:null,median:n&&!omittedDetails?(n%2?dead[middle]:(dead[middle-1]+dead[middle])/2):null};
 const result={start,end,count,dead:n,alive:alive.length,birthClosed,omittedDetails,excludedInvalid,domainEnd,completed,points:[],observedAges:{dead,alive}};
 if(!count||omittedDetails)return result;
 // Массивы уже отсортированы: сливаем пороги без третьей сортировки.
 let ages=[0],di=0,ai=0;
 while(di<dead.length||ai<alive.length){const value=ai===alive.length||di<dead.length&&dead[di]<=alive[ai]?dead[di++]:alive[ai++],age=(Math.floor((value+EPS)*SUBSTEPS)+1)/SUBSTEPS;if(age!==ages.at(-1))ages.push(age);}
 if(ages.at(-1)!==domainEnd)ages.push(domainEnd);
 if(ages.length>MAX_POINTS)ages=Array.from({length:MAX_POINTS},(_,i)=>Math.round(i*domainEnd*SUBSTEPS/(MAX_POINTS-1))/SUBSTEPS).filter((a,i,aList)=>!i||a!==aList[i-1]);
 let d=0,a=0;
 for(const age of ages){
  while(d<dead.length&&dead[d]+EPS<age)d++;
  while(a<alive.length&&alive[a]+EPS<age)a++;
  result.points.push({id:result.points.length,...outcome(result,age,d,a)});
 }
 return result;
}
