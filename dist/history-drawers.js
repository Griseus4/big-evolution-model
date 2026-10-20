/** Панель наблюдателя. Кнопка в навигации переключает левый details.
 * Наведение только подсвечивает кнопку; Escape закрывает панель.
 * Прокрутка не запускает JS и не пересчитывает статистику. */
export function installHistoryDrawers(root=document,onResize=()=>{}){
 const drawer=root.getElementById('history-drawer-left'),handle=root.getElementById('history-drawer-left-handle');
 const sync=()=>{root.getElementById('history-layout').setAttribute('data-open',String(Boolean(drawer.open)));handle.setAttribute('aria-expanded',String(Boolean(drawer.open)));onResize();};
 handle.addEventListener('click',()=>{drawer.open=!drawer.open;sync();});
 drawer.addEventListener('keydown',event=>{if(event.key==='Escape'){
  event.preventDefault();event.stopPropagation();
  // Зафиксировать числовой ввод до скрытия и вернуть фокус на кнопку.
  if(drawer.contains(root.activeElement))root.activeElement.blur();
  drawer.open=false;sync();handle.focus();
 }});
 // Перенос навигации изменяет её высоту, но не требует обработчика scroll.
 const toolbar=root.querySelector?.('.global-toolbar'),panel=root.getElementById('panel-history');
 if(toolbar&&typeof ResizeObserver!=='undefined'){
  const sync=()=>panel.style.setProperty('--history-toolbar-height',`${toolbar.getBoundingClientRect().height}px`);
  new ResizeObserver(sync).observe(toolbar);sync();
 }
}
