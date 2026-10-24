import {validatePlan,validateWorldOptions,standardSeeds,EXPERIMENT_DEFAULTS,EXPERIMENT_TEMPLATES,EXPERIMENT_PLAN_PROTOCOLS,EXPERIMENT_PLAN_VERSION,EXPERIMENT_TERRAIN_SEED,EXPERIMENT_FOOD_SEED} from './experiment-plan.js';
import {EXPERIMENT_FIELDS as fields,settingAt as get,setSetting as put,settingInput} from './experiment-fields.js';
import {installExperimentDesign} from './experiment-design-ui.js';
import {installExperimentRuns,runStatus} from './experiment-runs-ui.js';
import {ExperimentSeries} from './experiment-series.js';
import {ExperimentStore} from './experiment-store.js';
import {experimentPreferences} from './experiment-preferences.js';
import {installConditionTabs} from './workspace-ui.js';
import {createHelpButton} from './help.js';
import {EXPERIMENT_HELP} from './ui-text.js';
import {mergeLifeReports,reportSources,experimentWorlds} from './experiment-statistics.js';
import {COMPUTATION_WORKER_COUNTS} from './computation-settings.js';
import {validateGenomeFile} from './evolution.js';
import {downloadJson,snapshotExperiment,saveJsonBlob} from './json-export.js';
import {experimentArchive,openExperimentArchive,readExperimentFile,materializeExperiment,archiveOrigin,archiveWindowReady,loadArchiveWindow} from './experiment-archive.js';
import {normalizeChartWindows} from './chart-context.js';
import {historyDomainEnd} from './history-window.js';
import {registerAnalysisWorlds,analysisWorlds} from './statistical-series.js';
import {installExperimentGrouping,groupedExperimentSources} from './experiment-grouping.js';
const PALETTE=['#86bf80','#e1c88c','#91b8d0','#cba4e4','#e89f72','#77c5bb','#d9a4bd','#c1c878'];
const EMPTY_REPORT=Object.freeze({tick:0,dead:[],living:[],completed:{count:0,meanAge:null,medianAge:null},byCause:{},omittedDetails:0});
export const downloadExperiment=downloadJson;
export function validateExperimentReport(report){
 if(report?.format!=='big-evolution-experiment'||report.version!==1||![...EXPERIMENT_PLAN_PROTOCOLS,'world-constructor-v1'].includes(report.plan?.protocolId)||!Array.isArray(report.groups))throw new Error('Нужен отчёт конструктора опытов v1.');
 const plan=validatePlan(report.plan),ids=new Set();if(report.groups.length!==plan.worlds*plan.variants.length)throw new Error('Неполный состав миров отчёта.');
 for(const g of report.groups){if(ids.has(g.id)||!plan.variants.some(v=>v.id===g.variantId)||!Number.isSafeInteger(g.index)||g.index<0||g.index>=plan.worlds||g.id!==`${g.variantId}-${g.index}`||!Array.isArray(g.attempts)||g.attempts.length>3)throw new Error('Повреждена группа попыток.');ids.add(g.id);
  for(let i=0;i<g.attempts.length;i++){const a=g.attempts[i];if(a.id!==`${g.id}-${i+1}`||a.number!==i+1||a.seed!==plan.seedMatrix[g.index][i]||!Number.isFinite(a.tick)||a.tick<0)throw new Error('Повреждён seed или номер попытки.');if(a.lives){if(!Array.isArray(a.lives.dead)||!Array.isArray(a.lives.living))throw new Error('Повреждены истории жизней.');for(const r of [...a.lives.dead,...a.lives.living])if(!Number.isFinite(r.age)||!Number.isFinite(r.born)||r.age<0||r.born<0)throw new Error('Повреждена строка жизни.');}}
  if(g.selectedId&&!g.attempts.some(a=>a.id===g.selectedId&&a.lives))throw new Error('Нет выбранной попытки.');
 }
 return report;
}
export function installExperimentUI({getSimulation,getWorldState,pauseWorld,resumeWorld,onBusyChange=()=>{},isOtherActive=()=>false,openStatistics,sourceChanged=()=>{}}){
 const byId=id=>document.getElementById(id),make=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const controls=new Map(),store=new ExperimentStore();let busy=false,exporting=false,importing=false,lease=null,report=null,saveTimer=null,saveChain=Promise.resolve(),baseGenome=null,statsCache=null,design=null,windowTask=null,windowKey=null;
 const error=message=>{byId('constructor-error').textContent=message;};
 let local;try{local=globalThis.localStorage;}catch{}
 const preferences=experimentPreferences(local,message=>byId('constructor-storage').textContent=message);let draftTimer=null,restoring=true;
 const scheduleDraft=()=>{if(restoring)return;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,300);};
 const notification=byId('experiment-notification-dialog');
 function announce(message){byId('experiment-notification-body').textContent=message;if(!notification.open)notification.showModal();}
 byId('experiment-notification-close').addEventListener('click',()=>notification.close());
 notification.addEventListener('click',event=>{if(event.target===notification){const r=notification.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)notification.close();}});
 const inputFor=(field,value)=>settingInput(document,field,value);
 function labelInput(text,input,key){const label=make('label');if(input.type==='checkbox')label.className='check';label.append(EXPERIMENT_HELP[key]?createHelpButton(EXPERIMENT_HELP[key],text):make('span',text),input);return label;}
 const defaults={...validateWorldOptions(),foodCapacityMin:3,foodCapacityMax:6};
 const commonTabs=[];const table=make('table'),body=make('tbody');table.className='constructor-common-table';table.append(body);byId('constructor-common').append(table);
 for(const category of new Set(fields.map(f=>f[0]))){const row=make('tr'),title=make('th',category),cell=make('td'),grid=make('div');title.scope='row';grid.className='common-fields';cell.append(grid);row.append(title,cell);body.append(row);commonTabs.push({row,title});for(const f of fields.filter(f=>f[0]===category)){const input=inputFor(f,get(defaults,f[1]));controls.set(f[1],input);grid.append(labelInput(f[2],input,f[1]));}}
 installConditionTabs(byId('constructor-common'),commonTabs);
 byId('constructor-map-note').textContent=`Карта: seed ${EXPERIMENT_TERRAIN_SEED} · пища: seed ${EXPERIMENT_FOOD_SEED} — общие для всех повторов и попыток при одинаковых пищевых настройках. Seed жителей ниже меняют основателей и случайность их жизни. Собранная жителями пища может различаться.`;
 const cap=byId('constructor-workers');for(const count of COMPUTATION_WORKER_COUNTS){const o=make('option',String(count));o.value=count;cap.append(o);}cap.value=4;
 byId('constructor-budget').value=EXPERIMENT_DEFAULTS.budget;byId('constructor-worlds').value=EXPERIMENT_DEFAULTS.worlds;byId('constructor-steps').value=EXPERIMENT_DEFAULTS.steps;
 let seedPool=standardSeeds(64);
 const showSeeds=()=>{byId('constructor-seeds').value=seedPool.slice(0,Number(byId('constructor-worlds').value)).join(', ');updateDesign();};showSeeds();
 byId('constructor-seeds').addEventListener('change',()=>{seedPool=byId('constructor-seeds').value.split(/[\s,;]+/).filter(Boolean).map(Number);updateDesign();});
 byId('constructor-worlds').addEventListener('change',()=>{const n=Number(byId('constructor-worlds').value);for(const seed of standardSeeds(64))if(seedPool.length<n&&!seedPool.includes(seed))seedPool.push(seed);showSeeds();});
 byId('constructor-random').addEventListener('click',()=>{const values=new Set();while(values.size<64){const a=new Uint32Array(64);crypto.getRandomValues(a);for(const n of a)if(n)values.add(n);}seedPool=[...values].slice(0,64);showSeeds();});
 function updateDesign(){scheduleDraft();if(!design)return;const valid=design.preview({worlds:Number(byId('constructor-worlds').value),seeds:byId('constructor-seeds').value.split(/[\s,;]+/).filter(Boolean).map(Number)});byId('constructor-run').disabled=!valid||busy||isOtherActive();return valid;}
 design=installExperimentDesign({readCommon,onChange:updateDesign,onError:error});
 function readCommon(){const result={terrainSeed:EXPERIMENT_TERRAIN_SEED};for(const [key,input]of controls)put(result,key,input.type==='checkbox'?input.checked:String(input.value).trim()===''?NaN:Number(input.value));result.foodGeneralSettings=!Number.isInteger(result.foodRegrowInterval)||result.foodRegrowInterval>300||result.foodRegrowInterval<10||result.foodIslandCount===0;return result;}
 function readPlan(){const common=readCommon();if(baseGenome)common.baseGenome=baseGenome;return validatePlan({name:byId('constructor-name').value,worlds:Number(byId('constructor-worlds').value),steps:Number(byId('constructor-steps').value),budget:Number(byId('constructor-budget').value),maxWorkers:Number(cap.value),allocation:byId('constructor-allocation').value,seeds:byId('constructor-seeds').value.split(/[\s,;]+/).filter(Boolean).map(Number),common,factors:design.read()});}
 function fill(input){if(input.protocolId&&!EXPERIMENT_PLAN_PROTOCOLS.includes(input.protocolId)||!Array.isArray(input.factors))throw new Error('Нужен новый план с наборами значений параметров; старые планы не поддерживаются.');const plan=validatePlan(input);for(const [key,node]of controls){const value=get(plan.common,key)??get(defaults,key);if(node.type==='checkbox')node.checked=value;else node.value=value;}for(const [id,value]of [['name',plan.name],['worlds',plan.worlds],['steps',plan.steps],['budget',plan.budget],['workers',plan.maxWorkers],['allocation',plan.allocation]])byId('constructor-'+id).value=value;seedPool=plan.seeds;baseGenome=plan.common.baseGenome??null;byId('constructor-base').value='';byId('constructor-base-note').textContent=baseGenome?'Загруженная основа генома':'Случайные геномы';design.write(plan.factors);showSeeds();}

 function saveDraft(){if(restoring)return;try{preferences.saveDraft({meta:Object.fromEntries(['name','worlds','steps','budget','workers','allocation','seeds'].map(id=>[id,byId('constructor-'+id).value])),common:Object.fromEntries([...controls].map(([key,node])=>[key,node.type==='checkbox'?node.checked:node.value])),factors:design.snapshot(),baseGenome,seedPool});}catch(e){byId('constructor-storage').textContent=e.message;}}
 const factoryPlan=readPlan();
 function resetDraft(){restoring=true;try{fill(preferences.standard()??factoryPlan);}finally{restoring=false;}saveDraft();}
 byId('constructor-restore-defaults').addEventListener('click',()=>{try{resetDraft();error('');}catch(e){error(e.message);}});
 byId('constructor-new').addEventListener('click',()=>{try{resetDraft();byId('test-tab-constructor').click();}catch(e){error(e.message);}});
 byId('constructor-make-defaults').addEventListener('click',()=>{try{if(preferences.saveStandard(readPlan()))byId('constructor-storage').textContent='Личные стандартные настройки сохранены.';}catch(e){error(e.message);}});
 for(const name of ['input','change'])byId('test-panel-constructor').addEventListener(name,scheduleDraft);
 globalThis.addEventListener?.('pagehide',saveDraft);
 try{const draft=preferences.draft();if(draft){if(!draft.meta||!draft.common||!Array.isArray(draft.factors))throw new Error('Черновик повреждён.');for(const [id,value]of Object.entries(draft.meta))if(['name','worlds','steps','budget','workers','allocation','seeds'].includes(id))byId('constructor-'+id).value=value;for(const [key,node]of controls)if(Object.hasOwn(draft.common,key)){if(node.type==='checkbox')node.checked=Boolean(draft.common[key]);else node.value=draft.common[key];}baseGenome=draft.baseGenome?validateGenomeFile(draft.baseGenome):null;seedPool=draft.seedPool??seedPool;design.write(draft.factors);byId('constructor-base-note').textContent=baseGenome?'Загруженная основа генома':'Случайные геномы';}else if(preferences.standard())fill(preferences.standard());}catch(e){fill(factoryPlan);error('Не удалось восстановить форму: '+e.message);}finally{restoring=false;}
 byId('constructor-base').addEventListener('change',async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>100000)throw new Error('Слишком большой файл генома.');baseGenome=validateGenomeFile(JSON.parse(await file.text()));byId('constructor-base-note').textContent='Загруженная основа генома';scheduleDraft();}catch(e){error(e.message);}});
 byId('constructor-clear-base').addEventListener('click',()=>{baseGenome=null;byId('constructor-base').value='';byId('constructor-base-note').textContent='Случайные геномы';scheduleDraft();});
 function templateCard(name,action){const button=make('button',name);button.className='template-card';button.addEventListener('click',()=>{try{action();}catch(e){error(e.message);}});return button;}
 for(const template of EXPERIMENT_TEMPLATES)byId('constructor-builtins').append(templateCard(template.name,()=>{fill({name:template.name,factors:template.factors});byId('test-tab-constructor').click();}));
 async function savedTemplates(){try{const names=[];for(const name of await store.templates()){const p=await store.template(name);if(EXPERIMENT_PLAN_PROTOCOLS.includes(p?.protocolId)&&Array.isArray(p.factors))names.push(name);}byId('constructor-saved-templates').replaceChildren(...names.map(name=>templateCard(name,async()=>{try{fill(await store.template(name));byId('test-tab-constructor').click();}catch(e){error(e.message);}})));}catch{}}
 byId('constructor-save-template').addEventListener('click',async()=>{try{const plan=readPlan();await store.saveTemplate(plan.name,plan);await savedTemplates();byId('constructor-storage').textContent='Шаблон сохранён в этом браузере.';}catch(e){error(e.message);}});savedTemplates();
 byId('constructor-export-plan').addEventListener('click',async()=>{try{await downloadExperiment('big-evolution-experiment-plan.json',{format:'big-evolution-experiment-plan',version:EXPERIMENT_PLAN_VERSION,plan:readPlan()});}catch(e){error(e.message);}});
 byId('constructor-import-plan').addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>16000000)throw new Error('Слишком большой план.');const data=JSON.parse(await f.text());if(data.format!=='big-evolution-experiment-plan'||![2,EXPERIMENT_PLAN_VERSION].includes(data.version))throw new Error('Нужен план опытов v2/v3 с наборами значений параметров. Старые планы не поддерживаются.');fill(data.plan);}catch(e){error(e.message);}});
 function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,1500);}
 function save(){clearTimeout(saveTimer);if(!report)return;const current=report;saveChain=saveChain.catch(()=>{}).then(()=>store.save(current)).catch(e=>{byId('constructor-storage').textContent=e.message;});return saveChain;}
 let lastRender=0,lastRevision=-1,lastSourcesKey=null;
 const series=new ExperimentSeries({onChange:r=>{if(report!==r||lastRevision!==r.dataRevision)statsCache=null;report=r;lastRevision=r.dataRevision;if(!series.active||performance.now()-lastRender>500){lastRender=performance.now();render();}queueSave();},onFinish:async()=>{await save();await release();await runList();render();}});
 fetch('./build-info.json').then(r=>r.ok?r.json():null).then(build=>series.build=build).catch(()=>{});
 async function release(started=true){const state=lease;lease=null;let message=started?'Опыты завершены.':'Опыты не запущены.';try{if(state?.running)await resumeWorld(state);message+=state?.running?' Основной мир продолжает моделирование.':' Основной мир остаётся на паузе.';}catch(e){message+=' Основной мир не удалось возобновить: '+e.message;}finally{busy=false;onBusyChange();announce(message);}}
 byId('constructor-run').addEventListener('click',async()=>{if(busy||importing||exporting||isOtherActive())return;try{const plan=readPlan();busy=true;onBusyChange();lease=getWorldState();await pauseWorld();announce(lease.running?'Основной мир приостановлен. Опыты начаты.':'Опыты начаты. Основной мир остаётся на паузе.');error('');series.start(plan);byId('test-tab-runs').click();}catch(e){error(e.message);if(series.active)series.stop(true);else if(lease)await release(false);}});
 byId('constructor-stop').addEventListener('click',()=>series.stop());byId('constructor-force-stop').addEventListener('click',()=>series.stop(true));
 byId('constructor-export').addEventListener('click',async()=>{
  if(!report||exporting||importing)return;const button=byId('constructor-export'),status=byId('constructor-export-state'),plain=byId('constructor-export-format').value==='json';exporting=true;button.disabled=true;status.textContent='Подготовка файла…';
  try{const selected=report,name='big-evolution-experiment-'+selected.createdAt.replace(/[:.]/g,'-'),onProgress=bytes=>{status.textContent=`Подготовка ${plain?'JSON':'архива'}: ${(bytes/1048576).toFixed(1)} МиБ…`;};let bytes;
   if(plain)bytes=await downloadExperiment(name+'.json',snapshotExperiment(await materializeExperiment(selected)),{onProgress});
   else{const blob=await experimentArchive(selected,{onProgress});bytes=blob.size;saveJsonBlob(name+'.beexp',blob);}
   status.textContent=`${plain?'JSON':'Архив'} подготовлен: ${(bytes/1048576).toFixed(1)} МиБ. Файл передан браузеру для скачивания.`;
  }
  catch(e){status.textContent='Не удалось подготовить или передать файл: '+e.message;error(status.textContent);}
  finally{exporting=false;button.disabled=!report;}
 });
 async function runList(){try{const list=await store.list();byId('constructor-archive').replaceChildren(...list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>{const row=make('div');row.className='constructor-archive-row';const open=make('button',`${r.plan.name} · ${r.status} · ${new Date(r.createdAt).toLocaleString('ru-RU')}`),del=make('button','Удалить');open.disabled=busy||importing;del.disabled=busy||importing;open.addEventListener('click',async()=>{try{if(busy||importing)return;const next=validateExperimentReport(await store.load(r.createdAt));report=next;statsCache=null;windowKey=null;lastSourcesKey=null;render();sourceChanged(true);}catch(e){error(e.message);}});del.addEventListener('click',async()=>{try{if(busy||importing)return;await store.delete(r.createdAt);await runList();}catch(e){error(e.message);}});row.append(open,del);return row;}));}catch(e){byId('constructor-storage').textContent=e.message;}}
 runList();
 byId('constructor-import-report').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;const status=byId('constructor-export-state');
  try{if(busy||importing||exporting)throw new Error('Сначала завершите текущую операцию.');importing=true;render();status.textContent='Проверка файла опытов…';
   let next=validateExperimentReport(await readExperimentFile(f,{onProgress:(done,total)=>{status.textContent=`Проверка блоков: ${done}/${total}…`;}}));
   // Старый JSON тоже переводится в блоки. До полной проверки сохраняется
   // прежний выбранный опыт; отмена/ошибка не очищает его статистику.
   if(!next.groups.some(g=>g.attempts.some(a=>archiveOrigin(a.lives)||archiveOrigin(a.live))))next=await openExperimentArchive(await experimentArchive(next,{onProgress:bytes=>{status.textContent=`Упаковка JSON: ${(bytes/1048576).toFixed(1)} МиБ…`;}}),{validate:false});
   if(['running','stopping'].includes(next.status)){next.status='interrupted';for(const g of next.groups){if(['running','pending'].includes(g.status))g.status='interrupted';for(const a of g.attempts)if(a.status==='running')a.status='interrupted';}}
   report=next;statsCache=null;windowKey=null;lastSourcesKey=null;error('');status.textContent='Опыт открыт. Истории будут загружаться для выбранных миров и периодов.';render();sourceChanged(true);await save();
  }catch(e){error(e.message);status.textContent='Файл не открыт: '+e.message;}
  finally{importing=false;render();await runList();}
 });
 const source=byId('experiment-stat-source'),weight=byId('experiment-stat-weight'),stat=byId('experiment-stat-line');
 const grouping=installExperimentGrouping({onChange:()=>{statsCache=null;updateStatNote();sourceChanged(false);}});
 const runs=installExperimentRuns({openAttempt:id=>{source.value='attempt:'+id;changeSource();openStatistics();},openVariant:id=>{source.value='variant:'+id;changeSource();openStatistics();}});
 function updateSources(){const key=report?.createdAt+'|'+report?.groups.map(g=>g.attempts.map(a=>a.id+Boolean(a.lives||a.live)).join(',')).join(';');if(key===lastSourcesKey)return;lastSourcesKey=key;const previous=source.value,options=[['current','Текущий мир']];if(report){options.push(['compare',`${report.plan.name} · сравнение вариантов`]);for(const v of report.plan.variants){options.push(['variant:'+v.id,v.name+' · выбранные попытки']);for(const g of report.groups.filter(g=>g.variantId===v.id))for(const a of g.attempts)if(a.lives||a.live)options.push(['attempt:'+a.id,`${v.name} · мир ${g.index+1} · попытка ${a.number} · seed ${a.seed}`]);}}
  source.replaceChildren(...options.map(([value,label])=>{const o=make('option',label);o.value=value;return o;}));source.value=options.some(o=>o[0]===previous)?previous:'current';}
 function render(){
  const active=busy||importing;byId('constructor-run').disabled=active||isOtherActive();updateDesign();byId('constructor-stop').disabled=!series.active;byId('constructor-force-stop').disabled=!series.active;byId('constructor-export').disabled=!report||exporting||importing;
  if(importing)byId('constructor-run').disabled=true;byId('constructor-import-report').disabled=busy||importing||exporting;
  if(report){const done=report.groups.filter(g=>g.status==='completed').length,attempts=report.groups.reduce((n,g)=>n+g.attempts.length,0),queued=report.groups.filter(g=>g.status==='pending').length;byId('constructor-progress').textContent=`${report.plan.name} · ${runStatus(report.status)} · завершено миров ${done}/${report.groups.length} · запусков ${attempts} · активных миров ${series.slots.length} · в очереди ${queued}`;
   if(!byId('panel-tests').hidden&&!byId('test-panel-runs').hidden)runs.render(report);
  }
  updateSources();observeSelection();updateStatNote();
 }
 function observeSelection(){const selected=source.value;series.observe(selected.startsWith('attempt:')?[selected.slice(8)]:[]);}
 function changeSource(){statsCache=null;observeSelection();updateStatNote();sourceChanged(true);}
 source.addEventListener('change',changeSource);
 weight.addEventListener('change',()=>{statsCache=null;updateStatNote();sourceChanged(false);});
 stat.addEventListener('change',()=>{updateStatNote();sourceChanged(false);});
 function data(){
  grouping.refresh(report,source.value!=='current');
  const selected=source.value;if(selected==='current'||!report)return null;
  if(statsCache?.source===selected&&statsCache.weight===weight.value)return statsCache;
  let result=null,comparisons=null,grouped=[],problem='';
  if(selected.startsWith('attempt:')){const id=selected.slice(8),a=report.groups.flatMap(g=>g.attempts).find(a=>a.id===id);result=a?.lives??a?.live??null;if(result)registerAnalysisWorlds(result,[{id,report:result,targetTick:report.plan.steps,extinct:Boolean(a.extinct)}]);}
  else{const variants=selected==='compare'?report.plan.variants:report.plan.variants.filter(v=>'variant:'+v.id===selected);try{grouped=groupedExperimentSources(report,variants,grouping.read(),weight.value);}catch(e){problem=e.message;}const sources=grouped.filter(s=>s.report);result=sources[0]?.report??null;if(selected==='compare'){comparisons=sources;if(result){const first=result;result={...first,tick:Math.max(...sources.map(s=>s.report.tick))};registerAnalysisWorlds(result,analysisWorlds(first));}}}
  const pairVariants=comparisons?grouped.map(({report,...rest})=>rest):null;
  statsCache={source:selected,weight:weight.value,report:result,comparisons,pairVariants,error:problem};return statsCache;
 }
 function prepareStatistics({start=0,end=null,width=100,curveStart=0,windows:extra=[]}){
  const selected=source.value;if(selected==='current'||!report)return null;
  if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(start)||start<0||end!==null&&(!Number.isSafeInteger(end)||end<=start)||!Number.isSafeInteger(curveStart)||curveStart<0)throw new Error('Неверный период статистики.');
  const attempts=report.groups.flatMap(g=>selected==='compare'?g.status==='completed'?g.attempts.filter(a=>a.id===g.selectedId):[]:selected==='variant:'+g.variantId?g.status==='completed'?g.attempts.filter(a=>a.id===g.selectedId):[]:g.attempts.filter(a=>selected==='attempt:'+a.id));
  const targets=attempts.map(a=>({a,key:a.lives?'lives':'live'})).filter(t=>t.a[t.key]);
  const last=end??historyDomainEnd(Math.max(0,...targets.map(t=>t.a[t.key].tick)),width),windows=normalizeChartWindows([[start,last],[curveStart,curveStart+width],...extra]);
  if(targets.every(t=>archiveWindowReady(t.a[t.key],windows)))return null;
  const key=JSON.stringify([report.createdAt,selected,windows]);if(windowTask&&windowKey===key)return windowTask;
  const current=report;windowKey=key;
  const task=(async()=>{const loaded=[];for(const t of targets)loaded.push(await loadArchiveWindow(t.a[t.key],windows));
   if(report!==current||source.value!==selected||windowKey!==key)return;
   targets.forEach((t,i)=>t.a[t.key]=loaded[i]);statsCache=null;
  })();windowTask=task;task.finally(()=>{if(windowTask===task)windowTask=null;}).catch(()=>{});return task;
 }
 async function exportObservation(){
  const selected=source.value;if(selected==='current'||!report)return null;
  const chosen={...report,groups:report.groups.filter(g=>selected==='compare'||selected==='variant:'+g.variantId||g.attempts.some(a=>selected==='attempt:'+a.id)).map(g=>({...g,attempts:g.attempts.filter(a=>selected.startsWith('attempt:')?selected==='attempt:'+a.id:a.id===g.selectedId)}))};
  const full=await materializeExperiment(chosen);
  if(selected.startsWith('attempt:')){const a=full.groups.flatMap(g=>g.attempts)[0];return a?.lives??a?.live??null;}
  const variant=full.plan.variants.find(v=>selected==='compare'||selected==='variant:'+v.id);return mergeLifeReports(reportSources(full,variant.id),weight.value);
 }
 byId('constructor-open-comparison').addEventListener('click',()=>{source.value='compare';changeSource();openStatistics();});
 function updateStatNote(){
  const node=byId('experiment-stat-note'),d=data();node.replaceChildren();if(source.value==='current')return;
  if(d?.error){node.textContent=d.error;return;}
  node.textContent=d?.report?'Итоги выбранных попыток; неудачные старты видны в разделе «Запуски». '+(weight.value==='worlds'?'Каждый непустой мир имеет равный вес в метриках особей. ':'Каждая особь имеет равный вес в метриках жизней. ')+'Население и пища: сначала среднее по времени каждого мира, затем равный вес миров. ':'Пока нет данных для выбранного источника. ';
  if(d?.comparisons){node.append(make('span','Таблица жизней и маркеры возраста относятся к первой группе; графики и сводки сравнивают выбранные группы. Связанные варианты одного повтора не считаются независимыми мирами в ДИ. Цвета: '));for(const s of d.comparisons){const label=make('span',s.name+' · ');label.style.color=s.color;node.append(label);}for(const s of d.pairVariants)if(!d.comparisons.some(c=>c.id===s.id))node.append(make('span',s.name+': пока нет полного набора результатов. '));}
 }

 setInterval(()=>{if(!byId('panel-history').hidden&&source.value!=='current'){updateStatNote();sourceChanged();}},5000);
 updateDesign();render();
 return {analysisSeries:()=>source.value==='compare'||source.value.startsWith('variant:')?report:null,isActive:()=>busy||importing,refresh:render,prepareStatistics,exportObservation,report:()=>source.value==='current'?null:data()?.report,getSimulation:()=>source.value==='current'?getSimulation():{lives:data()?.report??EMPTY_REPORT},comparisons:()=>{const d=data();return d?.comparisons?{sources:d.comparisons,statistic:stat.value,variants:d.pairVariants,weightMode:weight.value}:null;}};
}
