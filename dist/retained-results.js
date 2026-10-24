/** Ограниченный LRU только готовых численных ответов, без историй особей.
 * Смена вкладки не меняет ключ данных; новая версия отчёта даёт новый ключ. */
export function retainedResults({maxEntries=128,maxPoints=50000}={}){
 const entries=new Map();let points=0;
 const remove=key=>{const entry=entries.get(key);if(entry){points-=entry.size;entries.delete(key);}};
 return {get(key){const entry=entries.get(key);if(!entry)return;entries.delete(key);entries.set(key,entry);return entry.value;},
  set(key,value){remove(key);const size=1+(value?.points?.length??value?.cells?.length??0);entries.set(key,{value,size});points+=size;while(entries.size>maxEntries||points>maxPoints){const oldest=entries.keys().next().value;if(oldest===key&&entries.size===1)break;remove(oldest);}return value;},
  clear(){entries.clear();points=0;},size:()=>entries.size};
}
