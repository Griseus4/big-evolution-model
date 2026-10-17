/** Краткая история жизни принадлежит наблюдателю, а не мозгу.
 * Здесь нет пошаговых снимков, RNG или обратной связи в выбор действий.
 * Обычная игра хранит одну компактную строку на смерть. Испытания могут ограничить
 * число подробных строк; накопительная статистика при этом учитывает ВСЕ смерти.
 */
import {ACTION_COUNT,DEPOSIT_ACTION} from './policy-layout.js';
import {reproductionCounters} from './reproduction.js';
import {cognitionPlaces} from './cognition-summary.js';
export const MODEL_VERSION='0.33.0';
export const CAUSE_LABELS={starvation:'Истощение',injury:'Повреждения',age:'Предел возраста'};
export function createLifeCounters(){return {samples:0,energyTotal:0,healthTotal:0,painTotal:0,
 hungerSteps:0,emptyEnergySteps:0,painSteps:0,gathered:0,eaten:0,deposited:0,moved:0,injuries:0,damage:0,
 firstMealAge:null,lastMealAge:null,maxMealGap:0,actions:Array(ACTION_COUNT).fill(0),reproduction:reproductionCounters()};}
export function sampleLife(a){
 const c=a.life;c.samples++;c.energyTotal+=a.energy;c.healthTotal+=a.health;c.painTotal+=a.pain;
 // Порог 30 служит описательной статистике, не новой потребностью или наградой.
 c.hungerSteps+=Number(a.energy<30);c.emptyEnergySteps+=Number(a.energy===0);c.painSteps+=Number(a.pain>1);
 if(a.lastAction!==null){c.actions[a.lastAction]++;c.moved+=Number(a.lastAction<6);c.gathered+=Number(a.lastAction===6);c.eaten+=Number(a.lastAction===7);c.deposited+=Number(a.lastAction===DEPOSIT_ACTION);}
 // Сохраняем лишь три числа, без ленты событий. Начальный отрезок от рождения
 // считается без еды; последний отрезок добавляется в lifeRow, включая живых.
 // Это интервал между действиями «съесть», не измерение времени без усвоения.
 if(a.lastAction===7){c.maxMealGap=Math.max(c.maxMealGap,a.age-(c.lastMealAge??0));c.firstMealAge??=a.age;c.lastMealAge=a.age;}
 c.injuries+=Number(a.lastDamage>0);c.damage+=a.lastDamage;
}
/** Для живого возраст — незавершённое наблюдение (censored), не возраст смерти.
 * Чувство усредняется по собственным шагам. Геном и память в строку не включаются.
 */
export function lifeRow(a,born,tick,cause=null){
 const c=a.life,n=c.samples;
 const result={id:a.id,parentId:a.parentId,founderId:a.founderId,generation:a.generation,born,
 endTick:tick,age:a.age,status:cause?'dead':'alive',censored:!cause,cause,children:a.children,
 meanEnergy:n?c.energyTotal/n:null,meanHealth:n?c.healthTotal/n:null,meanPain:n?c.painTotal/n:null,
 meanFeeling:a.brain.feelingSamples?a.brain.feelingTotal/a.brain.feelingSamples:null,
 hungerSteps:c.hungerSteps,emptyEnergySteps:c.emptyEnergySteps,painSteps:c.painSteps,
 gathered:c.gathered,eaten:c.eaten,deposited:c.deposited,moved:c.moved,injuries:c.injuries,damage:c.damage,
 observedSteps:n,firstMealAge:c.firstMealAge,lastMealAge:c.lastMealAge,
 maxStepsWithoutEating:Math.max(c.maxMealGap,a.age-(c.lastMealAge??0)),
 feedingActionFraction:n?(c.gathered+c.eaten)/n:null,
 actions:c.actions.slice(),reproduction:structuredClone(c.reproduction),learningUpdates:a.brain.updates,shortPlaces:cognitionPlaces(a).short,longPlaces:cognitionPlaces(a).long};
 if(a.brain.temporal){for(const k of ['meanPain','painSteps','injuries','damage'])delete result[k];const actions=c.actions.reduce((n,x)=>n+x,0);result.feedingActionFraction=actions?(c.gathered+c.eaten)/actions:null;result.timeSchema='model-time-substeps-v1';}return result;
}
function group(){return {count:0,ageTotal:0,childrenTotal:0,feelingTotal:0,feelingCount:0,ages:[],
 meals:[],eatenTotal:0,depositedTotal:0,observedSteps:0,feedingActions:0,hungerSteps:0,emptyEnergySteps:0,
 gapTotal:0,maxGap:0,minMeals:null,maxMeals:0,actions:Array(ACTION_COUNT).fill(0),reproduction:reproductionCounters(),causes:{starvation:0,injury:0,age:0}};}
