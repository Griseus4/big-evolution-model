/** Длинные наблюдательные испытания одной и той же физики Evolution.
 * Миры изолированы, без отрисовки и общего RNG. Параллельность управляется UI;
 * здесь один мир выполняется кусками, чтобы Worker мог обработать остановку.
 */
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
import {Evolution,RULES,GENE_COUNT,validateGenomeFile,worldDistance} from './evolution.js';
import {controllerProblems,BRAIN_TYPE} from './brain-controller.js';
import {NEURAL_BRAIN_TYPE,NEURAL_GENE_COUNT,NEIGHBOUR_BRAIN_TYPE,SET_BRAIN_TYPE,layoutForType,layoutForGenes} from './neural-layout.js';
import {mutationOffset,validMutationGenes} from './mutation-parameters.js';
import {genomeMetadata} from './genome.js';
import {WORLD_DEFAULTS} from './world-defaults.js';
import {MODEL_VERSION,lifeRow} from './life-history.js';
import {validateFoodSettings} from './food-settings.js';
import {validateGeography} from './geography.js';
import {GENOME_SIZES,BIRTH_ACTION,DEPOSIT_ACTION} from './policy-layout.js';
import {reproductionProfile} from './reproduction.js';
export const DEFAULT_SEEDS=[42,23,7,71,82,104,137,203,311,419,577,811];
export const BRAIN_MODES=[
 {id:'no-memory-no-td',label:'Без памяти и TD',memory:false,learning:false},
 {id:'memory-only',label:'Память без TD',memory:true,learning:false},
 {id:'memory-and-td',label:'Память и TD',memory:true,learning:true},
];
export function validateExperimentConfig(input){
 const integer=(v,min,max,label)=>{if(!Number.isInteger(v)||v<min||v>max)throw new Error(`${label}: целое число ${min}…${max}.`);return v;};
 const seeds=input.seeds;if(!Array.isArray(seeds)||!seeds.length||seeds.length>64)throw new Error('Укажи от 1 до 64 различных seed.');
 seeds.forEach(v=>integer(v,1,4294967295,'Seed'));if(new Set(seeds).size!==seeds.length)throw new Error('Seed не должны повторяться.');
 const population=integer(input.population,1,1000,'Основателей'),limit=integer(input.limit,population,1000,'Лимит');
 const steps=integer(input.steps,1000,300000,'Шагов на мир'),parallel=integer(input.parallel,1,12,'Параллельных миров');
 const modes=input.modes??BRAIN_MODES.map(m=>m.id);if(!Array.isArray(modes)||!modes.length||modes.some(id=>!BRAIN_MODES.some(m=>m.id===id)))throw new Error('Не выбран режим мозга.');
 const food=validateFoodSettings(input),geography=validateGeography(input.geography);
 const mutationRate=input.mutationRate??WORLD_DEFAULTS.mutationRate;if(!Number.isFinite(mutationRate)||mutationRate<0||mutationRate>.3)throw new Error('Вероятность мутации вне диапазона 0…0.3.');
 const reproduction=reproductionProfile(input.reproduction).id;
 const baseGenome=input.baseGenome?validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(input.baseGenome),genes:input.baseGenome}):null;
 const brainType=baseGenome?genomeMetadata(baseGenome).brainType:input.brainType??TEMPORAL_BRAIN_TYPE;
 if(brainType!==BRAIN_TYPE&&!layoutForType(brainType))throw new Error('Неизвестный тип мозга.');
 if(brainType!==TEMPORAL_BRAIN_TYPE)throw new Error('Для новых испытаний нужен геном v13. Старые отчёты доступны только для анализа.');
 if(reproductionProfile(reproduction).automatic)throw new Error('Автоматическое размножение исключено из новых испытаний.');
 return {heritableMutations:input.heritableMutations!==false,upgradeMutationGenes:input.upgradeMutationGenes===true,individualFood:input.individualFood!==false,brainType,seeds:seeds.slice(),population,limit,steps,parallel,modes:[...new Set(modes)],
 mutations:input.mutations!==false,mutationRate,baseGenome,saveGenomes:input.saveGenomes!==false,geography,reproduction,...food};
}
export function experimentJobs(config){let id=0;return config.seeds.flatMap(seed=>config.modes.map(mode=>({id:`world-${++id}`,kind:'world',heritableMutations:config.heritableMutations,upgradeMutationGenes:config.upgradeMutationGenes,brainType:config.brainType,seed,scenario:'custom',mode,steps:config.steps,population:config.population,limit:config.limit,mutations:config.mutations,mutationRate:config.mutationRate,baseGenome:config.baseGenome,saveGenomes:config.saveGenomes,geography:config.geography,reproduction:config.reproduction,foodSources:config.foodSources,foodRegrowInterval:config.foodRegrowInterval,foodIslandCount:config.foodIslandCount,foodPeriodSpread:config.foodPeriodSpread,foodSizeSpread:config.foodSizeSpread,individualFood:config.individualFood})));}
const require=(condition,message)=>{if(!condition)throw new Error(message);};
/** Это ошибки механики, а не требования к успешной стратегии. Вымирание допустимо.
 * Проверяем на контрольных точках; отчёт не утверждает проверку каждого параметра
 * на каждом шаге. Механические фикстуры запускаются отдельно.
 */
