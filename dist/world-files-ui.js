/** Отмена выбора/ошибка не отправляет замену мира. Разбор большого JSON идёт
 * в Worker; старый мир заменяется только после полной проверки/готовности. */
import {MAX_WORLD_SAVE_BYTES} from './world-save.js';
export function installWorldFiles({element,command,onLoad=()=>{}}){
 const status=element('world-file-status'),save=element('world-save'),load=element('world-load'),input=element('world-load-file');let busy=false;
 async function run(task){if(busy)return;busy=true;save.disabled=true;load.disabled=true;try{await task();}catch(error){status.textContent=error.message;}finally{busy=false;save.disabled=false;load.disabled=false;}}
 save.addEventListener('click',()=>run(async()=>{status.textContent='Синхронизация и сохранение мира…';const result=await command('save-world'),url=URL.createObjectURL(new Blob([result.json],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=result.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Полный мир сохранён в файл.';}));
 load.addEventListener('click',()=>{if(!busy){input.value='';input.click();}});
 input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;void run(async()=>{if(file.size>MAX_WORLD_SAVE_BYTES)throw new Error('Сохранение больше 512 МиБ.');status.textContent='Проверка и загрузка мира…';const result=await command('load-world',{json:await file.text()});onLoad();status.textContent=`Мир № ${result.seed}, ${result.tick} Т загружен на паузе.`;});});
}
