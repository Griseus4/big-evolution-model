/** Только успешное подтверждение исчезает через 3 с. Новое сообщение в том же
 * поле отменяет прежний таймер; ошибки остаются до явного исправления. */
export function transientStatus(node){let timer=null;return (message,{success=false}={})=>{clearTimeout(timer);node.textContent=message;if(success)timer=setTimeout(()=>{if(node.textContent===message)node.textContent='';},3000);};}
