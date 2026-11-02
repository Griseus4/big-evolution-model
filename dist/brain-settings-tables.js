import {NUMERIC_MUTATION_GROUPS} from './numeric-mutation.js';
import {MUTATION_GROUPS,MUTATION_LABELS} from './brain-evolution-rules.js';
import {createHelpButton} from './help.js';
const create=(doc,tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mutationSettingsTable(doc,controls,{percent=true}={}){
 if(controls.has('initialMutation.behavior.shape'))return numericSettingsTable(doc,controls,percent);
 const box=create(doc,'div'),table=create(doc,'table');box.className='brain-settings-scroll';table.className='brain-settings-table';
 const head=create(doc,'tr');for(const [text,key]of [['Блок','mutation-founders'],['Мутации','mutation-enabled'],['Вероятность'+(percent?', %':', доля'),'mutation-probability'],['Сила','mutation-strength']]){const th=create(doc,'th');th.append(createHelpButton(key,text,doc));head.append(th);}table.append(head);
 for(const key of MUTATION_GROUPS){const row=create(doc,'tr'),name=create(doc,'th');name.append(createHelpButton('mutation-block-'+key,MUTATION_LABELS[key],doc));row.append(name);
  for(const name of ['mutationEnabled.'+key,'initialMutation.'+key+'.rate','initialMutation.'+key+'.strength']){
   const cell=create(doc,'td'),input=controls.get(name);input.setAttribute('aria-label',MUTATION_LABELS[key]+': '+(name.startsWith('mutationEnabled')?'мутации потомков':name.endsWith('rate')?'начальная вероятность':'начальная сила'));input.setAttribute('data-help',name.startsWith('mutationEnabled')?'mutation-enabled':name.endsWith('rate')?'mutation-probability':'mutation-strength');cell.append(input);row.append(cell);
  }table.append(row);
 }box.append(table);return box;
}
export function structureSettingsTable(doc,title,neurons,layers,initial,percent){
 const box=create(doc,'fieldset');box.className='brain-settings-block';box.append(create(doc,'legend',title));
 const table=create(doc,'table');table.className='brain-settings-table';
 for(const [text,input]of [['Предел нейронов',neurons],['Предел слоёв',layers],['Начальные нейроны по слоям',initial],['Начальная связность, %',percent]]){
  const row=create(doc,'tr'),cell=create(doc,'td');input.setAttribute('aria-label',title+': '+text);cell.append(input);row.append(create(doc,'th',text),cell);table.append(row);
 }box.append(table);return box;
}

function numericSettingsTable(doc,controls,percent){
 const box=create(doc,'div');box.className='brain-settings-scroll';
 for(const numeric of [true,false]){
  const table=create(doc,'table');table.className='brain-settings-table';table.append(create(doc,'caption',numeric?'Числовые гены: каждый существующий параметр меняется при рождении':'Структура: отдельные события изменения нейронов и связей'));
  const head=create(doc,'tr');for(const text of ['Блок','Включено',numeric?'Форма A':'Вероятность'+(percent?', %':', доля'),numeric?'Потолок r':'Сила'])head.append(create(doc,'th',text));table.append(head);
  for(const key of MUTATION_GROUPS.filter(k=>NUMERIC_MUTATION_GROUPS.includes(k)===numeric)){
   const row=create(doc,'tr'),name=create(doc,'th');name.append(createHelpButton('mutation-block-'+key,MUTATION_LABELS[key],doc));row.append(name);
   for(const suffix of ['enabled',...(numeric?['shape','ceiling']:['rate','strength'])]){
    const n=controls.get(suffix==='enabled'?'mutationEnabled.'+key:'initialMutation.'+key+'.'+suffix),cell=create(doc,'td');
    n.setAttribute('aria-label',MUTATION_LABELS[key]+': '+suffix);n.title=suffix==='shape'?'A задаёт распределение величины изменения. Каждый числовой ген мутирует; это не вероятность события.':suffix==='ceiling'?'r ограничивает прибавку долей от большего из модуля текущего значения и опорного масштаба. Минимальная прибавка сохраняет подвижность нулевых весов.':suffix==='enabled'?'Выключение фиксирует параметры блока и его регуляторы при рождении. Личное обучение задаётся отдельно.':suffix==='rate'?'Вероятность отдельного структурного события при рождении.':'Масштаб числа изменяемых нейронов и связей.';
    cell.append(n);row.append(cell);
   }table.append(row);
  }box.append(table);
 }return box;
}
