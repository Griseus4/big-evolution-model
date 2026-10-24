import {TEMPORAL_BRAIN_TYPE as SET_BRAIN_TYPE,CANDIDATE_NAMES,OPERATION_NAMES} from './temporal-layout.js';
/**
 * Интерфейс лаборатории читает снимки расчётного Worker. Он не двигает мир
 * и не выбирает действия. Карта, график и клики не расходуют RNG мира.
 *
 * Код разделён на управление, представление жителя, карту и график.
 * Модуль не содержит наследования, условий рождения или физики питания.
 */
import {ACTIONS,RULES,WORLD_WIDTH,WORLD_HEIGHT,CANVAS_WIDTH,CANVAS_HEIGHT,
 hexCenter,worldHexAt,HEX_RADIUS,HEX_WIDTH,validateGenomeFile,BASE_GENE_COUNT,COGNITIVE_GENES,memoryWorldPosition,worldDistance} from './evolution.js';
import {BIRTH_BLOCK_LABELS,reproductionSummary} from './reproduction.js';
import {WorldClient} from './world-client.js';
import {installWorldFiles} from './world-files-ui.js';
import {installEnvironmentUI} from './environment-ui.js';
import {formatNumber as format} from './ui-numbers.js';
import {WorldProfiler} from './world-profiler.js';
import {installPerformancePanel} from './performance-ui.js';
import {updateTextRows} from './stable-text-list.js';
import {installSidebar} from './sidebar.js';
import {randomExperienceSeed} from './random-seed.js';
import {installLabTabs} from './lab-tabs.js';
import {memoryBelief,memoryEntries,memoryStrength,FEATURE_NAMES} from './cognition.js';
import {BODY_FEATURE_NAMES,bodySenses} from './brain-parameters.js';
import {NEURAL_BRAIN_TYPE,NEURAL_INPUT_NAMES,PARAMETER_COUNT,layoutForType} from './neural-layout.js';
import {localNeighbours} from './navigation.js';
import {installHelp,createHelpButton} from './help.js';
import {foodLabel} from './food-settings.js';
import {readFoodControls,installFoodControls,syncFoodControls,installLiveFoodControls} from './food-controls.js';
import {geographyLabel} from './geography.js';
import {COMPUTATION_WORKER_COUNTS,computationHardwareLabel} from './computation-settings.js';
import {installUIText,UI_TEXT} from './ui-text.js';
import {installPerformanceTabs} from './performance-tabs.js';
import {installScreenTabs} from './screen-tabs.js';
const element=id=>document.getElementById(id);
installUIText(document);installPerformanceTabs(document);
installScreenTabs('start',['population','food','other'],document);
installScreenTabs('food',['conditions','automatic','journal'],document);
installScreenTabs('wiki',['world', 'saves', 'actions', 'brain', 'memory', 'selection', 'genome', 'geography', 'food', 'deposits', 'environment', 'research', 'checks', 'limits'],document);
// Один список допустимых режимов используется интерфейсом и расчётом.
for(const count of COMPUTATION_WORKER_COUNTS){const option=document.createElement('option');option.value=count;option.textContent=count===1?'1 · последовательно':`${count} · параллельно`;element('compute-workers').append(option);}
element('compute-hardware').textContent=computationHardwareLabel();
import {mutationProfile} from './mutation-parameters.js';
const canvas=element('world'),context=canvas.getContext('2d');
const chart=element('chart'),graph=chart.getContext('2d');let worldInfoOpen=false;
element('world-info').addEventListener('toggle',event=>{worldInfoOpen=event.newState==='open';if(worldInfoOpen)update();});
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!element('panel-world').hidden)drawChart();}).observe(chart);

canvas.width=CANVAS_WIDTH;canvas.height=CANVAS_HEIGHT;
let selected=null,running=false,baseGenome=null,legacyBase=false,controlPending=false,activeComputationMode='auto';
const trail={points:[]};
const client=new WorldClient({onState:message=>{
 sim=client.view;selected=message.state.selected?.agent??null;trail.points=message.state.trail;
 running=message.running;actualRate=message.actualRate;profiler.accept(message.profile);
 if(!document.hidden){
  if(!labTabs||labTabs.currentTab()==='world'){update();draw();}
  else profiler.measureUI('otherTabs',()=>{updateTransport();labTabs.refresh();});
 }
},onError:message=>{running=false;element('error').textContent=message;update();}});
let sim=client.view,environmentUI=null,liveFoodControls=null;
function command(type,payload){return client.request(type,payload).catch(error=>{element('error').textContent=error.message;throw error;});}
function selectResident(agent){if(agent)void command('select',{id:agent.id}).catch(()=>{});}
const profiler=new WorldProfiler(client);
let performancePanel=null;
let labTabs=null,sidebar=null;
let lastPaint=0,actualRate=0;
let displayedEnvironmentRevision=-1;

/** Проверяем настройки на границе интерфейса. Исправления модели от пользователя не требуются.
 * Изменение поля не меняет начатый опыт; параметры читаются только при перезапуске.
 */
