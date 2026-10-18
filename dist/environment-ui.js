import {ENVIRONMENT_DEFAULTS} from './environment-settings.js';
export function installEnvironmentUI({element,command,getWorld}){
 const enabled=element('environment-enabled'),preparation=element('environment-preparation-interval'),random=element('environment-random-interval'),status=element('environment-status');let pending=false;
 enabled.checked=ENVIRONMENT_DEFAULTS.enabled;preparation.value=ENVIRONMENT_DEFAULTS.preparationInterval;random.value=ENVIRONMENT_DEFAULTS.randomInterval;
 async function apply(){if(pending)return;pending=true;try{await command('environment',{enabled:enabled.checked,preparationInterval:Number(preparation.value),randomInterval:Number(random.value)});status.textContent='Настройки применены; отсчёт интервала начат заново.';}catch(error){status.textContent=error.message;update();}finally{pending=false;}}
 enabled.addEventListener('change',apply);element('environment-apply').addEventListener('click',apply);
 function update(){const s=getWorld()?.automaticEnvironment;if(!s)return;enabled.checked=s.enabled;if(preparation.ownerDocument?.activeElement!==preparation)preparation.value=s.preparationInterval;if(random.ownerDocument?.activeElement!==random)random.value=s.randomInterval;
  status.textContent=`${s.enabled?(s.phase==='preparation'?`Обеднение ${s.completedSteps}/5`:'Случайные изменения'):'Автоматика выключена'}. Выработка ${s.production.toFixed(3)} порции/Т; минимум ${s.minimumRate}. ${s.nextTick===null?'':`Следующее событие: ${s.nextTick} Т.`} ${s.blockedReason??''}`;
 }
 return {update,settings:()=>({enabled:enabled.checked,preparationInterval:Number(preparation.value),randomInterval:Number(random.value)})};
}
