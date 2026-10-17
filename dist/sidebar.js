/** Компактные вкладки наблюдателя: они меняют только видимость DOM.
 * Никаких шагов мира, сбросов настроек или бросков RNG здесь нет.
 * Стрелки/Home/End управляют вкладками; Tab переводит фокус в выбранный раздел.
 */
export function installSidebar(onChange){
 const names=['resident','world','new','performance'];
 const button=name=>document.getElementById(`side-tab-${name}`);
 const panel=name=>document.getElementById(`side-panel-${name}`);
 function select(name,focus=false,notify=true){
  if(!names.includes(name))return;
  for(const id of names){const active=id===name;button(id).setAttribute('aria-selected',String(active));button(id).tabIndex=active?0:-1;panel(id).hidden=!active;}
  if(focus)button(name).focus();
  if(notify)onChange?.();
 }
 for(const [i,name]of names.entries()){
  button(name).addEventListener('click',()=>select(name));
  button(name).addEventListener('keydown',event=>{
   const index=event.key==='ArrowRight'?(i+1)%names.length:event.key==='ArrowLeft'?(i+names.length-1)%names.length:event.key==='Home'?0:event.key==='End'?names.length-1:null;
   if(index===null)return;event.preventDefault();select(names[index],true);
  });
 }
 select('resident',false,false);
 const sections=['birth','position','senses','actions','learning','traits','short','long','features'];
 let residentSection='birth';
 const scroll=document.getElementById('resident-details'),positions=new Map();
 function selectResident(name,focus=false){
  if(!sections.includes(name))return;
  // Сам scroll-узел постоянный. Обновления чисел не меняют scrollTop;
  // при ручном переходе сохраняем положение отдельно для каждого раздела.
  positions.set(residentSection,scroll.scrollTop);residentSection=name;
  for(const id of sections){const active=id===name,b=document.getElementById('resident-tab-'+id);
   b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
   document.getElementById('resident-panel-'+id).hidden=!active;
  }
  scroll.scrollTop=positions.get(name)??0;
  if(focus)document.getElementById('resident-tab-'+name).focus();onChange?.();
 }
 for(const [i,name]of sections.entries()){
  const b=document.getElementById('resident-tab-'+name);
  b.addEventListener('click',()=>selectResident(name));
  b.addEventListener('keydown',event=>{
   const index=event.key==='ArrowRight'?(i+1)%sections.length:event.key==='ArrowLeft'?(i+sections.length-1)%sections.length:event.key==='Home'?0:event.key==='End'?sections.length-1:null;
   if(index===null)return;event.preventDefault();selectResident(sections[index],true);
  });
 }
 return {select,selectResident,getResidentSection:()=>residentSection};
}