function add(g,row){g.count++;g.ageTotal+=row.age;g.childrenTotal+=row.children;g.causes[row.cause]++;
 g.eatenTotal+=row.eaten;g.depositedTotal+=row.deposited??0;g.meals[row.eaten]=(g.meals[row.eaten]??0)+1;
 g.minMeals=g.minMeals===null?row.eaten:Math.min(g.minMeals,row.eaten);g.maxMeals=Math.max(g.maxMeals,row.eaten);
 g.observedSteps+=row.observedSteps;g.feedingActions+=row.gathered+row.eaten;g.hungerSteps+=row.hungerSteps;g.emptyEnergySteps+=row.emptyEnergySteps;
 g.gapTotal+=row.maxStepsWithoutEating;g.maxGap=Math.max(g.maxGap,row.maxStepsWithoutEating);
 for(let i=0;i<g.actions.length;i++)g.actions[i]+=row.actions[i]??0;
 if(row.reproduction){for(const name of ['decisions','eligible','chosen','births'])g.reproduction[name]+=row.reproduction[name];
  for(const reason of Object.keys(g.reproduction.blocked))g.reproduction.blocked[reason]+=row.reproduction.blocked[reason];}
 if(row.timeSchema)g.ageScale=10;const ageBin=Math.round(row.age*(g.ageScale??1));g.ages[ageBin]=(g.ages[ageBin]??0)+1;if(row.meanFeeling!==null){g.feelingTotal+=row.meanFeeling;g.feelingCount++;}}
function describe(g){
 let median=null;
 if(g.count){const middle=Math.floor((g.count-1)/2),upper=Math.floor(g.count/2);let n=0,lo=null;
  for(let age=0;age<g.ages.length;age++){n+=g.ages[age]??0;if(lo===null&&n>middle)lo=age;if(n>upper){median=(lo+age)/(2*(g.ageScale??1));break;}}}
 let medianMeals=null;
 if(g.count){const lower=Math.floor((g.count-1)/2),upper=Math.floor(g.count/2);let n=0,lo=null;
  for(let meals=0;meals<g.meals.length;meals++){n+=g.meals[meals]??0;if(lo===null&&n>lower)lo=meals;if(n>upper){medianMeals=(lo+meals)/2;break;}}}
 const actionCount=g.ageScale===10?g.actions.reduce((n,v)=>n+v,0):g.observedSteps;
 return {count:g.count,meanAge:g.count?g.ageTotal/g.count:null,medianAge:median,
 feeding:{meanMeals:g.count?g.eatenTotal/g.count:null,medianMeals,minMeals:g.minMeals,maxMeals:g.count?g.maxMeals:null,
  observedSteps:g.observedSteps,mealsPer1000ObservedSteps:g.observedSteps?g.eatenTotal/g.observedSteps*1000:null,
  deposited:g.depositedTotal,depositActionFraction:actionCount?g.depositedTotal/actionCount:null,
  feedingActionFraction:actionCount?g.feedingActions/actionCount:null,
  movementActionFraction:actionCount?g.actions.slice(0,6).reduce((n,v)=>n+v,0)/actionCount:null,
  hungerFraction:g.observedSteps?g.hungerSteps/g.observedSteps:null,emptyEnergyFraction:g.observedSteps?g.emptyEnergySteps/g.observedSteps:null,
  meanMaxStepsWithoutEating:g.count?g.gapTotal/g.count:null,maxStepsWithoutEating:g.count?g.maxGap:null},
 actionTotals:g.actions.slice(),reproduction:structuredClone(g.reproduction),meanChildren:g.count?g.childrenTotal/g.count:null,meanLifetimeFeeling:g.feelingCount?g.feelingTotal/g.feelingCount:null,causes:{...g.causes}};
}
export class LifeHistory{
 constructor({retain=Infinity}={}){this.retain=retain;this.rows=[];this.offset=0;this.omitted=0;
  this.all=group();this.founders=group();this.descendants=group();this.byCause=Object.fromEntries(Object.keys(CAUSE_LABELS).map(k=>[k,group()]));}
 complete(row){
  add(this.all,row);add(row.parentId===null?this.founders:this.descendants,row);add(this.byCause[row.cause],row);
  this.rows.push(row);
  if(this.rows.length-this.offset>this.retain){this.offset++;this.omitted++;}
  // Амортизированная очистка очереди: не копируем длинный массив при каждой смерти.
  if(this.offset>1024&&this.offset>this.rows.length/2){this.rows=this.rows.slice(this.offset);this.offset=0;}
 }
 retainedRows(){return this.rows.slice(this.offset);}
 summary(){return {completed:describe(this.all),founders:describe(this.founders),descendants:describe(this.descendants),
  byCause:Object.fromEntries(Object.entries(this.byCause).map(([k,g])=>[k,describe(g)])),omittedDetails:this.omitted};}
}
