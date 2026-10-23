import {prepareMetric} from './statistical-series.js';
import {incompleteLifeHistory} from './life-cohorts.js';
import {collapsePairBlocks} from './statistical-blocks.js';
/** Один проход каждой истории даёт период и временные корзины. Отсутствие
 * рождения/исхода — пустая выборка, а не ноль. В расчёт идут полные пары. */
export function preparePairSeries(a,b,metric,options){
 const pointIds=new Map();
 function side(worlds){return worlds.map(world=>{
  const {report,...meta}=world;
  if(!report)return {meta,summary:{...meta,values:new Float64Array(),reason:'Нет завершённого результата.'},points:new Map()};
  const prepared=prepareMetric([world],metric,options),incomplete=prepared.incomplete||incompleteLifeHistory(report),points=new Map();
  if(!incomplete)for(const p of prepared.points){const sample=p.worlds[0];if(!sample)continue;points.set(p.id,{...meta,values:sample.values});const previous=pointIds.get(p.id);pointIds.set(p.id,{id:p.id,start:p.start,end:p.end,complete:(previous?.complete??true)&&p.complete});}
  return {meta,points,summary:{...meta,values:incomplete?new Float64Array():prepared.summary.worlds[0]?.values??new Float64Array(),reason:incomplete?'История неполная.':prepared.error??'Нет наблюдений.'}};
 });}
 const sides=[side(a),side(b)],points=[...pointIds.values()].sort((a,b)=>a.id-b.id).map(p=>({...p,a:sides[0].map(w=>w.points.get(p.id)??{...w.meta,values:new Float64Array(),reason:'Нет наблюдений в интервале.'}),b:sides[1].map(w=>w.points.get(p.id)??{...w.meta,values:new Float64Array(),reason:'Нет наблюдений в интервале.'})}));
 const collapse=(values,index)=>collapsePairBlocks(values,[a,b][index][0]?.blockDesign);
 for(const point of points){point.a=collapse(point.a,0);point.b=collapse(point.b,1);}
 return {a:collapse(sides[0].map(w=>w.summary),0),b:collapse(sides[1].map(w=>w.summary),1),points};
}
