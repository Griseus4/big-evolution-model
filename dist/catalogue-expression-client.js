import {archiveOrigin} from './experiment-archive.js';
import {retainedResults} from './retained-results.js';
import {ANALYSIS_DEFAULT,analysisPlan} from './analysis-builder-core.js';
import {compileExpression} from './analysis-expression.js';
import {projectAnalysisWorld} from './analysis-projection.js';
import {analysisWorlds} from './statistical-series.js';
import {chartContext,chartContextKey} from './chart-context.js';
/** Одна подготовка столбцов и один Worker для всех видимых формул.
 * Каталог хранит рецепты; исходные истории в него не копируются. */
export function createCatalogueExpressionClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./analysis-builder-worker.js',import.meta.url),{type:'module'})}={}){
 const cache=retainedResults({maxEntries:100,maxPoints:50000});const identities=new WeakMap();let serial=0,key=null,request=0,worker=null,rejectWait=null,results=new Map(),status='';
 const identity=report=>{if(!report)return 0;report=archiveOrigin(report)??report;if(!identities.has(report))identities.set(report,++serial);return identities.get(report);};
 function stop(){request++;worker?.terminate();worker=null;rejectWait?.(new Error('Устаревший расчёт.'));rejectWait=null;}
 function update({cards,comparison,report,options,start,end,plan:sourcePlan}){
  const sources=comparison?.variants??[{id:'selected',name:'Выбранные данные',color:'#86bf80',worlds:analysisWorlds(report)}];
  const next=JSON.stringify([cards.map(c=>[c.definition.id,{...c.definition.recipe,chart:''},c.definition.pins]),sources.map(s=>[s.id,s.worlds.map(w=>[w.id,identity(w.report),w.pairId,w.variantId])]),options,start,end,report.weightMode]);if(next===key){for(const c of cards){const r=results.get(c.definition.id);if(r?.config){r.config.name=c.definition.name;r.config.chart=c.definition.recipe.chart;}}return;}stop();key=next;results=new Map();status='';const context=JSON.stringify([sources.map(s=>[s.id,s.name,s.color,s.worlds.map(w=>[w.id,identity(w.report),w.pairId,w.variantId])]),options,start,end,report.weightMode,sourcePlan?.factors]);const keys=new Map(cards.map(c=>[c.definition.id,JSON.stringify([{...c.definition.recipe,chart:''},c.definition.pins,context])]));for(const c of cards){const saved=cache.get(keys.get(c.definition.id));if(saved)results.set(c.definition.id,{...saved,config:{...saved.config,name:c.definition.name,chart:c.definition.recipe.chart}});}cards=cards.filter(c=>!results.has(c.definition.id));if(!cards.length)return;
  const view=sourcePlan?analysisPlan(sourcePlan):null;
  const current=request,variants=new Map(),targets=[],groups=new Map(),contexts=new Map();let repeats=1;
  const aliases=new Map(),calculations=new Map(),configs=[];
  for(const card of cards){const recipe=card.definition.recipe,ctx=chartContext(card.definition,{...options,start,end}),contextId=chartContextKey(ctx),config={...ANALYSIS_DEFAULT,...recipe,name:card.definition.name,start:ctx.start,end:ctx.end,width:ctx.width,origin:ctx.origin,mode:ctx.mode==='dead'?'dead':'all',weight:report.weightMode??'worlds',group:'chartGroup',split:'',variantFilters:[]},calculation=JSON.stringify({...config,name:'',chart:''});
   if(calculations.has(calculation)){aliases.set(card.definition.id,calculations.get(calculation));continue;}calculations.set(calculation,card.definition.id);aliases.set(card.definition.id,card.definition.id);configs.push({id:card.definition.id,config});
   if(!contexts.has(contextId))contexts.set(contextId,{...ctx,owners:[],fields:new Set(['id','born','alive']),needBirths:false});const batch=contexts.get(contextId);batch.owners.push(card.definition.id);for(const text of [recipe.expression,recipe.filter]){const parsed=compileExpression(text);for(const f of parsed.fields)if(f!=='N')batch.fields.add(f);batch.needBirths||=parsed.births.length>0;}
  }
  for(const source of sources){groups.set(source.id,source);for(const [i,w]of source.worlds.entries()){const pairId=w.pairId??i,variantId=w.variantId??source.id;repeats=Math.max(repeats,pairId+1);variants.set(variantId,{id:variantId,settings:{...view?.variants.find(v=>v.id===variantId)?.settings,chartGroup:source.id}});targets.push({...w,pairId,variantId});}}
  const plan={worlds:Math.max(repeats,view?.worlds??1),variants:[...variants.values()],factors:[...(view?.factors??[]),{key:'chartGroup',values:[...groups.keys()]}]};status='Подготовка пользовательских графиков…';
  (async()=>{let receive=null;try{worker=createWorker();const active=worker;let failure=null;worker.onmessage=({data})=>{if(current!==request)return;if(data.error){failure=new Error(data.error);rejectWait?.(failure);}else receive?.(data);};worker.onerror=e=>{e.preventDefault?.();failure=new Error(e.message??'Ошибка Worker графиков');rejectWait?.(failure);};
    const wait=()=>new Promise((resolve,reject)=>{receive=resolve;rejectWait=reject;if(failure)reject(failure);});active.postMessage({type:'start',plan,configs});
    for(const [i,w]of targets.entries())for(const ctx of contexts.values()){if(current!==request)return;status=`Формулы: мир ${i+1}/${targets.length}`;const projection=w.report?await projectAnalysisWorld(w.report,[...ctx.fields],{...ctx,mode:ctx.mode==='dead'?'dead':'all'},()=>current!==request):null;if(current!==request)return;
     const ack=wait(),transfer=projection?[...Object.values(projection.columns),...Object.values(projection.timeline??{})].map(a=>a.buffer):[];active.postMessage({type:'world',owners:ctx.owners,meta:{id:w.id,variantId:w.variantId,pairId:w.pairId,seed:w.seed,number:w.number,extinctions:w.extinctions},projection},transfer);await ack;
    }
    const done=wait();status='Оценки пользовательских графиков…';active.postMessage({type:'finish'});const data=await done;if(current!==request)return;
    const answers=new Map();for(const {id,result,error}of data.results){if(error){answers.set(id,{error});continue;}for(const group of result.groups){const source=groups.get(JSON.parse(group.id)[0][1]);group.label=source?.name??group.label;group.color=source?.color;}answers.set(id,result);}
    for(const c of cards){const answer=answers.get(aliases.get(c.definition.id));results.set(c.definition.id,cache.set(keys.get(c.definition.id),answer?.error?answer:{...answer,config:{...answer.config,name:c.definition.name,chart:c.definition.recipe.chart}}));}status='';
   }catch(error){if(current===request)status=error.message;}finally{if(current===request){worker?.terminate();worker=null;rejectWait=null;onChange();}}
  })();
 }
 return {update,get:id=>results.get(id),state:()=>status,busy:()=>Boolean(worker),suspend(){stop();key=null;},dispose(){stop();key=null;results=new Map();cache.clear();}};
}
