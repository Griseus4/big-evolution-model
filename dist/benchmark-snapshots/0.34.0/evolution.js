/**
 * Лаборатория отбора и личного обучения, версия 0.29.
 *
 * Здесь нет DOM, таймеров, нейросети, A* или цели «добыть пищу».
 * Мир исполняет элементарные действия; геном задаёт только их предпочтения.
 * Геном не изменяется за жизнь. Личный опыт хранится отдельно в cognition.js.
 * Два механизма можно отключать независимо: мутации у детей и обучение за жизнь.
 *
 * Повторяемость: потоки физики, новых генов и раскладки выводятся из seed.
 * Отрисовка не обращается к нему и не влияет на результаты опыта.
 */
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
import {initializeTemporal,advanceTemporal,temporalObservation,temporalFrame,temporalBirthAvailability} from './temporal-world.js';
import {Random, key, hexCenter, HEX_RADIUS, HEX_WIDTH} from './simulation.js';
import {ACTIONS} from './action-catalog.js';
import {beginComputePart,endComputePart} from './performance-probe.js';
export {ACTIONS};
import {BASE_GENE_COUNT} from './policy-layout.js';
import {GENE_COUNT,COGNITIVE_GENES} from './brain-parameters.js';
import {GENOME_VERSION,randomGenome,randomNeuralGenome,genomeMetadata,mutateGenome,validateGenomeFile,randomizeLegacyProperties} from './genome.js';
import {NEURAL_BRAIN_TYPE,NEIGHBOUR_BRAIN_TYPE,SET_BRAIN_TYPE,layoutForType} from './neural-layout.js';
import {createOccupancy,placeOccupant,removeOccupant,countOthers,contactIds,visibleNeighbours} from './neighbour-perception.js';
import {withMutationGenes,mutationProfile,MUTATION_SCHEMA} from './mutation-parameters.js';
import {WORLD_DEFAULTS} from './world-defaults.js';
export {GENOME_VERSION,randomGenome,mutateGenome,validateGenomeFile};
import {BRAIN_TYPE,DECISION_SCHEMA,createControllerState,controllerState,evaluateController,selectControllerDecision,prepareControllerDecision,
 controllerFeeling,observeController,recordControllerOutcome,hasPendingDecision,prepareControllerOutcome,finishControllerOutcome,adjustPendingFeeling,expectedControllerValue} from './brain-controller.js';
import {TRAIT_SCALE_VERSION,BODY_SENSE_VERSION} from './brain-parameters.js';
import {localNeighbours,moveLocally,memoryWorldPosition} from './navigation.js';
import {placeFoodIslands,worldDistance} from './food-layout.js';
import {LifeHistory,MODEL_VERSION,createLifeCounters,sampleLife,lifeRow} from './life-history.js';
import {validateFoodSettings,createFoodTemplate} from './food-settings.js';
import {ISLAND_SCHEMA,createIndividualFoodLayout,scheduleFoodIslands,regrowFoodIslands,islandScheduleSummary} from './food-islands.js';
import {planWorldFoodChange,foodEnvironment} from './world-edit.js';
import {GEOGRAPHY_PROFILES,DEFAULT_GEOGRAPHY,validateGeography,createLakesAndRivers,classifyLandRegions,balancedFounderPositions} from './geography.js';
import {ACTION_COUNT,BIRTH_ACTION,DEPOSIT_ACTION,STATE_COUNT,GENOME_SIZES} from './policy-layout.js';
import {reproductionProfile,DEFAULT_REPRODUCTION,reproductionCounters} from './reproduction.js';
export {ACTION_COUNT,BIRTH_ACTION,DEPOSIT_ACTION,STATE_COUNT};
export {memoryWorldPosition,worldDistance};
export {key, hexCenter, HEX_RADIUS, HEX_WIDTH,BASE_GENE_COUNT,GENE_COUNT,COGNITIVE_GENES};
// Старый прямоугольник сохранён для сравнительного профиля и опасной области.
// По умолчанию основатели распределены по всей суше новой карты.
export const INITIAL_WIDTH=24, INITIAL_HEIGHT=16;
export const WORLD_WIDTH=INITIAL_WIDTH*2, WORLD_HEIGHT=INITIAL_HEIGHT*2;
export const CANVAS_WIDTH=Math.ceil((WORLD_WIDTH+.5)*HEX_WIDTH+12);
export const CANVAS_HEIGHT=Math.ceil((WORLD_HEIGHT-1)*HEX_RADIUS*1.5+2*HEX_RADIUS+12);

// Все величины условные: шаг пока не переводится в часы или годы.
export const RULES=Object.freeze({foodEnergy:22,digestionRate:1.1,stomachCapacity:66,
 inventoryCapacity:3,initialEnergy:68,newbornEnergy:28,birthCost:32,birthThreshold:reproductionProfile().energy,birthHealth:reproductionProfile().health,
 maturity:90,birthInterval:100,maxAge:10000,regrowInterval:80,
 waitCost:.30,depositCost:.36,groundFoodCapacity:10,actionCost:.48,moveExtra:.30,gatherExtra:.18});
/** Расходы действий в три раза выше 0.8. Рождение отдельно: его стоимость 32
 * и передача 28 ребёнку не масштабированы, как и сроки начала размножения.
 * Эти величины заданы физикой, не обученными предпочтениями/целями организма.
 */
export function actionEnergyCost(action){return action===BIRTH_ACTION?RULES.birthCost:action===DEPOSIT_ACTION?RULES.depositCost:action===8?RULES.waitCost:
 RULES.actionCost+(action<6?RULES.moveExtra:action===6?RULES.gatherExtra:0);}
const bound=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/** Шесть соседей гекса. Порядок соответствует первым шести действиям.
 * Чётные и нечётные ряды имеют разные смещения. Никакого маршрута здесь нет.
 */
