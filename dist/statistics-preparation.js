/** Низкоприоритетная очередь: один скрытый график после видимых. Не рисует
 * Canvas и не планирует физику. При новых данных/фильтрах очередь заменяется. */
export function statisticsPreparation({allowed,ready,onChange,schedule=fn=>setTimeout(fn,160),cancel=clearTimeout}){
 let context=[],jobs=[],index=0,current=null,timer=null;
 const stopTimer=()=>{if(timer!==null)cancel(timer);timer=null;};
 function sync(parts,next){if(parts.length!==context.length||parts.some((v,i)=>v!==context[i])){stopTimer();context=parts;jobs=next;index=0;current=null;}if(!allowed()){stopTimer();current=null;}return current;}
 function pulse(){if(timer!==null||!allowed()||index>=jobs.length)return;timer=schedule(()=>{timer=null;if(!allowed()){current=null;return;}if(!ready()){pulse();return;}if(current)index++;current=jobs[index]??null;if(current)onChange();});}
 return {sync,pulse,current:()=>current,interrupt(){stopTimer();current=null;},reset(){stopTimer();context=[];jobs=[];index=0;current=null;}};
}