function settings(){
 const population=Number(element('founders').value),limit=Number(element('population-limit').value);
 const seed=Number(element('seed').value);
 if(!Number.isInteger(population)||population<1||population>1000)throw new Error('Основателей должно быть от 1 до 1000.');
 if(!Number.isInteger(limit)||limit<population||limit>1000)throw new Error('Лимит должен быть не меньше числа основателей и не больше 1000.');
 if(!Number.isInteger(seed)||seed<1||seed>4294967295)throw new Error('Номер опыта должен быть целым от 1 до 4294967295.');
 const computeWorkers=activeComputationMode;
 return {seed,population,limit,computeWorkers,automaticEnvironment:environmentUI?.settings(),geography:'lakes-rivers-v1',...readFoodControls(),
  learning:element('learning').checked,memory:element('memory').checked,
  expandLegacy:legacyBase&&element('expand-legacy').checked,mutationRate:Number(element('mutation-rate').value),mutations:element('mutations').checked,upgradeMutationGenes:element('upgrade-mutations').checked,baseGenome};
}
function pause(){if(!client.ready)return Promise.resolve();return command('running',{value:false}).catch(()=>{});}
async function toggle(){
 if(!client.ready||controlPending||!sim.agents.length||labTabs?.isBenchmarkActive())return;
 controlPending=true;update();try{await command('running',{value:!running});}catch{}finally{controlPending=false;update();}
}
async function singleStep(){
 if(!client.ready||controlPending||labTabs?.isBenchmarkActive())return;
 controlPending=true;update();try{await command('substep');}catch{}finally{controlPending=false;update();}
}
async function restart(){
 if(controlPending||labTabs?.isBenchmarkActive())return;
 try{const options=settings();controlPending=true;await client.init(options);
  running=false;actualRate=0;
  element('error').textContent='';element('save-status').textContent='';labTabs?.onRestart();syncWorldFoodEditor();update();draw();
  await sendView();
 }catch(error){element('error').textContent=error.message;}finally{controlPending=false;update();}
}
element('play').addEventListener('click',toggle);
element('step').addEventListener('click',singleStep);
element('restart').addEventListener('click',restart);
element('compute-apply').addEventListener('click',async()=>{
 if(!client.ready||controlPending||labTabs?.isBenchmarkActive())return;
 const value=element('compute-workers').value,mode=value==='auto'?'auto':Number(value);
 controlPending=true;element('compute-message').textContent='Перенос опыта и проверка вычислителей…';update();
 try{const result=await command('computations',{value:mode});activeComputationMode=mode;element('compute-message').textContent=UI_TEXT.computeChanged(result.computeWorkers,sim.tick);}
 catch(error){element('compute-message').textContent=error.message;}
 finally{controlPending=false;update();}
});
// Меняем только поле следующего запуска. Текущий мир, RNG, пауза и выбранный
// житель остаются прежними до явного «Начать новый опыт».
element('randomize-seed').addEventListener('click',()=>{
 try{element('seed').value=randomExperienceSeed(Number(element('seed').value));element('error').textContent='';}
 catch(error){element('error').textContent=error.message;}
});
element('speed').addEventListener('change',()=>{if(client.ready)void command('speed',{value:10*Number(element('speed').value),substeps:Number(element('speed').value)<=.1}).catch(()=>{});});
installFoodControls();
/** Поля вмешательства независимы от полей следующего нового опыта.
 * Движение ползунка только готовит ввод. Worker применяет пищевые условия
 * между целыми шагами, сохраняя прежний режим запуска.
 */
const updateWorldFoodControls=installFoodControls('world-');
liveFoodControls=installLiveFoodControls({element,getWorld:()=>sim,refresh:updateWorldFoodControls});
function syncWorldFoodEditor(){
 if(!client.ready)return;
 syncFoodControls('world-',sim.foodSettings);
 element('world-food-relocate').checked=false;
 element('world-food-status').textContent='';element('world-food-error').textContent='';
 displayedEnvironmentRevision=-1;updateWorldFoodControls();
 liveFoodControls?.reset();
}
element('world-food-apply').addEventListener('click',async()=>{
 if(!client.ready||controlPending)return;
 controlPending=true;
 try{
  const change=await command('food',{...readFoodControls('world-'),relocate:element('world-food-relocate').checked});
  element('world-food-error').textContent='';
  const mode=running?'Мир продолжает работу.':'Мир остаётся на паузе.';
  element('world-food-status').textContent=change?`Применено на шаге ${format(change.tick)}. ${mode} Следующее пополнение: ${change.nextRegrowthTick===null?'нет источников':'шаг '+format(change.nextRegrowthTick)}.`:
   `Условия совпадают с текущими. ${mode} Цикл восстановления сохранён.`;
  // Перестановка — одно вмешательство. Повторный обычный Apply не должен
  // случайно ещё раз перераспределять источники из-за оставленной галочки.
  element('world-food-relocate').checked=false;update();draw();
 }catch(error){element('world-food-error').textContent=error.message;}finally{controlPending=false;update();}
});
element('world-food-export').addEventListener('click',()=>{pause();labTabs?.exportWorldObservation();});
syncWorldFoodEditor();
environmentUI=installEnvironmentUI({element,command,getWorld:()=>sim});
installWorldFiles({element,command,isBlocked:()=>labTabs?.isBenchmarkActive(),onLoad:()=>{labTabs?.onRestart();environmentUI.reset();syncWorldFoodEditor();update();draw();}});
element('next-agent').addEventListener('click',()=>{
 if(!sim.agents.length)return;
 const index=sim.agents.findIndex(a=>a.id===selected?.id);selectResident(sim.agents[(index+1)%sim.agents.length]);update();draw();
});
// Горячие клавиши не вмешиваются в поля, вкладки, раскрытие details и диалоги.
// Space на summary должен раскрывать сведения, а не запускать мир одновременно.
document.addEventListener('keydown',event=>{
 if(labTabs&&labTabs.currentTab()!=='world')return;
 if(event.defaultPrevented||event.target.closest('summary,[role=tablist]')||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName)||element('help-dialog').open)return;
 if(event.code==='Space'){event.preventDefault();toggle();}
 if(event.code==='ArrowRight'){event.preventDefault();void singleStep();}
});
function sendView(){return command('view',{visible:!document.hidden,tab:labTabs?.currentTab()??'world',section:sidebar?.getResidentSection()??'birth'});}
document.addEventListener('visibilitychange',()=>{if(client.ready)void sendView().catch(()=>{});});

