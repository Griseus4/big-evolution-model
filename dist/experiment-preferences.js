/** Только форма наблюдателя: черновик не меняет личный стандартный набор.
 * Храним малые настройки, не результаты опытов. Сбой/quota не блокирует работу. */
import {splitMutationForm} from './mutation-form-migration.js';
const KEY='big-evolution-experiment-preferences-v1';
export function experimentPreferences(storage,onError=()=>{},key=KEY){
 let state={version:1,draft:null,standard:null};
 try{const saved=JSON.parse(storage?.getItem(key)??'null');if(saved?.version===1)state={...state,...saved};}catch{onError('Не удалось прочитать настройки формы. Доступны исходные настройки.');}
 const original=structuredClone(state);let migrated=false;
 for(const field of ['draft','standard']){const result=splitMutationForm(state[field]);state[field]=result.value;migrated||=result.changed;}
 if(migrated){
  try{if(!storage?.getItem(key+'-before-v17'))storage?.setItem(key+'-before-v17',JSON.stringify(original));}catch{onError('Не удалось сохранить резервную копию прежней формы.');}
  onError('Прежние общие настройки скопированы в отдельные пары весов и структуры. Теперь они меняются независимо. Старые геномы не преобразованы.');
 }
 const save=()=>{try{if(!storage)throw new Error();storage.setItem(key,JSON.stringify(state));return true;}catch{onError('Браузер не сохранил настройки формы. Скачайте план для сохранности.');return false;}};
 return {
  draft:()=>state.draft,standard:()=>state.standard,
  saveDraft(value){state.draft=value;return save();},
  saveStandard(value){state.standard=value;return save();},
 };
}