export function neighbourPositions(p){
 const odd=p.y&1;
 return [[1,0],[-1,0],[odd-1,-1],[odd,-1],[odd-1,1],[odd,1]]
  .map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}));
}
/** Щелчок ищет ближайший центр среди соседних строк и столбцов.
 * Старый hexAt ограничен старым полем 28×18 и не подходит для расширенной карты.
 * Для регулярной сетки достаточно девяти кандидатов. После поиска проверяем
 * границы самого многоугольника, чтобы клик за краем не выбирал крайний гекс.
 */
export function worldHexAt(x,y){
 const nearestRow=Math.round((y-6-HEX_RADIUS)/(HEX_RADIUS*1.5));
 let best=null,nearest=Infinity;
 for(let row=nearestRow-1;row<=nearestRow+1;row++){
  if(row<0||row>=WORLD_HEIGHT)continue;
  const nearestCol=Math.round((x-6)/HEX_WIDTH-.5-(row&1)/2);
  for(let col=nearestCol-1;col<=nearestCol+1;col++){
   if(col<0||col>=WORLD_WIDTH)continue;
   const p={x:col,y:row},center=hexCenter(p),squared=(x-center.x)**2+(y-center.y)**2;
   if(squared<nearest){best=p;nearest=squared;}
  }
 }
 if(!best)return null;
 const center=hexCenter(best),dx=Math.abs(x-center.x),dy=Math.abs(y-center.y);
 return dx<=HEX_WIDTH/2&&dy<=HEX_RADIUS-dx/Math.sqrt(3)?best:null;
}
export class Evolution {
 /** Один общий мир: жители конкурируют за его конечную пищу.
  * При использовании сохранённой основы новые основатели получают один геном.
  * В режиме «мутации выключены» их геном и геномы потомков остаются неизменны.
  */
 constructor({seed=42,population=WORLD_DEFAULTS.population,limit=WORLD_DEFAULTS.limit,mutationRate=WORLD_DEFAULTS.mutationRate,mutations=true,temporal=true,brainType=temporal?TEMPORAL_BRAIN_TYPE:SET_BRAIN_TYPE,
  scenario='custom',foodSources,foodRegrowInterval,foodIslandCount,foodPeriodSpread,foodSizeSpread,individualFood=scenario==='custom',geography,reproduction=DEFAULT_REPRODUCTION,baseGenome=null,learning=true,memory=true,expandLegacy=false,lifeHistoryLimit=Infinity,heritableMutations=true,upgradeMutationGenes=false}={}){
  this.temporal=Boolean(temporal);
  if(this.temporal&&brainType!==TEMPORAL_BRAIN_TYPE)throw new Error('В0.32 нужен мозг v13; старые основы не поддерживаются.');
  if(!['custom','balanced','scarce'].includes(scenario))throw new Error('Неизвестная пищевая среда.');
  const foodOptions=validateFoodSettings({foodSources,foodRegrowInterval,foodIslandCount,foodPeriodSpread,foodSizeSpread});
  this.individualFood=Boolean(individualFood);
  // Прежние balanced/scarce в API сохраняют историческую географию фикстур.
  // Обычная custom-игра по умолчанию использует новый рельеф и равномерный старт.
  this.geography=validateGeography(geography??(scenario==='custom'?DEFAULT_GEOGRAPHY:'legacy-v1'));
  const profile=GEOGRAPHY_PROFILES.find(p=>p.id===this.geography);
  this.learningEnabled=Boolean(learning);this.memoryEnabled=Boolean(memory);
  this.reproduction=reproductionProfile(reproduction);
  this.seed=seed>>>0;this.random=new Random(this.seed);this.cognitiveRandom=new Random(this.seed^0x2ac7e131);this.bodyRandom=new Random(this.seed^0x7bd239a1);this.scenario=scenario;
  if(brainType!==BRAIN_TYPE&&!layoutForType(brainType))throw new Error('Неизвестный тип мозга.');
  this.heritableMutations=Boolean(heritableMutations);this.upgradeMutationGenes=Boolean(upgradeMutationGenes);
  this.mutationRandom=new Random(this.seed^0x31d869ab);
  this.brainType=brainType;this.neuralRandom=new Random(this.seed^0x493cc13d);
  this.initialPopulation=bound(Math.floor(population),1,1000);
  this.limit=bound(Math.floor(limit),this.initialPopulation,1000);
  this.mutationRate=bound(mutationRate,0,.3);this.mutations=mutations;
  this.baseGenome=baseGenome?validateGenomeFile({format:'big-evolution-genome',
   ...genomeMetadata(baseGenome),genes:baseGenome}):null;
  if(this.baseGenome)this.brainType=genomeMetadata(this.baseGenome).brainType;
  if(this.temporal&&this.brainType!==TEMPORAL_BRAIN_TYPE)throw new Error('В0.32 нужны новые геномыv13; старые основы не преобразуются.');
  if(this.temporal&&this.reproduction.automatic)throw new Error('Автоматическое рождение удалено из новых испытаний0.32.');
  this.tick=0;this.nextId=1;this.maxGeneration=0;this.events=[];this.history=[];this.agents=[];
  // Нулевое начало цикла сохраняет прежние сроки восстановления до первого
  // вмешательства. Журнал содержит только реальные изменения, не каждый шаг.
  this.foodCycleStart=0;this.environmentRevision=0;this.environmentChanges=[];
  this.lifeHistory=new LifeHistory({retain:lifeHistoryLimit});this.lifeExposure={steps:0,feelingTotal:0};
  this.records=new Map();this.lineages=new Map();this.tiles=[];this.occupancy=createOccupancy();
  this.stats={births:0,deaths:0,gathered:0,eaten:0,deposited:0,regrown:0,discardedFood:0,
   digested:0,overflow:0,spent:0,birthSpent:0,deathEnergy:0,injuries:0,
   deathsByCause:{starvation:0,injury:0,age:0},actions:Array(ACTION_COUNT).fill(0),reproduction:reproductionCounters()};
  // Старая генерация области сохраняет порядок бросков RNG основателей.
  // В custom этот временный набор пищи заменится независимым шаблоном ниже:
  // изменение числа источников не должно само по себе менять геномы/позиции.
  // Явные balanced/scarce оставлены в API для прежних механических фикстур.
  for(let y=0;y<WORLD_HEIGHT;y++)for(let x=0;x<WORLD_WIDTH;x++){
   this.tiles.push({x,y,terrain:'land',feature:null,food:0,maxFood:0,risk:0});
  }
  for(let y=0;y<INITIAL_HEIGHT;y++)for(let x=0;x<INITIAL_WIDTH;x++){
   const water=x>=INITIAL_WIDTH-2+(y%4===0?1:0);
   const fertile=this.random.next()<(scenario==='scarce'?.1:.27);
   const maxFood=!water&&fertile?3+Math.floor(this.random.next()*4):0;
   // Истинный риск доступен физике, контроллер видит только опасный рельеф.
   const risk=water?0:Math.max(0,1-Math.hypot(x-17,y-5)/3.3)*.07;
   Object.assign(this.tile(x,y),{terrain:water?'water':'land',food:maxFood,maxFood,risk});
  }
  // Старая петля выше сохранена для того же расхода RNG геномов. Новая вода
  // заменяет её рельеф независимым потоком; попадание воды убирает опасность.
  const terrainInfo=profile.terrain==='lakes-rivers-v1'?createLakesAndRivers(this.tiles,WORLD_WIDTH,WORLD_HEIGHT,this.seed):
   {terrainGeneration:profile.terrain,targetWaterCells:null,waterCells:this.tiles.filter(c=>c.terrain==='water').length,riverCount:0,lakeCount:0,fordCells:0};
  const regions=classifyLandRegions(this.tiles,WORLD_WIDTH,WORLD_HEIGHT);
  // Шаблон принадлежит физике/наблюдателю, никогда не передаётся в мозг.
  this.sourceTemplate=scenario==='custom'?createFoodTemplate(foodOptions.foodSources,this.seed):
   this.tiles.filter(c=>c.maxFood>0).map(({x,y,food,maxFood})=>({x,y,food,maxFood}));
  if(this.sourceTemplate.length>this.tiles.filter(c=>c.terrain==='land').length)
   throw new Error('Для выбранного числа источников недостаточно пригодной суши.');
  if(this.individualFood){
   const layout=createIndividualFoodLayout(this.tiles,this.sourceTemplate,this.seed,foodOptions);
   for(const c of this.tiles){c.food=0;c.maxFood=0;}
   for(const p of layout.sources)Object.assign(this.tile(p.x,p.y),{food:p.food,maxFood:p.maxFood});
   this.foodIslands=scheduleFoodIslands(layout.islands,this.seed,foodOptions);
  }else this.foodIslands=placeFoodIslands(this.tiles,this.sourceTemplate,this.seed,WORLD_WIDTH,WORLD_HEIGHT,{anchorFirstIsland:profile.placement==='legacy-region-v1'});
  this.initialFood=this.tiles.reduce((sum,c)=>sum+c.food,0);
  this.foodSettings={generation:scenario==='custom'?(profile.placement==='legacy-region-v1'?'islands-custom-v1':'islands-custom-v2'):'islands-legacy-v1',sourceCount:this.sourceTemplate.length,
   regrowInterval:scenario==='custom'?foodOptions.foodRegrowInterval:RULES.regrowInterval,
   initialFood:this.initialFood,islandCount:this.foodIslands.length,synchronized:!this.individualFood};
  if(this.individualFood)Object.assign(this.foodSettings,{generation:ISLAND_SCHEMA,requestedIslandCount:foodOptions.foodIslandCount,
   periodSpread:foodOptions.foodPeriodSpread,sizeSpread:foodOptions.foodSizeSpread,...islandScheduleSummary(this.foodIslands)});
  this.initialFoodSettings={...this.foodSettings};
  this.initialFoodIslands=structuredClone(this.foodIslands);
  // Прежний профиль сохраняет область рождения. Новые профили распределяют
  // основателей по всей суше; выбор мест не учитывает пищу или опасность.
  const land=this.tiles.filter(c=>c.terrain==='land'&&c.x<INITIAL_WIDTH&&c.y<INITIAL_HEIGHT);
  const uniform=profile.placement==='balanced-land-v1'?balancedFounderPositions(this.tiles,this.initialPopulation,this.seed):null;
  // Расширение старой основы — одна общая случайная добавка для всех основателей.
  // Отдельный RNG сохраняет карту и позиции при сравнении режимов мозга.
  if(this.baseGenome&&expandLegacy){
   this.baseGenome=randomizeLegacyProperties(this.baseGenome,new Random(this.seed^0x8ad7f21));
  }
  if(this.baseGenome&&this.upgradeMutationGenes)this.baseGenome=withMutationGenes(this.baseGenome,this.mutationRandom);
  this.mutationProtocol=this.baseGenome?(mutationProfile(this.baseGenome)?MUTATION_SCHEMA:'global-mutation-v1'):
   this.heritableMutations?MUTATION_SCHEMA:'global-mutation-v1';
  for(let i=0;i<this.initialPopulation;i++){
   // Даже при отдельном размещении сохраняем один прежний бросок перед генами.
   // Поэтому смена географии при том же seed не меняет исходные гены/физический RNG.
   const oldDraw=this.random.next(),p=uniform?.[i]??land[Math.floor(oldDraw*land.length)];
   let genome=this.baseGenome?.slice();
   if(!genome){
    if(layoutForType(this.brainType)){
     // Резервируем прежние 450 бросков основателя, чтобы смена мозга сама
     // по себе не сдвигала RNG размещения/физики следующего основателя.
     for(let draw=0;draw<450;draw++)this.random.next();
     genome=randomNeuralGenome(this.neuralRandom,this.brainType);
    }else genome=randomGenome(this.random,this.cognitiveRandom,this.bodyRandom);
   }
   if(!this.baseGenome&&this.heritableMutations)genome=withMutationGenes(genome,this.mutationRandom);
   this.addAgent(p,genome,null);
  }
  for(const a of this.agents)regions[this.tile(a.x,a.y).regionId].initialFounders++;
  for(const c of this.tiles)if(c.maxFood>0)regions[c.regionId].initialSources++;
  this.geographyInfo={profile:this.geography,founderPlacement:profile.placement,...terrainInfo,
   landCells:this.tiles.length-terrainInfo.waterCells,waterFraction:terrainInfo.waterCells/this.tiles.length,
   regionCount:regions.length,regions};
  this.log('Начало',`${this.agents.length} основателей. Предпочтения ${this.baseGenome?'взяты из сохранённого генома':'случайны'}.`);
  if(this.temporal)initializeTemporal(this);
  this.record();
 }
 tile(x,y){return x<0||y<0||x>=WORLD_WIDTH||y>=WORLD_HEIGHT?null:this.tiles[y*WORLD_WIDTH+x];}
 /** Следующее пополнение считается в шагах мира, не по времени компьютера.
  * В индивидуальной среде это ближайшее событие любой группы; без источников
  * возвращаем null. Историческая среда использует общий цикл. Вмешательство
  * не выдаёт запас задним числом, пауза не выращивает еду.
  */
 nextFoodRegrowth(){
  if(this.individualFood)return this.foodIslands.length?Math.min(...this.foodIslands.map(g=>g.nextTick)):null;
  const period=this.foodSettings.regrowInterval;return this.foodCycleStart+(Math.floor((this.tick-this.foodCycleStart)/period)+1)*period;
 }
 /** Меняем только производство пищи. Все клетки сохраняют своё food, даже
  * если источник убран, перенесён или уменьшен ниже нынешнего запаса.
  * Тела, геномы, память, статистика и RNG жизни сохраняются дословно.
  * Скрытая перестановка не вызывает observe(): жители узнают её при обычном
  * взгляде и могут продолжать доверять устаревшему личному воспоминанию.
  */
 changeFoodEnvironment(input){
  const plan=planWorldFoodChange(this,{foodIslandCount:this.foodSettings.requestedIslandCount,
   foodPeriodSpread:this.foodSettings.periodSpread,foodSizeSpread:this.foodSettings.sizeSpread,...input},WORLD_WIDTH,WORLD_HEIGHT);
  if(!plan.changed)return null;
  const before=foodEnvironment(this),previous=new Set(this.tiles.filter(c=>c.maxFood>0).map(c=>key(c.x,c.y)));
  // Полная валидация/раскладка выше. Ни одна настоящая клетка не меняется,
  // пока план не готов; ниже уже нет операций генерации или разбора ввода.
  for(const c of this.tiles)c.maxFood=0;
  for(const p of plan.sources)this.tile(p.x,p.y).maxFood=p.maxFood;
  this.sourceTemplate=plan.sources.map(p=>({...p,food:this.tile(p.x,p.y).food}));
  this.foodIslands=plan.islands;this.foodCycleStart=this.tick;this.environmentRevision++;
  this.foodSettings={...this.foodSettings,generation:this.individualFood?'individual-food-islands-edited-v1':'islands-edited-v1',sourceCount:plan.sources.length,
   regrowInterval:plan.options.foodRegrowInterval,islandCount:plan.islands.length};
  if(this.individualFood)Object.assign(this.foodSettings,{requestedIslandCount:plan.options.foodIslandCount,
   periodSpread:plan.options.foodPeriodSpread,sizeSpread:plan.options.foodSizeSpread,...islandScheduleSummary(plan.islands)});
  const next=new Set(plan.sources.map(p=>key(p.x,p.y))),after=foodEnvironment(this);
  Object.assign(this.foodSettings,{capacityMin:after.capacityMin,capacityMax:after.capacityMax});
  const change={revision:this.environmentRevision,tick:this.tick,kind:'food',
   operation:plan.options.relocate||plan.layoutChanged?'redistribute':'adjust',requested:{...plan.options},before,after,
   islands:structuredClone(this.foodIslands),
   addedSources:[...next].filter(p=>!previous.has(p)).length,removedSources:[...previous].filter(p=>!next.has(p)).length,
   remainingWorldFood:this.tiles.reduce((n,c)=>n+c.food,0),
   foodOutsideSources:this.tiles.filter(c=>c.maxFood===0).reduce((n,c)=>n+c.food,0),
   nextRegrowthTick:this.nextFoodRegrowth(),summary:this.summary(),stats:structuredClone(this.stats),lives:this.lifeHistory.summary()};
  this.environmentChanges.push(change);
  this.log('Изменение мира',`Источников ${before.sourceCount} → ${after.sourceCount}, период ${before.regrowInterval} → ${after.regrowInterval}. Лежащая еда сохранена. Следующее пополнение: шаг ${change.nextRegrowthTick}.`);
  this.record();return change;
 }
 /** Запись родословной не содержит полный геном каждого умершего.
  * Сам геном хранится у живого жителя. Это ограничивает накопление больших таблиц.
  * Лёгкие записи старых умерших удаляются, текущие родители сохраняются.
  */
 addAgent(position,genome,parent){
  const id=this.nextId++,founderId=parent?.founderId??id;
  // Поворот личной системы не наследуется и не зависит от координат рождения.
  // Отдельный генератор не расходует RNG физики и прежних генов.
  const frameRotation=Math.floor(new Random(this.seed^(Math.imul(id,0x9e3779b9))^0x63a71f).next()*6);
  const a={id,parentId:parent?.id??null,founderId,generation:parent?parent.generation+1:0,
   x:position.x,y:position.y,energy:parent?RULES.newbornEnergy:RULES.initialEnergy,
   health:100,pain:0,stomach:0,inventory:0,age:0,lastBirthAge:-RULES.birthInterval,
   children:0,lastAction:null,lastDecision:null,lastDamage:0,alive:true,genome,frameRotation,brain:createControllerState(genome),life:createLifeCounters(),born:this.tick};
  if(this.temporal){delete a.pain;delete a.lastDamage;for(const k of ['painTotal','painSteps','injuries','damage'])delete a.life[k];a.process=null;a.callReason=0;a.lastAction=8;a.readyAt=(this.subtick??0)+(parent?1:0);a.lastProcess={action:8,localDestination:{...a.brain.position},direction:null,elapsed:5,duration:5};}
  a.brain.wellbeing=this.feeling(a);
  this.agents.push(a);placeOccupant(this.occupancy,a);this.records.set(id,{id,parentId:a.parentId,founderId,generation:a.generation,born:this.tick,death:null,cause:null});
  // Счётчик достигнутых поколений не уменьшается после смерти старшей ветви.
  this.maxGeneration=Math.max(this.maxGeneration,a.generation);
  if(!this.lineages.has(founderId))this.lineages.set(founderId,{births:0,founderId});
  if(parent)this.lineages.get(founderId).births++;
  return a;
 }
 /** Явное восстановление после управляемой расстановки в проверках/фикстурах.
  * Обычная игра поддерживает индекс по событиям и не пересобирает его на шаге. */
 rebuildOccupancy(){this._viewEpoch=(this._viewEpoch??0)+1;this.occupancy=createOccupancy();for(const a of this.agents)placeOccupant(this.occupancy,a);}
 neighbours(a){return visibleNeighbours(this,a);}
 contacts(a){return contactIds(this.occupancy,a);}
 /** Единственная точка перемещения физического тела. Личную навигацию меняет
  * исполнитель после успешного шага; индекс меняется немедленно. */
 moveAgent(a,destination){a.x=destination.x;a.y=destination.y;placeOccupant(this.occupancy,a);}
 log(title,text){this.events.unshift({tick:this.tick,title,text});this.events.length=Math.min(60,this.events.length);}
 /** Наблюдение для решения содержит только собственное тело и локальный
  * контекст. Возвращаем копии: контроллер не получает ссылку на тело/мир.
  */
 /** Только круговой обзор. Мировые адреса остаются у исполнителя. Источник
  * виден даже пустым; наружу выходит только булев признак, не ёмкость/таймер. */
 visibleDecisionCells(a){
  if(this.temporal)return temporalObservation(this,a).cells;
  return [a.brain.position,...localNeighbours(a.brain)].flatMap(place=>{
   const world=memoryWorldPosition(a,place),cell=this.tile(world.x,world.y);
   return cell?[{q:place.q,r:place.r,food:cell.food,isFoodSource:cell.maxFood>0,terrain:cell.terrain,hazard:cell.risk>0,neighbours:countOthers(this.occupancy,a,world.x,world.y)}]:[];
  });
 }
 decisionObservation(a){if(this.temporal)return temporalObservation(this,a);return {
  body:{energy:a.energy,health:a.health,inventory:a.inventory,pain:a.pain,stomach:a.stomach},
  capacities:{inventory:RULES.inventoryCapacity,stomach:RULES.stomachCapacity},
  position:{...a.brain.position},currentFood:this.tile(a.x,a.y).food>0,
  previousAction:a.lastAction,tick:this.tick,memoryEnabled:this.memoryEnabled,learningEnabled:this.learningEnabled,
  ...(a.brain.controllerType===NEIGHBOUR_BRAIN_TYPE||a.brain.controllerType===SET_BRAIN_TYPE?{neighbours:this.neighbours(a)}:{}),
  ...(a.brain.controllerType===SET_BRAIN_TYPE?{cells:this.visibleDecisionCells(a)}:{}),
 };}
 /** Прежний публичный метод остаётся для панели/проверок; строку вычисляет
  * адаптер нынешнего мозга, физика не знает порогов его внутренней таблицы.
  */
 state(a){return controllerState(this.decisionObservation(a));}
 /** Мир задаёт только физическую доступность и назначения. Два списка:
  * request можно передать мозгу; executionDestinations содержит мировые x/y
  * и никогда ему не передаётся. id связывает оценённый вариант с исполнением.
  */
 decisionFrame(a,withExecution=true){
  if(this.temporal)return temporalFrame(this,a,withExecution);
  // Продолжение TD оценивает допустимые действия, но не исполняет их:
  // не создаём Map и копии мировых назначений. Публичный пакет прежний.
  const observation=this.decisionObservation(a),candidates=[],executionDestinations=withExecution?new Map():null;
  if(!a.alive)return {request:{schema:DECISION_SCHEMA,observation,candidates},executionDestinations};
  const positions=localNeighbours(a.brain);
  for(let action=0;action<ACTION_COUNT;action++){
   let destination={x:a.x,y:a.y},localDestination={...a.brain.position};
   if(action<6){
    localDestination=positions[action];destination=memoryWorldPosition(a,localDestination);
    const cell=this.tile(destination.x,destination.y);if(!cell||cell.terrain==='water')continue;
   }else if(action===6&&(a.inventory>=RULES.inventoryCapacity||this.tile(a.x,a.y).food===0))continue;
   else if(action===7&&(a.inventory===0||a.stomach>RULES.stomachCapacity-RULES.foodEnergy+1e-9))continue;
   else if(action===BIRTH_ACTION&&(this.reproduction.automatic||!this.birthAvailability(a).eligible))continue;
   else if(action===DEPOSIT_ACTION&&!this.canDeposit(a))continue;
   const cell=this.tile(destination.x,destination.y),id=`action-${action}`;
   candidates.push({id,action,label:ACTIONS[action],localDestination:{...localDestination},cell:{food:cell.food,isFoodSource:cell.maxFood>0,hazard:cell.risk>0,
    ...(a.brain.controllerType===NEIGHBOUR_BRAIN_TYPE||a.brain.controllerType===SET_BRAIN_TYPE?{neighbours:countOthers(this.occupancy,a,destination.x,destination.y)}:{})}});
   if(withExecution)executionDestinations.set(id,{action,destination:{...destination},localDestination:{...localDestination}});
  }
  return {request:{schema:DECISION_SCHEMA,observation,candidates},executionDestinations};
 }
 /** Назначение добавляет только исполнитель, после получения оценок мозга.
  * Несуществующий id запрещён: контроллер не создаёт новое действие/телепорт.
  */
 executableDecision(frame,decision){
  const execution=frame.executionDestinations.get(decision.id);
  if(!execution||decision.action!==execution.action)throw new Error('Мозг выбрал неизвестный или несогласованный вариант действия.');
  return {...decision,action:execution.action,localDestination:{...execution.localDestination},destination:{...execution.destination}};
 }
 /** Общая точка оценки: измеритель отдельно учитывает подготовку вариантов
  * и мозг, не включая выбор RNG и личное обучение. */
 /** Один снимок текущей ситуации для двух оценок вокруг TD. Исполнитель
  * остаётся у мира; мозг готовит только независимые от весов входы. */
 prepareDecision(a){
  const frame=this.decisionFrame(a);
  return {frame,input:prepareControllerDecision(a.brain,frame.request)};
 }
 evaluateFrame(a,decision=null){
  const frame=decision?.frame??this.decisionFrame(a),options=evaluateController(a.brain,a.genome,frame.request,decision?.input);
  return {frame,options};
 }
 evaluate(a){
  if(!a.alive)return [];
  const {frame,options}=this.evaluateFrame(a);
  return options.map(option=>this.executableDecision(frame,option));
 }
 /** Отдельная точка для профилирования: принадлежит оценке, не TD-градиенту.
  * Запрос строится после закрепления памяти и до изменения весов. */
 expectedContinuation(a,decision=null){
  if(!a.alive)return 0;
  return expectedControllerValue(a.brain,a.genome,decision?.frame.request??this.decisionFrame(a,false).request,decision?.input);
 }
 choose(a,decision=null){
  const {frame,options}=this.evaluateFrame(a,decision);
  const chosen=selectControllerDecision(options,this.random.next());
  const copyMark=beginComputePart('copies');try{
   a.lastDecision={tick:this.tick,row:chosen.row,options:options.map(o=>this.executableDecision(frame,o)),chosen:chosen.action};
  }finally{endComputePart(copyMark);}
  return this.executableDecision(frame,chosen);
 }
 /** Можно положить ровно одну переносимую порцию на текущую сушу.
  * Предел 10 ограничивает только новое выкладывание. Естественная ёмкость
  * источника (до 24 при редактировании мира) и уже лежащая еда не обрезаются.
  * Никакой собственности, скрытого тайника или готовой цели запасти здесь нет.
  */
 canDeposit(a){const cell=this.tile(a.x,a.y);return Boolean(a.alive&&a.inventory>0&&cell?.terrain==='land'&&cell.food<RULES.groundFoodCapacity);}
 /** Атомарный перенос и счётчик. Цена списывается один раз в step() после
  * выбранного действия; здесь нет отдельного расхода или обратной связи TD. */
 depositFood(a){
  if(!this.canDeposit(a))return false;
  this.tile(a.x,a.y).food++;a.inventory--;this.stats.deposited++;
  return true;
 }
 /** Чувства вычисляются только из тела и генетической чувствительности. */
 feeling(a){return controllerFeeling(a.brain,{energy:a.energy,health:a.health,pain:a.pain,stomach:a.stomach},RULES.stomachCapacity);}
 /** Смотрим на текущий гекс и шесть соседей. Дальние клетки не читаются.
  * Повторный взгляд после действия уточняет пищу, подобранную самим жителем.
  */
 observe(a,visit=false){
  if(!this.memoryEnabled)return;
  // Пакет восприятия содержит только личные координаты и видимые признаки.
  // У мира остаются точные x/y, но memory/pending/traces мозга их не получают.
  const positions=[a.brain.position,...localNeighbours(a.brain)];
  const cells=positions.map(p=>{
   const world=memoryWorldPosition(a,p),cell=this.tile(world.x,world.y);
   return cell?{q:p.q,r:p.r,terrain:cell.terrain,food:cell.food,isFoodSource:cell.maxFood>0}:null;
  }).filter(Boolean);
  observeController(a.brain,cells,a.brain.position,this.tick,visit);
 }