/** Экспорт сохраняет именно геном и сведения об его происхождении.
 * Это не полное сохранение мира: энергия, текущие координаты и память не загружаются.
 * Импорт запускает новые организмы с этой основой только после «Начать новый опыт».
 */
element('save-genome').addEventListener('click',async()=>{
 if(!selected)return;
 try{
 const genome=await command('genome');if(!genome)return;
 const blob=new Blob([JSON.stringify(genome,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`genome-generation-${genome.source.generation}-id-${genome.source.id}.json`;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 element('save-status').textContent='Геном отправлен в загрузки браузера. Его можно загрузить как основу нового опыта.';
 }catch{}
});
element('load-genome').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;pause();
 try{
  if(file.size>100000)throw new Error('Файл слишком велик. Геном должен быть меньше 100 КБ.');
  const data=JSON.parse(await file.text());if(data.version!==13)throw new Error('Новый мир принимает только геномы v13.');baseGenome=validateGenomeFile(data);legacyBase=false;
  element('legacy-options').hidden=!legacyBase;
  const inherited=Boolean(mutationProfile(baseGenome));
  element('upgrade-mutations').checked=false;element('mutation-upgrade-options').hidden=inherited;
  element('legacy-mutation-settings').hidden=inherited;
  element('base-status').textContent=legacyBase?'Основа версии 1 загружена: 435 прежних значений перенесены с сохранением смысла, новые оценки рождения и выкладывания нейтральны. Выбери дополнение новых свойств и начни опыт.':`Основа версии ${data.version} загружена. Нажми «Начать новый опыт», чтобы применить её.`;
  element('clear-base').disabled=false;element('error').textContent='';
 }catch(error){element('error').textContent='Геном не загружен: '+error.message;}
});
element('upgrade-mutations').addEventListener('change',()=>{element('legacy-mutation-settings').hidden=element('upgrade-mutations').checked||!baseGenome||Boolean(mutationProfile(baseGenome));});
element('clear-base').addEventListener('click',()=>{
 baseGenome=null;legacyBase=false;element('legacy-options').hidden=true;
 element('mutation-upgrade-options').hidden=true;element('upgrade-mutations').checked=false;element('legacy-mutation-settings').hidden=true;element('load-genome').value='';element('clear-base').disabled=true;
 element('base-status').textContent='Новая популяция: случайные геномы';
});

/** Все пользовательские значения выводятся через textContent, не через HTML.
 * Проценты относятся к нынешнему состоянию. Выделение показывает последнее действие.
 * Умерший выбранный житель остаётся доступен для изучения и сохранения генома.
 */
function update(){
 updateTransport();
 if(!client.ready){element('play').disabled=true;element('step').disabled=true;return;}
 return profiler.measureUI('panel',updateContents);
}
/** Общая кнопка обновляется и вне карты, без обхода жителей/источников. */
function updateTransport(){
 element('play').textContent=controlPending?'Ожидание…':running?'Ⅱ Пауза':'▶ Наблюдать';
 element('play').setAttribute('aria-pressed',String(running));
 element('restart').disabled=controlPending||labTabs?.isBenchmarkActive();
 element('world-load').disabled=Boolean(labTabs?.isBenchmarkActive());
 element('play').disabled=!client.ready||controlPending||!sim.agents.length||labTabs?.isBenchmarkActive();
}
function updateContents(){
 environmentUI?.update();
 liveFoodControls?.update();
 let residentOptions=null;
 const total=sim.summary();
 for(const [id,value]of [['population',total.population],['births',total.births],['deaths',total.deaths],
  ['generation',total.maxGeneration],['lineages',total.survivingFounders]])element(id).textContent=value;
 element('feeling-mean').textContent=`Самочувствие живых: ${total.meanFeeling.toFixed(1)} · личных обновлений у живых: ${total.learningUpdates}`;
 element('brain-mode').textContent=`Память ${sim.memoryEnabled?'включена':'выключена'} · обучение ${sim.learningEnabled?'включено':'выключено'}`;
 element('clock').textContent=`Шаг ${sim.tick}`;
 element('step').disabled=controlPending||!total.population||labTabs?.isBenchmarkActive();
 element('next-agent').disabled=!total.population;
 element('rate').textContent=running?(Number(element('speed').value)<=.1?`${(actualRate*10).toFixed(1)} подшага/с фактически`:`${Math.round(actualRate)} шагов/с фактически`):'На паузе';
 element('compute-status').textContent=`Вычислителей: ${sim.execution?.computeWorkers??1}`;
 activeComputationMode=sim.execution?.mode??activeComputationMode;
 element('compute-current').textContent=UI_TEXT.currentComputations(sim.execution?.computeWorkers??1,activeComputationMode);
 element('compute-apply').disabled=controlPending||labTabs?.isBenchmarkActive();element('compute-workers').disabled=controlPending||labTabs?.isBenchmarkActive();
 // Показатель наблюдателя: использует настоящие источники, но не входит в мозг.
 if(worldInfoOpen){
 const sources=sim.foodIslands.flatMap(g=>g.sources);
 const nearFood=sim.agents.filter(a=>sources.some(p=>worldDistance(a,p)<=3)).length;
 element('food-region').textContent=`${foodLabel({scenario:sim.scenario,foodSettings:sim.foodSettings})} · начальный запас ${sim.initialFood} порций. Не дальше 3 шагов от источника: ${nearFood}/${total.population} живых · островков ${sim.foodSettings.islandCount}, одиночных кустов ${sim.foodSettings.bushCount??0} · карта ${WORLD_WIDTH}×${WORLD_HEIGHT}`.replaceAll(' · ','\n');
 const geography=sim.geographyInfo,populatedRegions=new Set(sim.agents.map(a=>sim.tile(a.x,a.y).regionId)).size;
 element('geography-region').textContent=`${geographyLabel(sim.geography)} · воды ${(geography.waterFraction*100).toFixed(1)}% · рек ${geography.riverCount}, озёр ${geography.lakeCount}, бродов ${geography.fordCells}. Районов суши ${geography.regionCount}, сейчас населены ${populatedRegions}. Обзор жителя: радиус 1.`.replaceAll(' · ','\n');
 }
 const environment=sim.environment,looseFood=sim.tiles.filter(c=>c.maxFood===0).reduce((n,c)=>n+c.food,0);
 const capacity=environment.sourceCount?`${environment.capacityMin}…${environment.capacityMax} порций`:'нет источников';
 element('world-food-current').textContent=`Сейчас: ${environment.sourceCount} источников, периоды ${format(environment.periodMin??environment.regrowInterval)}…${format(environment.periodMax??environment.regrowInterval)}, ёмкость ${capacity}. Еды на карте ${sim.tiles.reduce((n,c)=>n+c.food,0)}, из неё вне источников ${looseFood}. Следующее пополнение: ${sim.nextFoodRegrowth()===null?'нет источников':'шаг '+format(sim.nextFoodRegrowth())}.`;
 if(displayedEnvironmentRevision!==sim.environmentRevision){
  displayedEnvironmentRevision=sim.environmentRevision;
  element('world-food-production').textContent=`Ожидаемая выработка текущего мира: ${format(sim.automaticEnvironment?.production)} порции/Т. Полные источники пропускают рост; неприменённые настройки здесь не учитываются.`;
  element('world-food-changes').replaceChildren(...sim.environmentChanges.slice(-8).reverse().map(change=>{
   const row=document.createElement('li'),a=change.after;
   if(change.kind==='automatic-food'){row.textContent=`${format(change.tick)} Т · ${change.operation==='prepare'?'Подготовка':'Колебания около целей'}: ${format(change.before.production)} → ${format(a.production)} порции/Т; источников ${a.sourceCount}, средний период ${format(a.meanPeriod)} Т, перемещено ${change.moved.length}.${change.countAdjusted?' Число источников скорректировано по выработке.':''}${change.periodsAdjusted?' Дополнительно скорректированы периоды.':''}`;return row;}
   row.textContent=`Шаг ${format(change.tick)}: ${a.sourceCount} источников, период ${format(a.regrowInterval)}, ёмкость ${format(a.capacityMin)}…${format(a.capacityMax)}. ${change.operation==='redistribute'?'Перераспределены. ':''}Живых ${change.summary.population}, линий ${change.summary.survivingFounders}.`;
   return row;
  }));
  element('world-food-no-changes').hidden=sim.environmentChanges.length>0;
  element('world-food-island-summary').textContent=`Островков ${environment.islandCount} (запрошено ${environment.requestedIslandCount}), размер ${environment.sizeMin??'—'}…${environment.sizeMax??'—'} источников; одиночных кустов ${environment.bushCount??0}. Центральный период ${format(environment.regrowInterval)} Т, разброс ±${format(environment.periodSpread??0)}%; реальные периоды ${format(environment.periodMin)}…${format(environment.periodMax)} Т.`;
 }
 element('limit-status').textContent=total.atLimit?'Достигнут лимит: рождения приостановлены':'';
 element('extinction').hidden=total.population>0;
 element('reproduction-summary').textContent=reproductionSummary(sim.stats.reproduction);
 const causes=sim.stats.deathsByCause;
 element('causes').textContent=`Истощение ${causes.starvation} · возраст ${causes.age}`;
 if(selected&&!element('side-panel-resident').hidden){
  const a=selected;
  const birth=sim.birthAvailability(a);
  element('reproduction-status').textContent=(birth.eligible?'Сейчас может родить. ':'Сейчас рождение недоступно: '+birth.blocked.map(k=>BIRTH_BLOCK_LABELS[k]).join(', ')+'. ')+reproductionSummary(a.life.reproduction);
  element('resident-title').textContent=`Житель №${a.id}`;
  element('resident-detail').textContent=`${a.alive?'Жив':'Погиб'} · поколение ${a.generation} · родитель ${a.parentId===null?'нет':a.parentId} · линия №${a.founderId} · возраст ${a.age} · потомков ${a.children} · положил ${a.life.deposited} · последнее: ${a.lastAction===null?'—':ACTIONS[a.lastAction]}`;
  element('resident-detail').textContent+=a.process?` · выполняет: ${ACTIONS[a.process.action]}, ${a.process.elapsed}/${a.process.duration} подшагов`:' · действие завершено';
  const metrics=[['Энергия',a.energy.toFixed(1)],['Самочувствие',sim.feeling(a).toFixed(1)],['Здоровье',a.health.toFixed(1)],
   ['Предметов при себе',`${a.inventory}/${RULES.inventoryCapacity}`],['Усваивается',`${(a.stomach/RULES.foodEnergy).toFixed(1)} порции`],['Личная позиция',`(${a.brain.position.q}, ${a.brain.position.r})`],['Взгляд',`${a.brain.facing*60}° от рождения`]];
  const metricHelp=['metric-energy','feeling-mean','metric-health','metric-inventory','metric-stomach','metric-position','metric-facing'];
  // Не заменяем кнопки каждые 200 мс: иначе фокус клавиатуры терялся бы
  // во время наблюдения. Меняем только числа, сама справка остаётся на месте.
  const body=element('body'),position=element('resident-position');
  if(!body.querySelector('.body-grid')){
   const main=document.createElement('div');main.className='body-grid';
   for(const [i,[label,value]]of metrics.entries()){
    const box=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');
    name.append(createHelpButton(metricHelp[i],label));number.className='metric-value';number.dataset.index=i;number.textContent=value;box.append(name,number);
    (i<5?main:position).append(box);
   }
   body.replaceChildren(main);
  }else for(const host of [body,position])for(const number of host.querySelectorAll('.metric-value'))number.textContent=metrics[Number(number.dataset.index)][1];
  const detailSection=sidebar?.getResidentSection()??'birth';
  // Полная диагностическая оценка нужна только открытым действиям/реакциям.
  // Это уменьшает работу UI, но не частоту решений или обучения организма.
  if(detailSection==='actions'||detailSection==='features'){
  element('action-title').textContent=a.alive?(Boolean(layoutForType(a.brain.controllerType))?'Оценки нейросети сейчас':`Предпочтения сейчас · строка ${sim.state(a)}`):'Последний выбор перед гибелью';
  const options=residentOptions=sim.evaluate(a);
  if(detailSection==='actions')element('choices').replaceChildren(...options.map(option=>{
   const row=document.createElement('div');row.className='choice'+(option.action===a.lastAction?' last':'');
   const head=document.createElement('div');head.className='choice-head';
   const label=document.createElement('span'),number=document.createElement('span');
   label.textContent=option.label;number.textContent=`${(option.probability*100).toFixed(1)}%`;
   head.append(label,number);const meter=document.createElement('div');meter.className='choice-meter';
   const fill=document.createElement('span');fill.style.width=option.probability*100+'%';meter.append(fill);
   const detail=document.createElement('small');detail.className='choice-detail';
   detail.textContent=Boolean(layoutForType(a.brain.controllerType))?
    `${option.operation!==undefined?`Операция «${OPERATION_NAMES[option.operation]}» ${(option.operationProbability*100).toFixed(1)}% × вариант ${(option.targetProbability*100).toFixed(1)}%. `:''}Прогноз Q ${option.learningValue.toFixed(3)} · генетическая сеть с личными поправками. Это оценка последствий, не вероятность выживания.`:
    `Геном ${option.innate.toFixed(2)} · опыт ${option.experience.toFixed(2)}. Вклад запасов/желудка: врождённый ${option.bodyInnate.toFixed(2)}, выученный ${option.bodyExperience.toFixed(2)}.`;
   row.append(head,meter,detail);return row;
  }));
 }
 }
 renderBrain(residentOptions);
 element('save-genome').disabled=!selected;
 element('events').replaceChildren(...sim.events.slice(0,20).map(event=>{
  const row=document.createElement('div');row.className='event';const time=document.createElement('time');time.textContent=event.tick;
  const box=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');
  title.textContent=event.title;description.textContent=event.text;box.append(title,description);row.append(time,box);return row;
 }));
 drawChart();
}

/** Память показывается как наблюдение и прогноз, а не истинная скрытая карта.
 * Сортировка создаёт новый массив и не меняет очередь забывания в Map.
 * Панель отделяет удовольствие, изменение оценок и физическое благополучие.
 */
function renderBrain(options){return profiler.measureUI('resident',()=>renderBrainContents(options));}
function renderBrainContents(options){
 if(!selected||element('side-panel-resident').hidden)return;
 const a=selected,b=a.brain,traits=b.traits,change=b.lastLearning;
 const detailSection=sidebar?.getResidentSection()??'birth';
 const senses=bodySenses(a,RULES.inventoryCapacity,RULES.stomachCapacity);
 const layout=layoutForType(b.controllerType),neural=Boolean(layout);
 if(detailSection==='senses'){
element('body-senses').textContent=`Переносимый запас: ${a.inventory}/${RULES.inventoryCapacity} порций (${(senses[0]*100).toFixed(0)}%). Желудок: ${(senses[1]*100).toFixed(0)}%. `+(neural?'Входы сети вместе с энергией, здоровьем и личными наблюдениями.':'Это два числовых признака; у каждого действия свои веса.')+' Больший запас не получает готовой награды.';
  const view=sim.neighbours(a),ids=sim.contacts(a);
  const rows=[`Других особей в обзоре: ${view.visibleCount}; на своей клетке: ${view.ownCount}.`,
   ...view.cells.map(c=>`${c.action===null?'Своя клетка':ACTIONS[c.action]}: ${c.count}`),
   `Контакты на своей клетке: ${ids.length?ids.map(id=>'№'+id).join(', '):'нет'}. На соседних клетках личности не различимы.`,
   layout?.version===8||b.controllerType===SET_BRAIN_TYPE||b.temporal?'Количества доступны сети. Узнавания прежних встреч и социальной памяти пока нет.':'Этот сохранённый мозг не использует количества соседей; его схема сохранена.'];
  if(b.controllerType===SET_BRAIN_TYPE||b.temporal)rows.push(...sim.visibleDecisionCells(a).map(cell=>
   `Личные (${cell.q}, ${cell.r}): ${cell.isFoodSource?'источник пищи':'без источника'}, лежит ${cell.food} порций.`+(b.temporal?' '+UI_TEXT.activities(cell):'')));
  updateTextRows(element('neighbour-senses'),rows);
 }

 if(detailSection==='learning')element('learning-report').textContent=change?
  `Шаг ${change.tick}: ${ACTIONS[change.action]}${neural?'':', состояние '+change.row}. Подкрепление ${change.reward.toFixed(3)}, ошибка ожидания ${change.delta.toFixed(3)}. Оценка ${change.beforeValue.toFixed(3)} → ${change.afterValue.toFixed(3)}. След: ${neural?'накопленный градиент':change.traceLength+' решений'}.`:
  sim.learningEnabled?'Пока нет завершённого перехода для обучения. После решения нужно дождаться следующего ощущения.':'Личное обучение отключено в этом опыте.';
 element('memory-summary').textContent=`Краткая память ${b.memory.size}/${traits.shortCapacity} · долгая ${b.longMemory.size}/${traits.longCapacity} · пищу видел в ${[...memoryEntries(b)].filter(r=>r.maxFoodSeen>0).length} местах · обновлений опыта ${b.updates} · среднее чувство за жизнь ${b.feelingSamples?(b.feelingTotal/b.feelingSamples).toFixed(1):'—'}`;
 if(detailSection==='traits'){element('traits-summary').textContent=`Скорость обучения ${traits.alpha.toFixed(3)} · забывание ${(traits.forgetting*100).toFixed(3)}%/Т · вес будущего ${traits.discount.toFixed(2)} · затухание следа ${traits.trace.toFixed(2)}. Память: краткая ${traits.shortCapacity}, долгая ${traits.longCapacity}; порог закрепления ${traits.consolidationThreshold.toFixed(3)}, затухание значимости ${Math.round(traits.longRetention)} шагов. Чувствительность: энергия ${traits.values[0].toFixed(2)}, здоровье ${traits.values[1].toFixed(2)}, пищеварение ${traits.values[3].toFixed(2)}.`;
  const mutation=mutationProfile(a.genome);
  element('traits-summary').textContent+=mutation?` Наследуемая изменчивость: ${(mutation.rate*100).toPrecision(4)}% на ген, сила ±${mutation.strength.toPrecision(4)}.`:` Изменчивость старой основы: общий параметр мира ${(sim.mutationRate*100).toFixed(2)}%, сила ±0.7.`;
 }
 const memoryRow=record=>{
  const belief=memoryBelief(record,sim.tick,traits),row=document.createElement('div');row.className='memory-row';
  const long=b.longMemory.has(`${record.q},${record.r}`);
  row.textContent=`[${long?'ДОЛГАЯ':'КРАТКАЯ'}] личные (${record.q}, ${record.r}) · видел пищу ${record.food} на шаге ${record.lastSeen} · источник при наблюдении: ${record.isFoodSource===undefined?'неизвестно':record.isFoodSource?'да':'нет'} · предполагает ${belief.food.toFixed(1)} · время на клетке ${record.visits.toFixed(1)} Т${record.recoveries?' · возвращений пищи '+record.recoveries:''}`;
  if(record.lastExperience)row.textContent+=` · сила переживания ${record.lastExperience.intensity.toFixed(3)}, неожиданность ${record.lastExperience.surprise.toFixed(3)}`;
  if(long)row.textContent+=` · закреплено: ${record.consolidationReason} · сила ${memoryStrength(record,sim.tick,traits).toFixed(3)}`;
  return row;
 };
 // Долгие места показываются независимо от 12 последних кратких наблюдений.
 if(detailSection==='short')element('memories').replaceChildren(...[...b.memory.values()].sort((x,y)=>y.lastSeen-x.lastSeen).slice(0,12).map(memoryRow));
 if(detailSection==='long')element('long-memories').replaceChildren(...[...b.longMemory.values()].sort((x,y)=>memoryStrength(y,sim.tick,traits)-memoryStrength(x,sim.tick,traits)).map(memoryRow));
 if(detailSection==='long'&&!b.longMemory.size){const empty=document.createElement('p');empty.textContent='Пока ни одно место не закреплено.';element('long-memories').append(empty);}
 // Этот контейнер живёт до закрытия страницы; его нельзя заменять при refresh.
 if(detailSection!=='features')return;
 const host=element('feature-learning');
 let features=host.querySelector('.feature-values');
 if(!features){features=document.createElement('div');features.className='feature-values';features.tabIndex=0;host.append(features);}
 const rows=[];
 if(neural){
  const norm=Math.sqrt(b.networkDelta.reduce((sum,v)=>sum+v*v,0));
  rows.push(b.controllerType===SET_BRAIN_TYPE?`Мозг Б: клетки ${layout.network.cellInputs} → ${layout.network.cellHidden}, общая ситуация ${layout.network.contextInputs} → ${layout.network.contextHidden}, цели ${layout.network.targetInputs} → ${layout.network.contextHidden}, критерии 6 операций → все Q. ${layout.parameters} наследуемых параметров; норма личных поправок ${norm.toFixed(3)}. 6 операций; движение выбирает направление.`:`Сеть ${layout.inputs} → ${layout.hidden} tanh → Q. ${layout.parameters} генетических параметров и столько же личных поправок; норма поправок ${norm.toFixed(3)}. Смещения обучаются вместе со связями.`);
  // В рамках одного синхронного обновления тело/мозг не меняются:
  // список уже вычислен для вероятностей выше, повторный проход сети не нужен.
  const option=options?.find(o=>o.action===a.lastAction)??options?.[0];
  if(option?.input){
   rows.push(`Входы для варианта «${option.label}»${a.alive?' сейчас':' перед последним действием'}:`);
   layout.inputNames.forEach((name,i)=>rows.push(`${name}: ${option.input[i].toFixed(3)}`));
   if(option.candidateInput)CANDIDATE_NAMES.forEach((name,i)=>rows.push(`${name}: ${option.candidateInput[i].toFixed(3)}`));
  }
  updateTextRows(features,rows);return;
 }
 FEATURE_NAMES.forEach((name,i)=>{
  rows.push(`${name}: ${(b.weights[i]*b.scale).toFixed(3)}`);
 });
 ACTIONS.forEach((name,action)=>{
  rows.push(`${name}: `+BODY_FEATURE_NAMES.map((label,i)=>{
   const index=action*BODY_FEATURE_NAMES.length+i;
   return `${label} — ген ${b.bodyGenes[index].toFixed(3)}, опыт ${(b.bodyWeights[index]*b.scale).toFixed(3)}`;
  }).join(' · '));
 });
 updateTextRows(features,rows);
}

/** У шестиугольника шесть вершин на окружности через 60 градусов.
 * Один и тот же центр используется для поля, жителей и определения щелчков.
 */
function hexPath(x,y){
 context.beginPath();
 for(let i=0;i<6;i++){
  const angle=(i*60-30)*Math.PI/180,px=x+HEX_RADIUS*Math.cos(angle),py=y+HEX_RADIUS*Math.sin(angle);
  if(i===0)context.moveTo(px,py);else context.lineTo(px,py);
 }
 context.closePath();
}
/** Цвет родословной и смещение точки выводятся из id, а не из случайного генератора.
 * Несколько жителей на гексе расходятся визуально; их физические координаты одинаковы.
 */
function agentPoint(a){const p=hexCenter(a),angle=a.id*2.399963;return {x:p.x+Math.cos(angle)*7,y:p.y+Math.sin(angle)*7};}
function draw(){if(client.ready)return profiler.measureUI('map',drawContents);}
function drawContents(){
 context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle='#1e2922';context.fillRect(0,0,canvas.width,canvas.height);
 for(const cell of sim.tiles){
  const {x,y}=hexCenter(cell);hexPath(x,y);
  const shade=(cell.x*13+cell.y*7)%3;
  context.fillStyle=cell.terrain==='water'?(cell.feature==='river'?'#477b8a':'#416b70'):cell.feature==='ford'?'#a6b493':['#71875c','#788d62','#809367'][shade];context.fill();
  context.strokeStyle='#233b2b77';context.lineWidth=.6;context.stroke();
  if(cell.feature==='ford'){
   // Видимый знак проходимого разрыва. В физике это обычная суша: цена
   // шага прежняя, навык плавания или особое знание мостов не добавлены.
   context.strokeStyle='#47665a';context.lineWidth=1.5;context.beginPath();context.moveTo(x-8,y-4);context.lineTo(x+8,y-4);context.moveTo(x-8,y+4);context.lineTo(x+8,y+4);context.stroke();
  }
  if(cell.food>0){
   context.fillStyle='#324d31';context.beginPath();context.arc(x,y-2,7,0,Math.PI*2);context.fill();
   context.fillStyle='#d5acc5';context.beginPath();context.arc(x-3,y-3,2.5,0,Math.PI*2);context.arc(x+3,y,2.5,0,Math.PI*2);context.fill();
   context.font='9px Segoe UI';context.textAlign='center';context.fillStyle='#e9edda';context.fillText(cell.food,x,y+14);
   if(cell.maxFood===0){
    // Пунктир означает пищу без источника (оставленную или прежнюю): его можно доесть, но здесь
    // уже нет производства. Это отметка наблюдателя, не новый признак мозга.
    context.strokeStyle='#dfc98c';context.setLineDash([2,2]);context.beginPath();context.arc(x,y-2,9,0,Math.PI*2);context.stroke();context.setLineDash([]);
   }
  }else if(cell.maxFood>0){context.strokeStyle='#b9c69677';context.beginPath();context.arc(x,y,4,0,Math.PI*2);context.stroke();}
 }
 // Маршрут только выбранной жизни: максимум 20 отрезков, без хранения
 // для остальных. Координаты наблюдателя не передаются контроллеру.
 if(trail.points.length>1){
  context.save();context.strokeStyle=selected?.alive?'#fff0ad':'#e09a7c';context.lineWidth=2.3;context.setLineDash([5,4]);context.beginPath();
  trail.points.forEach((cell,i)=>{const p=agentPoint({...cell,id:selected.id});if(i===0)context.moveTo(p.x,p.y);else context.lineTo(p.x,p.y);});
  context.stroke();context.restore();
 }
 if(element('show-memory').checked&&selected){
  // Обводки — клетки в личной памяти. Карта под ними остаётся обзором наблюдателя.
  for(const record of memoryEntries(selected.brain)){
   const p=hexCenter(memoryWorldPosition(selected,record));hexPath(p.x,p.y);
   const alpha=.15+.65*memoryBelief(record,sim.tick,selected.brain.traits).confidence;
   context.strokeStyle=record.maxFoodSeen>0?`rgba(237,189,105,${alpha})`:`rgba(151,205,226,${alpha})`;
   context.lineWidth=selected.brain.longMemory.has(`${record.q},${record.r}`)?3.5:1.2;context.stroke();
  }
 }
 for(const a of sim.agents){
  const p=agentPoint(a);context.fillStyle=`hsl(${(a.founderId*137.5)%360} 55% 72%)`;
  context.strokeStyle='#24321f';context.lineWidth=1;context.beginPath();context.arc(p.x,p.y,4,0,Math.PI*2);context.fill();context.stroke();
 }
 if(selected){
  const p=agentPoint(selected);context.strokeStyle=selected.alive?'#ffe5a0':'#e09a7c';context.lineWidth=2;
  context.beginPath();context.arc(p.x,p.y,10,0,Math.PI*2);context.stroke();
  // Личный взгляд преобразуем той же навигацией, что физика движения.
  // Центр соседнего гекса существует геометрически даже за краем карты.
  const centre=hexCenter(selected),ahead=hexCenter(memoryWorldPosition(selected,localNeighbours(selected.brain)[0]));
  const dx=ahead.x-centre.x,dy=ahead.y-centre.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
  context.beginPath();context.moveTo(p.x+10*ux,p.y+10*uy);context.lineTo(p.x+20*ux,p.y+20*uy);
  context.lineTo(p.x+16*ux-3*uy,p.y+16*uy+3*ux);context.moveTo(p.x+20*ux,p.y+20*uy);
  context.lineTo(p.x+16*ux+3*uy,p.y+16*uy-3*ux);context.stroke();
 }
}
element('show-memory').addEventListener('change',draw);
canvas.addEventListener('click',event=>{
 const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*canvas.width,y=(event.clientY-box.top)/box.height*canvas.height;
 const cell=worldHexAt(x,y);if(!cell)return;
 const candidates=sim.agents.filter(a=>a.x===cell.x&&a.y===cell.y);
 if(candidates.length){selectResident(candidates.sort((a,b)=>{const p=agentPoint(a),q=agentPoint(b);return (p.x-x)**2+(p.y-y)**2-(q.x-x)**2-(q.y-y)**2;})[0]);sidebar.select('resident');update();draw();}
});
canvas.addEventListener('mousemove',event=>{
 const box=canvas.getBoundingClientRect(),p=worldHexAt((event.clientX-box.left)/box.width*canvas.width,(event.clientY-box.top)/box.height*canvas.height);
 if(!p){element('hover').textContent='За пределами карты.';return;}
 const cell=sim.tile(p.x,p.y),count=sim.agents.filter(a=>a.x===p.x&&a.y===p.y).length;
 const group=sim.foodIslands.find(g=>g.sources.some(c=>c.x===p.x&&c.y===p.y));
 const terrain=cell.feature==='ford'?'брод — проходим':cell.terrain==='water'?(cell.feature==='river'?'река':cell.feature==='lake'?'озеро':'вода'):'суша';
 element('hover').textContent=`Гекс (${p.x+1}, ${p.y+1}) · ${terrain} · пища ${cell.food} · ${cell.maxFood>0?'источник, ёмкость '+cell.maxFood+(group?.period?`, ${group.kind==='bush'?'куст':'островок '+(group.id+1)}, период ${group.period}, фаза ${group.phase}`:''):'без восстановления'} · жителей ${count}`;
});

/** Две шкалы: численность слева и средняя энергия 0–100 справа.
 * X использует настоящий tick, так что последняя неполная запись не искажает время.
 * Масштаб численности адаптируется к истории, история хранит максимум 800 точек.
 */
function drawChart(){return profiler.measureUI('chart',drawChartContents);}
function drawChartContents(){
 if(element('panel-world').hidden)return;
 const rect=chart.getBoundingClientRect(),ratio=globalThis.devicePixelRatio||1,w=Math.max(220,rect.width||900),h=Math.max(160,rect.height||180);
 if(chart.width!==Math.round(w*ratio)||chart.height!==Math.round(h*ratio)){chart.width=Math.round(w*ratio);chart.height=Math.round(h*ratio);}graph.setTransform(ratio,0,0,ratio,0,0);
 const left=56,right=w-56,top=18,bottom=h-30;
 graph.clearRect(0,0,w,h);graph.font='11px Segoe UI';
 const populationMax=Math.max(sim.initialPopulation,...sim.history.map(p=>p.population),1);
 for(const fraction of [0,.5,1]){
  const y=bottom-fraction*(bottom-top);graph.strokeStyle='#344333';graph.beginPath();graph.moveTo(left,y);graph.lineTo(right,y);graph.stroke();
  graph.fillStyle='#9aab90';graph.textAlign='left';graph.fillText(Math.round(populationMax*fraction),8,y+4);
  graph.textAlign='right';graph.fillText(Math.round(100*fraction),w-8,y+4);
 }
 const history=sim.history,start=history[0]?.tick??0,end=history.at(-1)?.tick??1;
 for(const [field,color,maximum]of [['population','#9ec48a',populationMax],['meanEnergy','#dfc98c',100]]){
  graph.strokeStyle=color;graph.lineWidth=2;graph.beginPath();
  history.forEach((p,i)=>{const x=left+(p.tick-start)/Math.max(1,end-start)*(right-left),y=bottom-p[field]/maximum*(bottom-top);if(i===0)graph.moveTo(x,y);else graph.lineTo(x,y);});graph.stroke();
 }
 // Метки используют тот же tick, что линии. Старые вмешательства остаются
 // в журнале, но на графике видны только внутри его последних 800 точек.
 graph.strokeStyle='#dfc98c88';graph.lineWidth=1;graph.setLineDash([3,4]);
 for(const change of sim.environmentChanges){if(change.tick<start||change.tick>end)continue;const x=left+(change.tick-start)/Math.max(1,end-start)*(right-left);graph.beginPath();graph.moveTo(x,top);graph.lineTo(x,bottom);graph.stroke();}
 graph.setLineDash([]);
 graph.fillStyle='#9aab90';graph.textAlign='left';graph.fillText(`Шаг ${start}`,left,h-5);graph.textAlign='right';graph.fillText(`${end}`,right,h-5);
}

/** rAF обслуживает только интерфейс. Worker сам планирует шаги и принимает
 * команды даже без кадров; скрытое окно не ставит мир на программную паузу. */
function frame(now){
 if(!document.hidden&&now-lastPaint>=200){
  updateTransport();
  if(!labTabs?.isBenchmarkActive())performancePanel?.refresh(now);
  lastPaint=now;
 }
 requestAnimationFrame(frame);
}
labTabs=installLabTabs({getSimulation:()=>sim,pauseWorld:pause,getWorldState:()=>({running,epoch:client.epoch}),
 suspendWorld:async()=>{if(!client.ready)throw new Error('Основной мир ещё не готов.');await command('running',{value:false});},
 resumeWorld:async state=>{if(client.epoch!==state.epoch)throw new Error('Основной мир сменился.');await command('running',{value:true});},getPerformanceReport:()=>profiler.report(),
 getWorldObservation:()=>command('observation'),onTabChange:()=>{if(client.ready)void sendView().catch(()=>{});}});
performancePanel=installPerformancePanel({profiler,getSimulation:()=>sim,isRunning:()=>running});
sidebar=installSidebar(()=>{if(client.ready)void sendView().catch(()=>{});});
installHelp();
update();requestAnimationFrame(frame);
void client.init().then(async()=>{syncWorldFoodEditor();await command('speed',{value:10*Number(element('speed').value),substeps:Number(element('speed').value)<=.1});await sendView();}).catch(error=>{element('error').textContent=error.message;});
