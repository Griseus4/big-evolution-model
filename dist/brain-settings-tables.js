import {MUTATION_GROUPS,MUTATION_LABELS} from './brain-evolution-rules.js';
const create=(doc,tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mutationSettingsTable(doc,controls,{percent=true}={}){
 const box=create(doc,'div'),table=create(doc,'table');box.className='brain-settings-scroll';table.className='brain-settings-table';
 const head=create(doc,'tr');for(const text of ['Блок','Мутации','Вероятность'+(percent?', %':', доля'),'Сила'])head.append(create(doc,'th',text));table.append(head);
 for(const key of MUTATION_GROUPS){const row=create(doc,'tr');row.append(create(doc,'th',MUTATION_LABELS[key]));
  for(const name of ['mutationEnabled.'+key,'initialMutation.'+key+'.rate','initialMutation.'+key+'.strength']){
   const cell=create(doc,'td'),input=controls.get(name);input.setAttribute('aria-label',MUTATION_LABELS[key]+': '+(name.startsWith('mutationEnabled')?'мутации потомков':name.endsWith('rate')?'начальная вероятность':'начальная сила'));cell.append(input);row.append(cell);
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
