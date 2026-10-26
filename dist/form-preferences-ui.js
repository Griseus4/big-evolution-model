import {experimentPreferences} from './experiment-preferences.js';
/** Черновик допускает незавершённый ввод; стандарт проходит проверку.
 * Восстановление меняет форму, не текущий мир/опыт. */
export function installFormPreferences({doc=document,host,key,controls,validate=()=>{},refresh=()=>{},readExtra=()=>null,writeExtra=()=>{}}){
 const make=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const bar=make('div'),standard=make('button','Сделать стандартными'),reset=make('button','Сбросить к заводским'),message=make('p');bar.className='lab-controls';standard.type=reset.type='button';message.className='note';message.setAttribute('role','status');bar.append(standard,reset);host.append(bar,message);
 let storage;try{storage=globalThis.localStorage;}catch{}
 const preferences=experimentPreferences(storage,text=>message.textContent=text,key);
 const capture=()=>({fields:Object.fromEntries([...controls].map(([key,n])=>[key,n.type==='checkbox'?n.checked:n.value])),extra:readExtra()});
 const factory=capture();let restoring=false,queued=false;
 function apply(value){if(!value?.fields||typeof value.fields!=='object')throw new Error('Некорректные сохранённые настройки.');restoring=true;try{writeExtra(value.extra);for(const [key,n]of controls)if(Object.hasOwn(value.fields,key)){if(n.type==='checkbox')n.checked=value.fields[key]===true;else n.value=value.fields[key];}refresh();}finally{restoring=false;}}
 function save(){queued=false;if(!restoring)preferences.saveDraft(capture());}
 const schedule=()=>{if(!queued){queued=true;queueMicrotask(save);}};
 for(const n of controls.values())for(const event of ['input','change'])n.addEventListener(event,schedule);
 standard.addEventListener('click',()=>{try{validate();if(preferences.saveStandard(capture()))message.textContent='Личные стандартные настройки сохранены.';}catch(e){message.textContent=e.message;}});
 reset.addEventListener('click',()=>{try{apply(factory);save();message.textContent='Заводские настройки восстановлены. Текущий мир не изменён.';}catch(e){message.textContent=e.message;}});
 try{const saved=preferences.draft()??preferences.standard();if(saved)apply(saved);}catch(e){try{apply(factory);}catch{}message.textContent='Не удалось восстановить настройки: '+e.message;}
 globalThis.addEventListener?.('pagehide',save);
 return {save:schedule};
}
