/** Событийный сценарий среды. Между событиями — только проверка срока.
 * Черновик имеет собственный RNG и группы; живой мир меняется одним проходом
 * после проверки выработки. Запасы пищи не переносятся и не создаются. */
import {Random} from './simulation.js';
import {islandScheduleSummary} from './food-islands.js';
import {ENVIRONMENT_SCHEMA,ENVIRONMENT_DEFAULTS,ENVIRONMENT_RULES as R,validateEnvironmentSettings,foodProduction} from './environment-settings.js';
import {DT} from './action-timing.js';
import {foodDistribution} from './food-distribution.js';
import {prepareEnvironmentPlan} from './environment-plan.js';
const preparing=e=>e.completedSteps<R.preparationSteps&&!e.preparationCancelled;
function reason(w,options){return !w.individualFood?'Автоматика требует индивидуальных источников.':foodProduction(w)<options.minimumRate*(1-1e-12)?`Выработка ниже выбранного минимума ${options.minimumRate} порции/Т.`:'';}
export function initializeEnvironment(w,input=ENVIRONMENT_DEFAULTS){
 const options=validateEnvironmentSettings(input),blocked=reason(w,options);
 w.automaticEnvironment={schema:ENVIRONMENT_SCHEMA,...options,enabled:options.enabled&&!blocked,completedSteps:0,preparationCancelled:false,random:new Random(w.seed^0x1f8c57ab),events:0,blockedReason:blocked,lastError:'',nextTick:null};
 resetEnvironmentTimer(w);
}
function interval(e){return preparing(e)?e.preparationInterval:e.randomInterval;}
function resetEnvironmentTimer(w){const e=w.automaticEnvironment;e.nextTick=e.enabled?w.tick+interval(e):null;}
export function configureEnvironment(w,input){
 const e=w.automaticEnvironment,options=validateEnvironmentSettings({...e,...input}),blocked=reason(w,options);
 if(options.enabled&&blocked)throw new Error(blocked+' Автоматика не включена.');
 const restart=options.enabled!==e.enabled||options.preparationInterval!==e.preparationInterval||options.randomInterval!==e.randomInterval;
 Object.assign(e,options);e.blockedReason=blocked;e.lastError='';if(restart)resetEnvironmentTimer(w);return environmentStatus(w);
}
export function manualEnvironmentChange(w){
 const e=w.automaticEnvironment;if(!e)return;e.preparationCancelled=true;e.completedSteps=R.preparationSteps;e.blockedReason=reason(w,e);e.lastError='';if(e.blockedReason)e.enabled=false;resetEnvironmentTimer(w);
}
export function environmentStatus(w){const e=w.automaticEnvironment;return e?{...e,random:undefined,production:foodProduction(w),phase:preparing(e)?'preparation':'random'}:null;}
function applyPlan(w,plan){
 for(const c of w.tiles)c.maxFood=0;
 for(const g of plan.groups){
  for(const p of g.sources)w.tile(p.x,p.y).maxFood=p.capacity;
  g.sources=g.sources.map(({x,y})=>({x,y}));
  g.nextTick=Math.round((w.tick+Math.max(DT,g.remaining*g.period))/DT)*DT;
  g.cycleStart=w.tick-(1-g.remaining)*g.period;delete g.remaining;
 }
 w.foodIslands=plan.groups;
 w.sourceTemplate=plan.groups.flatMap(g=>g.sources.map(p=>{const c=w.tile(p.x,p.y);return {x:p.x,y:p.y,food:c.food,maxFood:c.maxFood};}));
 Object.assign(w.foodSettings,{generation:ENVIRONMENT_SCHEMA,...islandScheduleSummary(plan.groups)},foodDistribution(w));
}
export function advanceEnvironment(w){
 const e=w.automaticEnvironment;if(!e?.enabled||w.tick+1e-9<e.nextTick)return false;
 const isPreparation=preparing(e),before=foodProduction(w),beforeCount=w.foodSettings.sourceCount,beforePeriod=w.foodSettings.regrowInterval,beforeCapacity=w.tiles.reduce((n,c)=>n+c.maxFood,0);
 // Копии метаданных достаточно: планировщик только читает исходные клетки,
 // а источники копирует. Биологические RNG не участвуют в событии среды.
 const draft={...e,random:new Random(e.random.state)},world={...w,automaticEnvironment:draft,tile:(x,y)=>w.tile(x,y)};
 let plan;
 try{plan=prepareEnvironmentPlan(world,{preparing:isPreparation,minimumRate:e.minimumRate,maximumRate:isPreparation&&e.completedSteps<R.preparationSteps-1?Infinity:e.maximumRate});}
 catch(error){e.lastError=error.message;w.log('Изменение среды отложено',error.message);resetEnvironmentTimer(w);return false;}
 applyPlan(w,plan);e.random.state=draft.random.state;e.nextGroupId=draft.nextGroupId;e.lastError='';
 if(isPreparation)e.completedSteps++;e.events++;w.environmentRevision++;
 const entry={revision:w.environmentRevision,tick:w.tick,kind:'automatic-food',operation:isPreparation?'prepare':'random',
  before:{production:before,capacity:beforeCapacity,sourceCount:beforeCount,meanPeriod:beforePeriod},
  after:{production:plan.production,capacity:w.tiles.reduce((n,c)=>n+c.maxFood,0),sourceCount:w.foodSettings.sourceCount,meanPeriod:w.foodSettings.regrowInterval},
  proposedSourceCount:plan.proposedSourceCount,proposedPeriod:plan.proposedPeriod,countAdjusted:plan.countAdjusted,periodsAdjusted:plan.periodsAdjusted,
  moved:plan.moved,movedGroups:plan.movedGroups.map(({moved,...g})=>g),sourceCount:w.foodSettings.sourceCount,previousSourceCount:beforeCount,islandCount:w.foodIslands.filter(g=>g.kind==='island').length,
  actualProduction:plan.production,periodMin:Math.min(...w.foodIslands.map(g=>g.period)),periodMax:Math.max(...w.foodIslands.map(g=>g.period))};
 w.environmentChanges.push(entry);w.log('Изменение среды',`${isPreparation?'Подготовка':'Колебания около целей'}: ${before.toFixed(3)} → ${plan.production.toFixed(3)} порции/Т.`);resetEnvironmentTimer(w);return true;
}
