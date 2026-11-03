import {energyPreview,previewBrain,ENERGY_PREVIEW} from './energy-preview.js';
import {formatStatistic} from './statistics-format.js';
/** Один отложенный пересчёт на серию событий формы; только один образец
 * топологии, фиксированный seed, без запуска моделирования/создания карты. */
export function installEnergyPreview({doc=document,host,read}){
 const make=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const box=make('section');box.className='energy-preview';box.append(make('h3','Хватит ли энергии на мозг?'));
 const label=make('label','Перемещений на одну порцию'),moves=make('input');moves.type='number';moves.min=1;moves.max=ENERGY_PREVIEW.maxMoves;moves.step=1;moves.value=ENERGY_PREVIEW.moves;label.append(moves);
 const food=make('select'),calls=make('input');for(const [i,name]of ['Трава','Плоды','Мясо'].entries()){const option=make('option',name);option.value=i;food.append(option);}food.value=0;calls.type='number';calls.min=0;calls.step='any';calls.value=1;const foodLabel=make('label','Тип пищи'),callsLabel=make('label','Основных вызовов / Т');foodLabel.append(food);callsLabel.append(calls);
 const table=make('table'),result=make('p'),note=make('p');result.setAttribute('role','status');note.className='note';const details=make('details');details.append(make('summary','Условия расчёта'),note);const caption=make('p','Условный режим с доступной пищей. Оценка начальной структуры, не прогноз выживания.');caption.className='note';box.append(label,foodLabel,callsLabel,table,result,caption,details);host.append(box);
 let key='',brain=null,queued=false;
 function refresh(){queued=false;try{
  const options=read(),shape=JSON.stringify([options.baseGenome,options.initialNeurons,options.initialConnections,options.attentionInitialNeurons,options.attentionInitialConnections,options.maxNeurons,options.maxLayers,options.attentionMaxNeurons,options.attentionMaxLayers,Boolean(options.physiology)]);
  if(shape!==key||!brain){brain=previewBrain(options);key=shape;}
  const v=energyPreview(options,brain,Number(moves.value),{foodType:Number(food.value),callsPerT:Number(calls.value)}),f=n=>formatStatistic(n,4).replace(/,0000$/,'');
  const rows=[['Энергия / Т','Оценка'],['Поступление из пищи','+'+f(v.food)],...(v.base!==undefined?[['Содержание тела и пищеварения','−'+f(v.base)],['Движение, сбор, еда','−'+f(v.motor)]]:[['Движение, сбор, еда, ожидание','−'+f(v.physical)]]),['Основной выбор','−'+f(v.main)],['Обучение','−'+f(v.learning)],['Малый мозг','−'+f(v.attention)],['Остаток для накопления',(v.net>=0?'+':'−')+f(Math.abs(v.net))]];
  table.replaceChildren(...rows.map((row,i)=>{const tr=make('tr');row.forEach(t=>tr.append(make(i?'td':'th',t)));return tr;}));
  result.textContent=v.net>=0?`В этом режиме энергии хватает: запас ${f(v.net)} / Т до заполнения тела.`:`В этом режиме не хватает ${f(-v.net)} энергии / Т.`;
  if(v.spent>v.ceiling)result.textContent+=' Расходы выше даже предела усвоения при достатке еды.';
  result.className=v.net<0?'error':'energy-preview-positive';
  foodLabel.hidden=callsLabel.hidden=!options.physiology;
  note.textContent=(options.physiology?`За один приём ${f(v.portion)} порции выбранной пищи; в среднем ${f(v.gathers)} действий сбора на приём. Время еды не зависит от объёма. `:'')+`Условный цикл: ${moves.value} перемещений на порцию → сбор запаса → еда; ожидание при ограничении усвоения. В движении ${f(100*v.moving)}% времени; основных вызовов ${f(v.calls)}/Т, проверок малого мозга ${f(v.gateChecks)}/Т. Обзор ${ENERGY_PREVIEW.cells} клеток, ${ENERGY_PREVIEW.candidates} вариантов, обычная ставка без скидки повторения; верхняя оценка подготовки входов малого мозга. Еда доступна при сборе, роды исключены. Для случайной связности — один фиксированный образец. Это проверка бюджета начальной структуры, не прогноз выживания или эволюции.`;
 }catch(e){table.replaceChildren();result.className='error';result.textContent=e.message;note.textContent='Исправьте параметры формы для расчёта.';}}
 const schedule=()=>{if(queued)return;queued=true;queueMicrotask(refresh);};
 for(const node of [moves,food,calls])node.addEventListener('input',schedule);refresh();return {refresh:schedule,moves,food,calls};
}
