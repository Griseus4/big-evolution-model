import {chartContext,chartContextKey} from './chart-context.js';
import {createStatisticsClient} from './statistics-client.js';
import {createPairStatisticsClient} from './pair-statistics-client.js';
import {installHistoryEstimates} from './history-estimates-ui.js';
import {installHistoryDifferences} from './history-differences-ui.js';
import {createComparisonCharts} from './comparison-charts.js';
import {drawHistoryChart,HISTORY_LINES} from './history-charts.js';
import {survivalCurve,survivalAgeWindow} from './survival-curve.js';
/** Все независимые контексты делят один Worker оценок и один Worker пары.
 * Сама карточка не владеет историей мира; неактивные контексты освобождаются. */
export function createLocalChartRenderer({root=document,onChange}){
 const estimates=createStatisticsClient({onChange}),pairs=createPairStatisticsClient({onChange}),contexts=new Map(),drawComparison=createComparisonCharts(),queues={estimates:[],pairs:[]};let local=new Set();
 function update({cards,common,comparison,report,pair,bandMode,legend,curveMaximum,prefetch=[],render=true}){
  local=new Set();const groups=new Map();queues.estimates=[];queues.pairs=[];
  for(const c of cards){c.localContext=null;if(c.card.hidden&&!prefetch.includes(c))continue;const ctx=chartContext(c.definition,common),base=chartContext({...c.definition,pins:{}},common);if(chartContextKey(ctx)===chartContextKey(base))continue;
   const key=chartContextKey(ctx);if(!groups.has(key))groups.set(key,{context:ctx,cards:[]});groups.get(key).cards.push(c);local.add(c);
  }
  for(const [key,group]of groups){let entry=contexts.get(key);
   if(!entry){const list=[],metricCards=[],adapter={update:q=>{queues.estimates.push({...q,id:key});},get:(id,m)=>estimates.get(id,m,key),state:estimates.state,dispose(){}},pairAdapter={update:q=>{queues.pairs.push({...q,id:key});},get:m=>pairs.get(m,key),state:pairs.state,suspend(){},dispose(){}};
    entry={list,metricCards,estimates:installHistoryEstimates({root,cards:list,onChange,createClient:()=>adapter,showStatus:false}),differences:installHistoryDifferences({root,cards:metricCards,onChange,createClient:()=>pairAdapter})};contexts.set(key,entry);
   }
   entry.list.splice(0,entry.list.length,...group.cards.filter(c=>c.m));entry.metricCards.splice(0,entry.metricCards.length,...group.cards.filter(c=>c.definition.kind==='metric'));
   const ctx=group.context,sources=comparison?.sources?.length?comparison.sources:[{id:'selected',name:'Выбранные данные',color:'#86bf80',report}];
   entry.estimates.update({render,prefetch:group.cards.filter(c=>c.m),sources,options:ctx,start:ctx.start,end:ctx.end});entry.differences.update({render,prefetch:group.cards.filter(c=>c.m),pair,options:ctx,start:ctx.start,end:ctx.end,weightMode:comparison?.weightMode,statistic:comparison?.statistic??'mean',bandMode});
   for(const c of prefetch.filter(c=>group.cards.includes(c)&&['histogram','curve'].includes(c.definition.kind)))drawComparison({sources,options:c.definition.kind==='curve'?{...ctx,width:ctx.end-ctx.start}:ctx,start:ctx.start,end:ctx.end,curveStart:ctx.start,chartCards:[],histogramCards:[],curveVisible:false,precompute:c.definition.kind});
   for(const c of group.cards)c.localContext={...ctx,estimates:entry.estimates,differences:entry.differences};
   if(!render)continue;
   const originals=group.cards.filter(c=>!c.card.hidden&&c.definition.kind==='metric'&&!entry.differences.isDifference(c)),histograms=group.cards.filter(c=>!c.card.hidden&&c.definition.kind==='histogram');
   if(comparison?.sources?.length||histograms.length)drawComparison({sources,options:ctx,start:ctx.start,end:ctx.end,statistic:comparison?.statistic??'mean',chartCards:comparison?.sources?.length?originals:[],histogramCards:histograms,curveVisible:false,getEstimate:entry.estimates.get,bandMode});
   if(!comparison?.sources?.length)for(const c of originals){const r=entry.estimates.get('selected',c.m.id),single=c.m.single||['survival','food','production'].includes(c.m.id),keys=single?['mean']:[...legend],points=(r?.points??[]).map(p=>({...p})),bands=[];
    if(bandMode!=='none')for(const key of keys)if(['mean','median'].includes(key)){for(const p of points){const s=r.byId?.get(p.id),range=bandMode==='spread'&&s?.worlds<2?null:s?.[bandMode==='spread'?'spread':'confidence']?.[key];p[key+'Low']=range?.low??null;p[key+'High']=range?.high??null;}bands.push({low:key+'Low',high:key+'High',color:HISTORY_LINES.find(l=>l.id===key).color});}
    drawHistoryChart(c.canvas,{points,keys,bands,domainStart:ctx.start,domainEnd:ctx.end,width:ctx.width,single:['population','food','production'].includes(c.m.id)?'food':single,minimum:0,maximum:c.m.maximum??(['hunger','survival','reproduced'].includes(c.m.id)?100:null)});
    c.note.textContent=r?.error??(r?.summary?.count?'Нажми или наведи на интервал для значений.':r?'Нет данных для этих настроек и периода.':estimates.state().error??'Расчёт закреплённых настроек…');
   }
   for(const c of group.cards.filter(c=>!c.card.hidden&&c.definition.kind==='curve')){
    if(comparison?.sources?.length){drawComparison({sources,options:{...ctx,width:ctx.end-ctx.start},start:ctx.start,end:ctx.end,statistic:comparison.statistic,chartCards:[],histogramCards:[],curveCanvas:c.canvas,curveMaximum,curveStart:ctx.start,curveVisible:true});c.note.textContent='Сплошная линия — подтверждённая доля; пунктир — возможная с учётом живых.';}
    else{const curve=survivalCurve(report,{start:ctx.start,width:ctx.end-ctx.start,origin:ctx.origin}),view=survivalAgeWindow(curve,curveMaximum),markers=HISTORY_LINES.filter(l=>['mean','median'].includes(l.id)&&curve.completed[l.id]!==null).map(l=>({value:curve.completed[l.id],label:l.label,color:l.color}));drawHistoryChart(c.canvas,{points:view.points,keys:['mean'],domainEnd:curveMaximum,single:true,maximum:100,age:true,markers});c.note.textContent=curve.count?`Группа: ${curve.count}; завершено ${curve.dead}; живых ${curve.alive}. Маркеры возраста — только завершённые жизни; живые сохраняют неизвестный исход.`:'Нет данных в закреплённой группе рождения.';}
   }
  }
  for(const key of contexts.keys())if(!groups.has(key))contexts.delete(key);
  estimates.updateBatch(queues.estimates);pairs.updateBatch(queues.pairs);
 }
 return {update,state:()=>[estimates.state(),pairs.state()],suspend(){estimates.suspend();pairs.suspend();},isLocal:c=>local.has(c),dispose(){estimates.dispose();pairs.dispose();contexts.clear();local=new Set();}};
}
