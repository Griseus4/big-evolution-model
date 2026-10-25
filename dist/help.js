/** Справка на подписи: мышь, фокус, Enter/Space и касание. Не вызывает паузу.
 * Один общий popover обслуживает также динамические карточки без наблюдения DOM. */
import {HELP,ALIASES} from './ui-text.js';
export {HELP,ALIASES} from './ui-text.js';
export function createHelpButton(key,text){
 const span=document.createElement('span');span.className='help-label';span.dataset.help=ALIASES[key]??key;span.dataset.helpLabel='true';span.tabIndex=0;span.setAttribute('role','button');span.textContent=text??HELP[span.dataset.help]?.[0]??key;span.setAttribute('aria-label','Справка: '+span.textContent);return span;
}
export function installHelp(){
 const tooltip=document.createElement('div');tooltip.id='help-tooltip';tooltip.className='help-tooltip';tooltip.setAttribute('popover','manual');tooltip.setAttribute('role','tooltip');document.body.append(tooltip);let opener=null,timer=null;
 function hide(){clearTimeout(timer);if(tooltip.matches(':popover-open'))tooltip.hidePopover();if(opener)opener.removeAttribute('aria-describedby');opener=null;}
 function show(target){const entry=HELP[target.dataset.help];if(!entry)return;clearTimeout(timer);if(opener&&opener!==target)opener.removeAttribute('aria-describedby');opener=target;tooltip.textContent=entry[1];target.setAttribute('aria-describedby',tooltip.id);if(!tooltip.matches(':popover-open'))tooltip.showPopover();const r=target.getBoundingClientRect(),box=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(r.left,innerWidth-box.width-8))+'px';tooltip.style.top=Math.max(8,r.bottom+8+box.height<=innerHeight?r.bottom+8:r.top-box.height-8)+'px';}
 function labelHelp(label,key){if(label.querySelector('[data-help]'))return;const nodes=[...label.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());if(!nodes.length)return;const span=createHelpButton(key,nodes.map(n=>n.textContent).join('').trim());nodes[0].before(span);for(const node of nodes)node.remove();}
 const ranges=new Set();
 for(const [id,key]of [...Object.keys(HELP).map(id=>[id,id]),...Object.entries(ALIASES)]){
  const control=document.getElementById(id);if(!control||control.hidden||control.type==='hidden')continue;
  if(control.dataset.helpShared)continue;
  const range=control.closest('.range-setting');if(range){if(!ranges.has(range)){const label=range.querySelector('.range-heading label');if(label)labelHelp(label,key);ranges.add(range);}continue;}
  const label=control.closest('label');if(label)labelHelp(label,key);
  else if(control.tagName==='BUTTON'){control.dataset.help=key;}
  else if(['population','births','deaths','generation','lineages'].includes(id))labelHelp(control.parentElement.querySelector('small'),key);
  else{control.dataset.help=key;control.tabIndex=0;}
 }
 const delayed=target=>{if(opener===target&&tooltip.matches(':popover-open'))return;hide();timer=setTimeout(()=>show(target),700);};
 document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const target=e.target.closest?.('[data-help]');if(target)delayed(target);else if(tooltip.contains(e.target))clearTimeout(timer);});
 document.addEventListener('pointerout',e=>{if(e.pointerType==='touch')return;if(e.target.closest?.('[data-help]')||tooltip.contains(e.target)){clearTimeout(timer);timer=setTimeout(hide,150);}});
 document.addEventListener('focusin',e=>{const target=e.target.closest?.('[data-help]');if(target)delayed(target);else hide();});
 document.addEventListener('focusout',()=>{clearTimeout(timer);timer=setTimeout(hide,100);});
 document.addEventListener('click',e=>{const target=e.target.closest?.('[data-help]');if(target?.dataset.helpLabel){e.preventDefault();e.stopPropagation();show(target);}else if(target?.dataset.guideArticle||!target&&!tooltip.contains(e.target))hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();return;}const target=e.target.closest?.('[data-help]');if(target?.dataset.helpLabel&&['Enter',' '].includes(e.key)){e.preventDefault();show(target);}});
 document.addEventListener('scroll',e=>{if(!tooltip.contains(e.target))hide();},true);globalThis.addEventListener('resize',hide);
}
