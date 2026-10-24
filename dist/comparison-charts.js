import {aggregateLifeCohorts} from './life-cohorts.js';
import {sensitivityDistributions,SENSITIVITY_BIN_WIDTH} from './heritable-statistics.js';
import {windowFoodCohorts} from './history-window.js';
import {foodCohorts} from './food-exposure.js';
import {productionCohorts} from './food-production-history.js';
import {survivalCurve,survivalAtAge} from './survival-curve.js';
import {HISTORY_LINES,drawHistoryChart} from './history-charts.js';
/** Общие графики получают дополнительные серии; DOM карточек не копируется.
 * У каждой проекции свой ключ: период кривой не сбрасывает остальные графики. */
export function createComparisonCharts(){
 const cache=new WeakMap();
 return function draw({sources,options,start,end,statistic,chartCards,histogramCards,curveCanvas,curveMaximum,curveStart,curveVisible,getEstimate=()=>null,bandMode='confidence',precompute=null}){
  if(!sources?.length)return false;
  const prepared=sources.map(s=>{let data=cache.get(s.report);if(!data){data=new Map();cache.set(s.report,data);}return {...s,data};});
  const projection=(s,type,parts,build)=>{const key=JSON.stringify(parts),saved=s.data.get(type);if(saved?.key===key)return saved.value;const value=build();s.data.set(type,{key,value});return value;};
  // Независимый контекст не должен строить невидимые распределения/кривую.
  const cohorts=s=>projection(s,'cohorts',[options,start,end],()=>aggregateLifeCohorts(s.report,{...options,birthStart:start,birthEnd:end}));
  const food=s=>projection(s,'food',[options.width,start,end],()=>windowFoodCohorts(foodCohorts(s.report.foodAvailability,s.report.environmentTick??s.report.tick,options.width),s.report.foodAvailability,s.report.environmentTick??s.report.tick,start,end));
  const production=s=>projection(s,'production',[options.width,start,end],()=>productionCohorts(s.report.foodProductionHistory,s.report.environmentTick??s.report.tick,options.width,start,end));
  const distributions=s=>projection(s,'distributions',[start,end,options.origin,s.report.weightMode],()=>sensitivityDistributions([...s.report.dead,...s.report.living],{start,end,origin:options.origin,weightMode:s.report.weightMode}));
  const curve=s=>projection(s,'curve',[curveStart,options.width,options.origin],()=>survivalCurve(s.report,{start:curveStart,width:options.width,origin:options.origin}));
  if(precompute){for(const s of prepared){if(precompute==='histogram')distributions(s);if(precompute==='curve')curve(s);}return true;}
  const lines=prepared.map(s=>({id:s.id,color:s.color,label:s.name})),keys=lines.map(l=>l.id);
  const join=lists=>{const rows=new Map();lists.forEach((list,index)=>{for(const p of list){let row=rows.get(p.id);if(!row){row={id:p.id,start:p.start,end:p.end,x:p.x,complete:true};rows.set(p.id,row);}row[keys[index]]=p.value;row.complete&&=p.complete;}});return [...rows.values()].sort((a,b)=>a.id-b.id);};
  for(const c of chartCards){const {m,canvas,card,note}=c;if(card.hidden||c.pending)continue;
   const effective=m.single||m.id==='survival'?'mean':statistic;
   const lists=prepared.map(s=>{const estimate=c.displayEstimates?.get(s.id)??getEstimate(s.id,m.id);if(estimate?.points)return estimate.points.map(p=>({...p,value:p[effective]}));if(c.statisticsManaged||m.id==='population'||s.report.groupDesign)return [];return (m.id==='food'?food(s):m.id==='production'?production(s):cohorts(s).cohorts).map(p=>({...p,value:m.id==='survival'?p.survival.percent:['food','production'].includes(m.id)?p.mean:p.metrics[m.id][effective]}));});
   const points=join(lists),bands=[];
   if(['mean','median'].includes(effective)&&bandMode!=='none')for(const source of sources){const result=getEstimate(source.id,m.id);for(const p of points){const estimate=result?.byId?.get(p.id),range=estimate?.[bandMode==='spread'?'spread':'confidence']?.[effective];p[source.id+'Low']=range?.low??null;p[source.id+'High']=range?.high??null;}bands.push({low:source.id+'Low',high:source.id+'High',color:source.color});}
   drawHistoryChart(canvas,{points,keys,lines,bands,domainStart:start,domainEnd:end,width:options.width,single:['population','food','production'].includes(m.id)?'food':false,minimum:m.minimum??0,maximum:m.maximum??(['hunger','survival','reproduced'].includes(m.id)?100:null)});
   note.textContent='';
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
