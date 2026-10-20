/** Только представление серии: одна ячейка на вариант, не на попытку.
 * Строим строки лишь для текущей страницы и меняем текст на месте: сообщения
 * прогресса не сбрасывают фокус, раскрытые попытки и внутреннюю прокрутку. */
const PAGE_SIZE=6;
const STATUS={pending:'В очереди',running:'Выполняется',completed:'Завершён',failed:'Ошибка',stopped:'Остановлен',interrupted:'Прерван','not-started':'Не запускался',stopping:'Останавливается','completed-with-errors':'Завершён с ошибками'};
export const runStatus=status=>STATUS[status]??status;
export const selectedRun=group=>group.attempts.find(a=>a.id===group.selectedId)??group.attempts.at(-1);
const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
const tick=value=>Number(value??0).toFixed(1);
export function environmentSeedText(settings){
 const seed=key=>settings?.[key]===undefined?'seed жителей':`seed ${settings[key]}`;
 return `Карта: ${seed('terrainSeed')} · пища: ${seed('foodSeed')}`;
}
export function installExperimentRuns({root=document,openAttempt,openVariant}){
 const byId=id=>root.getElementById(id),make=(tag,value)=>{const n=root.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
 const grid=byId('constructor-results'),previous=byId('constructor-results-prev'),next=byId('constructor-results-next');
 let report=null,page=0,cells=[];
 function build(){
  const groups=new Map(report.plan.variants.map(v=>[v.id,[]]));
  for(const g of report.groups)groups.get(g.variantId)?.push(g);
  cells=report.plan.variants.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(v=>{
   const card=make('section'),heading=make('h3',v.name),summary=make('p'),seeds=make('p',environmentSeedText(v.settings)),view=make('button','Статистика варианта'),scroll=make('div'),table=make('table'),head=make('thead'),header=make('tr'),body=make('tbody');
   card.className='panel experiment-variant-cell';summary.className=seeds.className='note';scroll.className='experiment-worlds-window';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',`Миры: ${v.name}`);
   for(const label of ['Мир / попытки','Состояние','Выполнено, Т','Данные']){const th=make('th',label);th.scope='col';header.append(th);}head.append(header);table.append(head,body);scroll.append(table);card.append(heading,seeds,summary,view,scroll);
   view.addEventListener('click',()=>openVariant(v.id));
   const rows=groups.get(v.id).map(g=>{
    const row=make('tr'),identity=make('td'),details=make('details'),title=make('summary',`Мир ${g.index+1}`),attempts=make('div'),state=make('td'),status=make('span'),seed=make('small'),warning=make('small'),progressCell=make('td'),progress=make('progress'),amount=make('small'),data=make('td'),button=make('button','Смотреть');
    progress.max=report.plan.steps;progress.setAttribute('aria-label',`Прогресс мира ${g.index+1}`);details.append(title,attempts);identity.append(details);state.append(status,seed,warning);progressCell.append(progress,amount);data.append(button);row.append(identity,state,progressCell,data);body.append(row);
    button.addEventListener('click',()=>{const a=selectedRun(g);if(a?.lives||a?.live)openAttempt(a.id);});
    const entry={g,title,details,attempts,status,seed,warning,progress,amount,button,attemptKey:null};
    details.addEventListener('toggle',()=>{if(details.open)updateAttempts(entry);});return entry;
   });return {card,summary,rows,view};
  });
  grid.replaceChildren(...cells.map(c=>c.card));
 }
 function updateAttempts(row){
  if(!row.details.open)return;
  const {g}=row,key=JSON.stringify(g.attempts.map(a=>[a.id,a.status,a.tick,a.extinct,a.error?.message,a.allocationError,g.selectedId]));
  if(key===row.attemptKey)return;row.attemptKey=key;
  row.attempts.replaceChildren(...g.attempts.map(a=>{
   const line=make('p',`Попытка ${a.number} · seed жителей ${a.seed} · ${runStatus(a.status)} · ${tick(a.tick)} Т${a.extinct?' · вымирание':''}${g.selectedId===a.id?' · выбрана для итогов':''}`);
   if(a.extinct||a.error)line.className='extinction-warning';
   if(a.error)line.append(make('span',` · ${a.error.message}`));
   if(a.allocationError)line.append(make('span',` · ${a.allocationError}`));return line;
  }));
 }
 function update(){
  const pages=Math.ceil(report.plan.variants.length/PAGE_SIZE);
  previous.disabled=page===0;next.disabled=page>=pages-1;text(byId('constructor-results-page'),`Сочетания ${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,report.plan.variants.length)} из ${report.plan.variants.length}`);
  for(const cell of cells){
   let done=0,running=0,pending=0,extinct=0,errors=0,available=false;
   for(const row of cell.rows){
    const {g}=row,a=selectedRun(g),losses=g.attempts.filter(a=>a.extinct).length;
    done+=g.status==='completed';running+=g.status==='running';pending+=g.status==='pending';errors+=g.status==='failed';extinct+=losses;available||=Boolean(a?.lives||a?.live);
    text(row.title,`Мир ${g.index+1} · ${g.attempts.length}/3`);text(row.status,runStatus(g.status));text(row.seed,a?`Попытка ${a.number} · seed жителей ${a.seed}`:`Начальный seed ${report.plan.seeds[g.index]}`);
    text(row.warning,losses?`Вымираний: ${losses}${g.selectedId&&g.attempts.every(a=>a.extinct)?' · итог — самая длительная попытка':''}`:'');row.warning.className=losses?'extinction-warning':'';
    row.status.className=g.status==='failed'?'extinction-warning':'';row.progress.value=Math.min(a?.tick??0,report.plan.steps);
    const workers=a?.progress?.computeWorkers??a?.computationChanges?.at(-1)?.workers;
    text(row.amount,`${tick(a?.tick)} / ${report.plan.steps}${workers?` · вычислителей ${workers}`:''}`);row.button.disabled=!a?.lives&&!a?.live;updateAttempts(row);
   }
   text(cell.summary,`Завершено ${done}/${cell.rows.length} · активно ${running} · очередь ${pending} · ошибок ${errors} · вымираний ${extinct}`);cell.view.disabled=!available;
  }
 }
 previous.addEventListener('click',()=>{if(page>0){page--;build();update();}});
 next.addEventListener('click',()=>{if(report&&(page+1)*PAGE_SIZE<report.plan.variants.length){page++;build();update();}});
 return {render(value){if(report!==value){report=value;page=0;build();}update();}};
}
