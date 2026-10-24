/** Объединяет движения расчётного ползунка; change немедленно фиксирует итог.
 * Не используется для масштаба: готовые данные рисуются сразу. */
export function deferredControl(apply,delay=200){
 let timer=null;
 const cancel=()=>{clearTimeout(timer);timer=null;};
 return {input(){cancel();timer=setTimeout(()=>{timer=null;apply();},delay);},flush(){cancel();apply();},cancel};
}
