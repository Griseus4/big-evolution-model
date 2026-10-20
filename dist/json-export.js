/** Сборка JSON без строки размером со весь опыт. Истории сериализуются по
 * записи; UI получает управление между порциями, файл возникает только после
 * успешной подготовки. Числа/ключи и формат данных прежние, отступов нет. */
const typed=(_,value)=>ArrayBuffer.isView(value)?Array.from(value):value;
export function snapshotExperiment(report){
 const lives=r=>r?{...r,dead:r.dead?.slice(),living:r.living?.slice()}:r;
 // Завершённые строки неизменяемы. Копируем только изменяемое членство массивов,
 // а не сотни мегабайт индивидуальных записей; новые события в экспорт не входят.
 return {...report,groups:report.groups.map(g=>({...g,attempts:g.attempts.map(a=>({...a,...(a.lives?{lives:lives(a.lives)}:{}),...(a.live?{live:lives(a.live)}:{})}))}))};
}
export function* jsonParts(value,key='',parents=new Set()){
 if(value?.toJSON)value=value.toJSON(key);
 if(value===null||typeof value!=='object'){const part=JSON.stringify(value);if(part===undefined)throw new Error('Значение нельзя представить в JSON.');yield part;return;}
 if(parents.has(value))throw new Error('Циклическая ссылка в отчёте.');parents.add(value);
 try{
  if(Array.isArray(value)||ArrayBuffer.isView(value)){
   yield '[';const length=Number(value.length??0);
   for(let i=0;i<length;i++){
    if(i)yield ',';const item=value[i];
    if(item===undefined||typeof item==='function'||typeof item==='symbol'){yield 'null';continue;}
    // Одна жизнь — ограниченная запись без мозга; stringify одной строки
    // значительно дешевле генератора по каждому её числу и ключу.
    if((key==='dead'||key==='living')&&item&&typeof item==='object')yield JSON.stringify(item,typed);
    else yield* jsonParts(item,String(i),parents);
   }yield ']';
  }else{
   yield '{';let first=true;
   for(const name of Object.keys(value)){
    const item=value[name];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;
    if(!first)yield ',';first=false;yield JSON.stringify(name)+':';yield* jsonParts(item,name,parents);
   }yield '}';
  }
 }finally{parents.delete(value);}
}
export async function jsonBlob(value,{onProgress=()=>{},yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),chunkSize=512*1024}={}){
 const encoder=new TextEncoder(),chunks=[];let parts=[],length=0,bytes=0,at=performance.now();
 const flush=()=>{if(!length)return;const chunk=encoder.encode(parts.join(''));chunks.push(chunk);bytes+=chunk.byteLength;parts=[];length=0;};
 for(const part of jsonParts(value)){
  parts.push(part);length+=part.length;
  if(length>=chunkSize||performance.now()-at>=12){flush();onProgress(bytes);await yieldControl();at=performance.now();}
 }
 flush();onProgress(bytes);return new Blob(chunks,{type:'application/json'});
}
export function saveJsonBlob(name,blob,root=document){
 const url=URL.createObjectURL(blob),a=root.createElement('a');a.href=url;a.download=name;
 // Присоединённая ссылка работает одинаково в Chrome и других браузерах.
 // Не освобождаем большой Blob через одну секунду после начала скачивания.
 try{root.body.append(a);a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
export async function downloadJson(name,value,options){const blob=await jsonBlob(value,options);saveJsonBlob(name,blob);return blob.size;}