 /** Последствие предыдущего действия измеряем после следующего пищеварения.
  * Так усвоение съеденного не приписывается действию, выбранному уже после него.
  * Оценка продолжения — среднее личного критика по текущей политике (Expected TD).
  */
 learnPending(a,terminal=false,reuseForChoice=false){
  if(!hasPendingDecision(a.brain))return;
  const afterFeeling=this.feeling(a);
  prepareControllerOutcome(a.brain,{afterFeeling,tick:this.tick,memoryEnabled:this.memoryEnabled});
  // Только после закрепления памяти и только для ближайшего выбора той же
  // особи. Пакет не переживает действие, движение или изменение времени.
  const decision=reuseForChoice&&this.learningEnabled&&!terminal&&a.brain.controllerType===SET_BRAIN_TYPE?this.prepareDecision(a):null;
  const nextValue=this.learningEnabled&&!terminal?this.expectedContinuation(a,decision):0;
  finishControllerOutcome(a.brain,{afterFeeling,tick:this.tick,terminal,learningEnabled:this.learningEnabled,
   nextValue});
  return decision;
 }
 /** Съеденная порция сначала попадает в пищеварение. Усвоение начинается следующим шагом.
  * Избыток при полной энергии теряется, а желудок имеет конечную вместимость.
  * Поэтому бесконечное поедание не создаёт бесконечный внутренний склад.
  */
 digest(a){
  const amount=Math.min(a.stomach,RULES.digestionRate),gain=Math.min(amount,100-a.energy);
  a.stomach=Math.max(0,a.stomach-amount);a.energy+=gain;
  this.stats.digested+=amount;this.stats.overflow+=amount-gain;
 }
 /** Доступность — только физика. Она не повышает оценку рождения и не даёт
  * мозгу сведения о будущей пище. Причины независимы и могут совпадать.
  * Проверка не пишет статистику: evaluate вызывается также UI и TD-критиком.
  */
 birthAvailability(a){
  if(this.temporal)return temporalBirthAvailability(this,a);
  const blocked=[];
  if(a.energy<this.reproduction.energy)blocked.push('energy');
  if(a.health<this.reproduction.health)blocked.push('health');
  if(a.age<RULES.maturity)blocked.push('immature');
  if(a.age-a.lastBirthAge<RULES.birthInterval)blocked.push('interval');
  if(this.agents.length>=this.limit)blocked.push('limit');
  if(!a.alive||a.age>=RULES.maxAge)blocked.push('terminal');
  return {eligible:blocked.length===0,blocked};
 }
 /** Один замер на реальный выбор, после усвоения пищи. Просмотр панели и
  * вычисление ожидаемого продолжения не добавляют ложных возможностей рождения.
  */
 recordBirthDecision(a){
  const status=this.birthAvailability(a);
  for(const c of [a.life.reproduction,this.stats.reproduction]){
   c.decisions++;c.eligible+=Number(status.eligible);
   for(const reason of status.blocked)c.blocked[reason]++;
  }
  return status;
 }
 /** Исполнение переноса: 32 из тела родителя, 28 новому телу, 4 в потери.
  * Обычная политика вызывает его только при выбранном действии рождения;
  * контрольный автоматизм — после другого действия. Личный опыт не копируется.
  */
 reproduce(a){
  if(!this.birthAvailability(a).eligible)return null;
  const childGenes=this.mutations?mutateGenome(a.genome,this.random,this.mutationRate,.7,this.cognitiveRandom,this.bodyRandom,this.neuralRandom):a.genome.slice();
  a.energy-=RULES.birthCost;this.stats.birthSpent+=RULES.birthCost-RULES.newbornEnergy;
  a.lastBirthAge=a.age;a.children++;this.stats.births++;
  a.life.reproduction.births++;this.stats.reproduction.births++;
  const child=this.addAgent(a,childGenes,a);
  this.log('Рождение',`№${a.id} → №${child.id}, поколение ${child.generation}. Энергия передана от родителя.`);
  return child;
 }
 /** Умершего удаляем из расчёта. Оставшаяся еда учитывается как потерянная,
  * поэтому она не исчезает из бухгалтерского баланса «без следа».
  * Возвращение её в среду, лечение и сложная физиология — будущие механизмы.
  */
 die(a,cause){
  if(!a.alive)return;a.alive=false;removeOccupant(this.occupancy,a.id);
  this.stats.deaths++;this.stats.deathsByCause[cause]++;
  this.stats.discardedFood+=a.inventory;this.stats.deathEnergy+=a.energy+a.stomach;
  Object.assign(this.records.get(a.id),{death:this.tick,cause});
  this.lifeHistory.complete(lifeRow(a,a.born,this.tick,cause));
  this.log('Гибель',`№${a.id}: ${cause==='starvation'?'истощение':cause==='age'?'предел возраста':'повреждения'}.`);
 }
 /** Один шаг мира. Порядок жителей каждый раз перемешивается:
  * первый элемент массива не получает постоянного преимущества в сборе еды.
  * Родившиеся в этом шаге включатся в действия только на следующем шаге.
  */
 step(){if(this.temporal){for(let i=0;i<10&&this.agents.length;i++)advanceTemporal(this);return;}return this.legacyStep();}
 substep(){if(!this.temporal)throw new Error('Подшаги толькоv13');advanceTemporal(this);}
 legacyStep(){
  if(!this.agents.length)return;
  this.tick++;
  // Индивидуальные расписания не раскрываются через наблюдения. Прежний общий
  // цикл оставлен для исторических фикстур; обычная игра использует островки.
  if(this.individualFood)regrowFoodIslands(this);
  else if((this.tick-this.foodCycleStart)%this.foodSettings.regrowInterval===0)for(const c of this.tiles){
   if(c.food<c.maxFood){c.food++;this.stats.regrown++;}
  }
  const turn=this.agents.slice();
  for(let i=turn.length-1;i>0;i--){const j=Math.floor(this.random.next()*(i+1));[turn[i],turn[j]]=[turn[j],turn[i]];}
  for(const a of turn){
   a.age++;a.pain*=.88;a.lastDamage=0;this.digest(a);
   this.observe(a);const decision=this.learnPending(a,false,true);
   const beforeFeeling=this.feeling(a);
   this.recordBirthDecision(a);
   const choice=this.choose(a,decision),action=choice.action;
   a.lastAction=action;this.stats.actions[action]++;
   const cost=actionEnergyCost(action);
   if(action<6){this.moveAgent(a,choice.destination);moveLocally(a.brain,action);}
   else if(action===6){this.tile(a.x,a.y).food--;a.inventory++;this.stats.gathered++;}
   else if(action===7){a.inventory--;a.stomach+=RULES.foodEnergy;this.stats.eaten++;}
   else if(action===DEPOSIT_ACTION)this.depositFood(a);
   if(action===BIRTH_ACTION){
    // Вся цена 32 уже списана reproduce: 28 остаются в теле ребёнка, 4 — расход.
    // Второго обычного расхода 0.48 нет. Этот перенос войдёт в TD-переход рождения.
    a.life.reproduction.chosen++;this.stats.reproduction.chosen++;
    if(!this.reproduce(a))throw new Error('Политика выбрала физически недоступное рождение.');
   }else{
    const spent=Math.min(a.energy,cost);a.energy-=spent;this.stats.spent+=spent;
   }
   const cell=this.tile(a.x,a.y);
   if(cell.risk>0&&this.random.next()<cell.risk){
    const damage=5+Math.floor(this.random.next()*8);a.health=Math.max(0,a.health-damage);
    a.pain=bound(a.pain+damage,0,100);a.lastDamage=damage;this.stats.injuries++;
   }
   if(a.energy===0)a.health=Math.max(0,a.health-1.5);
   this.observe(a,true);
   recordControllerOutcome(a.brain,choice,{position:a.brain.position,damage:a.lastDamage,beforeFeeling,tick:this.tick,
    memoryEnabled:this.memoryEnabled,learningEnabled:this.learningEnabled});
   const terminal=a.health===0||a.age>=RULES.maxAge;
   if(terminal){
    this.learnPending(a,true);
   }else if(this.reproduction.automatic){
    const beforeBirth=this.feeling(a),child=this.reproduce(a);
    // Рождение не является действием политики: исключаем прямой перепад чувства
    // при передаче энергии из изменения, приписываемого последнему решению.
    if(child)adjustPendingFeeling(a.brain,this.feeling(a)-beforeBirth);
   }
   if(this.temporal){delete a.pain;delete a.lastDamage;a.process=null;a.callReason=0;a.lastAction=8;a.readyAt=(this.subtick??0)+(parent?1:0);a.lastProcess={action:8,localDestination:{...a.brain.position},direction:null,elapsed:5,duration:5};}
  a.brain.wellbeing=this.feeling(a);a.brain.feelingTotal+=a.brain.wellbeing;a.brain.feelingSamples++;
   sampleLife(a);this.lifeExposure.steps++;this.lifeExposure.feelingTotal+=a.brain.wellbeing;
   // Итог включает последний прожитый шаг и ощущение; наблюдатель не меняет RNG.
   if(terminal)this.die(a,a.health===0?(a.energy===0?'starvation':'injury'):'age');
  }
  this.agents=this.agents.filter(a=>a.alive);
  if(!this.agents.length)this.log('Опыт завершён','Популяция вымерла. Автоматического возрождения нет.');
  if(this.tick%10===0||!this.agents.length)this.record();
  if(this.records.size>6000){
   const keep=new Set(this.agents.flatMap(a=>[a.id,a.parentId]));
   for(const [id,r]of this.records){if(this.records.size<=5000)break;if(r.death!==null&&!keep.has(id))this.records.delete(id);}
  }
 }
 advance(count){for(let i=0;i<count&&this.agents.length;i++)this.step();}
 /** Компактные итоги всех завершённых жизней и отдельные незавершённые строки.
  * Они не зависят от обрезаемого справочника родословных records.
  */
 lifeReport(){return {tick:this.tick,...this.lifeHistory.summary(),
  dead:this.lifeHistory.retainedRows(),living:this.agents.map(a=>lifeRow(a,a.born,this.tick))};}
 /** Общие показатели не заменяют индивидуальных жителей в расчёте. */
 summary(){
  const n=this.agents.length;
  return {tick:this.tick,population:n,meanEnergy:n?this.agents.reduce((s,a)=>s+a.energy,0)/n:0,
   meanFeeling:n?this.agents.reduce((sum,a)=>sum+this.feeling(a),0)/n:0,
   learningUpdates:this.agents.reduce((sum,a)=>sum+a.brain.updates,0),maxGeneration:this.maxGeneration,
   births:this.stats.births,deaths:this.stats.deaths,atLimit:n>=this.limit,
   survivingFounders:new Set(this.agents.map(a=>a.founderId)).size};
 }
 record(){const point=this.summary();if(this.history.at(-1)?.tick===this.tick)this.history[this.history.length-1]=point;else this.history.push(point);if(this.history.length>800)this.history.shift();}
 /** Балансы — проверяемые инварианты, а не оценки поведения.
  * Энергия пищи в мире + инвентаре + желудках + теле учитывается одним запасом.
  * Полный баланс включает расход, выброшенную пищу, потери при смерти и насыщении.
  */
 balances(){
  const worldFood=this.tiles.reduce((s,c)=>s+c.food,0);
  const inventory=this.agents.reduce((s,a)=>s+a.inventory,0);
  const stored=this.agents.reduce((s,a)=>s+a.energy+a.stomach,0)+(worldFood+inventory)*RULES.foodEnergy;
  const input=this.initialPopulation*RULES.initialEnergy+(this.initialFood+this.stats.regrown)*RULES.foodEnergy;
  const losses=this.stats.spent+this.stats.birthSpent+this.stats.deathEnergy+
   this.stats.overflow+this.stats.discardedFood*RULES.foodEnergy;
  return {foodError:worldFood+inventory+this.stats.eaten+this.stats.discardedFood-this.initialFood-this.stats.regrown,
   energyError:stored+losses-input};
 }
 genomeFile(a){return {format:'big-evolution-genome',...genomeMetadata(a.genome),modelVersion:MODEL_VERSION,policyContext:{stateEncoding:layoutForType(a.brain.controllerType)?.network.inputSchema??'energy-inventory-food-pain-stomach-v1',traitScale:TRAIT_SCALE_VERSION,bodySenses:BODY_SENSE_VERSION,directions:'personal-facing-v1'},actionLabels:ACTIONS.slice(),genes:a.genome.slice(),
  source:{seed:this.seed,tick:this.tick,id:a.id,generation:a.generation,children:a.children},rules:{...RULES,regrowInterval:this.foodSettings.regrowInterval,birthThreshold:this.reproduction.energy,birthHealth:this.reproduction.health},environment:{scenario:this.scenario,...this.foodSettings,geography:this.geographyInfo,reproduction:{...this.reproduction}}};}
 /** JSON-снимок пригоден для точного сравнения запусков в автоматических проверках. */
 snapshot(){return {seed:this.seed,tick:this.tick,rng:this.random.state,cognitiveRng:this.cognitiveRandom.state,bodyRng:this.bodyRandom.state,neuralRng:this.neuralRandom.state,mutationRng:this.mutationRandom.state,agents:this.agents.map(a=>({...a,brain:{...a.brain,spatialCache:undefined,memory:[...a.brain.memory],longMemory:[...a.brain.longMemory]}})),
  mutationProtocol:this.mutationProtocol,learningEnabled:this.learningEnabled,memoryEnabled:this.memoryEnabled,reproduction:{...this.reproduction},geography:this.geographyInfo,foodSettings:this.foodSettings,foodCycleStart:this.foodCycleStart,foodIslands:this.foodIslands,
  environmentRevision:this.environmentRevision,environmentChanges:this.environmentChanges,tiles:this.tiles,stats:this.stats,records:[...this.records],events:this.events,history:this.history};}
}

/** Исторические регрессии v1–v11. Не используется обычной игрой0.32. */
export class LegacyEvolution extends Evolution{constructor(options={}){super({...options,temporal:false,brainType:options.brainType??SET_BRAIN_TYPE});}}
