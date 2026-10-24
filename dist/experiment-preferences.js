/** Только форма наблюдателя: черновик не меняет личный стандартный набор.
 * Храним малые настройки, не результаты опытов. Сбой/quota не блокирует работу. */
const KEY='big-evolution-experiment-preferences-v1';
export function experimentPreferences(storage,onError=()=>{}){
 let state={version:1,draft:null,standard:null};
 try{const saved=JSON.parse(storage?.getItem(KEY)??'null');if(saved?.version===1)state={...state,...saved};}catch{onError('Не удалось прочитать настройки формы. Доступны исходные настройки.');}
 const save=()=>{try{if(!storage)throw new Error();storage.setItem(KEY,JSON.stringify(state));return true;}catch{onError('Браузер не сохранил настройки формы. Скачайте план для сохранности.');return false;}};
 return {
  draft:()=>state.draft,standard:()=>state.standard,
  saveDraft(value){state.draft=value;return save();},
  saveStandard(value){state.standard=value;return save();},
 };
}
