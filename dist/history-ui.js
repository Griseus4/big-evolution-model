import {createComparisonCharts} from './comparison-charts.js';
/** Истории считаются только при открытии вкладки/смене фильтра. Пагинация,
 * выбор точки и перерисовка Canvas повторно не сортируют жизни по группам. */
import {aggregateLifeCohorts,LIFE_METRICS,lifeMetric,HISTORY_PAGE_SIZE as PAGE} from './life-cohorts.js';
import {sensitivityDistributions,HERITABLE_METRICS,SENSITIVITY_BIN_WIDTH} from './heritable-statistics.js';
import {productionCohorts} from './food-production-history.js';
import {foodCohorts} from './food-exposure.js';
import {HISTORY_LINES,drawHistoryChart,chartCohortAt,chartTimeAt} from './history-charts.js';
import {historyDomainEnd,windowLifeCohorts,windowFoodCohorts} from './history-window.js';
import {survivalCurve,survivalAtAge,survivalAgeWindow} from './survival-curve.js';
import {SUBSTEPS} from './action-timing.js';
import {CAUSE_LABELS} from './life-history.js';
import {installHistoryDrawers} from './history-drawers.js';
import {installHistoryEstimates} from './history-estimates-ui.js';
import {analysisWorlds} from './statistical-series.js';
import {populationCohorts} from './population-statistics.js';
import {installPairComparison} from './pair-comparison-ui.js';
import {installHistoryDifferences} from './history-differences-ui.js';
import {installAnalysisBuilder} from './analysis-builder-ui.js';
const format=(v,digits=1)=>v===null||v===undefined?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:Math.min(1,digits)});
const SENSITIVITY_TICKS=Object.freeze([-100,-80,-60,-40,-20,0,20,40,60,80,100]);
export function installHistoryUI({root=document,getSimulation,getComparisons=()=>null,prepareSimulation=()=>null,getExperiment=()=>null}){
 const drawComparison=createComparisonCharts();
 const byId=id=>root.getElementById(id),make=(tag,text)=>{const e=root.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let cachedReport=null,cachedKey='',data=null,food=[],allRows=[],tableRows=[],page=0,selected=null,selectedLife=null,dirtyTable=true;
 let awaiting=null;
 let base=null,fullFood=[],rangeStart=0,rangeEnd=null,rangeMaximum=100,curve=null,curveReport=null,curveKey='',curveIndex=0,curveMarkers=[];
 let curveView=null,curveViewSource=null,curveMaximum=Number(byId('history-curve-age-max').value),curveAgeLimit=curveMaximum;
 let production=[],population=[],distributions=[];const histogramCards=[];
 const chartCards=[],legend=new Set(HISTORY_LINES.map(l=>l.id)),series=new Map(),members=new Map();
 const metricSelect=byId('history-table-metric');
 for(const m of LIFE_METRICS.filter(m=>!m.single)){const option=make('option',m.label);option.value=m.id;metricSelect.append(option);}
 function options(){return {width:Number(byId('history-width').value),survivalAge:Number(byId('history-survival-age').value),origin:byId('history-origin').value,mode:byId('history-stat-mode').value,interruptionKind:byId('history-interruption-kind').value};}
 const metricValue=(g,id)=>g?.metrics[id];
 function description(g,id){
  if(!g)return 'В этом интервале нет сохранённых рождений.';
  const start=`Рождение [${g.start}; ${g.end}) Т. Родилось ${g.born}; завершено ${g.dead}; живы ${g.alive}. `;
  if(id==='survival')return start+(g.survival.percent===null?'Точная доля ещё недоступна: интервал открыт, часть исходов неизвестна или история неполна.':`Дожили до ${data.survivalAge} Т: ${g.reachedAge}/${g.born} (${format(g.survival.percent)}%).`);
  const m=LIFE_METRICS.find(m=>m.id===id),s=metricValue(g,id);
  if(m.single)return start+`Доля среди ${s.count} наблюдаемых жизней: ${format(s.mean)}%. `+(data.mode==='observed'?'Живые показывают только уже состоявшиеся рождения; их итог ещё неизвестен.':'По завершённым жизням; при живых в группе итог предварительный.');
  return start+`Показатель доступен для ${s.count} особей. `+(s.count?HISTORY_LINES.map(l=>`${l.label}: ${format(s[l.id],m.digits)}`).join(' · ')+` ${m.unit}. `:'')+(m.inherited?'Наследуемое значение определено при рождении; живые включены.':g.complete?'Группа завершена.':'Группа незавершённая; значения предварительные.')+(id==='firstBirth'?' Только особи, родившие ребёнка; смотри также долю размножившихся.':'');
 }
 function selectCohort(id){selected=id;selectedLife=null;page=0;byId('history-table-mode').value='lives';dirtyTable=true;drawCharts();renderTable();}
 function pointDescription(m,id){const time=['population','food','production'].includes(m.id),prefix=`${time?'Время мира':'Рождения'} [${Math.max(rangeStart,id*data.width)}; ${Math.min(rangeEnd,(id+1)*data.width)}) Т. `;if(differences.isDifference(chartCards.find(c=>c.m.id===m.id)))return prefix+differences.pointDescription(m.id,id);return prefix+(!time&&!getComparisons()?.sources?.length?description(data.byId.get(id),m.id)+' ':'')+estimates.pointDescription(m.id,id);}
 // Все три подписанные чувствительности остаются в данных/таблице и
 // распределениях; отдельные линейные графики пользователь исключил.
 for(const m of [...LIFE_METRICS.filter(m=>!m.signed),{id:'population',label:'Средняя численность населения',unit:'живых особей'},{id:'survival',label:'Доля доживших до выбранного возраста',unit:'%'},{id:'food',label:'Среднее количество еды на карте',unit:'порций на земле'},{id:'production',label:'Потенциальная выработка пищи',unit:'порций / Т'}]){
  const card=make('section');card.className='history-chart-card';card.append(make('h3',m.label),make('p',m.unit));
  const canvas=make('canvas');canvas.id='history-chart-'+m.id;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',m.label+'. Стрелки выбирают интервал, Escape снимает выбор.');
  const note=make('p','Наведи на линию для значений. Нажми, чтобы выбрать интервал.');note.className='history-chart-note';canvas.setAttribute('aria-describedby',note.id='history-note-'+m.id);card.append(canvas,note);byId('history-charts').append(card);chartCards.push({m,canvas,note,card});
  const idAt=e=>chartCohortAt(canvas,e.clientX,data.domainEnd,data.width,data.domainStart);
  canvas.addEventListener('pointermove',e=>{if(!data)return;const id=idAt(e);note.textContent=pointDescription(m,id);});
  canvas.addEventListener('click',e=>{if(data)selectCohort(idAt(e));});
  canvas.addEventListener('keydown',e=>{if(!data)return;const first=Math.floor(data.domainStart/data.width),last=Math.ceil(data.domainEnd/data.width)-1;let id=selected??first;if(e.key==='Escape'){clearSelection();return;}if(e.key==='ArrowRight')id++;else if(e.key==='ArrowLeft')id--;else if(e.key==='Home')id=first;else if(e.key==='End')id=last;else return;e.preventDefault();selectCohort(Math.max(first,Math.min(last,id)));note.textContent=pointDescription(m,selected);});
 }
 // Три распределения используют общий период рождения и все сохранённые
 // рождения, включая живых. Клавиатура не выбирает временной интервал по X.
 for(const m of HERITABLE_METRICS.filter(m=>m.signed)){
  const card=make('section');card.className='history-chart-card';card.append(make('h3','Распределение: '+m.label.toLowerCase()),make('p','X — подписанная доля шкалы чувств; Y — доля особей, %'));
  const canvas=make('canvas');canvas.id='history-histogram-'+m.id;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Распределение: '+m.label);const note=make('p');note.className='history-chart-note';note.id='history-histogram-note-'+m.id;canvas.setAttribute('aria-describedby',note.id);card.append(canvas,note);byId('history-charts').append(card);histogramCards.push({m,canvas,note,card});
 }
 const estimates=installHistoryEstimates({root,cards:[...chartCards,...histogramCards],onChange:()=>drawCharts()});
 const pairs=installPairComparison({root,onChange:()=>drawCharts()});
 const differences=installHistoryDifferences({root,cards:chartCards,onChange:()=>drawCharts()});
 for(const [metric,control]of [['survival','history-survival-controls'],['interruptions','history-interruption-controls']])chartCards.find(c=>c.m.id===metric).card.append(byId(control));
 const builder=installAnalysisBuilder({root,getExperiment});
 const display=byId('history-display'),picked=new Set(),pickers=new Map();
 if(byId('history-builder-screen')){const option=make('option','Конструктор анализа');option.value='builder';display.append(option);}
 byId('history-open-builder')?.addEventListener('click',()=>{display.value='builder';applyDisplay();});
 const groups=[
  {id:'survival',label:'Выживание',charts:['population','lifetime','survival','curve']},
  {id:'behavior',label:'Поведение',charts:['movement','eating','reviews','interruptions','brainCalls']},
  {id:'resources',label:'Ресурсы',charts:['inventory','energy','health','feeling','hunger','food','production']},
  {id:'reproduction',label:'Размножение',charts:['children','reproduced','firstBirth']},
  {id:'genome',label:'Наследуемые свойства',charts:chartCards.filter(c=>c.m.inherited).map(c=>c.m.id)},
  {id:'distributions',label:'Распределения',charts:histogramCards.map(c=>'distribution-'+c.m.id)},
 ];
 const chartLabels=new Map([...chartCards.map(c=>[c.m.id,c.m.label]),...histogramCards.map(c=>['distribution-'+c.m.id,'Распределение: '+c.m.label]),['curve','Кривая дожития']]);
 for(const group of groups){
  const column=make('fieldset');column.className='history-picker-group';column.append(make('legend',group.label));byId('history-chart-options').append(column);
  for(const id of group.charts){
   const label=make('label'),input=make('input');input.type='checkbox';input.checked=true;input.setAttribute('aria-label',chartLabels.get(id));label.append(input,make('span',chartLabels.get(id)));column.append(label);picked.add(id);pickers.set(id,input);
   input.addEventListener('change',()=>{input.checked?picked.add(id):picked.delete(id);display.value='custom';applyDisplay();});
  }
 }
 function applyDisplay(){
  const mode=display.value||'all';if(mode!=='custom'){picked.clear();for(const id of mode==='all'?pickers.keys():groups.find(g=>g.id===mode)?.charts??[])picked.add(id);}
  byId('history-pair-screen').hidden=mode!=='pair';
  if(byId('history-builder-screen')){byId('history-builder-screen').hidden=mode!=='builder';if(mode==='builder')builder.refresh();}
  for(const id of ['history-summary','history-causes','history-cohorts','history-selection-controls'])byId(id).hidden=['pair','builder'].includes(mode);
  for(const [id,input]of pickers)input.checked=picked.has(id);
  for(const {m,card}of chartCards)card.hidden=!picked.has(m.id);
  for(const {m,card}of histogramCards)card.hidden=!picked.has('distribution-'+m.id);
  byId('history-survival-section').hidden=!picked.has('curve');byId('history-table-screen').hidden=!['all','table'].includes(mode);
  drawCharts();renderTable();
 }
 display.addEventListener('change',applyDisplay);applyDisplay();
 function drawCharts(){
  if(display.value==='builder'){pairs.suspend();differences.update({pair:null,options:options(),start:rangeStart,end:rangeEnd});estimates.update({sources:[],options:options(),start:rangeStart,end:rangeEnd});builder.refresh();return;}
  if(!data)return;
  const comparison=getComparisons(),bandMode=byId('history-band-mode').value||'confidence';
  const pair=pairs.selection(comparison);
  if(display.value==='pair'){differences.update({pair:null,options:options(),start:rangeStart,end:rangeEnd});estimates.update({sources:[],options:options(),start:rangeStart,end:rangeEnd});pairs.update({comparison,options:options(),start:rangeStart,end:rangeEnd});return;}
  pairs.suspend();
  differences.update({pair,options:options(),start:rangeStart,end:rangeEnd,weightMode:comparison?.weightMode,statistic:comparison?.statistic??'mean',bandMode});
  estimates.update({sources:comparison?.sources?.length?comparison.sources:[{id:'selected',name:'Выбранные данные',color:'#86bf80',report:cachedReport}],options:options(),start:rangeStart,end:rangeEnd});
  if(comparison?.sources?.length){drawComparison({sources:comparison.sources,statistic:comparison.statistic,options:options(),start:rangeStart,end:rangeEnd,chartCards:chartCards.filter(c=>!differences.isDifference(c)),histogramCards,curveCanvas,curveMaximum,curveStart:Number(byId('history-curve-start').value),curveVisible:!byId('history-survival-section').hidden,getEstimate:estimates.get,bandMode});return;}
  for(const {m,canvas,card}of chartCards){
   if(card.hidden||differences.isDifference(chartCards.find(c=>c.m.id===m.id)))continue;
   const single=m.single||['survival','food','production'].includes(m.id);
   const result=estimates.get('selected',m.id),points=(result?.points??series.get(m.id)).map(p=>({...p})),keys=single?['mean']:[...legend],bands=[];
   if(bandMode!=='none')for(const key of keys)if(['mean','median'].includes(key)){
    for(const p of points){const estimate=result?.byId?.get(p.id),range=bandMode==='spread'&&estimate?.worlds<2?null:estimate?.[bandMode==='spread'?'spread':'confidence']?.[key];p[key+'Low']=range?.low??null;p[key+'High']=range?.high??null;}
    bands.push({low:key+'Low',high:key+'High',color:HISTORY_LINES.find(l=>l.id===key).color});
   }
   const maximum=m.maximum??(m.signed||['hunger','survival','reproduced'].includes(m.id)?100:null);
   drawHistoryChart(canvas,{points,keys,bands,domainStart:data.domainStart,domainEnd:data.domainEnd,width:data.width,selected,single:['population','food','production'].includes(m.id)?'food':single,maximum,minimum:m.minimum??(m.signed?-100:0)});
  }
  for(const {m,canvas,card,note}of histogramCards){
   if(card.hidden)continue;const d=distributions.find(s=>s.id===m.id);if(!d)continue;
   drawHistoryChart(canvas,{points:d.points,keys:['mean'],domainStart:-100,domainEnd:100,width:SENSITIVITY_BIN_WIDTH,single:true,histogram:true,xLabel:'Доля шкалы чувств, %',xTicks:SENSITIVITY_TICKS});
   note.textContent=`Рождения [${rangeStart}; ${rangeEnd}) Т: данные ${d.count} особей, включая живых. Положительных ${d.positive}, отрицательных ${d.negative}, нулевых ${d.zero}. `+(data.omittedDetails?'История неполная; показаны только сохранённые записи.':'')+` Интервалы шириной ${SENSITIVITY_BIN_WIDTH} процентных пунктов; +100% входит в последний. Это чувствительность, не самочувствие.`;
  }
  if(curveView&&!byId('history-survival-section').hidden)drawHistoryChart(curveCanvas,{points:curveView.points,keys:['mean'],domainEnd:curveView.domainEnd,selected:curveView.points.length?curveIndex:null,single:true,maximum:100,age:true,markers:curveMarkers});
 }
 function filteredLives(){
  const filter=byId('history-filter').value,search=byId('history-search').value.trim(),sort=byId('history-sort').value;
  const rows=(selected===null?allRows:members.get(selected)??[]).filter(r=>r.born>=rangeStart&&r.born<rangeEnd&&(!search||String(r.id)===search||String(r.founderId)===search)&&(filter==='all'||filter==='alive'&&r.status==='alive'||filter==='dead'&&r.status==='dead'||r.cause===filter));
  return rows.sort((a,b)=>sort==='age'?b.age-a.age:sort==='children'?b.children-a.children:(b.originalId??b.id)-(a.originalId??a.id));
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
  food=windowFoodCohorts(fullFood,cachedReport.foodAvailability,cachedReport.environmentTick??cachedReport.tick,rangeStart,rangeEnd);
  production=productionCohorts(cachedReport.foodProductionHistory,cachedReport.environmentTick??cachedReport.tick,data.width,rangeStart,rangeEnd);
  distributions=sensitivityDistributions(allRows,{start:rangeStart,end:rangeEnd,origin:data.origin,weightMode:cachedReport.weightMode});
  const worlds=analysisWorlds(cachedReport);population=worlds.length===1?populationCohorts(worlds[0],{start:rangeStart,end:rangeEnd,width:data.width}).points.map(p=>({...p,min:p.mean,median:p.mean,max:p.mean})):[];
  for(const {m}of chartCards)series.set(m.id,m.id==='population'?population:m.id==='food'?food:m.id==='production'?production:data.cohorts.map(g=>m.id==='survival'?{id:g.id,start:g.start,end:g.end,complete:g.survival.sufficient,mean:g.survival.percent}:{id:g.id,start:g.start,end:g.end,complete:m.inherited?g.birthClosed&&!data.omittedDetails&&g.metrics[m.id].count===g.born:g.complete,...g.metrics[m.id]}));
  for(const id of ['history-period-start','history-period-end']){byId(id).max=rangeMaximum;byId(id).disabled=rangeMaximum<=1;}
  for(const [id,value]of [['history-period-start',rangeStart],['history-period-from',rangeStart],['history-period-end',rangeEnd],['history-period-to',rangeEnd]])byId(id).value=value;
  byId('history-period-from').max=rangeMaximum-1;byId('history-period-to').max=rangeMaximum;
  const track=byId('history-period-value');track.textContent=`[${rangeStart}; ${rangeEnd}) Т`;
  // Переменные используются только для подсветки общей дорожки двух ползунков.
  byId('history-period-start').parentElement?.style.setProperty('--range-from',100*rangeStart/rangeMaximum+'%');
  byId('history-period-start').parentElement?.style.setProperty('--range-to',100*rangeEnd/rangeMaximum+'%');
  byId('history-cohorts').textContent=`Групп рождения в выбранном периоде: ${data.cohorts.length}. `+(data.mode==='dead'?'Линии рассчитаны по завершённым жизням.':'Частоты и средние включают прожитую часть живых; продолжительность жизни — только умершие.')+' Пунктир — незавершённые группы. Наследуемые свойства и их распределения включают все рождения, в том числе живых. Возраст первого ребёнка рассчитан только для размножившихся с известным возрастом.';
  dirtyTable=true;
 }
 function setPeriod(start,end){
  if(!base)return;
  try{if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>rangeMaximum||end<=start)throw new Error('Период: целые Т, начало меньше конца и границы внутри времени графика.');
   rangeStart=start;rangeEnd=end;selected=null;selectedLife=null;page=0;byId('history-detail').textContent='Выбери строку жизни.';byId('history-error').textContent='';refresh(true);
  }catch(error){byId('history-error').textContent=error.message;}
 }
 const curveCanvas=make('canvas');curveCanvas.id='history-chart-age-survival';curveCanvas.tabIndex=0;curveCanvas.setAttribute('role','img');curveCanvas.setAttribute('aria-label','Кривая дожития: возраст и доля. Стрелки выбирают возраст.');
 const curveNote=make('p');curveNote.className='history-chart-note';curveNote.id='history-note-age-survival';curveCanvas.setAttribute('aria-describedby',curveNote.id);byId('history-curve-chart').append(curveCanvas,curveNote);
 function curveDescription(point=null){
  const p=point??curveView?.points[curveIndex];if(!p){curveNote.textContent=curve?.omittedDetails?'Кривая недоступна: часть историй отсутствует.':'В выбранном интервале пока нет сохранённых рождений.';return;}
  curveNote.textContent=`Возраст ${format(p.x)} Т: подтверждено ${p.reached}/${curve.count} (${format(p.lower)}%). `+(p.unknown?`Исход ${p.unknown} живых ещё неизвестен; возможная доля ${format(p.lower)}–${format(p.upper)}%.`:'Исход известен для всех уже родившихся.')+(!curve.birthClosed?' Интервал рождения открыт; состав группы ещё меняется.':'');
 }
 function updateAgeWindow(){
  if(!curve)return;
  if(curveViewSource!==curve||curveView?.domainEnd!==curveMaximum){curveView=survivalAgeWindow(curve,curveMaximum);curveViewSource=curve;curveIndex=0;}
  curveAgeLimit=Math.max(curveAgeLimit,Math.ceil(curve.domainEnd),curveMaximum);
  byId('history-curve-age-max').value=curveMaximum;byId('history-curve-age-slider').max=curveAgeLimit;byId('history-curve-age-slider').value=curveMaximum;
 }
 function updateCurve(){
  const start=Number(byId('history-curve-start').value),width=base.width,origin=base.origin,key=`${start}/${width}/${origin}`;
  if(!Number.isSafeInteger(start)||start<0||start>Math.floor(cachedReport.tick))throw new Error('Начало группы дожития — целое Т от нуля до текущего времени мира.');
  if(curveReport!==cachedReport||curveKey!==key){
   curve=survivalCurve(cachedReport,{start,width,origin});curveReport=cachedReport;curveKey=key;curveIndex=0;
   curveMarkers=HISTORY_LINES.filter(l=>['mean','median'].includes(l.id)&&curve.completed[l.id]!==null).map(l=>({value:curve.completed[l.id],label:l.label,color:l.color}));
  }
  updateAgeWindow();
  byId('history-curve-slider').max=Math.max(1,Math.floor(cachedReport.tick));byId('history-curve-slider').disabled=cachedReport.tick<1;byId('history-curve-slider').value=start;byId('history-curve-start').max=Math.floor(cachedReport.tick);
  byId('history-curve-period').textContent=`Рождения [${start}; ${start+width}) Т · ширина ${width} Т`;
  byId('history-curve-summary').textContent=`Группа: ${curve.count} особей · завершено ${curve.dead} · живых ${curve.alive}. `+(curve.birthClosed?'Интервал рождения закрыт.':'Интервал рождения ещё открыт.');
  const stats=curve.completed;
  byId('history-curve-statistics').textContent=curve.omittedDetails?'Статистика отключена: история неполная.':!stats.count?'Среднее и медиана появятся после первой завершённой жизни этой группы.':`Возраст смерти по ${stats.count} завершённым жизням: средний ${format(stats.mean)} Т · медиана ${format(stats.median)} Т. `+(curve.alive?'Живые не включены; значения могут занижать итоговую продолжительность жизни всей группы.':'')+(!curve.birthClosed?' Новые рождения ещё могут изменить состав группы.':'');curveDescription();
 }
 curveCanvas.addEventListener('pointermove',e=>{if(!curveView?.points.length)return;const age=Math.round(chartTimeAt(curveCanvas,e.clientX,0,curveMaximum)*SUBSTEPS)/SUBSTEPS;curveDescription(survivalAtAge(curve,age));});
 curveCanvas.addEventListener('keydown',e=>{if(!curveView?.points.length)return;if(e.key==='ArrowRight')curveIndex++;else if(e.key==='ArrowLeft')curveIndex--;else if(e.key==='Home')curveIndex=0;else if(e.key==='End')curveIndex=curveView.points.length-1;else return;e.preventDefault();curveIndex=Math.max(0,Math.min(curveView.points.length-1,curveIndex));curveDescription();drawCharts();});
 function refresh(force=false){
  if(display.value==='builder'){builder.refresh();return;}
  let pending;try{pending=prepareSimulation({start:rangeStart,end:rangeEnd,width:options().width,curveStart:Number(byId('history-curve-start').value)});}catch(error){byId('history-error').textContent=error.message;return;}
  if(pending){
   if(awaiting!==pending){awaiting=pending;byId('history-load-state').textContent='Загрузка выбранных миров и периодов… До завершения показаны предыдущие данные.';
    pending.then(()=>{if(awaiting!==pending)return;awaiting=null;refresh(true);},error=>{if(awaiting!==pending)return;awaiting=null;byId('history-load-state').textContent='Не удалось загрузить данные.';byId('history-error').textContent=error.message;});
   }return;
  }
  awaiting=null;byId('history-load-state').textContent='';
  const sim=getSimulation(),report=sim?.lives;if(!report)return;
  try{
   const o=options(),key=JSON.stringify(o);
   if(report!==cachedReport||key!==cachedKey){
    const next=aggregateLifeCohorts(report,o),nextFood=foodCohorts(report.foodAvailability,report.environmentTick??report.tick,next.width),nextMaximum=historyDomainEnd(report.tick,next.width),follow=rangeEnd===null||rangeEnd===rangeMaximum;
    base=next;fullFood=nextFood;allRows=[];members.clear();
    for(const rows of [report.dead,report.living])for(const r of rows)if(o.origin==='all'||o.origin==='founders'&&r.parentId===null||o.origin==='descendants'&&r.parentId!==null){allRows.push(r);const id=Math.floor(r.born/base.width);let group=members.get(id);if(!group){group=[];members.set(id,group);}group.push(r);}
    rangeMaximum=nextMaximum;rangeEnd=follow?rangeMaximum:Math.min(rangeEnd,rangeMaximum);rangeStart=Math.min(rangeStart,rangeEnd-1);
    cachedReport=report;cachedKey=key;dirtyTable=true;updateWindow();
   }else if(!force)return;else updateWindow();
   updateCurve();const completed=report.completed;
   byId('history-summary').textContent=`${getComparisons()?.sources?.length?'Первый вариант':'Выбранные данные'} · шаг ${format(report.tick)} · завершено ${completed.count} жизней · живых ${report.totalLiving??report.living.length} · средний возраст смерти ${format(completed.meanAge)} Т · медиана ${format(completed.medianAge)} Т.`;
   byId('history-causes').textContent=Object.entries(report.byCause).map(([key,g])=>`${CAUSE_LABELS[key]??key}: ${g.count}`).join(' · ');
   byId('history-warning').textContent=[data.omittedDetails?`Отсутствуют подробности ${data.omittedDetails} жизней: распределения относятся только к сохранённым строкам; точная доля доживших отключена.`:'',data.excludedInvalid?`Пропущены некорректные строки: ${data.excludedInvalid}.`:'',!food.length?'История пищи отсутствует или время мира ещё не продвинулось.':''].filter(Boolean).join(' ');
   byId('history-error').textContent='';drawCharts();renderTable();
  }catch(error){byId('history-error').textContent=error.message;}
 }
 for(const id of ['history-width','history-survival-age','history-origin','history-stat-mode','history-interruption-kind'])byId(id).addEventListener('change',()=>{selected=null;page=0;refresh(true);});
 for(const [local,shared]of [['pair-survival-age','history-survival-age'],['pair-interruption-kind','history-interruption-kind']]){
  byId(local).value=byId(shared).value;
  byId(local).addEventListener('change',()=>{byId(shared).value=byId(local).value;refresh(true);});
  byId(shared).addEventListener('change',()=>{byId(local).value=byId(shared).value;});
 }
 for(const id of ['history-period-from','history-period-to'])byId(id).addEventListener('change',()=>setPeriod(Number(byId('history-period-from').value),Number(byId('history-period-to').value)));
 byId('history-period-start').addEventListener('input',()=>setPeriod(Math.min(Number(byId('history-period-start').value),rangeEnd-1),rangeEnd));
 byId('history-period-end').addEventListener('input',()=>setPeriod(rangeStart,Math.max(Number(byId('history-period-end').value),rangeStart+1)));
 byId('history-period-all').addEventListener('click',()=>setPeriod(0,rangeMaximum));
 const changeCurve=()=>{try{if(!base)return;byId('history-error').textContent='';refresh(true);}catch(error){byId('history-error').textContent=error.message;}};
 byId('history-curve-start').addEventListener('change',changeCurve);byId('history-curve-slider').addEventListener('input',()=>{byId('history-curve-start').value=byId('history-curve-slider').value;changeCurve();});
 function changeAgeMaximum(value){try{if(!Number.isSafeInteger(value)||value<1)throw new Error('Максимальный возраст на оси — положительное целое Т.');curveMaximum=value;updateAgeWindow();curveDescription();byId('history-error').textContent='';drawCharts();}catch(error){byId('history-error').textContent=error.message;}}
 byId('history-curve-age-max').addEventListener('change',()=>changeAgeMaximum(Number(byId('history-curve-age-max').value)));
 byId('history-curve-age-slider').addEventListener('input',()=>changeAgeMaximum(Number(byId('history-curve-age-slider').value)));
 for(const line of HISTORY_LINES)byId('history-show-'+line.id).addEventListener('change',e=>{e.target.checked?legend.add(line.id):legend.delete(line.id);drawCharts();});
 byId('history-band-mode').addEventListener('change',drawCharts);
 for(const id of ['history-table-mode','history-table-metric','history-filter','history-sort','history-search'])byId(id).addEventListener('input',()=>{dirtyTable=true;page=0;renderTable();});
 byId('history-prev').addEventListener('click',()=>{page--;renderTable();});byId('history-next').addEventListener('click',()=>{page++;renderTable();});byId('history-clear-selection').addEventListener('click',clearSelection);
 const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!byId('panel-history').hidden)drawCharts();});resize?.observe(byId('history-charts'));
 installHistoryDrawers(root,drawCharts);
 return {refresh,reset(){awaiting=null;cachedReport=null;cachedKey='';data=null;base=null;curve=null;curveView=null;curveViewSource=null;curveReport=null;curveKey='';allRows=[];tableRows=[];selected=null;selectedLife=null;page=0;rangeStart=0;rangeEnd=null;dirtyTable=true;byId('history-curve-start').value=0;byId('history-detail').textContent='Выбери строку жизни.';},getSummary:()=>data,getCurve:()=>curve};
}
