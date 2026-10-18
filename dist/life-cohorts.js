/** Сводки наблюдателя по полуоткрытым интервалам рождения [b,b+width).
 * Один проход по сохранённым жизням; сортируются только собственные массивы
 * значений внутри групп. Нет обращения к миру, мозгам или RNG. */
import {LIFE_OBSERVATION_SCHEMA} from './life-observations.js';
export const HISTORY_PAGE_SIZE=50;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const rate=(row,n)=>finite(n)&&n>=0&&row.observedSteps>0?n*100/row.observedSteps:null;
export const LIFE_METRICS=Object.freeze([
 {id:'lifetime',label:'Продолжительность завершённой жизни',unit:'Т',digits:1},
 {id:'movement',label:'Частота перемещений',unit:'переходов / 100 Т',digits:2},
 {id:'eating',label:'Частота еды',unit:'порций / 100 Т',digits:2},
 {id:'inventory',label:'Средний переносимый запас',unit:'порций',digits:2},
 {id:'energy',label:'Средняя энергия',unit:'энергии',digits:1},
 {id:'hunger',label:'Время с энергией ниже 30',unit:'%',digits:1},
 {id:'reviews',label:'Частота пересмотров',unit:'пересмотров / 100 Т',digits:2},
 {id:'interruptions',label:'Частота прерываний',unit:'прерываний / 100 Т',digits:2},
].map(Object.freeze));
export function lifeMetric(row,id,interruptionKind='all'){
 const o=row.observations?.schema===LIFE_OBSERVATION_SCHEMA?row.observations:null;
 switch(id){
  case 'lifetime':return row.status==='dead'?row.age:null;
  case 'movement':return rate(row,row.moved);
  case 'eating':return rate(row,row.eaten);
  case 'inventory':return o?.inventoryObservedSteps>0?o.meanInventory:null;
  case 'energy':return row.meanEnergy;
  case 'hunger':return rate(row,row.hungerSteps);
  case 'reviews':return o?rate(row,o.reviews):null;
  case 'interruptions':return o?rate(row,interruptionKind==='all'?o.interruptions.voluntary+o.interruptions.physical:o.interruptions[interruptionKind]):null;
  default:throw new Error('Неизвестный показатель истории.');
 }
}
function summarize(values){
 const count=values.length;if(!count)return {count:0,min:null,median:null,mean:null,max:null};
 values.sort((a,b)=>a-b);let total=0;for(const v of values)total+=v;
 return {count,min:values[0],median:(values[Math.floor((count-1)/2)]+values[Math.floor(count/2)])/2,mean:total/count,max:values[count-1]};
}
export function aggregateLifeCohorts(report,{width=100,survivalAge=100,origin='all',mode='dead',interruptionKind='all',birthStart=0,birthEnd=Infinity}={}){
 if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(survivalAge)||survivalAge<1)throw new Error('Интервал рождения и возраст дожития — положительные целые числа.');
 if(!['all','founders','descendants'].includes(origin)||!['dead','observed'].includes(mode)||!['all','voluntary','physical'].includes(interruptionKind))throw new Error('Неизвестный фильтр истории.');
 if(!Number.isSafeInteger(birthStart)||birthStart<0||birthEnd!==Infinity&&!Number.isSafeInteger(birthEnd)||birthEnd<=birthStart)throw new Error('Начало периода должно быть меньше конца; границы — целые неотрицательные Т.');
 const groups=new Map();let excludedInvalid=0;
 for(const rows of [report.dead??[],report.living??[]])for(const row of rows){
  if(origin==='founders'&&row.parentId!==null||origin==='descendants'&&row.parentId===null)continue;
  if(!finite(row.born)||row.born<0||!finite(row.age)||row.age<0||!['alive','dead'].includes(row.status)){excludedInvalid++;continue;}
  if(row.born<birthStart||row.born>=birthEnd)continue;
  const id=Math.floor(row.born/width);let g=groups.get(id);
  if(!g){g={id,start:Math.max(birthStart,id*width),end:Math.min(birthEnd,(id+1)*width),born:0,dead:0,alive:0,knownSurvival:0,reachedAge:0,samples:Object.fromEntries(LIFE_METRICS.map(m=>[m.id,[]]))};groups.set(id,g);}
  g.born++;g[row.status==='dead'?'dead':'alive']++;
  if(row.status==='dead'||row.age+1e-9>=survivalAge)g.knownSurvival++;
  if(row.age+1e-9>=survivalAge)g.reachedAge++;
  if(mode==='dead'&&row.status!=='dead')continue;
  for(const m of LIFE_METRICS){const value=lifeMetric(row,m.id,interruptionKind);if(finite(value))g.samples[m.id].push(value);}
 }
 const omittedDetails=report.omittedDetails??0;
 const cohorts=[...groups.values()].sort((a,b)=>a.id-b.id).map(g=>{
  const birthClosed=report.tick+1e-9>=g.end,complete=birthClosed&&g.alive===0&&omittedDetails===0;
  const sufficient=birthClosed&&g.knownSurvival===g.born&&omittedDetails===0;
  const metrics=Object.fromEntries(LIFE_METRICS.map(m=>[m.id,summarize(g.samples[m.id])]));
  delete g.samples;
  return {...g,birthClosed,complete,metrics,survival:{age:survivalAge,sufficient,percent:sufficient?100*g.reachedAge/g.born:null}};
 });
 return {width,survivalAge,origin,mode,interruptionKind,cohorts,omittedDetails,excludedInvalid};
}
