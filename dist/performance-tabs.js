/** Эти подвкладки меняют только показ панели, не паузу мира и не расчёт. */
export function installPerformanceTabs(root=document){
 const names=['workers','measurements'];
 function select(name,focus=false){for(const id of names){const button=root.getElementById('performance-tab-'+id);button.setAttribute('aria-selected',String(name===id));button.tabIndex=name===id?0:-1;root.getElementById('performance-panel-'+id).hidden=name!==id;}if(focus)root.getElementById('performance-tab-'+name).focus();}
 for(const [i,name]of names.entries()){
  const button=root.getElementById('performance-tab-'+name);button.addEventListener('click',()=>select(name));
  button.addEventListener('keydown',event=>{const next=event.key==='ArrowRight'||event.key==='ArrowLeft'?names[1-i]:event.key==='Home'?names[0]:event.key==='End'?names[1]:null;if(next){event.preventDefault();select(next,true);}});
 }
 select('workers');return {select};
}
