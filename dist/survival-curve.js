import {worldWeights,weightedSummary} from './weighted-statistics.js';
/** Возрастная кривая одной группы рождения, без гипотез о судьбе живых.
 * Сплошная линия — точный исход. При цензурировании lower/upper — границы
 * среди уже родившихся, а не оценка вероятности и не смерть молодой особи.
 * Сортируются два собственных массива возрастов, затем один проход порогов. */
import {SUBSTEPS} from './action-timing.js';
const MAX_POINTS=512,EPS=1e-9;
function outcome(curve,age,d,a){const mass=curve.totalMass??curve.count,dm=curve.massPrefixes?.dead[d]??d,am=curve.massPrefixes?.alive[a]??a,lower=100*Math.max(0,mass-dm-am)/mass,upper=100*Math.max(0,mass-dm)/mass;return {x:age,mean:lower,lower,upper,unknown:a,reached:curve.count-d-a,complete:curve.birthClosed&&a===0};}
/** Точный порог для подсказки, независимо от прореживания рисунка. */
export function survivalAtAge(curve,age){
 if(!Number.isFinite(age)||age<0||!curve.count||curve.omittedDetails)return null;
 const before=rows=>{let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid]+EPS<age)lo=mid+1;else hi=mid;}return lo;};
 return outcome(curve,age,before(curve.observedAges.dead),before(curve.observedAges.alive));
}
/** Только окно рисунка: отбор жизней и статистика всей группы не меняются.
 * Точная правая точка нужна, чтобы не растягивать последний известный исход
 * через ещё неизвестные возраста. Работы не больше 512 точек и двух поисков. */
export function survivalAgeWindow(curve,maximum){
 if(!Number.isSafeInteger(maximum)||maximum<1)throw new Error('Максимальный возраст на оси — положительное целое Т.');
 const points=curve.points.filter(p=>p.x<maximum),edge=survivalAtAge(curve,maximum);
 if(edge)points.push(edge);
 return {domainEnd:maximum,points:points.map((p,id)=>({...p,id}))};
}
export function survivalCurve(report,{start=0,width=100,origin='all'}={}){
 if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(width)||width<1||!['all','founders','descendants'].includes(origin))throw new Error('Неверный период рождения для кривой дожития.');
 const end=start+width,dead=[],alive=[],included=[];let excludedInvalid=0,totalDeadAge=0;
 for(const rows of [report.dead??[],report.living??[]])for(const r of rows){
  if(origin==='founders'&&r.parentId!==null||origin==='descendants'&&r.parentId===null)continue;
  if(!Number.isFinite(r.born)||!Number.isFinite(r.age)||r.born<0||r.age<0||!['dead','alive'].includes(r.status)){excludedInvalid++;continue;}
  if(r.born>=start&&r.born<end){included.push(r);if(r.status==='dead'){dead.push(r.age);totalDeadAge+=r.age;}else alive.push(r.age);}
 }
 dead.sort((a,b)=>a-b);alive.sort((a,b)=>a-b);
 const count=dead.length+alive.length,birthClosed=report.tick+EPS>=end,omittedDetails=report.omittedDetails??0;
 const maximumAge=Math.max(dead.at(-1)??0,alive.at(-1)??0),domainEnd=Math.max(1,Math.ceil(maximumAge+1/SUBSTEPS));
 // Это возраст смерти только завершённых жизней, а не прогноз для живых.
 // Медиана использует уже отсортированный массив; в кадровом цикле работы нет.
 const n=dead.length,middle=n>>>1,completed={count:n,mean:n&&!omittedDetails?totalDeadAge/n:null,median:n&&!omittedDetails?(n%2?dead[middle]:(dead[middle-1]+dead[middle])/2):null};
 const result={start,end,count,dead:n,alive:alive.length,birthClosed,omittedDetails,excludedInvalid,domainEnd,completed,points:[],observedAges:{dead,alive}};
 if(report.weightMode==='worlds'&&count){
  const weights=worldWeights(included),assigned=new Map(included.map((r,i)=>[r,weights[i]]));
  const prefix=status=>{const rows=included.filter(r=>r.status===status).sort((a,b)=>a.age-b.age),out=[0];for(const r of rows)out.push(out.at(-1)+assigned.get(r));return out;};
  result.totalMass=weights.reduce((a,b)=>a+b,0);result.massPrefixes={dead:prefix('dead'),alive:prefix('alive')};
  const rows=included.filter(r=>r.status==='dead'),summary=weightedSummary(rows.map(r=>r.age),worldWeights(rows));result.completed={count:rows.length,mean:omittedDetails?null:summary.mean,median:omittedDetails?null:summary.median};
 }
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