export function checkInvariants(s){
 const b=s.balances();
 // Допуск масштабируется с оборотом энергии: миллионы дробных списаний дают
 // погрешность IEEE-754. Допуск записывается в отчёт, потеря порции его превышает.
 const energyTolerance=1e-6+1e-9*(s.initialPopulation*RULES.initialEnergy+(s.initialFood+s.stats.regrown)*RULES.foodEnergy);
 require(b.foodError===0&&Number.isFinite(b.energyError)&&Math.abs(b.energyError)<=energyTolerance,'Нарушен баланс пищи/энергии');
 require(s.temporal||s.agents.length<=s.limit,'Превышен лимит населения');require(s.lifeHistory.all.count===s.stats.deaths,'Истории не совпадают с числом смертей');
 require(s.agents.length+s.stats.deaths===s.initialPopulation+s.stats.births,'Нарушен баланс числа жизней');
 if(s.individualFood){
  const positions=s.foodIslands.flatMap(g=>g.sources.map(p=>`${p.x},${p.y}`));
  require(positions.length===s.foodSettings.sourceCount&&new Set(positions).size===positions.length,'Источники потеряны/в нескольких группах');
  require(s.tiles.filter(c=>c.maxFood>0).length===positions.length,'Расписание не охватывает источники');
  for(const g of s.foodIslands){
   require(g.sources.length>0&&Number.isInteger(g.period)&&g.period>=10&&g.period<=1600&&Number.isInteger(g.phase)&&g.phase>=0&&g.phase<g.period&&Number.isFinite(g.nextTick)&&g.nextTick>s.tick-1e-9,'Недопустимое расписание островка');
   require(g.sources.every(p=>s.tile(p.x,p.y)?.terrain==='land'&&s.tile(p.x,p.y).maxFood>0),'Источник расписания не на суше');
  }
 }
 require(s.stats.reproduction.births===s.stats.births,'Потеряны показатели рождения');
 if(!s.reproduction.automatic)require((s.temporal?s.stats.completed[BIRTH_ACTION]:s.stats.actions[BIRTH_ACTION])===s.stats.births&&s.stats.reproduction.chosen===(s.temporal?s.stats.started[BIRTH_ACTION]:s.stats.births),'Рождение не совпадает с выбранным действием');
 for(const name of ['decisions','eligible','chosen','births'])require(s.lifeHistory.all.reproduction[name]+s.agents.reduce((n,a)=>n+a.life.reproduction[name],0)===s.stats.reproduction[name],'Истории потеряли показатели размножения');
 for(const reason of Object.keys(s.stats.reproduction.blocked))require(s.lifeHistory.all.reproduction.blocked[reason]+s.agents.reduce((n,a)=>n+a.life.reproduction.blocked[reason],0)===s.stats.reproduction.blocked[reason],'Истории потеряли причину недоступности рождения');
 // Проверяем полноту новых агрегатов: обрезка подробных строк не должна
 // терять пищевые действия. Живые ещё не включены в агрегаты завершённых.
 require((s.temporal?s.stats.completed[DEPOSIT_ACTION]:s.stats.actions[DEPOSIT_ACTION])===s.stats.deposited,'Выкладывание не совпадает с действием');
 require(s.lifeHistory.all.depositedTotal+s.agents.reduce((n,a)=>n+a.life.deposited,0)===s.stats.deposited,'Истории потеряли выкладывание');
 require(s.lifeHistory.all.eatenTotal+s.agents.reduce((n,a)=>n+a.life.eaten,0)===s.stats.eaten,'Истории потеряли поедания');
 for(let i=0;i<s.stats.actions.length;i++)require(s.lifeHistory.all.actions[i]+s.agents.reduce((n,a)=>n+a.life.actions[i],0)===(s.temporal?s.stats.completed[i]:s.stats.actions[i]),'Истории потеряли действия');
 for(const a of s.agents){
  require((s.temporal?[a.energy,a.health,a.stomach]:[a.energy,a.health,a.stomach,a.pain]).every(Number.isFinite),'Неконечное состояние тела');
  require(a.energy>=0&&a.energy<=100&&a.health>0&&a.health<=100&&a.inventory>=0&&a.inventory<=RULES.inventoryCapacity&&a.stomach>=0&&a.stomach<=RULES.stomachCapacity+1e-8,'Тело вне допустимых границ');
  require(s.tile(a.x,a.y)?.terrain==='land','Житель оказался за картой или в воде');
  const mutationStart=mutationOffset(a.genome);
  require(a.genome.length===(layoutForGenes(a.genome)?.genes??(mutationStart!==null?GENE_COUNT+2:GENE_COUNT))&&a.genome.every((v,i)=>Number.isFinite(v)&&(mutationStart!==null&&i>=mutationStart||Math.abs(v)<=8)),'Недопустимый геном');
  if(mutationStart!==null)require(validMutationGenes(a.genome),'Недопустимые гены изменчивости');
  const brainErrors=controllerProblems(a.brain);require(!brainErrors.length,brainErrors.join('; '));
 }
 return {foodError:b.foodError,energyError:b.energyError,energyTolerance};
}
export async function runWorld(job,{onProgress,shouldStop}){
 const mode=BRAIN_MODES.find(m=>m.id===job.mode);if(!mode)throw new Error('Неизвестный режим мозга');
 const s=new Evolution({temporal:!job.brainType||job.brainType===TEMPORAL_BRAIN_TYPE,heritableMutations:job.heritableMutations!==false,upgradeMutationGenes:job.upgradeMutationGenes===true,seed:job.seed,brainType:job.brainType??TEMPORAL_BRAIN_TYPE,scenario:job.scenario,geography:job.geography,reproduction:job.reproduction,foodSources:job.foodSources,foodRegrowInterval:job.foodRegrowInterval,foodIslandCount:job.foodIslandCount,foodPeriodSpread:job.foodPeriodSpread,foodSizeSpread:job.foodSizeSpread,individualFood:job.individualFood!==false,population:job.population,limit:job.limit,
  mutations:job.mutations,mutationRate:job.mutationRate,baseGenome:job.baseGenome,
  learning:mode.learning,memory:mode.memory,lifeHistoryLimit:250});
 const start=performance.now(),checkpoints=[],samples=[],champions=new Map();let agentSteps=0,limitSteps=0,checks=0,lastSent=0;
 const sources=s.foodIslands.flatMap(g=>g.sources),interval=Math.max(1000,Math.ceil(job.steps/200));
 function consider(a){
  if(!job.saveGenomes)return;
  // Три явно названных критерия отбора образцов; ни один не называется «лучший вообще».
  for(const [criterion,value]of [['most-children',a.children],['oldest',a.age],['highest-generation',a.generation]]){
   const previous=champions.get(criterion);if(!previous||value>previous.value)champions.set(criterion,{criterion,value,tick:s.tick,life:lifeRow(a,a.born,s.tick,a.alive?null:s.records.get(a.id)?.cause),genome:s.genomeFile(a)});
  }
 }
 const originalDie=s.die.bind(s);s.die=(a,cause)=>{originalDie(a,cause);consider(a);};
 function point(){
  const balances=checkInvariants(s);checks++;
  return {...s.summary(),livingFounders:s.agents.filter(a=>a.parentId===null).length,
   meanLivingAge:s.agents.length?s.agents.reduce((n,a)=>n+a.age,0)/s.agents.length:null,
   nearFood:s.agents.filter(a=>sources.some(p=>worldDistance(a,p)<=3)).length,
   longPlaces:s.agents.reduce((n,a)=>n+a.brain.longMemory.size,0),lives:s.lifeHistory.summary(),balances};
 }
 function saveSample(){
  for(const a of s.agents)consider(a);
  if(job.saveGenomes)samples.push({tick:s.tick,genomes:[...champions.values()].map(g=>({...g}))});
 }
 function result(status,error=null){
  return {id:job.id,kind:'world',modelVersion:MODEL_VERSION,status,error,settings:{...job,mutationProtocol:s.mutationProtocol,brainType:s.brainType,geography:s.geography,foodSettings:{...s.foodSettings},foodIslands:s.foodIslands,baseGenome:job.baseGenome?'stored-in-batch-config':null},
   tick:s.tick,targetSteps:job.steps,extinct:!s.agents.length,extinctionTick:!s.agents.length?s.tick:null,
   wallSeconds:(performance.now()-start)/1000,agentSteps,meanPopulation:s.tick?agentSteps/s.tick:s.initialPopulation,
   meanFeelingAcrossAgentSteps:agentSteps?s.lifeExposure.feelingTotal/s.lifeExposure.steps:null,limitSteps,
   deathsPer1000AgentSteps:agentSteps?s.stats.deaths/agentSteps*1000:null,
   rules:{...RULES,birthThreshold:s.reproduction.energy,birthHealth:s.reproduction.health},reproduction:{...s.reproduction},geography:s.geographyInfo,stats:structuredClone(s.stats),summary:s.summary(),lives:s.lifeReport(),checkpoints,
   feedingAcrossAgentSteps:{mealsPer1000AgentSteps:agentSteps?s.stats.eaten/agentSteps*1000:null,
    feedingActionFraction:s.stats.completed.reduce((n,v)=>n+v,0)?(s.stats.gathered+s.stats.eaten)/s.stats.completed.reduce((n,v)=>n+v,0):null},
   invariants:{status:error?'failed':'passed',checkpointsChecked:checks},genomeSamples:samples,
   detailRetention:{deadRowsLimit:250,allDeathsCounted:true},
   notes:['Средние возраста смерти относятся только к завершённым жизням; живые представлены отдельно.','Один seed задаёт одинаковый старт режимов; дальнейшие случайные события расходятся после разных действий.','Прекращение роста популяции при лимите влияет на отбор.','Образцы геномов выбраны по потомству, возрасту и поколению; это не рейтинг общей приспособленности.']};
 }
 try{
  checkpoints.push(point());saveSample();
  while(s.tick<job.steps&&s.agents.length&&!shouldStop()){
   const sliceStart=performance.now();
   // До 20 мс без отдачи управления; отдельный тяжёлый шаг может занять дольше.
   do{
    const alive=s.agents.length;agentSteps+=alive;limitSteps+=Number(alive>=s.limit);
    s.step();
    if(s.tick%interval===0)checkpoints.push(point());
    if(s.tick%10000===0)saveSample();
   }while(s.agents.length&&s.tick<job.steps&&performance.now()-sliceStart<20);
   if(performance.now()-lastSent>=1000){onProgress({tick:s.tick,targetSteps:job.steps,population:s.agents.length,births:s.stats.births,deaths:s.stats.deaths,seconds:(performance.now()-start)/1000});lastSent=performance.now();}
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(checkpoints.at(-1)?.tick!==s.tick)checkpoints.push(point());
  if(samples.at(-1)?.tick!==s.tick)saveSample();
  return result(shouldStop()?'stopped':'completed');
 }catch(error){return result('failed',{message:error.message,stack:error.stack??null,tick:s.tick});}
}

/** Сводка по независимым мирам. Незавершённые/аварийные запуски показываются
 * отдельно и не превращаются в смерти популяции. Наблюдаемая длительность
 * у дожившего мира ограничена концом испытания, а не истинным сроком его жизни.
 */
export function summarizeExperiments(jobs){
 const groups=new Map();
 for(const job of jobs){
  if(job.kind!=='world')continue;const geography=job.geography??job.result?.geography?.profile??'legacy-v1',reproduction=job.reproduction??job.result?.reproduction?.id??'automatic-86-55-v1',brainType=job.brainType??job.result?.settings?.brainType??BRAIN_TYPE,key=`${brainType}/${geography}/${reproduction}/${job.scenario}/${job.foodSources??'legacy'}/${job.foodRegrowInterval??'legacy'}/${job.foodIslandCount??'legacy'}/${job.foodPeriodSpread??'legacy'}/${job.foodSizeSpread??'legacy'}/${job.mode}`;
  if(!groups.has(key))groups.set(key,{brainType,geography,reproduction,scenario:job.scenario,foodSources:job.foodSources,foodRegrowInterval:job.foodRegrowInterval,foodIslandCount:job.foodIslandCount,foodPeriodSpread:job.foodPeriodSpread,foodSizeSpread:job.foodSizeSpread,mode:job.mode,planned:0,completed:0,failed:0,interrupted:0,survivedToEnd:0,durationTotal:0,endPopulationTotal:0,birthsTotal:0,deaths:0,deathAgeTotal:0,causes:{starvation:0,injury:0,age:0}});
  const g=groups.get(key);g.planned++;
  if(job.status==='failed'){g.failed++;continue;}
  if(['stopped','interrupted','not-started'].includes(job.status)){g.interrupted++;continue;}
  if(job.status!=='completed'||!job.result)continue;
  const r=job.result,c=r.lives.completed;g.completed++;g.survivedToEnd+=Number(!r.extinct&&r.tick===r.targetSteps);g.durationTotal+=r.tick;g.endPopulationTotal+=r.summary.population;g.birthsTotal+=r.stats.births;g.deaths+=c.count;g.deathAgeTotal+=(c.meanAge??0)*c.count;
  for(const cause of Object.keys(g.causes))g.causes[cause]+=c.causes[cause];
 }
 return [...groups.values()].map(g=>({...g,survivalFraction:g.completed?g.survivedToEnd/g.completed:null,
  meanObservedPopulationDuration:g.completed?g.durationTotal/g.completed:null,meanEndPopulation:g.completed?g.endPopulationTotal/g.completed:null,
  meanBirths:g.completed?g.birthsTotal/g.completed:null,pooledMeanAgeAtDeath:g.deaths?g.deathAgeTotal/g.deaths:null}));
}
