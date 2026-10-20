import {createPairStatisticsClient} from './pair-statistics-client.js';
import {drawHistoryChart,HISTORY_LINES} from './history-charts.js';
import {formatStatistic as format,estimateCell} from './statistics-format.js';
/** Разность считается по полным исходным повторам в каждой корзине.
 * Bootstrap выполняется в Worker; смена линии и размера использует кэш. */
export function installHistoryDifferences({root=document,cards,onChange,createClient=createPairStatisticsClient}){
 const make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const client=createClient({onChange}),rendered=new Map();let last=null;
 for(const c of cards){
  const label=make('label','Показать '),select=make('select');select.setAttribute('aria-label',c.m.label+': исходные данные или разность');
  for(const [value,text]of [['original','Исходные данные'],['difference','Разность B−A']]){const o=make('option',text);o.value=value;select.append(o);}select.value='original';
  label.append(select);label.className='history-chart-mode';
  const help=make('button','?');help.type='button';help.className='help-trigger';help.setAttribute('data-help','history-chart-mode');help.setAttribute('aria-label','Подсказка: исходные данные или B−A');
  const control=make('div');control.className='help-control';control.append(label,help);if(c.card.insertBefore)c.card.insertBefore(control,c.canvas);else c.card.append(control);c.view=select;
  c.difference=make('div');c.difference.className='history-numeric-summary';c.card.append(c.difference);
  select.addEventListener('change',onChange);
 }
 const isDifference=c=>c.view?.value==='difference';
 function pointText(p,stat){
  const s=p?.[stat],ci=s?.confidence?.difference;
  return s?`B−A: ${format(s.difference)}${ci?` [${format(ci.low)}; ${format(ci.high)}], 95% ДИ`:''}; полных пар ${p.pairs}, пропусков ${p.excludedCount??p.excluded?.length??0}. ${p.reason??''}`:'Нет полных пар или расчёт ещё не готов.';
 }
 function update(input){
  last=input;const visible=cards.filter(c=>!c.card.hidden&&isDifference(c));
  for(const c of cards){c.difference.hidden=!isDifference(c);if(c.numeric)c.numeric.hidden=isDifference(c);}
  if(!visible.length||!input.pair)client.suspend();
  else client.update({...input.pair,metrics:visible.map(c=>c.m.id),options:{...input.options,start:input.start,end:input.end},weightMode:input.weightMode,series:true});
  for(const c of visible){
   const answer=input.pair?client.get(c.m.id):null,result=answer?.result,stat=c.m.single||c.m.id==='survival'?'mean':input.statistic??'mean';
   const points=(answer?.points??[]).map(p=>{const s=p[stat],range=input.bandMode==='spread'?p.spread?.[stat]:s?.confidence?.difference;return {...p,value:s?.difference??null,low:range?.low??null,high:range?.high??null};});
   let low=0,high=0;for(const p of points)for(const k of input.bandMode==='none'?['value']:['value','low','high'])if(Number.isFinite(p[k])){low=Math.min(low,p[k]);high=Math.max(high,p[k]);}
   const bound=Math.max(Math.abs(low),Math.abs(high))*1.08||1;
   drawHistoryChart(c.canvas,{points,keys:['value'],lines:[{id:'value',color:'#91b8d0'}],bands:input.bandMode==='none'?[]:[{low:'low',high:'high',color:'#91b8d0'}],domainStart:input.start,domainEnd:input.end,width:input.options.width,minimum:-bound,maximum:bound,zeroLine:true,single:['population','food','production'].includes(c.m.id)?'food':false});
   c.note.textContent=!input.pair?'Выберите источник «Сравнение вариантов» и общую пару A/B.':`${input.pair.b.name} − ${input.pair.a.name}. ${HISTORY_LINES.find(l=>l.id===stat)?.label??stat}. ${input.bandMode==='spread'?'Полоса — межквартильный разброс парных значений миров.':'Полоса — поточечный 95% ДИ разности; от пяти полных пар.'} ${client.state().error??''}`;
   const signature=[answer,stat,input.pair?.a.id,input.pair?.b.id,input.start,input.end];const prev=rendered.get(c);if(prev?.every((v,i)=>v===signature[i]))continue;rendered.set(c,signature);
   const row=make('tr');row.append(make('th','B−A'),estimateCell(root,result?.[stat]?.difference,result?.[stat]?.confidence?.difference,{pending:!!input.pair&&!answer}),make('td',`Пар: ${result?.pairs??0}`));const table=make('table');table.append(row);
   c.difference.replaceChildren(make('p',`Период [${input.start}; ${input.end}) Т · ${c.m.unit} · ${HISTORY_LINES.find(l=>l.id===stat)?.label??stat} [95% ДИ]`),table,make('p',result?.reason??answer?.error??''));
  }
 }
 function pointDescription(metric,id){const answer=client.get(metric),stat=cards.find(c=>c.m.id===metric)?.m.single||metric==='survival'?'mean':last?.statistic??'mean';if(answer&&!answer.byId)answer.byId=new Map((answer.points??[]).map(p=>[p.id,p]));return pointText(answer?.byId?.get(id),stat);}
 return {update,isDifference,pointDescription,dispose:client.dispose};
}
