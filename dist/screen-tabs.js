/** Переключение экранов сохраняет DOM и введённые настройки. Оно не вызывает
 * Worker, паузу или перезапуск мира. Один механизм для настроек и справочника. */
export function installScreenTabs(prefix,names,root=document){
 const button=name=>root.getElementById(`${prefix}-tab-${name}`),panel=name=>root.getElementById(`${prefix}-panel-${name}`);
 function select(name,focus=false){
  if(!names.includes(name))return;
  for(const id of names){const active=id===name,b=button(id);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;panel(id).hidden=!active;}
  if(focus)button(name).focus();
 }
 for(const [i,name]of names.entries()){
  button(name).addEventListener('click',()=>select(name));
  button(name).addEventListener('keydown',e=>{const index=(e.key==='ArrowRight'||prefix==='wiki'&&e.key==='ArrowDown')?(i+1)%names.length:(e.key==='ArrowLeft'||prefix==='wiki'&&e.key==='ArrowUp')?(i+names.length-1)%names.length:e.key==='Home'?0:e.key==='End'?names.length-1:null;if(index===null)return;e.preventDefault();select(names[index],true);});
 }
 select(names[0]);return {select};
}
