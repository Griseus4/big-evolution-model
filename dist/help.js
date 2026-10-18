/** Справка относится только к наблюдателю. Открытие не расходует RNG, не меняет
 * геном и не добавляет знаний жителям. Тексты хранятся централизованно, чтобы
 * у одинаковых настроек обычной игры и испытаний был одинаковый смысл.
 * Нативный dialog открывается кликом/Enter/Space, удерживает фокус и закрывается
 * Escape. Поэтому помощь доступна на телефоне и с клавиатуры, без hover.
 */
import {HELP,ALIASES} from './ui-text.js';
export {HELP,ALIASES} from './ui-text.js';
export function createHelpButton(key){
 const button=document.createElement('button');button.type='button';button.className='help-trigger';button.dataset.help=ALIASES[key]??key;
 button.textContent='?';button.setAttribute('aria-label',`Подсказка: ${HELP[button.dataset.help][0]}`);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','help-dialog');return button;
}
export function installHelp(){
 const dialog=document.getElementById('help-dialog'),title=document.getElementById('help-title'),body=document.getElementById('help-body');let opener=null;
 const ranges=new Set();
 for(const [id,key]of [...Object.keys(HELP).map(id=>[id,id]),...Object.entries(ALIASES)]){
  const control=document.getElementById(id);if(!control||control.hidden||control.type==='hidden')continue;
  // Составной диапазон делит справку с числовым полем. Дополнительная
  // обёртка разрушила бы общую дорожку двух нативных ползунков.
  if(control.dataset.helpShared){if(!document.getElementById(control.dataset.helpShared))throw new Error('Нет связанного поля справки: '+id);control.title=HELP[key][1];continue;}
  // У ползунка и числового ввода одна подпись и одна подсказка.
  const range=control.closest('.range-setting');
  if(range){if(!ranges.has(range)){range.querySelector('.range-heading').append(createHelpButton(key));ranges.add(range);}continue;}
  // Кнопка помощи — сосед label, а не интерактивный элемент внутри него:
  // нажатие вопроса не должно переключать checkbox или активировать действие.
  const label=control.closest('label');
  if(label||control.tagName==='BUTTON'){
   const target=label??control,wrapper=document.createElement('div');wrapper.className='help-control'+(label?(control.type==='checkbox'?'':' help-field'):' help-action');target.before(wrapper);wrapper.append(target,createHelpButton(key));
  }else if(['population','births','deaths','generation','lineages'].includes(id))control.parentElement.querySelector('small').append(createHelpButton(key));
  else{
   const wrapper=document.createElement('div');wrapper.className='help-explained';
   control.before(wrapper);wrapper.append(control,createHelpButton(key));
  }
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-help]');if(!button)return;
  event.preventDefault();event.stopPropagation();const entry=HELP[button.dataset.help];if(!entry)return;
  opener=button;title.textContent=entry[0];body.textContent=entry[1];dialog.showModal();
 });
 document.getElementById('help-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{
  // Панель тела обновляется во время наблюдения. Если её прежняя кнопка уже заменена,
  // возвращаем фокус на новую кнопку той же подсказки, а не на исчезнувший узел.
  const fallback=[...document.querySelectorAll('[data-help]')].find(b=>b.dataset.help===opener?.dataset.help&&!b.closest('[hidden]'));
  (opener?.isConnected?opener:fallback)?.focus();
 });
}
