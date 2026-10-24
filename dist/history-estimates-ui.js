import {createStatisticsClient} from './statistics-client.js';
import {chartUpdateState} from './chart-update-state.js';
import {formatStatistic as format,estimateCell} from './statistics-format.js';
const interval=(s,stat)=>s?.confidence?.[stat]?` [${format(s.confidence[stat].low)}; ${format(s.confidence[stat].high)}]`:' [ДИ недоступен]';
/** Числа относятся ко всему выбранному периоду, наведение — к одной корзине.
 * DOM чисел заменяется только при новом результате фонового расчёта. */
export function installHistoryEstimates({root=document,cards,onChange,createClient=createStatisticsClient,showStatus=true}){
 const make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;},rendered=new WeakMap();
 const client=createClient({onChange}),state=root.getElementById('history-analysis-state');let sources=[];
 function register(){for(const card of cards)if(!card.numeric){card.numeric=make('div');card.numeric.className='history-numeric-summary';card.card.append(card.numeric);}}
 register();
 function update(input){
  register();sources=input.sources;const visible=(input.cards??cards).filter(c=>!c.card.hidden&&c.view?.value!=='difference');client.update({...input,metrics:[...new Set([...visible,...(input.prefetch??[])].filter(c=>c.view?.value!=='difference').map(c=>c.m.id))]});
  if(input.render===false)return;
  const progress=client.state();if(showStatus)state.textContent=progress.error??'';
  for(const c of visible){
   const results=sources.map(s=>client.get(s.id,c.m.id)),key=results.map((r,i)=>r??sources[i].report),pending=results.some(r=>!r)&&!progress.error;
   c.statisticsManaged=true;chartUpdateState(root,c,pending);if(pending)continue;
   c.displayEstimates=new Map(sources.map((s,i)=>[s.id,results[i]]));c.displayContext={start:input.start,end:input.end,width:input.options.width};
   const previous=rendered.get(c);if(previous&&previous.length===key.length&&previous.every((r,i)=>r===key[i]))continue;rendered.set(c,key);
   const table=make('table'),head=make('tr');head.append(...['Вариант','Среднее [95% ДИ]','Медиана [95% ДИ]','Миров'].map(t=>make('th',t)));table.append(head);
   for(let i=0;i<sources.length;i++){
    const source=sources[i],result=results[i],s=result?.summary,row=make('tr'),name=make('td',source.name);name.style.color=source.color;
    row.append(name,estimateCell(root,s?.mean,s?.confidence?.mean,{pending:!result}),estimateCell(root,s?.median,s?.confidence?.median,{pending:!result}),make('td',s?String(s.worlds):'—'));table.append(row);
   }
   const nodes=[make('p',`${['population','food','production'].includes(c.m.id)?'Время мира':'Рождения'} [${input.start}; ${input.end}) Т · ${c.m.unit}`),table];
   for(let i=0;i<sources.length;i++){
    const result=results[i],s=result?.summary;if(result?.error)nodes.push(make('p',sources[i].name+': '+result.error));
    if(s?.reason&&!(result?.error&&s.worlds===0))nodes.push(make('p',sources[i].name+': '+s.reason));
    if(s?.repeats!==undefined)nodes.push(make('p',`Независимых исходных повторов: ${s.repeats}. Связанные миры разных настроек перевыбираются совместно.`));
    if(s?.excluded?.length)nodes.push(make('p','Пропущены неполные повторы: '+s.excluded.map(e=>`${e.pairId+1} (нет данных: ${e.variants.join(', ')})`).join('; ')));
    if(s?.individual?.length){const details=make('details'),summary=make('summary',sources[i].name+' · значения отдельных миров');let built=false;details.append(summary);details.addEventListener('toggle',()=>{if(!details.open||built)return;built=true;const table=make('table');for(const w of s.individual){const row=make('tr');row.append(...[w.id,`среднее ${format(w.mean)}`,`медиана ${format(w.median)}`,`наблюдений ${w.count}`].map(t=>make('td',t)));table.append(row);}details.append(table);});nodes.push(details);}
   }c.numeric.replaceChildren(...nodes);
  }
 }
 function pointDescription(metric,id){
  return sources.map(source=>{const p=client.get(source.id,metric)?.byId?.get(id);return p?`${source.name}: среднее ${format(p.mean)}${interval(p,'mean')}; медиана ${format(p.median)}${interval(p,'median')}; миров ${p.worlds}. ${p.reason??''}`:`${source.name}: расчёт ещё не готов или данных нет.`;}).join(' ');
 }
 return {update,get:client.get,pointDescription,state:client.state,suspend:client.suspend,dispose:client.dispose};
}
