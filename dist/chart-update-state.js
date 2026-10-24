/** Индикатор принадлежит карточке, а не всему дашборду. Старый рисунок и числа
 * остаются вместе до готовности всех выбранных источников нового результата. */
export function chartUpdateState(root,c,pending){
 if(!c.updateNote){c.updateNote=root.createElement('p');c.updateNote.className='history-card-status';c.updateNote.setAttribute('role','status');if(c.card.insertBefore)c.card.insertBefore(c.updateNote,c.canvas);else c.card.append(c.updateNote);}
 if(pending&&!c.pending)c.card.style?.setProperty?.('--pending-height',`${c.card.getBoundingClientRect?.().height??0}px`);
 c.pending=pending;c.card.setAttribute('data-updating',String(pending));c.card.setAttribute('aria-busy',String(pending));
 c.updateNote.textContent=pending?'Обновляется…'+(c.displayEstimates||c.displayDifference||c.result?' Показаны данные предыдущих настроек.':''):'';
}
