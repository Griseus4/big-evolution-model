import {aggregateLifeCohorts} from './life-cohorts.js';
import {sensitivityDistributions,SENSITIVITY_BIN_WIDTH} from './heritable-statistics.js';
import {windowFoodCohorts} from './history-window.js';
import {foodCohorts} from './food-exposure.js';
import {productionCohorts} from './food-production-history.js';
import {survivalCurve,survivalAtAge} from './survival-curve.js';
import {HISTORY_LINES,drawHistoryChart} from './history-charts.js';
/** Общие графики получают дополнительные серии; DOM карточек не копируется.
 * Кэш зависит от отчёта и фильтров, хранит только последнюю проекцию варианта. */
export function createComparisonCharts(){
 const cache=new WeakMap();
 return function draw({sources,options,start,end,statistic,chartCards,histogramCards,curveCanvas,curveMaximum,curveStart,curveVisible,getEstimate=()=>null,bandMode='confidence'}){
  if(!sources?.length)return false;
  const key=JSON.stringify([options,start,end,curveStart]),prepared=sources.map(s=>{
   let data=cache.get(s.report);if(!data||data.key!==key){data={key};cache.set(s.report,data);}return {...s,data};
  });
  // Независимый контекст не должен строить невидимые распределения/кривую.
  const cohorts=s=>s.data.cohorts??=aggregateLifeCohorts(s.report,{...options,birthStart:start,birthEnd:end});
  const food=s=>s.data.food??=windowFoodCohorts(foodCohorts(s.report.foodAvailability,s.report.environmentTick??s.report.tick,options.width),s.report.foodAvailability,s.report.environmentTick??s.report.tick,start,end);
  const production=s=>s.data.production??=productionCohorts(s.report.foodProductionHistory,s.report.environmentTick??s.report.tick,options.width,start,end);
  const distributions=s=>s.data.distributions??=sensitivityDistributions([...s.report.dead,...s.report.living],{start,end,origin:options.origin,weightMode:s.report.weightMode});
  const curve=s=>s.data.curve??=survivalCurve(s.report,{start:curveStart,width:options.width,origin:options.origin});
  const lines=prepared.map(s=>({id:s.id,color:s.color,label:s.name})),keys=lines.map(l=>l.id);
  const join=lists=>{const rows=new Map();lists.forEach((list,index)=>{for(const p of list){let row=rows.get(p.id);if(!row){row={id:p.id,start:p.start,end:p.end,x:p.x,complete:true};rows.set(p.id,row);}row[keys[index]]=p.value;row.complete&&=p.complete;}});return [...rows.values()].sort((a,b)=>a.id-b.id);};
  for(const {m,canvas,card,note}of chartCards){if(card.hidden)continue;
   const effective=m.single||m.id==='survival'?'mean':statistic;
   const lists=prepared.map(s=>{const estimate=getEstimate(s.id,m.id);if(estimate?.points)return estimate.points.map(p=>({...p,value:p[effective]}));if(m.id==='population'||s.report.groupDesign)return [];return (m.id==='food'?food(s):m.id==='production'?production(s):cohorts(s).cohorts).map(p=>({...p,value:m.id==='survival'?p.survival.percent:['food','production'].includes(m.id)?p.mean:p.metrics[m.id][effective]}));});
   const points=join(lists),bands=[];
   if(['mean','median'].includes(effective)&&bandMode!=='none')for(const source of sources){const result=getEstimate(source.id,m.id);for(const p of points){const estimate=result?.byId?.get(p.id),range=estimate?.[bandMode==='spread'?'spread':'confidence']?.[effective];p[source.id+'Low']=range?.low??null;p[source.id+'High']=range?.high??null;}bands.push({low:source.id+'Low',high:source.id+'High',color:source.color});}
   drawHistoryChart(canvas,{points,keys,lines,bands,domainStart:start,domainEnd:end,width:options.width,single:['population','food','production'].includes(m.id)?'food':false,minimum:m.minimum??0,maximum:m.maximum??(['hunger','survival','reproduced'].includes(m.id)?100:null)});
   note.textContent=prepared.map(s=>`${s.name}: ${s.report.worldCount??1} миров`).join(' · ')+` · линия: ${m.single?'доля':HISTORY_LINES.find(l=>l.id===effective)?.label.toLowerCase()??effective}. Пунктир — предварительные данные.`;
  }
  for(const {m,canvas,card,note}of histogramCards){if(card.hidden)continue;const lists=prepared.map(s=>distributions(s).find(d=>d.id===m.id).points.map(p=>({...p,value:p.mean})));
   drawHistoryChart(canvas,{points:join(lists),keys,lines,width:SENSITIVITY_BIN_WIDTH,histogram:true,domainStart:-100,domainEnd:100,xTicks:Array.from({length:11},(_,i)=>-100+i*20),xLabel:'Доля шкалы чувств, %'});note.textContent='Доли по выбранному режиму весов. '+prepared.map(s=>s.name).join(' · ');
  }
  if(curveVisible){
   const ages=[...new Set([0,curveMaximum,...prepared.flatMap(s=>curve(s).points.filter(p=>p.x<curveMaximum).map(p=>p.x))])].sort((a,b)=>a-b),curveLines=prepared.flatMap(s=>[{id:s.id,color:s.color},{id:s.id+'upper',color:s.color,dashed:true}]);
   const points=ages.map((x,id)=>{const row={id,x,complete:true};for(const s of prepared){const p=survivalAtAge(curve(s),x);row[s.id]=p?.lower??null;row[s.id+'upper']=p?.upper??null;}return row;});
   drawHistoryChart(curveCanvas,{points,keys:curveLines.map(l=>l.id),lines:curveLines,domainEnd:curveMaximum,maximum:100,age:true});
  }
  return true;
 };
}
