/** Индикатор принадлежит карточке, а не всему дашборду. Старый рисунок и числа
 * остаются вместе до готовности всех выбранных источников нового результата. */
export function chartUpdateState(root,c,pending){
 if(!c.updateNote){c.updateNote=root.createElement('p');c.updateNote.className='history-card-status';c.updateNote.setAttribute('role','status');if(c.card.insertBefore)c.card.insertBefore(c.updateNote,c.canvas);else c.card.append(c.updateNote);}
 c.pending=pending;c.card.setAttribute('data-updating',String(pending));c.card.setAttribute('aria-busy',String(pending));
 const description=pending?'Обновление данных.'+(c.displayEstimates||c.displayDifference||c.result?' Показан последний готовый результат.':''):'';
 c.updateNote.textContent=pending?'Обновление…':'';c.updateNote.title=description;c.updateNote.setAttribute('aria-label',description);
}
