import {LIFE_METRICS} from './life-cohorts.js';
import {createPairStatisticsClient} from './pair-statistics-client.js';
import {formatStatistic as format,estimateCell} from './statistics-format.js';
export const PAIR_METRICS=Object.freeze([...LIFE_METRICS,{id:'population',label:'Средняя численность населения',unit:'живых особей'},{id:'food',label:'Среднее количество еды на карте',unit:'порций'},{id:'production',label:'Потенциальная выработка пищи',unit:'порций / Т'},{id:'survival',label:'Доля доживших до выбранного возраста',unit:'%'}]);
/** Строка метрики меняется только при новом ответе. Подробности миров
 * создаются лениво; общий период и фильтры принадлежат истории. */
export function installPairComparison({root=document,onChange=()=>{},createClient=createPairStatisticsClient}={}){
 const byId=id=>root.getElementById(id),make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const a=byId('pair-variant-a'),b=byId('pair-variant-b'),stat=byId('pair-statistic'),body=byId('pair-rows'),status=byId('pair-status'),client=createClient({onChange});
 let last=null,variantsKey='',previousA='',previousB='',blocks=new Map(),rendered=new Map();
 function details(result){
  const node=make('details'),summary=make('summary',`Состав: ${result.pairs} пар; пропусков ${result.excluded.length}`);node.append(summary);let built=false;
  node.addEventListener('toggle',()=>{if(!node.open||built)return;built=true;const list=make('ul');
   const describe=w=>w.members?w.members.map(m=>`${m.variantId}: seed ${m.seed??'—'}, попытка ${m.number??'—'}, среднее ${format(m.mean)}, медиана ${format(m.median)}, наблюдений ${m.count}; вымираний ${m.extinctions??0}`).join('; '):`seed ${w.seed??'—'}, попытка ${w.number??'—'}, среднее ${format(w.mean)}, медиана ${format(w.median)}, наблюдений ${w.count}; вымираний ${w.extinctions??0}`;
   for(const p of result.included){const item=make('li',`Повтор ${p.pairId+1}. A: ${describe(p.a)}. B: ${describe(p.b)}.`);if(p.a.extinctions||p.b.extinctions)item.className='extinction-warning';list.append(item);}
   for(const p of result.excluded)list.append(make('li',`Повтор ${p.pairId+1} исключён только из этого показателя. A: ${p.a??'данные есть'} B: ${p.b??'данные есть'}`));node.append(list);
  });return node;
 }
 function selection(comparison){
  const variants=comparison?.variants??[],key=JSON.stringify(variants.map(v=>[v.id,v.name]));
  if(key!==variantsKey){variantsKey=key;for(const select of [a,b]){const old=select.value;select.replaceChildren(...variants.map(v=>{const o=make('option',v.name);o.value=v.id;return o;}));select.value=variants.some(v=>v.id===old)?old:variants[select===a?0:1]?.id??'';}}
  if(variants.length<2)return null;
  if(a.value===b.value)b.value=variants.find(v=>v.id!==a.value).id;
  const va=variants.find(v=>v.id===a.value),vb=variants.find(v=>v.id===b.value);previousA=a.value;previousB=b.value;
  for(const [id,v]of [['pair-label-a',va],['pair-label-b',vb]]){const label=byId(id);label.textContent=`${id.endsWith('a')?'A':'B'}: ${v.name}`;label.style.color=v.color;}
  return {a:va,b:vb};
 }
 function update(input){
  last=input;const chosen=selection(input.comparison);if(!chosen){client.suspend();status.textContent='Выберите источник «Сравнение вариантов» в настройках статистики. Нужен опыт как минимум с двумя вариантами.';for(const id of ['pair-label-a','pair-label-b','pair-period'])byId(id).textContent='';for(const block of blocks.values())block.remove();blocks.clear();rendered.clear();return;}const {a:va,b:vb}=chosen;
  byId('pair-period').textContent=`Общий период [${input.start}; ${input.end}) Т. Метрики жизней — рождения, население и пища — время мира. Вес метрик особей: ${input.comparison.weightMode==='individuals'?'равный вес особей':'равный вес миров'}.`;
  client.update({a:va,b:vb,metrics:PAIR_METRICS.map(m=>m.id),options:{...input.options,start:input.start,end:input.end},weightMode:input.comparison.weightMode});
  const progress=client.state();status.textContent=progress.error??`Сравнение в фоне: ${progress.completed}/${progress.total} показателей. ДИ приближённые, от пяти полных пар; сравниваются только указанные в составе пары.`;
  if(!blocks.size){for(const m of PAIR_METRICS){const block=make('tbody');body.append(block);blocks.set(m.id,block);}}
  const mode=stat.value||'both',stats=mode==='both'?['mean','median']:[mode];
  for(const m of PAIR_METRICS){
   const answer=client.get(m.id),signature=[answer,mode,va.id,vb.id],previous=rendered.get(m.id);if(previous&&previous.every((v,i)=>v===signature[i]))continue;rendered.set(m.id,signature);
   const result=answer?.result,block=blocks.get(m.id),rows=[];
   for(let i=0;i<stats.length;i++){
    const name=stats[i],s=result?.[name],tr=make('tr'),label=make('th');label.setAttribute('scope','row');label.append(make('strong',m.label),make('p',`${name==='mean'?'Среднее':'Медиана'} · ${m.unit}`));
    if(i===0){if(result){label.append(make('p',`Доступно миров A/B: ${result.availableA}/${result.availableB}.`));if(result.reason)label.append(make('p',result.reason));label.append(details(result));}if(answer?.error)label.append(make('p',answer.error));}
    if(s?.ratioReason)label.append(make('p',s.ratioReason));if(s?.reason)label.append(make('p',s.reason));
    tr.append(label,...['a','b','difference','ratio','percent'].map(key=>{const cell=estimateCell(root,s?.[key],s?.confidence?.[key],{pending:!answer&&!progress.error});if(key==='difference'&&m.unit==='%')cell.append(make('small','п.п.'));return cell;}),make('td',result?String(result.pairs):'—'));rows.push(tr);
   }block.replaceChildren(...rows);
  }
 }
 for(const [select,other,old]of [[a,b,()=>previousA],[b,a,()=>previousB]])select.addEventListener('change',()=>{if(select.value===other.value)other.value=old();onChange();});
 stat.addEventListener('change',()=>{if(last)update(last);});
 byId('pair-swap').addEventListener('click',()=>{const old=a.value;a.value=b.value;b.value=old;onChange();});
 return {update,selection,state:client.state,prefetch(input){const pair=selection(input.comparison);if(pair)client.update({...pair,metrics:PAIR_METRICS.map(m=>m.id),options:{...input.options,start:input.start,end:input.end},weightMode:input.comparison.weightMode});},suspend:client.suspend,dispose:client.dispose};
}
