/** Редкие локальные события: между ними только проверка срока O(1).
 * В событии обходим источники/карту, но не жителей и не их мозги. Пища не
 * переносится/не выдаётся, календарь сохраняет долю до следующего роста. */
import {Random} from './simulation.js';
import {worldDistance} from './food-layout.js';
import {FOOD_LIMITS} from './food-settings.js';
import {islandScheduleSummary} from './food-islands.js';
import {ENVIRONMENT_DEFAULTS,ENVIRONMENT_RULES as R,validateEnvironmentSettings,foodProduction} from './environment-settings.js';
import {DT} from './action-timing.js';
import {SOURCE_CAPACITY_LIMITS} from './world-edit.js';
function reason(w){return !w.individualFood?'Автоматика требует индивидуальных источников.':foodProduction(w)+1e-9<R.minimumRate?`Выработка ниже минимума ${R.minimumRate} порции/Т.`:'';}
export function initializeEnvironment(w,input=ENVIRONMENT_DEFAULTS){
 const options=validateEnvironmentSettings(input),blocked=reason(w),prepared=foodProduction(w)<=R.targetRate;
 w.automaticEnvironment={schema:'automatic-food-v1',...options,enabled:options.enabled&&!blocked,completedSteps:prepared?R.preparationSteps:0,preparationCancelled:false,random:new Random(w.seed^0x1f8c57ab),events:0,blockedReason:blocked,nextTick:null};
 resetEnvironmentTimer(w);
}
function interval(e){return e.completedSteps<R.preparationSteps&&!e.preparationCancelled?e.preparationInterval:e.randomInterval;}
function resetEnvironmentTimer(w){const e=w.automaticEnvironment;e.nextTick=e.enabled?w.tick+interval(e):null;}
export function configureEnvironment(w,input){
 const e=w.automaticEnvironment,options=validateEnvironmentSettings({...e,...input}),blocked=reason(w);
 if(options.enabled&&blocked)throw new Error(blocked+' Автоматика не включена.');
 Object.assign(e,options);e.blockedReason=blocked;resetEnvironmentTimer(w);return environmentStatus(w);
}
export function manualEnvironmentChange(w){
 const e=w.automaticEnvironment;if(!e)return;e.preparationCancelled=true;e.completedSteps=R.preparationSteps;e.blockedReason=reason(w);if(e.blockedReason)e.enabled=false;resetEnvironmentTimer(w);
}
export function environmentStatus(w){const e=w.automaticEnvironment;return e?{...e,random:undefined,production:foodProduction(w),minimumRate:R.minimumRate,targetRate:R.targetRate,phase:e.completedSteps<R.preparationSteps&&!e.preparationCancelled?'preparation':'random'}:null;}
function normal(random){return Math.sqrt(-2*Math.log(1-random.next()))*Math.cos(2*Math.PI*random.next());}
function shuffle(a,random){for(let i=a.length-1;i>0;i--){const j=Math.floor(random.next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function nearby(w,p,used,random){
 const candidates=[];for(let y=Math.max(0,p.y-R.relocationRadius);y<=Math.min(w.tiles.at(-1).y,p.y+R.relocationRadius);y++)for(let x=Math.max(0,p.x-R.relocationRadius);x<=Math.min(w.tiles.at(-1).x,p.x+R.relocationRadius);x++){
  const c=w.tile(x,y);if(c.terrain==='land'&&!used.has(c)&&worldDistance(c,p)<=R.relocationRadius)candidates.push(c);
 }
 return candidates.length?candidates[Math.floor(random.next()*candidates.length)]:null;
}
function changeSources(w,rate,capacityFactor){
 const e=w.automaticEnvironment,random=e.random,current=foodProduction(w),groups=w.foodIslands.map(g=>({...g,centre:{...g.centre},sources:g.sources.slice()}));
 let sources=groups.flatMap(g=>g.sources.map(p=>({cell:w.tile(p.x,p.y),group:g})));const beforeCount=sources.length,used=new Set(sources.map(p=>p.cell));
 const desired=Math.max(1,Math.min(FOOD_LIMITS.sourcesMax,Math.round(beforeCount*Math.sqrt(rate/current))));
 shuffle(sources,random);
 for(const p of sources.slice(desired)){p.cell.maxFood=0;used.delete(p.cell);}
 sources=sources.slice(0,desired);
 for(let n=sources.length;n<desired;n++){
  const parent=sources[Math.floor(random.next()*sources.length)];let cell=nearby(w,parent.cell,used,random);
  if(!cell){const available=w.tiles.filter(c=>c.terrain==='land'&&!used.has(c));if(!available.length)break;cell=available[Math.floor(random.next()*available.length)];}
  cell.maxFood=parent.cell.maxFood;used.add(cell);sources.push({cell,group:parent.group});
 }
 const moved=[];for(const p of sources.slice(0,Math.max(1,Math.round(sources.length*R.relocationFraction)))){
  const cell=nearby(w,p.cell,used,random);if(!cell)continue;cell.maxFood=p.cell.maxFood;p.cell.maxFood=0;used.delete(p.cell);used.add(cell);moved.push({from:{x:p.cell.x,y:p.cell.y},to:{x:cell.x,y:cell.y}});p.cell=cell;
 }
 for(const g of groups)g.sources=[];
 for(const p of sources){p.cell.maxFood=Math.max(SOURCE_CAPACITY_LIMITS.min,Math.min(SOURCE_CAPACITY_LIMITS.max,Math.round(p.cell.maxFood*capacityFactor)));p.group.sources.push({x:p.cell.x,y:p.cell.y});}
 const kept=groups.filter(g=>g.sources.length),originalPotential=kept.reduce((n,g)=>n+g.sources.length/g.period,0),scale=originalPotential/rate;
 for(const g of kept){const remaining=Math.max(0,Math.min(1,(g.nextTick-w.tick)/g.period));g.period=Math.max(DT,Math.floor(g.period*scale/DT+1e-9)*DT);g.nextTick=Math.round((w.tick+remaining*g.period)/DT)*DT;g.cycleStart=w.tick-(1-remaining)*g.period;}
 w.foodIslands=kept;const actual=foodProduction(w);
 // Ограничение временной сетки: не более одной порции/источник/подшаг.
 // Округление периода вниз сохраняет нижний порог производства.
 w.sourceTemplate=sources.map(({cell:c})=>({x:c.x,y:c.y,food:c.food,maxFood:c.maxFood}));
 const capacities=sources.map(p=>p.cell.maxFood),periods=kept.map(g=>g.period),weight=kept.reduce((n,g)=>n+g.sources.length,0);
 Object.assign(w.foodSettings,{generation:'automatic-food-v1',sourceCount:sources.length,regrowInterval:kept.reduce((n,g)=>n+g.period*g.sources.length,0)/weight,
  capacityMin:Math.min(...capacities),capacityMax:Math.max(...capacities),...islandScheduleSummary(kept)});
 return {moved,sourceCount:sources.length,previousSourceCount:beforeCount,actualProduction:actual,periodMin:Math.min(...periods),periodMax:Math.max(...periods)};
}
export function advanceEnvironment(w){
 const e=w.automaticEnvironment;if(!e?.enabled||w.tick+1e-9<e.nextTick)return false;
 const before=foodProduction(w),preparing=e.completedSteps<R.preparationSteps&&!e.preparationCancelled;
 const rate=preparing?before*Math.pow(Math.min(1,R.targetRate/before),1/(R.preparationSteps-e.completedSteps)):Math.max(R.minimumRate,before*(1+normal(e.random)*R.relativeSigma));
 const capacityFactor=preparing?Math.sqrt(rate/before):Math.max(.05,1+normal(e.random)*R.relativeSigma),beforeCapacity=w.tiles.reduce((n,c)=>n+c.maxFood,0);
 const change=changeSources(w,Math.max(R.minimumRate,rate),capacityFactor);if(preparing)e.completedSteps++;e.events++;w.environmentRevision++;
 const afterCapacity=w.tiles.reduce((n,c)=>n+c.maxFood,0),entry={revision:w.environmentRevision,tick:w.tick,kind:'automatic-food',operation:preparing?'impoverish':'random',
  before:{production:before,capacity:beforeCapacity,sourceCount:change.previousSourceCount},after:{production:change.actualProduction,capacity:afterCapacity,sourceCount:change.sourceCount},...change};
 w.environmentChanges.push(entry);w.log('Изменение среды',`${preparing?'Обеднение':'Случайное изменение'}: ${before.toFixed(3)} → ${change.actualProduction.toFixed(3)} порции/Т.`);resetEnvironmentTimer(w);return true;
}
