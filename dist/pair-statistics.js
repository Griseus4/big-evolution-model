/** Парное сравнение итоговых миров. Пара — исходный повтор, не совпадение
 * seed выбранных попыток. В каждой перевыборке обе стороны получают одни
 * кратности; сравниваются оценки распределений, не медианы разностей особей. */
import {createWorldEstimator,bootstrapDraws,quantile,MIN_CONFIDENCE_WORLDS} from './statistics-estimates.js';
import {prepareMetric} from './statistical-series.js';
import {incompleteLifeHistory} from './life-cohorts.js';
import {collapsePairBlocks} from './statistical-blocks.js';
export function preparePairSide(worlds,metric,options){
 const result=worlds.map(world=>{
  const {report,...meta}=world;
  if(!report)return {...meta,values:new Float64Array(),reason:'Нет выбранного завершённого результата.'};
  const data=prepareMetric([world],metric,{...options,summaryOnly:true}),sample=data.summary.worlds[0],incomplete=data.incomplete||incompleteLifeHistory(report);
  return {...meta,values:incomplete?new Float64Array():sample?.values??new Float64Array(),reason:incomplete?'История неполная.':data.error??(sample?null:'Нет наблюдений за выбранный период.')};
 });return collapsePairBlocks(result,worlds[0]?.blockDesign);
}
const finite=x=>Number.isFinite(x)?x:null;
function effects(a,b){const ratio=a===0?null:finite(b/a);return {a,b,difference:finite(b-a),ratio,percent:ratio===null?null:finite((ratio-1)*100)};}
const bounds=values=>{values.sort((a,b)=>a-b);return {low:quantile(values,.025),high:quantile(values,.975)};};
export function estimatePair(a,b,weightMode='worlds'){
 function indexed(side){const map=new Map();for(const world of side){if(!Number.isSafeInteger(world.pairId)||world.pairId<0||map.has(world.pairId))throw new Error('Повтор отсутствует или повторяется в составе пары.');map.set(world.pairId,world);}return map;}
 const am=indexed(a),bm=indexed(b),ids=[...new Set([...am.keys(),...bm.keys()])].sort((a,b)=>a-b),included=[],excluded=[];
 for(const pairId of ids){const a=am.get(pairId),b=bm.get(pairId);if(a?.values.length&&b?.values.length)included.push({pairId,a,b});else excluded.push({pairId,a:a?.values.length?null:a?.reason??'Нет мира A.',b:b?.values.length?null:b?.reason??'Нет мира B.'});}
 const n=included.length,availableA=a.filter(w=>w.values.length).length,availableB=b.filter(w=>w.values.length).length;
 if(!n)return {pairs:0,availableA,availableB,excluded,included:[],mean:null,median:null,reason:'Нет полных пар с данными этого показателя.'};
 const members=(p,key)=>p[key].members??[p[key]],ca=createWorldEstimator(included.flatMap(p=>members(p,'a')),weightMode),cb=createWorldEstimator(included.flatMap(p=>members(p,'b')),weightMode),indices=key=>included.flatMap((p,i)=>members(p,key).map(()=>i)),ai=indices('a'),bi=indices('b');let ia=0,ib=0;
 function details(unit,compiled,side){if(!unit.members){const index=side==='a'?ia++:ib++;return {...unit,values:undefined,...compiled.individual[index]};}
  const first=side==='a'?ia:ib,list=unit.members.map(w=>{const index=side==='a'?ia++:ib++;return {...w,values:undefined,blockDesign:undefined,...compiled.individual[index]};}),count=list.reduce((n,w)=>n+w.count,0),mass=weightMode==='worlds'?list.length:count;
  const median=compiled.summarize(Uint16Array.from({length:compiled.worlds},(_,i)=>Number(i>=first&&i<first+list.length))).median;
  return {...unit,values:undefined,members:list,count,mean:list.reduce((n,w)=>n+w.mean*(weightMode==='worlds'?1:w.count),0)/mass,median};
 }
 const result={pairs:n,availableA,availableB,excluded,included:included.map(p=>({pairId:p.pairId,a:details(p.a,ca,'a'),b:details(p.b,cb,'b')})),reason:n<MIN_CONFIDENCE_WORLDS?`ДИ недоступен: ${n} полных пар, нужно не менее ${MIN_CONFIDENCE_WORLDS}.`:n<10?'Мало независимых повторов: интервалы приблизительны.':null};
 for(const stat of ['mean','median'])result[stat]={...effects(ca.center[stat],cb.center[stat]),confidence:null,ratioReason:ca.center[stat]===0?'База A равна нулю: отношение и процент не определены.':null};
 for(const stat of ['min','max'])result[stat]={...effects(ca[stat],cb[stat]),confidence:null};
 if(n<MIN_CONFIDENCE_WORLDS)return result;
 const samples=Object.fromEntries(['mean','median'].map(stat=>[stat,Object.fromEntries(['a','b','difference','ratio','percent'].map(key=>[key,[]]))])),memo=new Map();
 for(const counts of bootstrapDraws(n)){
  const key=counts.join(',');let value=memo.get(key);if(!value){value={a:ca.summarize(Uint16Array.from(ai.map(i=>counts[i]))),b:cb.summarize(Uint16Array.from(bi.map(i=>counts[i])))};memo.set(key,value);}
  for(const stat of ['mean','median']){const e=effects(value.a[stat],value.b[stat]);for(const key of Object.keys(samples[stat]))samples[stat][key].push(e[key]);}
 }
 for(const stat of ['mean','median']){
  const s=samples[stat],r=result[stat],confidence={a:bounds(s.a),b:bounds(s.b),difference:bounds(s.difference)};
  // Не отбрасываем неудачные деления из бутстрэпа: это дало бы искусственно
  // узкий интервал. База около нуля — явная недоступность отношения.
  const awayFromZero=confidence.a.low>0&&confidence.a.high>0||confidence.a.low<0&&confidence.a.high<0;
  if(r.ratio!==null&&awayFromZero&&s.ratio.every(Number.isFinite)&&s.percent.every(Number.isFinite)){confidence.ratio=bounds(s.ratio);confidence.percent=bounds(s.percent);}
  else{confidence.ratio=null;confidence.percent=null;r.ratioReason??='ДИ отношения недоступен: неопределённость базы включает ноль или деление неустойчиво.';}
  r.confidence=confidence;
  if(confidence.difference.low===confidence.difference.high)r.reason='Нулевой наблюдаемый разброс разности не доказывает точность.';
 }return result;
}
