import {analysisPlan,analysisLayout,ANALYSIS_DEFAULT} from './analysis-builder-core.js';
import {historicalFactorLabel,EXPERIMENT_FACTOR_FIELDS} from './experiment-fields.js';
import {experimentWorlds,mergeLifeReports} from './experiment-statistics.js';
const colors=['#86bf80','#e1c86e','#91b8d0','#cba4e4','#ed9a7a','#73c8bd','#d7a6bc','#c2ca8a'];
export const groupingLabel=key=>key==='variant'?'Вариант опыта':historicalFactorLabel(key);
export function groupingLayout(plan,variantIds,state){
 const view=analysisPlan(plan);return analysisLayout({...view,variants:view.variants.filter(v=>variantIds.includes(v.id))},{...ANALYSIS_DEFAULT,start:0,end:1,width:1,group:state.group,split:state.split,variantFilters:state.variantFilters});
}
export function groupedExperimentSources(series,variants,state,weightMode){
 const layout=groupingLayout(series.plan,variants.map(v=>v.id),state);
 return layout.groups.map((g,index)=>{
  const legacy=state.group==='variant'&&!state.split,id=legacy?g.variants[0]:'group:'+g.id,name=legacy?series.plan.variants.find(v=>v.id===id).name:JSON.parse(g.id).map(([k,v])=>`${groupingLabel(k)}: ${typeof v==='boolean'?(v?'вкл':'выкл'):v}`).join(' · ')||'Все выбранные варианты';
  const blockDesign=g.variants.length>1?{variants:g.variants,repeats:Array.from({length:series.plan.worlds},(_,i)=>i)}:null;
  const worlds=g.variants.flatMap(variantId=>experimentWorlds(series,variantId).map(w=>({...w,variantId,...(blockDesign?{blockDesign}:{})})));
  // Гистограммы/возрастные кривые также не смешивают неполные уровни фактора.
  const full=new Set(worlds.filter(w=>w.report).map(w=>w.pairId));if(blockDesign)for(const repeat of full)if(g.variants.some(v=>!worlds.some(w=>w.pairId===repeat&&w.variantId===v&&w.report)))full.delete(repeat);
  const available=worlds.filter(w=>w.report&&full.has(w.pairId)),report=mergeLifeReports(available,weightMode);if(report&&blockDesign)report.groupDesign=blockDesign;
  return {id,name,color:colors[(legacy?series.plan.variants.findIndex(v=>v.id===id):index)%colors.length],worlds,report};
 });
}
export function installExperimentGrouping({root=document,onChange=()=>{}}={}){
 const host=root.getElementById('history-group-controls');if(!host)return {refresh(){},read:()=>({group:'variant',split:'',variantFilters:[]})};
 const make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;},group=make('select'),split=make('select'),filters=make('details');filters.append(make('summary','Фильтры: какие значения включать'));
 const label=(text,input)=>{const n=make('label',text);n.append(input);return n;};const grouping=make('fieldset');grouping.append(make('legend','Группировка: отдельные линии'),label('Группировать графики по',group),label('Дополнительно разделить по',split));host.append(filters,grouping,make('p','Фильтры выбирают миры, группировка разделяет выбранные данные на линии. Оба блока действуют на весь дашборд; связанные варианты одного повтора считаются совместно в ДИ.'));
 let plan=null,filterInputs=[],state={group:'variant',split:'',variantFilters:[]};
 const update=()=>{state={group:group.value,split:split.value,variantFilters:filterInputs.flatMap(f=>{const values=f.items.filter(i=>i.node.checked).map(i=>i.value);return values.length===f.items.length?[]:[{key:f.key,values}];})};onChange();};group.addEventListener('change',update);split.addEventListener('change',update);
 function refresh(series,enabled=true){host.hidden=!series;group.disabled=split.disabled=!enabled;for(const f of filterInputs)for(const i of f.items)i.node.disabled=!enabled;if(!series||plan===series.plan)return;plan=series.plan;state={group:'variant',split:'',variantFilters:[]};const view=analysisPlan(plan);
  for(const [select,empty]of [[group,'Объединить выбранные варианты'],[split,'Не разделять']])select.replaceChildren(...[['',empty],...view.factors.map(f=>[f.key,groupingLabel(f.key)])].map(([value,text])=>{const o=make('option',text);o.value=value;return o;}));group.value='variant';split.value='';filters.replaceChildren(make('summary','Фильтры: какие значения включать'));filterInputs=[];
  for(const f of view.factors){const field=make('fieldset');field.append(make('legend',groupingLabel(f.key)));const items=[];for(const value of f.values){const i=make('input');i.type='checkbox';i.checked=true;i.disabled=!enabled;const l=label(typeof value==='boolean'?(value?'вкл':'выкл'):String(value),i);l.className='check';field.append(l);items.push({node:i,value});i.addEventListener('change',update);}filters.append(field);filterInputs.push({key:f.key,items});}
 }return {refresh,read:()=>state};
}
