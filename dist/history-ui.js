/** Истории считаются только при открытии вкладки/смене фильтра. Пагинация,
 * выбор точки и перерисовка Canvas повторно не сортируют жизни по группам. */
import {aggregateLifeCohorts,LIFE_METRICS,lifeMetric,HISTORY_PAGE_SIZE as PAGE} from './life-cohorts.js';
import {foodCohorts} from './food-exposure.js';
import {HISTORY_LINES,drawHistoryChart,chartCohortAt,chartTimeAt} from './history-charts.js';
import {historyDomainEnd,windowLifeCohorts,windowFoodCohorts} from './history-window.js';
import {survivalCurve,survivalAtAge} from './survival-curve.js';
import {SUBSTEPS} from './action-timing.js';
import {CAUSE_LABELS} from './life-history.js';
const format=(v,digits=1)=>v===null||v===undefined?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:digits});
export function installHistoryUI({root=document,getSimulation}){
 const byId=id=>root.getElementById(id),make=(tag,text)=>{const e=root.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let cachedReport=null,cachedKey='',data=null,food=[],allRows=[],tableRows=[],page=0,selected=null,selectedLife=null,lastTick=-1,dirtyTable=true;
 let base=null,fullFood=[],rangeStart=0,rangeEnd=null,rangeMaximum=100,curve=null,curveReport=null,curveKey='',curveIndex=0;
 const foodById=new Map();
 const chartCards=[],legend=new Set(HISTORY_LINES.map(l=>l.id)),series=new Map(),members=new Map();
 const metricSelect=byId('history-table-metric');
 for(const m of LIFE_METRICS){const option=make('option',m.label);option.value=m.id;metricSelect.append(option);}
 function options(){return {width:Number(byId('history-width').value),survivalAge:Number(byId('history-survival-age').value),origin:byId('history-origin').value,mode:byId('history-stat-mode').value,interruptionKind:byId('history-interruption-kind').value};}
 const metricValue=(g,id)=>g?.metrics[id];
 function description(g,id){
  if(!g)return 'В этом интервале нет сохранённых рождений.';
  const start=`Рождение [${g.start}; ${g.end}) Т. Родилось ${g.born}; завершено ${g.dead}; живы ${g.alive}. `;
  if(id==='survival')return start+(g.survival.percent===null?'Точная доля ещё недоступна: интервал открыт, часть исходов неизвестна или история неполна.':`Дожили до ${data.survivalAge} Т: ${g.reachedAge}/${g.born} (${format(g.survival.percent)}%).`);
  const m=LIFE_METRICS.find(m=>m.id===id),s=metricValue(g,id);
  return start+`Показатель доступен для ${s.count} особей. `+(s.count?HISTORY_LINES.map(l=>`${l.label}: ${format(s[l.id],m.digits)}`).join(' · ')+` ${m.unit}. `:'')+(g.complete?'Группа завершена.':'Группа незавершённая; значения предварительные.');
 }
 function selectCohort(id){selected=id;selectedLife=null;page=0;byId('history-table-mode').value='lives';dirtyTable=true;drawCharts();renderTable();}
 for(const m of [...LIFE_METRICS,{id:'survival',label:'Доля доживших до выбранного возраста',unit:'%'},{id:'food',label:'Среднее количество еды на карте',unit:'порций на земле'}]){
  const card=make('section');card.className='history-chart-card';card.append(make('h3',m.label),make('p',m.unit));
  const canvas=make('canvas');canvas.id='history-chart-'+m.id;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',m.label+'. Стрелки выбирают интервал, Escape снимает выбор.');
  const note=make('p','Наведи на точку для значений. Нажми, чтобы выбрать интервал.');note.className='history-chart-note';canvas.setAttribute('aria-describedby',note.id='history-note-'+m.id);card.append(canvas,note);byId('history-charts').append(card);chartCards.push({m,canvas,note});
  const idAt=e=>chartCohortAt(canvas,e.clientX,data.domainEnd,data.width,data.domainStart);
  canvas.addEventListener('pointermove',e=>{if(!data)return;const id=idAt(e);note.textContent=m.id==='food'?foodDescription(id):description(data.byId.get(id),m.id);});
  canvas.addEventListener('click',e=>{if(data)selectCohort(idAt(e));});
  canvas.addEventListener('keydown',e=>{if(!data)return;const first=Math.floor(data.domainStart/data.width),last=Math.ceil(data.domainEnd/data.width)-1;let id=selected??first;if(e.key==='Escape'){clearSelection();return;}if(e.key==='ArrowRight')id++;else if(e.key==='ArrowLeft')id--;else if(e.key==='Home')id=first;else if(e.key==='End')id=last;else return;e.preventDefault();selectCohort(Math.max(first,Math.min(last,id)));note.textContent=m.id==='food'?foodDescription(selected):description(data.byId.get(selected),m.id);});
 }
 function foodDescription(id){const f=foodById.get(id);return f?`Время [${f.start}; ${f.end}) Т: среднее ${format(f.mean,2)} порций на земле за ${format(f.observedTime)} Т. `+(f.complete?'Интервал завершён.':'Интервал ещё продолжается.'):'Нет истории количества пищи для этого интервала.';}
 function drawCharts(){
  if(!data)return;
  for(const {m,canvas}of chartCards){
   const single=m.id==='survival'||m.id==='food';
   const points=series.get(m.id);
   const maximum=['hunger','survival'].includes(m.id)?100:null;
   drawHistoryChart(canvas,{points,keys:single?['mean']:[...legend],domainStart:data.domainStart,domainEnd:data.domainEnd,width:data.width,selected,single:m.id==='food'?'food':single,maximum});
  }
  if(curve)drawHistoryChart(curveCanvas,{points:curve.points,keys:['mean'],domainEnd:curve.domainEnd,selected:curve.points.length?curveIndex:null,single:true,maximum:100,age:true});
 }
 function filteredLives(){
  const filter=byId('history-filter').value,search=byId('history-search').value.trim(),sort=byId('history-sort').value;
  const rows=(selected===null?allRows:members.get(selected)??[]).filter(r=>r.born>=rangeStart&&r.born<rangeEnd&&(!search||String(r.id)===search||String(r.founderId)===search)&&(filter==='all'||filter==='alive'&&r.status==='alive'||filter==='dead'&&r.status==='dead'||r.cause===filter));
  return rows.sort((a,b)=>sort==='age'?b.age-a.age:sort==='children'?b.children-a.children:b.id-a.id);
 }
 function showLife(row){selectedLife=row.id;const o=row.observations;
  byId('history-detail').textContent=`Житель №${row.id}: рождение ${format(row.born)} Т, ${row.status==='dead'?'возраст смерти':'наблюдаемый возраст'} ${format(row.age)} Т. `+
   LIFE_METRICS.filter(m=>m.id!=='lifetime').map(m=>`${m.label}: ${format(lifeMetric(row,m.id,data.interruptionKind),m.digits)} ${m.unit}`).join(' · ')+
   (o?`. Прерывания: добровольно ${o.interruptions.voluntary}, физически ${o.interruptions.physical}, из-за смерти ${o.interruptions.death}. Среднее/медиана запасов ${format(o.meanInventory,2)}/${format(o.medianInventory,2)}.`:' Новые индивидуальные счётчики отсутствуют.')+
   (row.status==='alive'?' Жизнь продолжается; показатели относятся только к уже прожитому времени.':'');
 }
 function renderTable(){
  if(!data)return;
  const lives=byId('history-table-mode').value==='lives',metric=byId('history-table-metric').value,m=LIFE_METRICS.find(m=>m.id===metric);
  byId('history-resident-filters').hidden=!lives;byId('history-table-metric-label').hidden=lives;
  const headers=lives?['№','Поколение','Линия','Рождение, Т','Возраст, Т','Состояние','Переходов / 100 Т','Порций / 100 Т']:['Рождение, Т','Родилось','Завершено','Живы','В выборке',...HISTORY_LINES.map(l=>l.label+' · '+m.unit),'Дожили, %','Статус'];
  byId('history-head').replaceChildren(...headers.map(h=>{const th=make('th',h);th.scope='col';return th;}));
  if(dirtyTable){tableRows=lives?filteredLives():data.cohorts;dirtyTable=false;}
  const pages=Math.max(1,Math.ceil(tableRows.length/PAGE));page=Math.max(0,Math.min(page,pages-1));
  const nodes=[];
  for(let i=page*PAGE;i<Math.min(tableRows.length,(page+1)*PAGE);i++){
   const r=tableRows[i],tr=make('tr');tr.tabIndex=0;
   const values=lives?[r.id,r.generation,'№'+r.founderId,format(r.born),format(r.age),r.status==='alive'?'Жив':CAUSE_LABELS[r.cause]??r.cause,format(lifeMetric(r,'movement'),2),format(lifeMetric(r,'eating'),2)]:[`[${r.start}; ${r.end})`,r.born,r.dead,r.alive,r.metrics[metric].count,...HISTORY_LINES.map(l=>format(r.metrics[metric][l.id],m.digits)),format(r.survival.percent),r.complete?'Завершена':'Предварительно'];
   tr.append(...values.map(v=>make('td',v)));if(lives?r.id===selectedLife:r.id===selected)tr.className='selected-row';
   const choose=()=>{if(lives){showLife(r);renderTable();}else selectCohort(r.id);};tr.addEventListener('click',choose);tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});nodes.push(tr);
  }
  byId('history-rows').replaceChildren(...nodes);byId('history-page').textContent=`Страница ${page+1}/${pages} · строк ${tableRows.length}`;byId('history-prev').disabled=page===0;byId('history-next').disabled=page===pages-1;
  byId('history-selected').textContent=selected===null?`Интервалы рождения в периоде [${rangeStart}; ${rangeEnd}) Т.`:`Выбран интервал [${Math.max(rangeStart,selected*data.width)}; ${Math.min(rangeEnd,(selected+1)*data.width)}) Т.`;byId('history-clear-selection').disabled=selected===null;
 }
 function clearSelection(){selected=null;page=0;dirtyTable=true;drawCharts();renderTable();}
 function updateWindow(){
  data=windowLifeCohorts(base,members,cachedReport.tick,rangeStart,rangeEnd);
  food=windowFoodCohorts(fullFood,cachedReport.foodAvailability,cachedReport.tick,rangeStart,rangeEnd);foodById.clear();for(const f of food)foodById.set(f.id,f);
  for(const {m}of chartCards)series.set(m.id,m.id==='food'?food:data.cohorts.map(g=>m.id==='survival'?{id:g.id,start:g.start,end:g.end,complete:g.survival.sufficient,mean:g.survival.percent}:{id:g.id,start:g.start,end:g.end,complete:g.complete,...g.metrics[m.id]}));
  for(const id of ['history-period-start','history-period-end']){byId(id).max=rangeMaximum;byId(id).disabled=rangeMaximum<=1;}
  for(const [id,value]of [['history-period-start',rangeStart],['history-period-from',rangeStart],['history-period-end',rangeEnd],['history-period-to',rangeEnd]])byId(id).value=value;
  byId('history-period-from').max=rangeMaximum-1;byId('history-period-to').max=rangeMaximum;
  const track=byId('history-period-value');track.textContent=`[${rangeStart}; ${rangeEnd}) Т`;
  // Переменные используются только для подсветки общей дорожки двух ползунков.
  byId('history-period-start').parentElement?.style.setProperty('--range-from',100*rangeStart/rangeMaximum+'%');
  byId('history-period-start').parentElement?.style.setProperty('--range-to',100*rangeEnd/rangeMaximum+'%');
  byId('history-cohorts').textContent=`Групп рождения в выбранном периоде: ${data.cohorts.length}. `+(data.mode==='dead'?'Линии рассчитаны по завершённым жизням.':'Частоты и средние включают прожитую часть живых; продолжительность жизни — только умершие.')+' Пунктир и пустые точки — незавершённые группы.';
  dirtyTable=true;
 }
 function setPeriod(start,end){
  if(!base)return;
  try{if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>rangeMaximum||end<=start)throw new Error('Период: целые Т, начало меньше конца и границы внутри времени графика.');
   rangeStart=start;rangeEnd=end;selected=null;selectedLife=null;page=0;updateWindow();byId('history-detail').textContent='Выбери строку жизни.';byId('history-error').textContent='';drawCharts();renderTable();
  }catch(error){byId('history-error').textContent=error.message;}
 }
 const curveCanvas=make('canvas');curveCanvas.id='history-chart-age-survival';curveCanvas.tabIndex=0;curveCanvas.setAttribute('role','img');curveCanvas.setAttribute('aria-label','Кривая дожития: возраст и доля. Стрелки выбирают возраст.');
 const curveNote=make('p');curveNote.className='history-chart-note';curveNote.id='history-note-age-survival';curveCanvas.setAttribute('aria-describedby',curveNote.id);byId('history-curve-chart').append(curveCanvas,curveNote);
 function curveDescription(point=null){
  const p=point??curve?.points[curveIndex];if(!p){curveNote.textContent=curve?.omittedDetails?'Кривая недоступна: часть историй отсутствует.':'В выбранном интервале пока нет сохранённых рождений.';return;}
  curveNote.textContent=`Возраст ${format(p.x)} Т: подтверждено ${p.reached}/${curve.count} (${format(p.lower)}%). `+(p.unknown?`Исход ${p.unknown} живых ещё неизвестен; возможная доля ${format(p.lower)}–${format(p.upper)}%.`:'Исход известен для всех уже родившихся.')+(!curve.birthClosed?' Интервал рождения открыт; состав группы ещё меняется.':'');
 }
 function updateCurve(){
  const start=Number(byId('history-curve-start').value),width=base.width,origin=base.origin,key=`${start}/${width}/${origin}`;
  if(!Number.isSafeInteger(start)||start<0||start>Math.floor(cachedReport.tick))throw new Error('Начало группы дожития — целое Т от нуля до текущего времени мира.');
  if(curveReport!==cachedReport||curveKey!==key){curve=survivalCurve(cachedReport,{start,width,origin});curveReport=cachedReport;curveKey=key;curveIndex=0;}
  byId('history-curve-slider').max=Math.max(1,Math.floor(cachedReport.tick));byId('history-curve-slider').disabled=cachedReport.tick<1;byId('history-curve-slider').value=start;byId('history-curve-start').max=Math.floor(cachedReport.tick);
  byId('history-curve-period').textContent=`Рождения [${start}; ${start+width}) Т · ширина ${width} Т`;
  byId('history-curve-summary').textContent=`Группа: ${curve.count} особей · завершено ${curve.dead} · живых ${curve.alive}. `+(curve.birthClosed?'Интервал рождения закрыт.':'Интервал рождения ещё открыт.');curveDescription();
 }
 curveCanvas.addEventListener('pointermove',e=>{if(!curve?.points.length)return;const age=Math.round(chartTimeAt(curveCanvas,e.clientX,0,curve.domainEnd)*SUBSTEPS)/SUBSTEPS;curveDescription(survivalAtAge(curve,age));});
 curveCanvas.addEventListener('keydown',e=>{if(!curve?.points.length)return;if(e.key==='ArrowRight')curveIndex++;else if(e.key==='ArrowLeft')curveIndex--;else if(e.key==='Home')curveIndex=0;else if(e.key==='End')curveIndex=curve.points.length-1;else return;e.preventDefault();curveIndex=Math.max(0,Math.min(curve.points.length-1,curveIndex));curveDescription();drawCharts();});
 function refresh(force=false){
  const sim=getSimulation(),report=sim?.lives;if(!report)return;
  try{
   const o=options(),key=JSON.stringify(o);
   if(report!==cachedReport||key!==cachedKey||lastTick!==sim.tick){
    const next=aggregateLifeCohorts(report,o),nextFood=foodCohorts(report.foodAvailability,report.tick,next.width),nextMaximum=historyDomainEnd(report.tick,next.width),follow=rangeEnd===null||rangeEnd===rangeMaximum;
    base=next;fullFood=nextFood;allRows=[];members.clear();
    for(const rows of [report.dead,report.living])for(const r of rows)if(o.origin==='all'||o.origin==='founders'&&r.parentId===null||o.origin==='descendants'&&r.parentId!==null){allRows.push(r);const id=Math.floor(r.born/base.width);let group=members.get(id);if(!group){group=[];members.set(id,group);}group.push(r);}
    rangeMaximum=nextMaximum;rangeEnd=follow?rangeMaximum:Math.min(rangeEnd,rangeMaximum);rangeStart=Math.min(rangeStart,rangeEnd-1);
    cachedReport=report;cachedKey=key;lastTick=sim.tick;dirtyTable=true;updateWindow();
   }else if(!force)return;
   updateCurve();const completed=report.completed;
   byId('history-summary').textContent=`Весь мир · шаг ${format(report.tick)} · завершено ${completed.count} жизней · живых ${report.living.length} · средний возраст смерти ${format(completed.meanAge)} Т · медиана ${format(completed.medianAge)} Т.`;
   byId('history-causes').textContent=Object.entries(report.byCause).map(([key,g])=>`${CAUSE_LABELS[key]??key}: ${g.count}`).join(' · ');
   byId('history-warning').textContent=[data.omittedDetails?`Отсутствуют подробности ${data.omittedDetails} жизней: распределения относятся только к сохранённым строкам; точная доля доживших отключена.`:'',data.excludedInvalid?`Пропущены некорректные строки: ${data.excludedInvalid}.`:'',!food.length?'История пищи отсутствует или время мира ещё не продвинулось.':''].filter(Boolean).join(' ');
   byId('history-error').textContent='';drawCharts();renderTable();
  }catch(error){byId('history-error').textContent=error.message;}
 }
 for(const id of ['history-width','history-survival-age','history-origin','history-stat-mode','history-interruption-kind'])byId(id).addEventListener('change',()=>{selected=null;page=0;refresh(true);});
 for(const id of ['history-period-from','history-period-to'])byId(id).addEventListener('change',()=>setPeriod(Number(byId('history-period-from').value),Number(byId('history-period-to').value)));
 byId('history-period-start').addEventListener('input',()=>setPeriod(Math.min(Number(byId('history-period-start').value),rangeEnd-1),rangeEnd));
 byId('history-period-end').addEventListener('input',()=>setPeriod(rangeStart,Math.max(Number(byId('history-period-end').value),rangeStart+1)));
 byId('history-period-all').addEventListener('click',()=>setPeriod(0,rangeMaximum));
 const changeCurve=()=>{try{if(!base)return;updateCurve();byId('history-error').textContent='';drawCharts();}catch(error){byId('history-error').textContent=error.message;}};
 byId('history-curve-start').addEventListener('change',changeCurve);byId('history-curve-slider').addEventListener('input',()=>{byId('history-curve-start').value=byId('history-curve-slider').value;changeCurve();});
 for(const line of HISTORY_LINES)byId('history-show-'+line.id).addEventListener('change',e=>{e.target.checked?legend.add(line.id):legend.delete(line.id);drawCharts();});
 for(const id of ['history-table-mode','history-table-metric','history-filter','history-sort','history-search'])byId(id).addEventListener('input',()=>{dirtyTable=true;page=0;renderTable();});
 byId('history-prev').addEventListener('click',()=>{page--;renderTable();});byId('history-next').addEventListener('click',()=>{page++;renderTable();});byId('history-clear-selection').addEventListener('click',clearSelection);
 const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!byId('panel-history').hidden)drawCharts();});resize?.observe(byId('history-charts'));
 return {refresh,reset(){cachedReport=null;cachedKey='';data=null;base=null;curve=null;curveReport=null;curveKey='';allRows=[];tableRows=[];selected=null;selectedLife=null;page=0;rangeStart=0;rangeEnd=null;lastTick=-1;dirtyTable=true;byId('history-curve-start').value=0;byId('history-detail').textContent='Выбери строку жизни.';},getSummary:()=>data,getCurve:()=>curve};
}
