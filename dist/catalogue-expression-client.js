import {ANALYSIS_DEFAULT,analysisPlan} from './analysis-builder-core.js';
import {compileExpression} from './analysis-expression.js';
import {projectAnalysisWorld} from './analysis-projection.js';
import {analysisWorlds} from './statistical-series.js';
/** Одна подготовка столбцов и один Worker для всех видимых формул.
 * Каталог хранит рецепты; исходные истории в него не копируются. */
export function createCatalogueExpressionClient({onChange=()=>{},createWorker=()=>new Worker(new URL('./analysis-builder-worker.js',import.meta.url),{type:'module'})}={}){
 const identities=new WeakMap();let serial=0,key=null,request=0,worker=null,rejectWait=null,results=new Map(),status='';
 const identity=report=>{if(!report)return 0;if(!identities.has(report))identities.set(report,++serial);return identities.get(report);};
 function stop(){request++;worker?.terminate();worker=null;rejectWait?.(new Error('Устаревший расчёт.'));rejectWait=null;}
 function update({cards,comparison,report,options,start,end,plan:sourcePlan}){
  const sources=comparison?.variants??[{id:'selected',name:'Выбранные данные',color:'#86bf80',worlds:analysisWorlds(report)}];
  const next=JSON.stringify([cards.map(c=>[c.definition.id,c.definition.name,c.definition.recipe]),sources.map(s=>[s.id,s.worlds.map(w=>[w.id,identity(w.report),w.pairId,w.variantId])]),options,start,end,report.weightMode]);if(next===key)return;stop();key=next;results=new Map();status='';if(!cards.length)return;
  const view=sourcePlan?analysisPlan(sourcePlan):null;
  const current=request,variants=new Map(),targets=[],groups=new Map(),fields=new Set(['id','born','alive']);let repeats=1,needBirths=false;
  const configs=cards.map(card=>{const recipe=card.definition.recipe;for(const text of [recipe.expression,recipe.filter]){const parsed=compileExpression(text);for(const f of parsed.fields)if(f!=='N')fields.add(f);needBirths||=parsed.births.length>0;}return {id:card.definition.id,config:{...ANALYSIS_DEFAULT,...recipe,name:card.definition.name,start,end,width:options.width,origin:options.origin,mode:options.mode==='dead'?'dead':'all',weight:report.weightMode??'worlds',group:'chartGroup',split:'',variantFilters:[]}};});
  for(const source of sources){groups.set(source.id,source);for(const [i,w]of source.worlds.entries()){const pairId=w.pairId??i,variantId=w.variantId??source.id;repeats=Math.max(repeats,pairId+1);variants.set(variantId,{id:variantId,settings:{...view?.variants.find(v=>v.id===variantId)?.settings,chartGroup:source.id}});targets.push({...w,pairId,variantId});}}
  const plan={worlds:Math.max(repeats,view?.worlds??1),variants:[...variants.values()],factors:[...(view?.factors??[]),{key:'chartGroup',values:[...groups.keys()]}]};status='Подготовка пользовательских графиков…';
  (async()=>{let receive=null;try{worker=createWorker();const active=worker;let failure=null;worker.onmessage=({data})=>{if(current!==request)return;if(data.error){failure=new Error(data.error);rejectWait?.(failure);}else receive?.(data);};worker.onerror=e=>{e.preventDefault?.();failure=new Error(e.message??'Ошибка Worker графиков');rejectWait?.(failure);};
    const wait=()=>new Promise((resolve,reject)=>{receive=resolve;rejectWait=reject;if(failure)reject(failure);});active.postMessage({type:'start',plan,configs});
    for(const [i,w]of targets.entries()){if(current!==request)return;status=`Формулы: мир ${i+1}/${targets.length}`;const projection=w.report?await projectAnalysisWorld(w.report,[...fields],{start,end,mode:options.mode==='dead'?'dead':'all',origin:options.origin,needBirths},()=>current!==request):null;if(current!==request)return;
     const ack=wait(),transfer=projection?[...Object.values(projection.columns),...Object.values(projection.timeline??{})].map(a=>a.buffer):[];active.postMessage({type:'world',meta:{id:w.id,variantId:w.variantId,pairId:w.pairId,seed:w.seed,number:w.number,extinctions:w.extinctions},projection},transfer);await ack;
    }
    const done=wait();status='Оценки пользовательских графиков…';active.postMessage({type:'finish'});const data=await done;if(current!==request)return;
    for(const {id,result,error}of data.results){if(error){results.set(id,{error});continue;}for(const group of result.groups){const source=groups.get(JSON.parse(group.id)[0][1]);group.label=source?.name??group.label;group.color=source?.color;}results.set(id,result);}status='';
   }catch(error){if(current===request)status=error.message;}finally{if(current===request){worker?.terminate();worker=null;rejectWait=null;onChange();}}
  })();
 }
 return {update,get:id=>results.get(id),state:()=>status,dispose(){stop();key=null;results=new Map();}};
}
