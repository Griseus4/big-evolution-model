import {DIGESTION_GROUP_FRACTION} from './physiology-settings.js';

/** Объём не исчезает при усвоении энергии. Кольцо привязано к мировой сетке,
 * максимум 39 слотов при доле .05; отдельные порции не создают объекты. */
export function createDigestion(retentionSteps,subtick=0){
 if(!Number.isSafeInteger(retentionSteps)||retentionSteps<1||!Number.isSafeInteger(subtick)||subtick<0)throw new Error('Неверное время пищеварения.');
 const width=Math.max(1,Math.floor(DIGESTION_GROUP_FRACTION*retentionSteps)),slots=Math.ceil(retentionSteps/width);
 return {retentionSteps,width,subtick,starts:new Float64Array(slots).fill(-1),volumes:new Float64Array(slots),remaining:new Float64Array(slots*3),volume:0,
  totals:new Float64Array(3),absorbed:new Float64Array(3),excretedEnergy:0,excretedVolume:0};
}
export function ingestFood(d,type,portion,capacity,energies){
 if(!Number.isInteger(type)||type<0||type>=3||!Number.isFinite(portion)||portion<0||!Number.isFinite(capacity)||capacity<0)throw new Error('Неверная порция/вместимость.');
 const free=Math.max(0,capacity-d.volume);if(free===0||portion===0)return {started:0,swallowed:0,discarded:0};
 const swallowed=Math.min(portion,free),group=Math.floor(d.subtick/d.width),slot=group%d.starts.length,start=group*d.width;
 if(d.starts[slot]!==start){
  if(d.volumes[slot]!==0)throw new Error('Пищевая группа перезаписана до выведения.');
  d.starts[slot]=start;
 }
 const energy=swallowed*energies[type];if(!Number.isFinite(energy))throw new Error('Неконечная энергия пищи.');
 d.volumes[slot]+=swallowed;d.remaining[slot*3+type]+=energy;d.volume+=swallowed;
 return {started:portion,swallowed,discarded:portion-swallowed};
}
/** Строго один следующий подшаг. Итоги всех типов берутся до любых списаний;
 * на последней границе сначала усвоение, затем потеря остатков и объёма. */
export function advanceDigestion(d,subtick,capacity,powers,energies){
 if(subtick!==d.subtick+1)throw new Error('Пропущен или повторён подшаг пищеварения.');
 d.subtick=subtick;d.totals.fill(0);d.absorbed.fill(0);d.excretedEnergy=0;d.excretedVolume=0;
 for(let j=0;j<d.remaining.length;j++)d.totals[j%3]+=d.remaining[j];
 let volume=0;
 for(let j=0;j<d.starts.length;j++){
  if(d.starts[j]<0)continue;
  const expired=subtick>=d.starts[j]+d.retentionSteps;
  for(let type=0;type<3;type++){
   const at=j*3+type,energy=d.remaining[at],total=d.totals[type],budget=Math.min(total,powers[type]*capacity*energies[type]);
   const absorbed=total===0?0:Math.min(energy,energy/total*budget);
   d.remaining[at]-=absorbed;d.absorbed[type]+=absorbed;
   if(expired){d.excretedEnergy+=d.remaining[at];d.remaining[at]=0;}
  }
  if(expired){d.excretedVolume+=d.volumes[j];d.volumes[j]=0;d.starts[j]=-1;}else volume+=d.volumes[j];
 }
 d.volume=volume;return d.absorbed[0]+d.absorbed[1]+d.absorbed[2];
}
