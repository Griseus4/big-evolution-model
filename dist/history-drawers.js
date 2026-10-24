/** Панель наблюдателя. Узкая ручка слева переключает панель.
 * Наведение только подсвечивает кнопку; Escape закрывает панель.
 * Прокрутка не запускает JS и не пересчитывает статистику. */
export function installHistoryDrawers(root=document,onResize=()=>{}){
 const drawer=root.getElementById('history-drawer-left'),handle=root.getElementById('history-drawer-left-handle');
 const sync=()=>{root.getElementById('history-layout').setAttribute('data-open',String(Boolean(drawer.open)));handle.setAttribute('aria-expanded',String(Boolean(drawer.open)));handle.textContent=drawer.open?'‹':'›';handle.setAttribute('aria-label',drawer.open?'Скрыть настройки статистики':'Открыть настройки статистики');const body=root.getElementById('history-drawer-left-body');body.inert=!drawer.open;body.setAttribute('aria-hidden',String(!drawer.open));onResize();};
 handle.addEventListener('click',()=>{drawer.open=!drawer.open;sync();});
 const close=event=>{if(event.key==='Escape'){
  event.preventDefault();event.stopPropagation();
  // Зафиксировать числовой ввод до скрытия и вернуть фокус на кнопку.
  if(drawer.contains(root.activeElement))root.activeElement.blur();
  drawer.open=false;sync();handle.focus();
 }};drawer.addEventListener('keydown',close);root.getElementById('history-layout').addEventListener('keydown',close);
 root.getElementById('history-drawer-left-body').inert=true;
 root.getElementById('history-layout').addEventListener('transitionend',event=>{if(event.propertyName==='grid-template-columns')onResize();});
 // Перенос навигации изменяет её высоту, но не требует обработчика scroll.
 const toolbar=root.querySelector?.('.global-toolbar'),panel=root.getElementById('panel-history');
 if(toolbar&&typeof ResizeObserver!=='undefined'){
  const sync=()=>panel.style.setProperty('--history-toolbar-height',`${toolbar.getBoundingClientRect().height}px`);
  new ResizeObserver(sync).observe(toolbar);sync();
 }
}
