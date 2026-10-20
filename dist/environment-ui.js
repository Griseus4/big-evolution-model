import {ENVIRONMENT_DEFAULTS,validateEnvironmentSettings} from './environment-settings.js';
import {formatNumber as format} from './ui-numbers.js';
const fields={targetSources:'environment-target-sources',targetPeriod:'environment-target-period',minimumRate:'environment-minimum-rate',maximumRate:'environment-maximum-rate',preparationInterval:'environment-preparation-interval',randomInterval:'environment-random-interval'};
export function installEnvironmentUI({element,command,getWorld}){
 const enabled=element('environment-enabled'),status=element('environment-status'),error=element('environment-error'),button=element('environment-apply');
 const controls=Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,element(id)]));
 const lower=element('environment-rate-start'),upper=element('environment-rate-end'),range=element('environment-rate-range');
 let pending=false,dirty=false,lastSignature=null,lastWorld=null,lastTick=0;
 const number=n=>Number(n)>0&&Number(n)<.1?Number(n).toPrecision(3):format(n);
 function read(){return validateEnvironmentSettings({enabled:enabled.checked,...Object.fromEntries(Object.entries(controls).map(([key,control])=>[key,Number(control.value)]))});}
 function paintRange(){
  const lo=Number(controls.minimumRate.value),hi=Number(controls.maximumRate.value),min=Number(lower.min),max=Number(lower.max);
  lower.value=lo;upper.value=hi;range.style.setProperty('--range-from',`${(lo-min)/(max-min)*100}%`);range.style.setProperty('--range-to',`${(hi-min)/(max-min)*100}%`);
 }
 function syncRange(){
  const lo=Number(controls.minimumRate.value),hi=Number(controls.maximumRate.value);if(!(lo>0&&hi>lo))return;
  const min=Math.min(1e-9,lo),max=Math.max(10,hi>Number.MAX_VALUE/1.2?hi:hi*1.2);
  for(const slider of [lower,upper]){slider.min=min;slider.max=max;slider.step='any';}paintRange();
 }
 function write(s){enabled.checked=s.enabled;for(const [key,control]of Object.entries(controls))control.value=s[key];syncRange();}
 write(ENVIRONMENT_DEFAULTS);
 async function apply(){
  if(pending)return;let settings;try{settings=read();}catch(e){error.textContent=e.message;return;}
  pending=true;for(const control of [button,enabled,lower,upper,...Object.values(controls)])control.disabled=true;
  try{await command('environment',settings);dirty=false;error.textContent='';update();}
  catch(e){error.textContent=e.message;enabled.checked=getWorld()?.automaticEnvironment?.enabled??false;}
  finally{pending=false;for(const control of [button,enabled,lower,upper,...Object.values(controls)])control.disabled=false;}
 }
 enabled.addEventListener('change',()=>{dirty=true;return apply();});button.addEventListener('click',apply);
 for(const control of Object.values(controls))control.addEventListener('input',()=>{dirty=true;syncRange();});
 for(const [slider,key,other]of [[lower,'minimumRate','maximumRate'],[upper,'maximumRate','minimumRate']])slider.addEventListener('input',()=>{
  const value=Number(Number(slider.value).toPrecision(4)),edge=Number(controls[other].value);dirty=true;
  if(value>0&&(key==='minimumRate'?value<edge:value>edge))controls[key].value=value;
  // Шкала не меняется во время перетаскивания; обе ручки используют один max.
  paintRange();
 });
 function update(){
  const world=getWorld(),s=world?.automaticEnvironment;if(!s)return;
  const signature=JSON.stringify(Object.keys(ENVIRONMENT_DEFAULTS).map(k=>s[k]));
  if(world!==lastWorld||world.tick<lastTick||signature!==lastSignature){dirty=false;error.textContent='';}
  if(!dirty)write(s);lastSignature=signature;lastWorld=world;lastTick=world.tick;
  status.textContent=`${s.enabled?(s.phase==='preparation'?`Подготовка ${s.completedSteps}/5`:'Колебания около целей'):'Автоматика выключена'}. Сейчас: ${world.foodSettings?.sourceCount??'—'} источников, средний период ${number(world.foodSettings?.regrowInterval)} Т; выработка ${number(s.production)} порции/Т. Диапазон ${number(s.minimumRate)}–${number(s.maximumRate)} порции/Т. ${s.nextTick===null?'':`Следующее событие: ${format(s.nextTick)} Т.`} ${s.lastError||s.blockedReason||''}`;
 }
 return {update,settings:read,reset:()=>{dirty=false;lastSignature=null;update();}};
}
