/** Сохраняем DOM прокручиваемого контейнера и существующих строк. Даже на
 * паузе обновление текста не заменяет узел, которому принадлежит scrollTop.
 * Индексы подходят здесь для фиксированного порядка признаков, не для памяти. */
export function updateTextRows(container,values){
 const top=container.scrollTop;
 for(let i=0;i<values.length;i++){
  let row=container.children[i];if(!row){row=container.ownerDocument.createElement('div');container.append(row);}
  if(row.textContent!==values[i])row.textContent=values[i];
 }
 while(container.children.length>values.length)container.lastElementChild.remove();
 container.scrollTop=top;
 return container;
}
