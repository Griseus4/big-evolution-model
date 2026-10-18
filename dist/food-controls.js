/** Общие поля нового опыта и живущего мира; сами поля не изменяют симуляцию. */
import {FOOD_LIMITS,SOURCE_CAPACITY_LIMITS} from './food-settings.js';
import {foodDistribution} from './food-distribution.js';
const format=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
export function readFoodControls(prefix='',root=document){
 const field=name=>root.getElementById(prefix+'food-'+name),mean=field('capacity-mean'),spread=field('capacity-spread'),capacity=mean?Number(mean.value):null,range=spread?Number(spread.value)/100:0;
 return {foodSources:Number(field('sources').value),foodRegrowInterval:Number(field('period').value),
  foodIslandCount:Number(field('islands').value),foodPeriodSpread:Number(field('period-spread').value),foodSizeSpread:Number(field('size-spread').value),
  ...(mean?{foodGeneralSettings:true,foodCapacityMin:Math.max(SOURCE_CAPACITY_LIMITS.min,Math.round(capacity*(1-range))),foodCapacityMax:Math.min(SOURCE_CAPACITY_LIMITS.max,Math.round(capacity*(1+range)))}:{})};
}
export function installFoodControls(prefix='',root=document){
 const field=name=>root.getElementById(prefix+'food-'+name),general=field('capacity-mean');
 const fields=[['sources','источников'],['period','Т'],['period-spread','%'],['size-spread','%'],...(general?[['size-mean','источников на островок'],['capacity-mean','порций'],['capacity-spread','%']]:[])];
 const update=()=>{for(const [name,unit]of fields){root.getElementById(prefix+'food-'+name+'-value').textContent=`${format(field(name).value)} ${unit}`;const number=field(name+'-number');if(number&&number.ownerDocument?.activeElement!==number)number.value=field(name).value;}};
 for(const [name]of fields)field(name).addEventListener('input',update);
 if(general){
  const updateSize=()=>{const n=Number(field('sources').value),count=Math.min(Number(field('islands').value),n);field('size-mean').value=count?(n-Math.min(Math.floor(n*FOOD_LIMITS.scatteredFraction),n-count))/count:0;update();};
  for(const name of ['sources','islands'])field(name).addEventListener('input',updateSize);
  field('size-mean').addEventListener('input',()=>{const count=Number(field('islands').value);field('sources').value=Math.max(count,Math.min(FOOD_LIMITS.sourcesMax,Math.round(Number(field('size-mean').value)*count/(1-FOOD_LIMITS.scatteredFraction))));updateSize();});
  updateSize();
  for(const [name]of fields){const number=field(name+'-number');if(!number)continue;number.addEventListener('change',()=>{
   const n=Number(number.value);if(!Number.isFinite(n)||n<Number(number.min)||n>Number(number.max)||name==='sources'&&!Number.isInteger(n)){number.setCustomValidity('Значение вне допустимого диапазона или требует целого числа.');number.reportValidity();return;}
   number.setCustomValidity('');const control=field(name);control.min=Math.min(Number(control.min),n);control.max=Math.max(Number(control.max),n);control.step='any';control.value=n;
   if(name==='size-mean'){const count=Number(field('islands').value);field('sources').value=Math.max(count,Math.min(FOOD_LIMITS.sourcesMax,Math.round(n*count/(1-FOOD_LIMITS.scatteredFraction))));updateSize();}
   else if(name==='sources')updateSize();else update();
  });}
 }
 update();return update;
}
export function syncFoodControls(prefix,settings,root=document){
 const field=name=>root.getElementById(prefix+'food-'+name);
 for(const [name,value]of [['sources',settings.sourceCount],['period',settings.regrowInterval],['islands',settings.requestedIslandCount],['period-spread',settings.periodSpread],['size-spread',settings.sizeSpread],['size-mean',settings.sizeMean],['capacity-mean',settings.capacityMean],['capacity-spread',settings.capacitySpread]]){
  const control=field(name);if(!control||value===undefined)continue;
  if(['period','period-spread','size-spread'].includes(name)&&field('capacity-mean')){control.min=name==='period'?.1:0;control.step='any';control.max=Math.max(name==='period'?300:90,Math.ceil(value*1.25));}
  control.value=value;
 }
}
/** Только изменение ревизии/режима вызывает сводку, без обхода карты в кадре. */
export function installLiveFoodControls({element,getWorld,refresh}){
 let revision=null,enabled=null;
 function update(){
  const w=getWorld();if(!w?.foodSettings)return;const automatic=Boolean(w.automaticEnvironment?.enabled);
  if(revision===w.environmentRevision&&enabled===automatic)return;
  if(automatic||enabled===null){syncFoodControls('world-',foodDistribution(w),{getElementById:element});refresh();}
  revision=w.environmentRevision;enabled=automatic;
  for(const name of ['sources','period','islands','period-spread','size-spread','size-mean','capacity-mean','capacity-spread'])for(const suffix of name==='islands'?['']:['', '-number']){const control=element('world-food-'+name+suffix);if(control)control.disabled=automatic;}
  element('world-food-relocate').disabled=automatic;element('world-food-apply').disabled=automatic;
  element('world-food-live-note').textContent=automatic?'Поля показывают текущие условия. Для ручного изменения выключи автоматику на соседнем экране.':'Ручное редактирование доступно. Изменения вступят в силу после применения.';
 }
 return {update,reset(){revision=null;enabled=null;update();}};
}
