/** Представление, без доступа к RNG/миру. Вкладки оставляют поля в DOM. */
export function installChoiceTabs(select,host,root=document){
 const sync=()=>{host.replaceChildren();for(const option of select.options??select.children){const button=root.createElement('button');button.type='button';button.textContent=option.textContent;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(option.value===select.value));button.tabIndex=option.value===select.value?0:-1;button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));});host.append(button);}
  const buttons=[...host.children];buttons.forEach((b,i)=>b.addEventListener('keydown',e=>{const next=e.key==='ArrowRight'?(i+1)%buttons.length:e.key==='ArrowLeft'?(i+buttons.length-1)%buttons.length:e.key==='Home'?0:e.key==='End'?buttons.length-1:null;if(next!==null){e.preventDefault();buttons[next].click();host.children[next]?.focus();}}));};
 select.addEventListener('change',sync);sync();return sync;
}
export function installConditionTabs(host,items,root=document){
 const rows=items.map(item=>item.row),nav=root.createElement('div');nav.className='screen-tablist common-tablist';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Общие условия опыта');
 const buttons=items.map(({row,title},i)=>{const b=root.createElement('button');b.type='button';b.textContent=title.textContent;title.hidden=true;b.setAttribute('role','tab');b.id='common-tab-'+i;row.id='common-panel-'+i;row.setAttribute('role','tabpanel');row.setAttribute('aria-labelledby',b.id);b.setAttribute('aria-controls',row.id);nav.append(b);return b;});
 function select(index){rows.forEach((row,i)=>{row.hidden=i!==index;buttons[i].setAttribute('aria-selected',String(i===index));buttons[i].tabIndex=i===index?0:-1;});}
 buttons.forEach((b,i)=>{b.addEventListener('click',()=>select(i));b.addEventListener('keydown',e=>{const n=e.key==='ArrowRight'?(i+1)%rows.length:e.key==='ArrowLeft'?(i+rows.length-1)%rows.length:e.key==='Home'?0:e.key==='End'?rows.length-1:null;if(n!==null){e.preventDefault();select(n);buttons[n].focus();}});});host.prepend(nav);select(0);
}
