/** Чистый относительно живого мира план редкого события. Копии групп и RNG
 * принадлежат черновику; проверка периода/выработки завершается до применения. */
import {evolveFoodGroups,constrainFoodSources} from './food-island-evolution.js';
import {ENVIRONMENT_RULES as R} from './environment-settings.js';
import {FOOD_LIMITS} from './food-settings.js';
import {DT} from './action-timing.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const maxTicks=Math.round(R.maximumPeriod/DT);
export const normalEnvironmentChange=random=>Math.sqrt(-2*Math.log(1-random.next()))*Math.cos(2*Math.PI*random.next());
export const proposedEnvironmentValue=(current,target,random)=>{
 const centre=current+(target-current)*R.returnFraction;
 return centre*(1+normalEnvironmentChange(random)*R.relativeSigma);
};
export const planProduction=groups=>groups.reduce((n,g)=>n+g.sources.length/g.period,0);
const within=(rate,lo,hi)=>rate>=lo*(1-1e-12)&&rate<=hi*(1+1e-12);
function meanPeriods(groups,mean){
 const scale=mean/(groups.reduce((n,g)=>n+g.period,0)/groups.length),ticks=groups.map(g=>clamp(Math.round(g.period*scale/DT),1,maxTicks));
 let rest=Math.round(mean/DT*groups.length)-ticks.reduce((n,t)=>n+t,0);
 // Устраняем только погрешность сетки/границ: сумма соответствует заданному
 // среднему с точностью одного тика на все группы, без шума среднего в подготовке.
 for(let i=0;i<ticks.length&&rest;i++){const change=clamp(rest,1-ticks[i],maxTicks-ticks[i]);ticks[i]+=change;rest-=change;}
 groups.forEach((g,i)=>{g.period=ticks[i]*DT;});
}
function constrainPeriods(groups,minimum,maximum){
 const before=planProduction(groups);if(within(before,minimum,maximum))return false;
 const original=groups.map(g=>g.period),target=clamp(before,minimum,maximum),scale=before/target;
 const assign=(factor,round=Math.round)=>{groups.forEach((g,i)=>{g.period=clamp(round(original[i]*factor/DT),1,maxTicks)*DT;});return planProduction(groups);};
 // Сначала ближайшая граница: при росте выработки округление вниз, при
 // снижении — вверх. Это сохраняет выбранный край без лишнего сдвига периода.
 let rate=assign(scale,before<minimum?Math.floor:Math.ceil);if(within(rate,minimum,maximum))return true;
 // Узкий коридор и сетка могут конфликтовать. Монотонный поиск ограничен
 // 80 проходами только по группам; география/RNG повторно не рассчитываются.
 let lo=0,hi=R.maximumPeriod/Math.min(...original);
 for(let i=0;i<80;i++){const mid=(lo+hi)/2;rate=assign(mid);if(within(rate,minimum,maximum))return true;if(rate>maximum)lo=mid;else hi=mid;}
 throw new Error('На временной сетке 0,1 Т не удалось получить выработку в выбранном диапазоне. Расширьте диапазон.');
}
export function prepareEnvironmentPlan(world,{preparing,minimumRate,maximumRate}){
 const e=world.automaticEnvironment,random=e.random,currentCount=world.foodSettings.sourceCount,currentPeriod=world.foodSettings.regrowInterval;
 const remaining=R.preparationSteps-e.completedSteps;
 const desiredCount=preparing?currentCount+(e.targetSources-currentCount)/remaining:proposedEnvironmentValue(currentCount,e.targetSources,random);
 const desiredPeriod=preparing?currentPeriod+(e.targetPeriod-currentPeriod)/remaining:proposedEnvironmentValue(currentPeriod,e.targetPeriod,random);
 const sourceCount=clamp(Math.round(desiredCount),1,FOOD_LIMITS.sourcesMax),meanPeriod=clamp(desiredPeriod,DT,R.maximumPeriod);
 const sizeSpread=clamp((world.foodSettings.sizeSpread??30)+normalEnvironmentChange(random)*R.relativeSigma*100,0,90);
 const periodSpread=clamp((world.foodSettings.periodSpread??30)+normalEnvironmentChange(random)*R.relativeSigma*100,0,90);
 const islandCount=clamp(Math.round(Math.max(1,world.foodIslands.filter(g=>g.kind==='island').length)*(1+normalEnvironmentChange(random)*R.relativeSigma)),1,sourceCount);
 const capacityFactor=Math.max(.05,1+normalEnvironmentChange(random)*R.relativeSigma);
 const plan=evolveFoodGroups(world,{sourceCount,islandCount,sizeSpread,periodSpread,capacityFactor,normal:normalEnvironmentChange(random),meanPeriod});
 if(!plan.groups.length)throw new Error('Нет доступной суши для источников пищи.');
 meanPeriods(plan.groups,meanPeriod);
 const beforeCount=plan.groups.reduce((n,g)=>n+g.sources.length,0);
 constrainFoodSources(world,plan,minimumRate,maximumRate);
 const periodsAdjusted=constrainPeriods(plan.groups,minimumRate,maximumRate),production=planProduction(plan.groups);
 if(!within(production,minimumRate,maximumRate))throw new Error('План пищевых условий вышел за диапазон выработки.');
 const occupied=new Set();for(const g of plan.groups)for(const p of g.sources){
  const key=`${p.x},${p.y}`;if(world.tile(p.x,p.y)?.terrain!=='land'||occupied.has(key))throw new Error('Невозможно разместить источники на свободной суше.');occupied.add(key);
 }
 if(occupied.size>FOOD_LIMITS.sourcesMax)throw new Error('План превысил допустимое число источников.');
 // Журнал отражает только действительно сохранившиеся после коррекции клетки.
 const kept=new Map(plan.groups.map(g=>[g.id,new Set(g.sources.map(p=>`${p.x},${p.y}`))]));
 plan.movedGroups=plan.movedGroups.filter(g=>kept.has(g.id)).map(g=>({...g,moved:g.moved.filter(m=>kept.get(g.id).has(`${m.to.x},${m.to.y}`))}));
 plan.moved=plan.movedGroups.flatMap(g=>g.moved);
 return {...plan,proposedSourceCount:sourceCount,proposedPeriod:meanPeriod,sourceCount:plan.groups.reduce((n,g)=>n+g.sources.length,0),countAdjusted:beforeCount!==plan.groups.reduce((n,g)=>n+g.sources.length,0),periodsAdjusted,production};
}
