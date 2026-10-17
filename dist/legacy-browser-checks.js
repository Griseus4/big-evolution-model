/** Исполняемые проверки механизмов без Node.js и внешних библиотек.
 * Запускаются пользователем в Worker. Управляемые геномы/травмы — только фикстуры,
 * они не становятся настройками настоящих основателей. Каждая проверка изолирована.
 * Проверяем наблюдаемые последствия; красная ошибка не равна вымиранию в опыте.
 */
import {LegacyEvolution as WorldEvolution,ACTIONS,GENOME_VERSION,GENE_COUNT,COGNITIVE_GENES,RULES,validateGenomeFile,actionEnergyCost,WORLD_WIDTH,WORLD_HEIGHT,worldHexAt,hexCenter,worldDistance,memoryWorldPosition,mutateGenome} from './evolution.js';
import {ACTION_COUNT,BIRTH_ACTION,DEPOSIT_ACTION,GENOME_SIZES,BODY_GENE_OFFSET,BODY_WEIGHT_COUNT,STATE_COUNT} from './policy-layout.js';
import {REPRODUCTION_PROFILES,reproductionProfile} from './reproduction.js';
import {createBrain,observe,getMemory,rememberDecision,rememberExperience,memoryStrength,memoryBelief,cognitiveTraits,wellbeing,learn,spatialContext,actionFeatures,spatialInstinct,learnedValue} from './cognition.js';
import {localNeighbours,rotate,worldAxial,localDistance} from './navigation.js';
import {LifeHistory,lifeRow,sampleLife} from './life-history.js';
import {analyzeGenome,parseGenomeText,compareGenomes,makeGenomeAnalysisReport,genomeAnalysisMarkdown,MAX_GENOME_BYTES} from './genome-analysis.js';
import {bodySenses,bodySenseValue,BODY_SENSE_VERSION} from './brain-parameters.js';
import {BRAIN_TYPE,DECISION_SCHEMA,evaluateController,selectControllerDecision} from './brain-controller.js';
import {Random} from './simulation.js';
import {OPTIMIZATION_CHECKS} from './neural-optimization-checks.js';
import {PERFORMANCE_CHECKS} from './performance-checks.js';
import {NEIGHBOUR_CHECKS} from './neighbour-checks.js';
import {MUTATION_CHECKS} from './mutation-checks.js';
import {FOOD_ISLAND_CHECKS} from './food-island-checks.js';
import {TRAIL_CHECKS} from './resident-trail-checks.js';
import {SET_BRAIN_CHECKS} from './set-brain-checks.js';
import {NEURAL_CHECKS} from './neural-checks.js';
import {BENCHMARK_CHECKS} from './benchmark-checks.js';
import {BENCHMARK_VERSION_CHECKS} from './benchmark-version-checks.js';
import {LAB_REPORT_CHECKS} from './lab-report-checks.js';
import {CONTINUATION_CHECKS} from './continuation-checks.js';
import {validateFoodSettings} from './food-settings.js';
import {validateExperimentConfig as validateCurrentExperimentConfig,experimentJobs,summarizeExperiments} from './experiment-runner.js';
import {GEOGRAPHY_PROFILES,TERRAIN_LIMITS,validateGeography,geographicNeighbours,riverPath,carveRiverFords,classifyLandRegions,balancedFounderPositions} from './geography.js';
// Исторические проверки явно сохраняют свои табличные фикстуры и пищевые условия.
class Evolution extends WorldEvolution {constructor(options={}){super({population:48,limit:180,mutationRate:.06,foodSources:96,foodRegrowInterval:80,brainType:BRAIN_TYPE,heritableMutations:false,individualFood:false,...options});}}
const validateExperimentConfig=input=>validateCurrentExperimentConfig({foodSources:96,foodRegrowInterval:80,brainType:BRAIN_TYPE,heritableMutations:false,individualFood:false,...input});
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
const genes=()=>Array(GENE_COUNT).fill(0);
function fixture(options={}){
 const s=new Evolution({population:1,limit:3,seed:42,...options}),a=s.agents[0];
 for(const cell of s.tiles){cell.risk=0;cell.food=0;cell.maxFood=0;cell.terrain='land';}
 a.x=12;a.y=12;a.frameRotation=0;a.genome=genes();a.brain=createBrain(a.genome);s.rebuildOccupancy();return {s,a};
}
function choose(s,action){s.choose=a=>s.evaluate(a).find(o=>o.action===action);}
function experience(b,p,before,after,tick){rememberDecision(b,p,tick);rememberExperience(b,{choice:{row:0,action:8},beforeFeeling:before},after,tick+1);}
const place=(q=0,r=0,food=0)=>({q,r,food,terrain:'land'});
const choiceView=(s,a)=>s.evaluate(a).map(({action,score,features,probability})=>({action,score,features,probability}));
/** Зафиксированный оценщик 0.15 только для проверки эквивалентности.
 * Не используется игрой; учитываем прежний порядок сумм, признаки и softmax.
 * Полный цикл 0.15 не копируем: его потеря senses исправлена намеренно.
 */
function referenceStateV015(a,food){
 const energy=a.energy<30?0:a.energy<70?1:2;
 return ((((energy*2+Number(a.inventory>0))*2+Number(food))*2+Number(a.pain>1))*2+Number(a.stomach>0));
}
function evaluateV015Reference(s,a){
  if(!a.alive)return [];
  const row=referenceStateV015(a,s.tile(a.x,a.y).food>0),positions=localNeighbours(a.brain),options=[];
  // Запасы и желудок — собственное состояние до действия. Не создаём новые
  // строки/цели и не сообщаем скрытый запас мира или полезность рождения.
  const senses=bodySenses(a,RULES.inventoryCapacity,RULES.stomachCapacity);
  const potentials=s.memoryEnabled?spatialContext(a.brain,[a.brain.position,...positions],s.tick):Array(7).fill(0);
  const offset=STATE_COUNT*ACTION_COUNT;
  for(let action=0;action<ACTION_COUNT;action++){
   let destination={x:a.x,y:a.y},localDestination={...a.brain.position},extra=0;
   if(action<6){
    localDestination=positions[action];destination=memoryWorldPosition(a,localDestination);const cell=s.tile(destination.x,destination.y);
    if(!cell||cell.terrain==='water')continue;
    extra=a.genome[offset]*Number(cell.food>0)+a.genome[offset+1]*Number(cell.risk>0)+
     a.genome[offset+2]*Number(a.lastAction===action);
   }else if(action===6&&(a.inventory>=RULES.inventoryCapacity||s.tile(a.x,a.y).food===0))continue;
   else if(action===7&&(a.inventory===0||a.stomach>RULES.stomachCapacity-RULES.foodEnergy+1e-9))continue;
   else if(action===BIRTH_ACTION&&(s.reproduction.automatic||!s.birthAvailability(a).eligible))continue;
   else if(action===DEPOSIT_ACTION&&!s.canDeposit(a))continue;
   const cell=s.tile(destination.x,destination.y);
   const features=actionFeatures(a.brain,{action,destination:localDestination,current:a.brain.position,cell:{food:cell.food,hazard:cell.risk>0},previousAction:a.lastAction,
    energy:a.energy,tick:s.tick,potentials});
   if(!s.memoryEnabled)features.fill(0,3);
   const bodyInnate=bodySenseValue(a.brain.bodyGenes,action,senses);
   const bodyExperience=s.learningEnabled?a.brain.scale*bodySenseValue(a.brain.bodyWeights,action,senses):0;
   const innate=a.genome[row*ACTION_COUNT+action]+extra+spatialInstinct(a.brain,features)+bodyInnate;
   const experience=s.learningEnabled?learnedValue(a.brain,row,action,features,senses):0;
   options.push({action,label:ACTIONS[action],destination,localDestination,score:innate+experience,innate,
    experience,features,senses:senses.slice(),bodyInnate,bodyExperience,row});
  }
  // Softmax превращает произвольные числа в вероятности, сохраняя случайный выбор.
  // Вычитание максимума обеспечивает устойчивость экспоненты.
  const peak=Math.max(...options.map(o=>o.score));
  const sum=options.reduce((n,o)=>n+Math.exp(o.score-peak),0);
  return options.map(o=>({...o,probability:Math.exp(o.score-peak)/sum}));
 }

export const BROWSER_CHECKS=[
 ...SET_BRAIN_CHECKS,
 ...CONTINUATION_CHECKS,
 ...LAB_REPORT_CHECKS,
 ...BENCHMARK_CHECKS,
 ...BENCHMARK_VERSION_CHECKS,
 ...NEURAL_CHECKS,
 ...MUTATION_CHECKS,
 ...FOOD_ISLAND_CHECKS,
 ...TRAIL_CHECKS,
 ...NEIGHBOUR_CHECKS,
 ...PERFORMANCE_CHECKS,
 ...OPTIMIZATION_CHECKS,
 {id:'controller-boundary',label:'Пакет мозга не содержит мировых координат/риска и не ссылается на тело',run(){
  const {s,a}=fixture(),frame=s.decisionFrame(a),request=frame.request;
  assert(request.schema===DECISION_SCHEMA,'Нет версии контракта');
  const inspect=value=>{if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){
   assert(!['x','y','risk','maxFood','regrowInterval','agents','genome','destination'].includes(key),'Скрытое поле '+key);inspect(child);
  }};inspect(request);
  const energy=a.energy,q=a.brain.position.q,food=s.tile(a.x,a.y).food;
  request.observation.body.energy=-9;request.observation.position.q=900;request.candidates[0].cell.food=999;
  assert(a.energy===energy&&a.brain.position.q===q&&s.tile(a.x,a.y).food===food,'Пакет меняет мир/тело');
 }},
 {id:'controller-parity',label:'Новый контроллер сохраняет оценки/вероятности оценщика 0.15',run(){
  const view=options=>options.map(({action,row,score,innate,experience,bodyInnate,bodyExperience,features,senses,probability})=>({action,row,score,innate,experience,bodyInnate,bodyExperience,features,senses,probability}));
  for(const memory of [false,true])for(const learning of [false,true]){
   const {s,a}=fixture({memory,learning});a.genome=genes().map((_,i)=>(i%17-8)/5);a.brain=createBrain(a.genome);
   a.energy=45;a.inventory=2;a.stomach=33;a.pain=3;a.lastAction=0;
   a.brain.weights.fill(.2);a.brain.experience.fill(.13);a.brain.bodyWeights.fill(-.1);a.brain.scale=.7;
   if(memory)observe(a.brain,[place(7,0,3),place(0,0,0)],place(0),0);
   equal(view(s.evaluate(a)),view(evaluateV015Reference(s,a)),'Изменён оценщик при режимах '+memory+'/'+learning);
  }
 }},
 {id:'controller-rng',label:'Просмотр оценок не расходует RNG, выбор расходует один прежний бросок',run(){
  const {s,a}=fixture(),before=[s.random.state,s.cognitiveRandom.state,s.bodyRandom.state];
  const options=evaluateController(a.brain,a.genome,s.decisionFrame(a).request);s.evaluate(a);s.evaluate(a);
  equal([s.random.state,s.cognitiveRandom.state,s.bodyRandom.state],before,'Просмотр расходует RNG');
  const rng=new Random(before[0]),expected=selectControllerDecision(options,rng.next()),actual=s.choose(a);
  assert(actual.id===expected.id&&s.random.state===rng.state,'Бросок/вариант изменён');
 }},
 {id:'controller-routing',label:'Мозг оценивает только доступные id, мировое исполнение отделено',run(){
  const {s,a}=fixture(),frame=s.decisionFrame(a),options=evaluateController(a.brain,a.genome,frame.request);
  assert(new Set(options.map(o=>o.id)).size===options.length,'Повтор id');
  assert(options.every(o=>!Object.hasOwn(o,'destination')),'Мозгу передано назначение мира');
  const decision=options[0],executable=s.executableDecision(frame,decision),x=frame.executionDestinations.get(decision.id).destination.x;
  executable.destination.x=999;assert(frame.executionDestinations.get(decision.id).destination.x===x,'Исполнитель изменил исходное назначение');
  let rejected=false;try{s.executableDecision(frame,{...decision,id:'invented'});}catch{rejected=true;}assert(rejected,'Принят придуманный id');
  rejected=false;try{s.executableDecision(frame,{...decision,action:99});}catch{rejected=true;}assert(rejected,'Id позволил подменить действие');
  rejected=false;try{evaluateController(a.brain,a.genome,{...frame.request,schema:'unknown'});}catch{rejected=true;}assert(rejected,'Неизвестная схема принята');
  assert(s.genomeFile(a).brainType===BRAIN_TYPE&&s.genomeFile(a).version===6,'Контекст мозга/формат потерян');
  rejected=false;try{validateGenomeFile({...s.genomeFile(a),brainType:'unknown'});}catch{rejected=true;}assert(rejected,'Чужой мозг интерпретирован как таблица');
 }},
 {id:'controller-senses-step',label:'Основной цикл копирует ощущения до действия и обучает личные пары',run(){
  const {s,a}=fixture();a.genome[COGNITIVE_GENES.find(g=>g.key==='energy').index]=8;a.brain=createBrain(a.genome);
  a.energy=80;a.inventory=2;a.stomach=22;choose(s,8);s.step();
  const pending=a.brain.pending.choice.senses;
  assert(pending[0]===2/3&&Math.abs(pending[1]-(22-RULES.digestionRate)/RULES.stomachCapacity)<1e-12,'Потеряны ощущения до ожидания');
  s.step();assert(a.brain.updates===1&&a.brain.bodyWeights[8*2]!==0&&a.brain.bodyWeights[8*2+1]!==0,'Цикл не обучает новые пары');
  equal(a.brain.traces[0].senses,pending,'В след попало позднее тело');
 }},
 {id:'controller-terminal',label:'Терминальный переход хранит исходный запас и завершает обучение',run(){
  const {s,a}=fixture();a.genome[COGNITIVE_GENES.find(g=>g.key==='energy').index]=8;a.brain=createBrain(a.genome);
  a.energy=0;a.health=1;a.inventory=2;choose(s,8);s.step();
  assert(!a.alive&&a.brain.updates===1&&a.brain.pending===null,'Смерть оставила незавершённый переход');
  equal(a.brain.traces[0].senses,[2/3,0],'Потерян исходный запас при смерти');
 }},
 // Восприятие количества — новая возможность, не требование победы эволюции.
 {id:'body-input',label:'Ощущения тела нормированы и не читают состояние мира',run(){
  equal(bodySenses({inventory:1,stomach:33},3,66),[1/3,.5],'Неверная доля');
  equal(bodySenses({inventory:9,stomach:100},3,66),[1,1],'Нет насыщения');
  equal(bodySenses({inventory:0,stomach:0},3,66),[0,0],'Пустое тело не нуль');
 }},
 {id:'body-inventory',label:'Одна и две порции различаются при одной строке состояния',run(){
  const {s,a}=fixture();a.genome[BODY_GENE_OFFSET+7*2]=3;a.brain=createBrain(a.genome);a.inventory=1;
  const row=s.state(a),one=s.evaluate(a).find(o=>o.action===7);a.inventory=2;const two=s.evaluate(a).find(o=>o.action===7);
  assert(s.state(a)===row&&Math.abs(two.score-one.score-1)<1e-12,'Количество не повлияло');
  assert(two.probability>one.probability,'Добавка одинакова всем действиям');
 }},
 {id:'body-stomach',label:'Наполненность желудка различается без новых строк и приказа ждать',run(){
  const {s,a}=fixture();a.genome[BODY_GENE_OFFSET+8*2+1]=-3;a.brain=createBrain(a.genome);a.stomach=22;
  const row=s.state(a),one=s.evaluate(a).find(o=>o.action===8);a.stomach=44;const two=s.evaluate(a).find(o=>o.action===8);
  assert(s.state(a)===row&&Math.abs(two.score-one.score+1)<1e-12,'Доля желудка не повлияла');
  assert(two.probability<one.probability,'Знак веса заменён готовой стратегией');
 }},
 {id:'body-modes',label:'Восприятие тела работает без памяти и TD, личные веса исключаются при выключении TD',run(){
  const {s,a}=fixture({memory:false,learning:false});a.inventory=2;a.genome[BODY_GENE_OFFSET+8*2]=3;a.brain=createBrain(a.genome);a.brain.bodyWeights[8*2]=2;
  // Общая фикстура очищает пищу. Для доступности сбора нужны порция на земле
  // и свободное место в запасе; отсутствие пищи не является запретом мозга.
  const cell=s.tile(a.x,a.y);cell.food=1;
  const option=s.evaluate(a).find(o=>o.action===8);
  assert(option.bodyInnate===2&&option.experience===0&&option.bodyExperience===0,'Режимы подавили тело/включили TD');
  assert(s.evaluate(a).some(o=>o.action===6),'Восприятие запретило сбор');
  cell.food=0;assert(!s.evaluate(a).some(o=>o.action===6),'Разрешён сбор без пищи');
  cell.food=1;a.inventory=RULES.inventoryCapacity;
  assert(!s.evaluate(a).some(o=>o.action===6),'Разрешён сбор при полном запасе');
 }},
 {id:'body-learning',label:'TD меняет личную пару выбранного действия и не переписывает геном',run(){
  const {s,a}=fixture();a.inventory=2;a.stomach=22;const original=a.genome.slice(),choice=s.evaluate(a).find(o=>o.action===8);
  learn(a.brain,choice,{beforeFeeling:0,afterFeeling:50,nextValue:0,terminal:false,tick:1});
  assert(a.brain.bodyWeights[8*2]>0&&a.brain.bodyWeights[8*2+1]>0,'Нет личного обновления');
  assert(a.brain.bodyWeights.every((v,i)=>Math.floor(i/2)===8||v===0),'Изменены чужие действия');
  equal(a.genome,original,'Опыт записан в геном');
 }},
 {id:'body-trace',label:'След сохраняет ощущения при выборе, а не после действия',run(){
  const {s,a}=fixture();a.inventory=2;a.stomach=33;const choice=s.evaluate(a).find(o=>o.action===8);a.inventory=0;a.stomach=0;
  learn(a.brain,choice,{beforeFeeling:0,afterFeeling:50,nextValue:0,terminal:false,tick:1});choice.senses.fill(0);
  equal(a.brain.traces[0].senses,[2/3,.5],'Потеряно состояние до действия');
 }},
 {id:'body-newborn',label:'Ребёнок наследует веса тела, но не личные поправки родителя',run(){
  const {s,a}=fixture({mutations:false});a.age=100;a.energy=90;a.genome[BODY_GENE_OFFSET]=2;a.brain=createBrain(a.genome);a.brain.bodyWeights.fill(3);
  const child=s.reproduce(a);assert(child&&child.genome[BODY_GENE_OFFSET]===2&&child.brain.bodyGenes[0]===2,'Потеряно наследование');
  assert(child.brain.bodyWeights.length===BODY_WEIGHT_COUNT&&child.brain.bodyWeights.every(v=>v===0),'Скопирован личный опыт');
 }},
 {id:'body-analysis',label:'Анализ отличает новые веса от отсутствующих v5 и неизвестных шкал',run(){
  const old=Array(550).fill(0),g=validateGenomeFile({format:'big-evolution-genome',version:5,genes:old});
  assert(g.slice(BODY_GENE_OFFSET).every(v=>v===0),'Импорт добавил склонность');g[BODY_GENE_OFFSET+7*2]=2;
  const a=analyzeGenome({format:'big-evolution-genome',version:5,genes:old}),b=analyzeGenome({format:'big-evolution-genome',version:6,genes:g,policyContext:{bodySenses:BODY_SENSE_VERSION}}),c=compareGenomes(a,b);
  assert(c.sharedGenes===550&&c.changedGenes===0&&c.onlyB===22,'Новые веса выданы за изменение старых');
  assert(a.properties.find(p=>p.key==='body-7-0').raw===null&&b.properties.find(p=>p.key==='body-7-0').raw===2,'Отсутствие/индекс потеряны');
  const unknown=analyzeGenome({format:'big-evolution-genome',version:6,genes:g,policyContext:{bodySenses:'unknown'}});
  assert(!unknown.bodySenseKnown&&compareGenomes(b,unknown).properties.find(p=>p.key==='body-7-0').delta===null,'Неизвестная шкала сравнена');
 }},
 // Анализатор не создаёт мир: проверяем смысл схем, неполноту и экспорт.
 {id:'analysis-schemas',label:'Расшифровка сохраняет исходные размеры и отсутствующие свойства v1–v6',run(){
  for(const [version,size]of Object.entries(GENOME_SIZES).filter(([v])=>Number(v)<=6)){
   const v=Number(version),g=Array.from({length:size},(_,i)=>(i%101-50)/10),a=analyzeGenome({format:'big-evolution-genome',version:v,genes:g});
   const columns=v>=5?11:v===4?10:9;assert(a.geneCount===size&&a.columns===columns&&a.policy.length===48,'Схема изменена');
   equal(a.policy.flatMap(r=>r.scores),g.slice(0,48*columns),'Сдвинута таблица');
   const present=v===1?3:v===2?18:v===6?44:22;assert(a.properties.filter(p=>p.present).length===present,'Подставлены отсутствующие свойства');
   for(const p of a.properties)assert(p.present?p.raw===g[p.index]:p.index===null&&p.raw===null&&p.derived===null,'Оригинальный индекс/отсутствие неверны');
  }
 }},
 {id:'analysis-mixed-versions',label:'Одинаковые v4/v5 сравниваются по смыслу, новое действие отдельно',run(){
  const old=Array(502).fill(0),expanded=validateGenomeFile({format:'big-evolution-genome',version:4,genes:old});
  const c=compareGenomes(analyzeGenome({format:'big-evolution-genome',version:4,genes:old}),analyzeGenome({format:'big-evolution-genome',version:5,genes:expanded.slice(0,550)}));
  assert(c.sharedGenes===502&&c.changedGenes===0&&c.onlyA===0&&c.onlyB===48,'Новое действие посчитано изменённым/старые сдвинуты');assert(c.policy.every(r=>r.deltas[10]===null),'Отсутствие заменено нулём');
 }},
 {id:'analysis-difference-direction',label:'Разность B − A и рейтинг не смещаются при новой колонке',run(){
  const ga=Array(502).fill(0),gb=Array(550).fill(0);gb[45*11+9]=-2;
  const c=compareGenomes(analyzeGenome({format:'big-evolution-genome',version:4,genes:ga}),analyzeGenome({format:'big-evolution-genome',version:5,genes:gb}));
  assert(c.changedGenes===1&&c.changedPolicyRows===1&&c.policy[45].deltas[9]===-2&&c.rankedDifferences[0].id==='policy-45-9','Неверная строка/знак');
 }},
 {id:'analysis-scaled-memory',label:'Известные гены памяти расшифровываются в 25 и 54 места',run(){
  const g=Array(502).fill(0);g[483+15]=-1.6897511526942253;g[483+16]=1.8353142032306642;
  const a=analyzeGenome({format:'big-evolution-genome',version:4,genes:g});assert(a.properties.find(p=>p.key==='shortCapacity').derived===25&&a.properties.find(p=>p.key==='longCapacity').derived===54,'Неверная вместимость');
  const oldest=analyzeGenome({format:'big-evolution-genome',version:1,genes:Array(435).fill(0)});assert(oldest.properties.find(p=>p.key==='shortCapacity').derived===null,'Древнему файлу выдумана память');
 }},
 {id:'analysis-input-errors',label:'Анализ отвергает испорченный JSON, чужой формат, версии и числа',run(){
  const invalid=['{',JSON.stringify({format:'big-evolution-tests',version:GENOME_VERSION,genes:genes()}),JSON.stringify({format:'big-evolution-genome',version:9,genes:genes()}),JSON.stringify({format:'big-evolution-genome',version:5,genes:Array(550).fill(9)}),' '.repeat(MAX_GENOME_BYTES+1)];
  for(const raw of invalid){let rejected=false;try{parseGenomeText(raw);}catch{rejected=true;}assert(rejected,'Неверный файл принят');}
  let rejected=false;try{analyzeGenome({format:'big-evolution-genome',version:5,genes:Array(550).fill(NaN)});}catch{rejected=true;}assert(rejected,'NaN принят');
 }},
 {id:'analysis-unknown-convention',label:'Неизвестные шкалы и состояния ограничивают разбор, не подменяются',run(){
  const a=analyzeGenome({format:'big-evolution-genome',version:GENOME_VERSION,genes:genes(),policyContext:{stateEncoding:'unknown',traitScale:'unknown'}});
  assert(a.properties.every(p=>p.derived===null&&p.share===null)&&a.policy.every(r=>r.state===null),'Неизвестные правила подменены');
  const b=analyzeGenome({format:'big-evolution-genome',version:GENOME_VERSION,genes:genes()}),c=compareGenomes(a,b);assert(!c.policyComparable&&c.changedPolicyRows===null&&c.policy.every(r=>r.deltas.every(x=>x===null)),'Несопоставимые состояния сравнили');
 }},
 {id:'analysis-no-mutation',label:'Расшифровка и сравнение не меняют исходные файлы',run(){
  const data={format:'big-evolution-genome',version:GENOME_VERSION,genes:Object.freeze(genes()),source:Object.freeze({id:3,generation:4}),rules:Object.freeze({foodEnergy:22})};Object.freeze(data);
  const before=JSON.stringify(data),a=analyzeGenome(data),b=analyzeGenome(data);compareGenomes(a,b);makeGenomeAnalysisReport([a,b]);assert(JSON.stringify(data)===before,'Переписаны исходные данные');
 }},
 {id:'analysis-export',label:'JSON и Markdown сохраняют смысл сравнения и одиночного B',run(){
  const a=parseGenomeText('\uFEFF'+JSON.stringify({format:'big-evolution-genome',version:1,genes:Array(435).fill(0)}),{name:'старый.json'});
  const r=makeGenomeAnalysisReport([a],{createdAt:'2026-10-13T00:00:00Z',slotLabels:['B']}),md=genomeAnalysisMarkdown(r),copy=JSON.parse(JSON.stringify(r));
  assert(copy.format==='big-evolution-genome-analysis'&&copy.version===3&&copy.genomes[0].geneCount===435,'Неверный экспорт');assert(md.includes('## B —')&&md.includes('Отсутствует')&&md.includes('Личный опыт'),'Неверные пояснения');
 }},

 // Выкладывание: физические границы и перенос, не требование выгодной стратегии.
 {id:'deposit-availability',label:'Положить можно только имеющуюся порцию на неполную сушу',run(){
  const {s,a}=fixture();assert(!s.canDeposit(a)&&!s.evaluate(a).some(o=>o.action===DEPOSIT_ACTION),'Пустой инвентарь');
  a.inventory=1;const c=s.tile(a.x,a.y);c.food=9;assert(s.canDeposit(a)&&s.evaluate(a).some(o=>o.action===DEPOSIT_ACTION),'Граница 9');
  for(const food of [10,24]){c.food=food;assert(!s.canDeposit(a)&&!s.depositFood(a)&&a.inventory===1&&c.food===food,'Превышен предел или потеряна порция');}
  c.food=0;c.terrain='water';assert(!s.canDeposit(a)&&!s.depositFood(a),'Можно положить в воду');c.terrain='land';a.alive=false;assert(!s.depositFood(a),'Мёртвый положил');
 }},
 {id:'deposit-transfer-cost',label:'Положить переносит одну порцию и стоит ровно 0.36',run(){
  const {s,a}=fixture();s.initialFood=2;s.stats.spent=18;a.energy=50;a.inventory=2;choose(s,DEPOSIT_ACTION);s.step();
  assert(s.tile(a.x,a.y).food===1&&a.inventory===1&&a.stomach===0,'Неверный перенос');
  assert(Math.abs(a.energy-49.64)<1e-10&&actionEnergyCost(DEPOSIT_ACTION)===.36&&RULES.waitCost<.36,'Неверная цена');
  assert(s.stats.deposited===1&&a.life.deposited===1&&s.stats.actions[DEPOSIT_ACTION]===1,'Потерян счётчик');
  assert(s.stats.regrown===0&&s.stats.gathered===0&&s.stats.eaten===0&&s.balances().foodError===0&&Math.abs(s.balances().energyError)<1e-8,'Пища создана или баланс нарушен');
 }},
 {id:'deposit-last-place',label:'Несколько жителей не могут вместе переполнить последнюю порцию',run(){
  const {s,a}=fixture({population:2}),other=s.agents[1];other.x=a.x;other.y=a.y;a.inventory=1;other.inventory=1;s.tile(a.x,a.y).food=9;
  assert(s.depositFood(a),'Последнее место не занято');assert(!s.canDeposit(other)&&!s.depositFood(other)&&other.inventory===1&&s.tile(a.x,a.y).food===10,'Второе действие переполнило клетку');
 }},
 {id:'deposit-shared-pickup',label:'Оставленную пищу может подобрать другой житель',run(){
  const {s,a}=fixture({population:2}),other=s.agents[1];other.x=a.x;other.y=a.y;a.inventory=1;s.initialFood=1;
  s.choose=who=>s.evaluate(who).find(o=>o.action===(who===a?DEPOSIT_ACTION:8));s.step();
  assert(s.tile(a.x,a.y).food===1,'Не оставлена');s.choose=who=>s.evaluate(who).find(o=>o.action===(who===other?6:8));s.step();
  assert(other.inventory===1&&a.inventory===0&&s.tile(a.x,a.y).food===0,'Чужая еда недоступна');assert(s.balances().foodError===0&&Math.abs(s.balances().energyError)<1e-8,'Баланс чужого подбора');
 }},
 {id:'deposit-source-room',label:'Перенос освобождает источник для очередного пополнения',run(){
  const {s,a}=fixture();const origin=s.tile(a.x,a.y);origin.food=1;origin.maxFood=1;s.initialFood=1;s.foodSettings.regrowInterval=2;
  choose(s,6);s.step();assert(origin.food===0&&a.inventory===1,'Источник не освобождён');a.x++;choose(s,DEPOSIT_ACTION);s.step();
  const pile=s.tile(a.x,a.y);assert(origin.food===1&&pile.food===1&&pile.maxFood===0&&s.stats.regrown===1,'Рост или запас неверен');
  assert(s.foodCycleStart===0&&s.nextFoodRegrowth()===4&&s.balances().foodError===0&&Math.abs(s.balances().energyError)<1e-8,'Перенос изменил цикл/баланс');
 }},
 {id:'deposit-on-source',label:'Выкладывание не повышает ёмкость или скорость источника',run(){
  const {s,a}=fixture();const c=s.tile(a.x,a.y);c.food=3;c.maxFood=3;a.inventory=1;s.initialFood=4;s.foodSettings.regrowInterval=2;
  choose(s,DEPOSIT_ACTION);s.step();choose(s,8);s.step();assert(c.food===4&&c.maxFood===3&&s.stats.regrown===0,'Появилось производство/изменена ёмкость');
  assert(s.balances().foodError===0&&Math.abs(s.balances().energyError)<1e-8,'Баланс запаса на источнике');
 }},
 {id:'deposit-td',label:'Стоимость выкладывания относится к его колонке обучения',run(){
  const {s,a}=fixture();a.genome[COGNITIVE_GENES.find(g=>g.key==='energy').index]=8;a.brain=createBrain(a.genome);a.energy=50;a.inventory=1;const row=s.state(a);
  choose(s,DEPOSIT_ACTION);s.step();choose(s,8);s.step();assert(a.brain.lastLearning.action===DEPOSIT_ACTION&&a.brain.experience[row*ACTION_COUNT+DEPOSIT_ACTION]<0,'Стоимость не учтена в новом действии');
 }},
 {id:'deposit-memory',label:'Житель видит оставленные 10 порций, признаки остаются ограниченными',run(){
  const {s,a}=fixture();a.inventory=1;s.tile(a.x,a.y).food=9;choose(s,DEPOSIT_ACTION);s.step();
  const record=getMemory(a.brain,'0,0');assert(record.food===10&&record.maxFoodSeen===10,'Скрыта часть запаса');
  const belief=memoryBelief(record,s.tick+100000,a.brain.traits);assert(belief.food<=6&&belief.uncertainty>=0&&belief.uncertainty<=1,'Запас расширил шкалу признаков');
 }},
 {id:'deposit-history',label:'Истории сохраняют выкладывание отдельно от поеданий',run(){
  const {s,a}=fixture();a.inventory=2;s.initialFood=2;choose(s,DEPOSIT_ACTION);s.step();s.step();s.stats.spent+=a.energy;a.energy=0;a.health=1;choose(s,8);s.step();
  const report=s.lifeReport(),row=report.dead[0];assert(row.deposited===2&&row.actions[DEPOSIT_ACTION]===2&&report.completed.feeding.deposited===2&&report.completed.feeding.depositActionFraction===2/3,'Сводка потеряла выкладывание');
  assert(row.gathered===0&&row.eaten===0&&row.feedingActionFraction===0&&s.balances().foodError===0&&Math.abs(s.balances().energyError)<1e-8,'Выкладывание стало едой/потерей');
 }},

 // Первый патч географии. Это контроль генерации/размещения и ограничений,
 // а не требование выживания каждого случайного основателя или района.
 {id:'geography-repeatability',label:'География и старт воспроизводятся по seed',run(){
  for(const seed of [1,42,71,811]){
   const a=new Evolution({seed,population:8}),b=new Evolution({seed,population:8});
   equal(a.snapshot(),b.snapshot(),'Повтор карты/старта отличается');
   assert(a.geography==='lakes-rivers-v1'&&a.geographyInfo.founderPlacement==='balanced-land-v1','Новый профиль не выбран по умолчанию');
  }
 }},
 {id:'geography-water-contract',label:'Реки/озёра ограничены по площади, пища и жители на суше',run(){
  for(const seed of [23,42,104,577]){
   const s=new Evolution({seed,population:48}),g=s.geographyInfo,water=s.tiles.filter(c=>c.terrain==='water');
   assert(water.length>0&&water.length===g.waterCells&&water.length<=s.tiles.length*TERRAIN_LIMITS.targetWaterMax,'Неверный бюджет воды');
   assert(g.riverCount>0&&g.lakeCount>0,'Не созданы реки/озёра');assert(water.every(c=>!c.food&&!c.maxFood&&!c.risk),'Вода содержит пищу/опасность');
   assert(s.tiles.filter(c=>c.maxFood>0).length===96&&s.tiles.filter(c=>c.maxFood>0).every(c=>c.terrain==='land'),'Источники потеряны или на воде');
   assert(s.agents.every(a=>s.tile(a.x,a.y).terrain==='land'),'Основатель в воде');
   assert(s.tiles.filter(c=>c.feature==='ford').every(c=>c.terrain==='land'),'Брод непроходим');
  }
 }},
 {id:'geography-river-path',label:'Путь реки состоит из соседних гексов и имеет конечную длину',run(){
  const path=riverPath({x:0,y:3},{x:47,y:29},48,32,new Random(42));
  assert(path.length>1&&path.length<=160,'Неверная длина пути');assert(new Set(path.map(p=>`${p.x},${p.y}`)).size===path.length,'Путь зациклился');
  for(let i=0;i<path.length;i++){
   assert(path[i].x>=0&&path[i].x<48&&path[i].y>=0&&path[i].y<32,'Река вышла за карту');
   if(i)assert(worldDistance(path[i-1],path[i])===1,'Река перескочила клетку');
  }
  equal(path,riverPath({x:0,y:3},{x:47,y:29},48,32,new Random(42)),'Река не воспроизводится');
 }},
 {id:'geography-ford-connects',label:'Брод создаёт проходимый переход между берегами',run(){
  const width=11,height=9,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),terrain:i%width===5?'water':'land',feature:i%width===5?'river':null,food:0,maxFood:0,risk:0}));
  const path=tiles.filter(c=>c.terrain==='water').map(({x,y})=>({x,y}));assert(classifyLandRegions(tiles,width,height).length===2,'Фикстура не разделяет берега');
  const count=carveRiverFords(tiles,[path],width,height,{next:()=>.25});assert(count>0,'Брод не создан');
  assert(classifyLandRegions(tiles,width,height).length===1,'Брод не соединил берега');
  const ford=tiles.find(c=>c.feature==='ford');assert(ford.terrain==='land'&&geographicNeighbours(ford,width,height).some(p=>tiles[p.y*width+p.x].terrain==='land'),'Брод недоступен');
 }},
 {id:'founder-spatial-coverage',label:'Равномерный старт охватывает всю сушу без совпадений',run(){
  const tiles=Array.from({length:48*32},(_,i)=>({x:i%48,y:Math.floor(i/48),terrain:'land',food:0,risk:0}));
  const positions=balancedFounderPositions(tiles,64,42),quadrants=[0,0,0,0];
  assert(new Set(positions.map(p=>`${p.x},${p.y}`)).size===64,'Основатели совпадают');
  for(const p of positions)quadrants[Number(p.x>=24)+2*Number(p.y>=16)]++;
  equal(quadrants,[16,16,16,16],'Пустые/переполненные четверти ровной суши');
  const changed=tiles.map(c=>({...c,food:999,risk:1}));equal(positions,balancedFounderPositions(changed,64,42),'Старт подогнан под пищу/опасность');
 }},
 {id:'geography-genes-independent',label:'Профиль карты не сдвигает геномы или RNG жизни',run(){
  const worlds=GEOGRAPHY_PROFILES.map(p=>new Evolution({geography:p.id,population:12,seed:42})),base=worlds[0];
  for(const s of worlds){
   equal(s.agents.map(a=>a.genome),base.agents.map(a=>a.genome),'География изменила исходные гены');
   assert(s.random.state===base.random.state&&s.cognitiveRandom.state===base.cognitiveRandom.state,'Размещение расходовало RNG жизни');
   assert(s.agents.every(a=>!a.brain.memory.size&&!a.brain.longMemory.size&&a.brain.position.q===0&&a.brain.position.r===0),'Основателям вложено знание карты');
  }
 }},
 {id:'geography-regions-and-max-start',label:'Районы учитывают всю сушу и старт поддерживает 1000 особей',run(){
  const s=new Evolution({population:1000,limit:1000,seed:42}),g=s.geographyInfo;
  assert(s.agents.length===1000&&new Set(s.agents.map(a=>`${a.x},${a.y}`)).size===1000,'Максимальный равномерный старт потерян');
  assert(g.regions.reduce((n,r)=>n+r.cells,0)===g.landCells,'Районы потеряли сушу');
  assert(g.regions.reduce((n,r)=>n+r.initialFounders,0)===1000&&g.regions.reduce((n,r)=>n+r.initialSources,0)===96,'Исходный учёт районов неверен');
  assert(s.tiles.every(c=>c.terrain==='water'?c.regionId===-1:g.regions[c.regionId]?.cells>0),'Неверный номер района');
 }},
 {id:'geography-context-validation',label:'География сохраняется в заданиях/контексте и раздельных сводках',run(){
  const config=validateExperimentConfig({seeds:[42],steps:1000,parallel:1,population:1,limit:2,geography:'legacy-uniform-v1'}),jobs=experimentJobs(config),s=new Evolution(jobs[0]);
  assert(jobs.every(j=>j.geography==='legacy-uniform-v1')&&s.snapshot().geography.profile==='legacy-uniform-v1'&&s.genomeFile(s.agents[0]).environment.geography.profile==='legacy-uniform-v1','География потеряна');
  const groups=summarizeExperiments([{...jobs[0],status:'pending'},{...jobs[0],geography:'lakes-rivers-v1',status:'pending'}]);assert(groups.length===2,'Разные карты объединены в сводке');
  for(const id of ['unknown',null,17]){let rejected=false;try{validateGeography(id);}catch{rejected=true;}assert(rejected,'Принята неверная география');}
 }},
 // Эти проверки вмешательств исполняет пользователь. Проверяем сохранность
 // мира и бухгалтерию, а не требуем от случайных геномов успешной миграции.
 {id:'world-edit-preserves-life',label:'Изменение мира сохраняет жителей, память и случайность жизни',run(){
  const s=new Evolution({seed:42,population:4});s.advance(3);
  const protectedState=()=>JSON.stringify({tick:s.tick,agents:s.snapshot().agents,rng:s.random.state,cognitiveRng:s.cognitiveRandom.state,
   stats:s.stats,records:[...s.records],lineages:[...s.lineages],nextId:s.nextId,initialFood:s.initialFood,life:s.lifeReport()});
  const before=protectedState(),food=s.tiles.map(c=>c.food);
  const change=s.changeFoodEnvironment({foodSources:12,foodRegrowInterval:160,sourceCapacity:2,relocate:true});
  assert(change&&s.environmentRevision===1,'Вмешательство не записано');assert(protectedState()===before,'Изменены тела, память, статистика или RNG');
  equal(s.tiles.map(c=>c.food),food,'Лежащая еда перенесена/удалена');assert(s.foodSettings.sourceCount===12&&s.tiles.filter(c=>c.maxFood>0).every(c=>c.maxFood===2),'Параметры не применены');
  const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Нарушен баланс после перестановки');
 }},
 {id:'world-edit-noop-and-invalid',label:'Совпадающие/неверные настройки не меняют мир и цикл',run(){
  const s=new Evolution({population:1,foodSources:12});const before=JSON.stringify(s.snapshot());
  assert(s.changeFoodEnvironment({foodSources:12,foodRegrowInterval:80})===null,'Повторное применение создало изменение');
  assert(JSON.stringify(s.snapshot())===before,'Повторное применение сбросило состояние');
  const invalid=[{foodSources:-1},{foodSources:385},{foodRegrowInterval:0},{sourceCapacity:0},{sourceCapacity:25},{sourceCapacity:1.5},{sourceCapacity:'6'},{sourceCapacity:NaN},{relocate:'yes'}];
  for(const options of invalid){let rejected=false;try{s.changeFoodEnvironment({foodSources:12,foodRegrowInterval:80,...options});}catch{rejected=true;}assert(rejected,'Принят неверный ввод');assert(JSON.stringify(s.snapshot())===before,'Ошибка оставила частичное изменение');}
 }},
 {id:'world-edit-remove-sources',label:'Ноль источников сохраняет еду, но прекращает восстановление',run(){
  const s=new Evolution({population:1,limit:1,learning:false,memory:false,foodSources:12,foodRegrowInterval:10});choose(s,8);
  const food=s.tiles.map(c=>c.food),total=s.initialFood;
  s.changeFoodEnvironment({foodSources:0,foodRegrowInterval:10});s.advance(20);
  equal(s.tiles.map(c=>c.food),food,'Удаление источников уничтожило еду');assert(s.stats.regrown===0&&s.initialFood===total&&!s.foodIslands.length,'Производство не выключено');
  const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Потерялись порции бывших источников');
 }},
 {id:'world-edit-new-sources',label:'Добавленные источники получают пищу только после нового периода',run(){
  const s=new Evolution({population:1,limit:1,learning:false,memory:false,foodSources:0});choose(s,8);
  s.changeFoodEnvironment({foodSources:8,foodRegrowInterval:10});
  assert(s.tiles.filter(c=>c.maxFood>0).length===8&&s.tiles.every(c=>c.food===0)&&s.stats.regrown===0,'Подарен запас или неверное число источников');
  s.advance(9);assert(s.tiles.every(c=>c.food===0),'Еда появилась раньше нового периода');s.step();
  assert(s.stats.regrown===8&&s.tiles.filter(c=>c.maxFood>0).every(c=>c.food===1),'Первое пополнение не равно одной порции');
  const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Новые источники нарушили баланс');
 }},
 {id:'world-edit-capacity',label:'Уменьшение ёмкости сохраняет избыток и не переполняет источник',run(){
  const s=new Evolution({population:1,limit:1,learning:false,memory:false,foodSources:8,foodRegrowInterval:10});choose(s,8);
  const sourceKeys=s.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y]),food=s.tiles.map(c=>c.food);
  s.changeFoodEnvironment({foodSources:8,foodRegrowInterval:10,sourceCapacity:1});s.advance(10);
  equal(s.tiles.map(c=>c.food),food,'Избыток еды уничтожен/пополнен');equal(s.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y]),sourceKeys,'Смена ёмкости перенесла источники');assert(s.stats.regrown===0,'Пополнение сверх новой ёмкости');
  const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Смена ёмкости нарушила баланс');
 }},
 {id:'world-edit-cycle-phase',label:'Период отсчитывается от вмешательства, без мгновенного роста',run(){
  const s=new Evolution({population:1,limit:1,learning:false,memory:false,foodSources:1});choose(s,8);
  for(const c of s.tiles)c.food=0;s.initialFood=0;s.tick=37;
  s.changeFoodEnvironment({foodSources:1,foodRegrowInterval:10});assert(s.nextFoodRegrowth()===47,'Неверный срок');s.advance(9);
  assert(s.tick===46&&s.stats.regrown===0,'Период привязан к старому глобальному кратному');
  const start=s.foodCycleStart;s.changeFoodEnvironment({foodSources:1,foodRegrowInterval:10});assert(s.foodCycleStart===start,'Повторное применение продлило ожидание');
  s.step();assert(s.stats.regrown===1&&s.nextFoodRegrowth()===57,'Неверная граница нового цикла');
 }},
 {id:'world-edit-determinism',label:'Последовательность изменений воспроизводится и сохраняет оставшиеся места',run(){
  const a=new Evolution({population:2,seed:23,foodSources:12}),b=new Evolution({population:2,seed:23,foodSources:12});
  const original=new Set(a.tiles.filter(c=>c.maxFood>0).map(c=>`${c.x},${c.y}`));
  for(const s of [a,b])s.changeFoodEnvironment({foodSources:6,foodRegrowInterval:80});
  assert(a.tiles.filter(c=>c.maxFood>0).every(c=>original.has(`${c.x},${c.y}`)),'Уменьшение без перестановки перенесло оставшиеся');
  const retained=a.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y,c.maxFood]);
  for(const s of [a,b])s.changeFoodEnvironment({foodSources:24,foodRegrowInterval:20});
  assert(retained.every(([x,y,cap])=>a.tile(x,y).maxFood===cap),'Добавление изменило старые источники');
  for(const s of [a,b]){s.advance(3);s.changeFoodEnvironment({foodSources:12,foodRegrowInterval:160,relocate:true});s.advance(10);}
  equal(a.snapshot(),b.snapshot(),'Одинаковая последовательность не воспроизводится');
 }},
 {id:'world-edit-journal',label:'Журнал хранит времена, условия и независимые итоги вмешательств',run(){
  const s=new Evolution({population:1,limit:1,learning:false,memory:false,foodSources:12});choose(s,8);s.advance(3);
  const entry=s.changeFoodEnvironment({foodSources:6,foodRegrowInterval:20}),saved=JSON.stringify(entry);
  assert(entry.tick===3&&entry.before.sourceCount===12&&entry.after.sourceCount===6&&entry.nextRegrowthTick===23,'Неверный журнал');
  s.advance(3);s.changeFoodEnvironment({foodSources:0,foodRegrowInterval:40});
  assert(s.environmentChanges.length===2&&s.environmentChanges[1].tick===6,'История вмешательств потеряна');assert(JSON.stringify(s.environmentChanges[0])===saved,'Поздние шаги изменили прошлый итог');
  assert(s.initialFoodSettings.sourceCount===12&&s.foodSettings.sourceCount===0,'Начальные условия переписаны');
 }},
 // Управляемый добытчик ниже существует только в проверке. Это доказательство
 // возможности физиологии, а не готовая политика настоящих основателей.
 {id:'action-energy-09',label:'Каждое действие расходует согласованную энергию 0.9',run(){
  const expected=[.78,.78,.78,.78,.78,.78,.66,.48,.30];
  for(const [action,cost]of expected.entries()){
   const {s,a}=fixture({limit:1,learning:false,memory:false});s.tile(a.x,a.y).food=1;a.inventory=action===7?1:0;const before=a.energy;choose(s,action);s.step();
   assert(Math.abs(before-a.energy-cost)<1e-10&&Math.abs(s.stats.spent-cost)<1e-10,'Расход неверен для действия '+action);
   assert(Math.abs(actionEnergyCost(action)-cost)<1e-10,'Определение расхода расходится с физикой');
  }
  assert(RULES.digestionRate>Math.max(...expected),'Усвоение не покрывает обычные действия');
 }},
 {id:'age-limit-09',label:'Возрастной предел наступает на 10 000, а не на 1500',run(){
  const {s,a}=fixture({limit:1,learning:false,memory:false});choose(s,8);a.age=1499;s.step();assert(a.alive,'Старый предел остался');a.age=9998;s.step();assert(a.alive&&a.age===9999,'Смерть раньше нового предела');s.step();const r=s.lifeReport();assert(!a.alive&&r.dead[0].cause==='age'&&r.dead[0].age===10000,'Неверная возрастная смерть');
 }},
 {id:'regular-feeding-09',label:'Регулярное питание позволяет прожить полные 10 000 шагов',run(){
  const {s,a}=fixture({limit:1,learning:false,memory:false});const c=s.tile(a.x,a.y);c.maxFood=6;c.food=6;s.initialFood=6;s.foodSettings.regrowInterval=10;
  s.choose=resident=>s.evaluate(resident).find(o=>o.action===(resident.inventory===0?6:resident.energy<40&&resident.stomach<=44?7:8));
  s.advance(10000);const r=s.lifeReport(),row=r.dead[0];
  assert(row?.cause==='age'&&row.age===10000&&row.emptyEnergySteps===0,'Регулярно питающаяся фикстура погибла от голода');
  assert(row.eaten>=130&&row.eaten<=160&&row.feedingActionFraction<.10,'Число кормлений/доля действий не соответствуют энергетике');
  assert(row.maxStepsWithoutEating<200,'Фикстура не питалась регулярно');const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Нарушен баланс длинной жизни');
 }},
 {id:'three-meals-09',label:'Три порции не обеспечивают жизнь до нового предела',run(){
  const {s,a}=fixture({limit:1,learning:false,memory:false,foodSources:0});a.inventory=3;s.initialFood=3;
  s.choose=resident=>s.evaluate(resident).find(o=>o.action===(resident.inventory>0&&resident.energy<40&&resident.stomach<=44?7:8));
  s.advance(2000);const row=s.lifeReport().dead[0];assert(row?.cause==='starvation'&&row.eaten===3&&row.age<2000,'Три порции обеспечили несогласованную выживаемость');
  const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Потерялась энергия начального запаса');
 }},
 {id:'feeding-statistics-09',label:'Промежутки питания и сводки сохраняются после удаления строк',run(){
  const {a}=fixture();for(const [i,action]of [8,7,8,8,7,8,8].entries()){a.age=i+1;a.lastAction=action;sampleLife(a);}
  const row=lifeRow(a,0,7,'injury');assert(row.firstMealAge===2&&row.lastMealAge===5&&row.maxStepsWithoutEating===3&&row.eaten===2,'Неверный интервал питания');
  a.age=10;assert(lifeRow(a,0,10).maxStepsWithoutEating===5,'Хвост без еды не учтён');
  const h=new LifeHistory({retain:1});h.complete(row);h.complete({...row,id:2,age:10,eaten:0,gathered:0,observedSteps:10,maxStepsWithoutEating:10,firstMealAge:null,lastMealAge:null,actions:[0,0,0,0,0,0,0,0,10]});const f=h.summary().completed.feeding;
  assert(h.retainedRows().length===1&&f.meanMeals===1&&f.medianMeals===1&&f.minMeals===0&&f.maxMeals===2&&f.observedSteps===17&&f.meanMaxStepsWithoutEating===6.5&&f.maxStepsWithoutEating===10,'Агрегат потерял вытесненную жизнь');
 }},

 // Эти проверки запускает пользователь. Проверяем физику настроек, а не
 // требуем от эволюции миграции. Принудительное ожидание — только фикстура.
 {id:'custom-food-starts',label:'Пища настраивается без изменения начальных геномов',run(){
  const base=new Evolution({seed:42,population:4,foodSources:96,foodRegrowInterval:80});
  const founders=s=>s.agents.map(a=>[a.x,a.y,a.genome]);
  for(const foodSources of [0,12,96,384]){
   const s=new Evolution({seed:42,population:4,foodSources});equal(founders(base),founders(s),'Число источников изменило основателей');
   assert(s.tiles.filter(c=>c.maxFood>0).length===foodSources,'Неверное число источников');
   assert(s.tiles.filter(c=>c.maxFood).every(c=>c.terrain==='land'&&c.food===c.maxFood&&c.maxFood>=3&&c.maxFood<=6),'Неверная клетка/ёмкость');
   assert(s.tiles.reduce((n,c)=>n+c.food,0)===s.initialFood,'Начальный запас не учтён');
   if(foodSources===0)assert(!s.foodIslands.length&&!s.initialFood,'Нулевая пища не применена');
  }
  const slow=new Evolution({seed:42,population:4,foodSources:96,foodRegrowInterval:640}),repeat=new Evolution({seed:42,population:4,foodSources:96,foodRegrowInterval:640});
  equal(base.tiles,slow.tiles,'Период изменил исходные запасы/места');equal(founders(base),founders(slow),'Период изменил основателей');equal(slow.snapshot(),repeat.snapshot(),'Настройки не воспроизводятся');
 }},
 {id:'custom-food-cycles',label:'Период даёт одну порцию без переполнения и долга',run(){
  const {s,a}=fixture({foodSources:1,foodRegrowInterval:320,limit:1}),c=s.tile(a.x,a.y);c.maxFood=3;c.food=0;choose(s,8);
  // Перестановка часов изолирует границу цикла без длинного исследования.
  s.tick=318;s.step();assert(c.food===0&&s.stats.regrown===0,'Пища выросла раньше срока');s.step();assert(c.food===1&&s.stats.regrown===1,'Цикл добавил не одну порцию');
  c.food=3;s.tick=639;s.step();assert(c.food===3&&s.stats.regrown===1,'Полный источник переполнен');
  c.food=1;s.tick=959;s.step();assert(c.food===2&&s.stats.regrown===2,'Пропущенное пополнение накопилось');
  const empty=new Evolution({population:1,foodSources:0,foodRegrowInterval:10});choose(empty,8);empty.tick=9;empty.step();assert(empty.stats.regrown===0,'Пища появилась без источников');
 }},
 {id:'food-settings-validation',label:'Пределы пищи проверяются, старые фикстуры сохранены',run(){
  const invalid=[{foodSources:-1},{foodSources:385},{foodSources:1.5},{foodSources:'96'},{foodSources:null},{foodRegrowInterval:9},{foodRegrowInterval:1601},{foodRegrowInterval:Infinity},{foodRegrowInterval:NaN},{foodRegrowInterval:80.5},{foodRegrowInterval:'80'}];
  for(const options of invalid){let rejected=false;try{validateFoodSettings(options);}catch{rejected=true;}assert(rejected,'Приняты недопустимые настройки');}
  equal(validateFoodSettings(),{foodSources:384,foodRegrowInterval:20,foodIslandCount:8,foodPeriodSpread:30,foodSizeSpread:30},'Неверные начальные значения');
  for(const scenario of ['balanced','scarce']){const s=new Evolution({scenario,population:1});assert(s.foodSettings.regrowInterval===RULES.regrowInterval&&s.foodSettings.generation==='islands-legacy-v1','Изменена прежняя фикстура');}
 }},
 {id:'custom-food-jobs',label:'Пища сохраняется в заданиях, снимке и контексте генома',run(){
  const config=validateExperimentConfig({seeds:[42,23],population:1,limit:2,steps:1000,parallel:1,foodSources:20,foodRegrowInterval:640}),jobs=experimentJobs(config);
  assert(jobs.length===6&&jobs.every(j=>j.foodSources===20&&j.foodRegrowInterval===640),'Настройки потеряны в заданиях');
  const s=new Evolution(jobs[0]),file=s.genomeFile(s.agents[0]);assert(s.foodSettings.sourceCount===20&&s.foodSettings.regrowInterval===640,'Мир не получил настройки');
  assert(file.rules.regrowInterval===640&&file.environment.sourceCount===20&&s.snapshot().foodSettings.regrowInterval===640,'Контекст не сохранён');
 }},
 {id:'determinism',label:'Один seed воспроизводит мир',run(){
  const a=new Evolution({seed:71,population:8}),b=new Evolution({seed:71,population:8});a.advance(160);for(let i=0;i<16;i++)b.advance(10);
  equal(a.snapshot(),b.snapshot(),'Разбиение шагов изменило состояние');equal(a.lifeReport(),b.lifeReport(),'Истории расходятся');}},
 {id:'observer-neutrality',label:'История не меняет поведение мира',run(){const a=new Evolution({population:8,seed:23,lifeHistoryLimit:1}),b=new Evolution({population:8,seed:23});a.advance(180);b.advance(180);equal(a.snapshot(),b.snapshot(),'Вместимость истории изменила физику или RNG');assert(a.lifeHistory.all.count===b.lifeHistory.all.count,'Потеряны смерти в сводке');}},
 {id:'neutral-policy',label:'Нейтральный геном не предпочитает действие',run(){const {s,a}=fixture(),options=s.evaluate(a);assert(options.every(o=>Math.abs(o.probability-1/options.length)<1e-12),'Вероятности не равны');}},
 {id:'hidden-world',label:'Скрытая клетка не влияет на выбор',run(){const {s,a}=fixture();const before=choiceView(s,a);Object.assign(s.tile(40,25),{food:6,risk:1,terrain:'water'});equal(choiceView(s,a),before,'В выбор проникли дальние сведения');}},
 {id:'personal-frame',label:'Перенос и поворот сохраняют локальный выбор',run(){const {s,a}=fixture();a.genome.fill(.2);a.brain=createBrain(a.genome);const b=s.addAgent({x:36,y:24},a.genome.slice(),null);b.frameRotation=3;equal(choiceView(s,a),choiceView(s,b),'Выбор зависит от мирового положения');}},
 {id:'personal-steps',label:'Шаги и взгляд согласованы с личной картой',run(){const {s,a}=fixture();a.frameRotation=2;const origin=worldAxial(a);for(const action of [0,3,0,2,1,5,4]){const prev={...a.brain.position},next=localNeighbours(a.brain)[action];choose(s,action);s.step();assert(localDistance(prev,a.brain.position)===1,'Личный шаг имеет неверную длину');equal(a.brain.position,{q:next.q,r:next.r},'Личная позиция неверна');const d=rotate(a.brain.position,a.frameRotation);equal(worldAxial(a),{q:origin.q+d.q,r:origin.r+d.r},'Проекция расходится с физикой');equal(memoryWorldPosition(a,{q:0,r:0}),{x:12,y:12},'Потеряно место рождения');}}},
 {id:'private-brain',label:'Мозг не хранит мировые x/y',run(){const {s,a}=fixture();choose(s,8);s.advance(3);function visit(v){if(v instanceof Map){for(const x of v.values())visit(x);return;}if(!v||typeof v!=='object')return;assert(!Object.hasOwn(v,'x')&&!Object.hasOwn(v,'y'),'Мировые координаты найдены в мозге');for(const x of Object.values(v))visit(x);}visit(a.brain);}},
 {id:'boundary',label:'Недоступный шаг не меняет личную позицию',run(){const {s,a}=fixture();a.x=WORLD_WIDTH-1;const before={...a.brain.position};assert(!s.evaluate(a).some(o=>o.action===0),'Шаг за границу разрешён');equal(a.brain.position,before,'Оценка шага переместила мозг');}},
 {id:'short-overflow',label:'Краткая память соблюдает вместимость',run(){const b=createBrain(genes());b.traits.shortCapacity=8;for(let i=0;i<80;i++)observe(b,[place(i)],place(-1),i,false);assert(b.memory.size===8,'Неверный размер краткой памяти');assert(!getMemory(b,'0,0'),'Старая краткая запись не вытеснена');}},
 {id:'protected-place',label:'Значимое место переживает короткую очередь',run(){const b=createBrain(genes()),p=place(0,0,3);observe(b,[p],p,1);experience(b,p,0,-30,1);for(let i=1;i<150;i++)observe(b,[place(i)],place(-1),i+2,false);assert(b.longMemory.has('0,0'),'Сильное переживание не закрепило место');assert(getMemory(b,'0,0').food===3,'Закреплённая запись потеряна');}},
 {id:'revision',label:'Новое наблюдение пересматривает долгую память',run(){const b=createBrain(genes()),p=place(0,0,3);observe(b,[p],p,1);experience(b,p,0,30,1);observe(b,[{...p,food:0}],place(-1),20,false);assert(getMemory(b,'0,0').food===0,'Старая пища осталась текущим наблюдением');assert(getMemory(b,'0,0').maxFoodSeen===3,'История наблюдений исчезла');}},
 {id:'returns',label:'Возвращения закрепляют место; стояние не считается возвращением',run(){const b=createBrain(genes()),p=place(),q=place(1);for(let i=1;i<=20;i++)observe(b,[p],p,i);assert(b.longMemory.size===0,'Ожидание выдано за возвращения');for(let i=21;i<=30;i++){const v=i%2?p:q;observe(b,[v],v,i);}assert(b.longMemory.has('0,0'),'Повторные возвращения не закрепили место');}},
 {id:'delayed-place',label:'Поздний результат связан с предыдущим местом',run(){const b=createBrain(genes()),p=place(0,0,3),q=place(1);observe(b,[p],p,1);rememberDecision(b,p,1);observe(b,[q],q,2);rememberDecision(b,q,2);rememberExperience(b,{choice:{row:0,action:7},beforeFeeling:-20},30,3);assert(b.longMemory.has('0,0')&&b.longMemory.has('1,0'),'Позднее ощущение потеряло прошлое место');}},
 {id:'replace-long',label:'Более сильное место заменяет слабое',run(){const b=createBrain(genes());b.traits.longCapacity=1;const p=place(),q=place(1);observe(b,[p],p,1);experience(b,p,0,10,1);const old=getMemory(b,'0,0');assert(memoryStrength(old,10000,b.traits)<memoryStrength(old,2,b.traits),'Значимость не стареет');b.recentEvents=[];observe(b,[q],q,3);experience(b,q,0,-50,3);assert(b.longMemory.size===1&&b.longMemory.has('1,0'),'Слабая запись не уступила место');}},
 {id:'memory-genes',label:'Вместимость зависит от генов',run(){const g=genes();for(const key of ['shortCapacity','longCapacity']){const i=COGNITIVE_GENES.find(x=>x.key===key).index;g[i]=-8;const low=cognitiveTraits(g)[key];g[i]=8;assert(cognitiveTraits(g)[key]>low,'Ген '+key+' не влияет на объём');}}},
 {id:'newborn',label:'Ребёнок не наследует опыт и известные места',run(){const {s,a}=fixture({mutations:false});const p=place();observe(a.brain,[p],p,1);experience(a.brain,p,0,30,1);a.brain.experience[0]=2;a.age=100;a.energy=100;const child=s.reproduce(a);assert(child,'Рождение не произошло');assert(!child.brain.memory.size&&!child.brain.longMemory.size&&!child.brain.recentEvents.length,'Ребёнок знает места родителя');assert(child.brain.experience.every(v=>v===0),'Передан личный критик');equal(child.brain.position,{q:0,r:0},'Ребёнок начал не с нуля');equal(child.genome,a.genome,'При отключённых мутациях изменился геном');}},
 {id:'digestion',label:'Пища усваивается со следующего шага',run(){const {s,a}=fixture();a.energy=20;a.inventory=1;choose(s,7);s.step();assert(a.energy<20&&a.stomach===22,'Пища усвоена мгновенно');const prev=a.energy;choose(s,8);s.step();assert(a.energy>prev&&a.stomach<22,'Пищеварение не началось');}},
 {id:'pain',label:'Повреждение даёт боль; затухание не лечит здоровье',run(){const {s,a}=fixture();s.tile(a.x,a.y).risk=1;choose(s,8);s.step();assert(a.pain>=5&&a.health<100,'Повреждение не создало боль');const h=a.health,p=a.pain;s.tile(a.x,a.y).risk=0;s.step();assert(a.health===h&&a.pain<p,'Боль или здоровье меняются неверно');}},
 {id:'injury-learning',label:'Неприятное повреждение меняет оценку действия',run(){const {s,a}=fixture();a.genome[COGNITIVE_GENES.find(g=>g.key==='health').index]=3;a.genome[COGNITIVE_GENES.find(g=>g.key==='pain').index]=-3;a.brain=createBrain(a.genome);s.tile(13,12).risk=1;choose(s,0);s.step();s.tile(13,12).risk=0;choose(s,8);s.step();assert(a.brain.updates>0,'Нет обновления критика');assert(a.brain.experience.some(v=>v<0),'Неприятный результат не уменьшил оценку');}},
 {id:'memory-without-td',label:'Закрепление работает при выключенном TD',run(){const {s,a}=fixture({learning:false});a.genome[COGNITIVE_GENES.find(g=>g.key==='health').index]=3;a.brain=createBrain(a.genome);s.tile(a.x,a.y).risk=1;choose(s,8);s.advance(2);assert(a.brain.updates===0,'Выключенный TD обновлялся');assert(a.brain.longMemory.size>0,'Без TD память не закрепляется');}},
 {id:'remember-food',label:'Знание дальнего источника влияет без чтения скрытой клетки',run(){const {s,a}=fixture({learning:false});a.genome[COGNITIVE_GENES.find(g=>g.key==='foodMemory').index]=8;a.brain=createBrain(a.genome);observe(a.brain,[place(7,0,3)],place(7),1);s.tick=10;const options=s.evaluate(a);assert(options.find(o=>o.action===0).probability>options.find(o=>o.action===1).probability,'Память источника не влияет');const before=choiceView(s,a);s.tile(30,24).food=6;equal(choiceView(s,a),before,'Дальняя истинная пища повлияла');}},
 {id:'wellbeing',label:'Самочувствие ограничено и допускает разные знаки',run(){const body={energy:0,health:100,pain:90,stomach:0},g=genes();g[COGNITIVE_GENES.find(x=>x.key==='pain').index]=3;const positive=wellbeing(body,cognitiveTraits(g));g[COGNITIVE_GENES.find(x=>x.key==='pain').index]=-3;const negative=wellbeing(body,cognitiveTraits(g));assert(positive>0&&negative<0&&Math.abs(positive)<=100&&Math.abs(negative)<=100,'Генетические знаки или шкала неверны');}},
 // Фикстуры задают выбор только ради проверки причинности; в игре выбирает softmax.
 {id:'birth-thresholds',label:'Рождение доступно ровно на физических границах 50/40/90/100',run(){
  const {s,a}=fixture();a.age=90;a.energy=50;a.health=40;a.lastBirthAge=-10;
  assert(s.evaluate(a).some(o=>o.action===BIRTH_ACTION),'Граница недоступна');
  for(const [field,value,reason]of [['energy',49.99,'energy'],['health',39.99,'health'],['age',89,'immature'],['lastBirthAge',-9,'interval']]){
   const old=a[field];a[field]=value;assert(s.birthAvailability(a).blocked.includes(reason),'Нет причины '+reason);assert(!s.evaluate(a).some(o=>o.action===BIRTH_ACTION),'Недоступное рождение попало в выбор');assert(s.reproduce(a)===null,'Недоступное рождение выполнено');a[field]=old;
  }
 }},
 {id:'birth-voluntary',label:'Выполнение порогов не заставляет рожать при выборе ожидания',run(){
  const {s,a}=fixture();a.age=90;a.energy=100;choose(s,8);s.step();assert(a.children===0&&s.stats.births===0,'Автоматическое рождение осталось');assert(a.life.reproduction.eligible===1&&a.life.reproduction.chosen===0,'Отказ не отличён от недоступности');
 }},
 {id:'birth-cost',label:'Выбранное рождение стоит всего 32, ребёнку 28, остаток 18',run(){
  const {s,a}=fixture({mutations:false});s.initialFood=0;s.stats.spent=18;a.energy=50;a.health=40;a.age=90;choose(s,BIRTH_ACTION);s.step();
  const child=s.agents.find(c=>c.parentId===a.id);assert(child&&a.energy===18&&child.energy===28,'Неверный перенос');assert(s.stats.spent===18&&s.stats.birthSpent===4,'Двойное списание');
  assert(child.age===0&&child.life.samples===0&&child.born===s.tick,'Ребёнок действовал в шаг рождения');assert(a.lastAction===BIRTH_ACTION&&s.stats.actions[BIRTH_ACTION]===1,'Не учтено действие');
  assert(s.balances().foodError===0&&Math.abs(s.balances().energyError)<1e-8,'Баланс рождения нарушен');equal(child.genome,a.genome,'Приобретён новый геном без мутации');
 }},
 {id:'birth-terminal',label:'Мёртвый и достигший предела возраста не могут родить',run(){
  const {s,a}=fixture();a.energy=100;a.age=RULES.maxAge;assert(!s.birthAvailability(a).eligible&&s.reproduce(a)===null,'Рождение на пределе возраста');a.age=90;a.alive=false;assert(s.reproduce(a)===null,'Рождение умершего');
 }},
 {id:'birth-learning',label:'Расход выбранного рождения обучает именно его столбец TD',run(){
  const {s,a}=fixture({mutations:false});a.genome[COGNITIVE_GENES.find(g=>g.key==='energy').index]=8;a.brain=createBrain(a.genome);a.age=90;a.energy=50;const row=s.state(a);choose(s,BIRTH_ACTION);s.step();
  assert(a.brain.pending.choice.action===BIRTH_ACTION&&a.brain.pending.beforeFeeling===0,'Потерян перепад рождения');choose(s,8);s.step();
  assert(a.brain.experience[row*ACTION_COUNT+BIRTH_ACTION]<0&&a.brain.lastLearning.action===BIRTH_ACTION,'Обновлён не столбец рождения');
 }},
 {id:'birth-counters',label:'Просмотр не меняет счётчики, истории сохраняют возможности и причины',run(){
  const {s,a}=fixture();const before=structuredClone(s.stats.reproduction);s.evaluate(a);s.evaluate(a);s.birthAvailability(a);equal(s.stats.reproduction,before,'Просмотр засчитан как решение');
  choose(s,8);s.step();assert(a.life.reproduction.decisions===1&&a.life.reproduction.blocked.immature===1,'Не учтена причина');
  a.energy=0;a.health=1;s.step();const row=s.lifeReport().dead[0];assert(row.reproduction.decisions===2,'Потерян последний выбор');equal(s.lifeHistory.summary().completed.reproduction,s.stats.reproduction,'Агрегаты потеряли счётчики');
 }},
 {id:'birth-limit',label:'Последнее место населения допускает одного ребёнка и закрывает рождение',run(){
  const {s,a}=fixture({limit:2});a.energy=100;a.age=90;choose(s,BIRTH_ACTION);s.step();assert(s.agents.length===2&&s.stats.births===1,'Неверное последнее место');
  a.age+=100;a.energy=100;assert(s.birthAvailability(a).blocked.includes('limit')&&!s.evaluate(a).some(o=>o.action===BIRTH_ACTION),'Лимит не закрывает действие');assert(s.reproduce(a)===null,'Лимит превышен');
 }},
 {id:'birth-profiles',label:'Контрольные варианты изолируют автоматизм и два порога',run(){
  for(const profile of REPRODUCTION_PROFILES){const {s,a}=fixture({reproduction:profile.id});a.age=90;a.energy=100;choose(s,8);s.step();assert(s.stats.births===Number(profile.automatic),'Перепутан автоматизм');equal(s.reproduction,profile,'Неверные пороги');}
  let rejected=false;try{reproductionProfile('unknown');}catch{rejected=true;}assert(rejected,'Неизвестный вариант принят');
 }},
 {id:'birth-context',label:'Вариант размножения записан в заданиях, геноме и снимке',run(){
  const config=validateExperimentConfig({seeds:[42],population:1,limit:3,steps:1000,parallel:1,modes:['memory-and-td'],reproduction:'choice-50-55-v1'}),job=experimentJobs(config)[0];assert(job.reproduction===config.reproduction,'Задание потеряло вариант');
  const {s,a}=fixture({reproduction:job.reproduction});assert(s.genomeFile(a).version===GENOME_VERSION&&s.genomeFile(a).rules.birthHealth===55,'Геном потерял контекст');assert(s.snapshot().reproduction.id===job.reproduction,'Снимок потерял вариант');
 }},
 {id:'genome-files',label:'Геномы v1–v6 сохраняют прежние действия, рождение и свойства',run(){
  for(const [version,size]of Object.entries(GENOME_SIZES).filter(([v])=>Number(v)<=6)){
   const v=Number(version),g=Array.from({length:size},(_,i)=>(i%101-50)/10),r=validateGenomeFile({format:'big-evolution-genome',version:v,genes:g});
   assert(r.length===GENE_COUNT,'Неверный размер v6');
   if(v===6){equal(r,g,'Изменён геном v6');continue;}
   assert(r.slice(BODY_GENE_OFFSET).every(x=>x===0),'Прежним геномам подарены предпочтения тела');
   const oldColumns=v>=5?11:v===4?10:9;
   for(let row=0;row<48;row++){
    for(let action=0;action<oldColumns;action++)assert(r[row*ACTION_COUNT+action]===g[row*oldColumns+action],'Изменено прежнее действие');
    for(let action=oldColumns;action<ACTION_COUNT;action++)assert(r[row*ACTION_COUNT+action]===0,'Новое действие не нейтрально');
   }
   for(let i=0;i<22;i++)assert(r[48*ACTION_COUNT+i]===(g[48*oldColumns+i]??0),'Сдвинут признак движения/мозга');
  }
  for(const data of [{version:5,genes:Array(GENE_COUNT).fill(Infinity)},{version:4,genes:genes()},{version:99,genes:genes()}]){
   let rejected=false;try{validateGenomeFile({format:'big-evolution-genome',...data});}catch{rejected=true;}assert(rejected,'Принят неверный формат');}
 }},
 {id:'mutations',label:'Мутация копирует геном и соблюдает границы',run(){const g=genes(),copy=mutateGenome(g,new Random(13),1);assert(copy!==g&&g.every(v=>v===0),'Переписан родитель');assert(copy.some(v=>v!==0)&&copy.every(v=>Math.abs(v)<=8),'Мутация не работает');equal(mutateGenome(g,new Random(13),0),g,'Нулевая мутация меняет гены');}},
 {id:'source-conservation',label:'Островки сохраняют прежний запас',run(){for(const scenario of ['balanced','scarce'])for(const seed of [23,42]){const s=new Evolution({scenario,seed,population:1}),sources=s.tiles.filter(c=>c.maxFood);equal(sources.map(c=>c.maxFood).sort(),s.sourceTemplate.map(c=>c.maxFood).sort(),'Изменены ёмкости');assert(sources.every(c=>c.terrain==='land'),'Источник на воде');assert(sources.reduce((n,c)=>n+c.food,0)===s.initialFood,'Изменён запас');for(const g of s.foodIslands)for(const other of s.foodIslands)if(g.id!==other.id)assert(worldDistance(g.centre,other.centre)>=10,'Островки недостаточно разделены');}}},
 {id:'map-clicks',label:'Все гексы большой карты выбираются',run(){for(let y=0;y<WORLD_HEIGHT;y++)for(let x=0;x<WORLD_WIDTH;x++){const p={x,y},c=hexCenter(p);equal(worldHexAt(c.x,c.y),p,'Неверный гекс ('+x+','+y+')');}}},
 {id:'balances',label:'Пища и энергия учитываются через рождение и смерть',run(){for(const seed of [7,23,42]){const s=new Evolution({seed,population:12,limit:30});for(let i=0;i<500&&s.agents.length;i++){s.step();const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-5,'Баланс нарушен на шаге '+s.tick);}}}},
 {id:'extinction',label:'После вымирания мир не возрождается сам',run(){const {s,a}=fixture();a.energy=0;a.health=1;choose(s,8);s.step();assert(!s.agents.length,'Организм не погиб');const before=s.snapshot();s.advance(100);equal(s.snapshot(),before,'Вымерший мир продолжил расчёт');}},
 {id:'death-age',label:'Последний шаг и причина входят в итог жизни',run(){const {s,a}=fixture();a.energy=0;a.health=1;choose(s,8);s.step();const report=s.lifeReport();assert(report.completed.count===1&&report.dead[0].age===1,'Итог смерти неверен');assert(report.dead[0].cause==='starvation'&&report.dead[0].emptyEnergySteps===1,'Последний шаг или причина потеряны');assert(report.dead[0].meanFeeling!==null,'Последнее чувство не учтено');}},
 {id:'censoring',label:'Живые не учитываются как умершие',run(){const {s,a}=fixture();choose(s,8);s.advance(10);const r=s.lifeReport();assert(r.completed.count===0&&r.completed.meanAge===null,'Живой включён в средний возраст смерти');assert(r.living[0].censored&&r.living[0].age===10,'Не обозначена незавершённая жизнь');}},
 {id:'history-retention',label:'Сводка учитывает смерти после удаления подробных строк',run(){const {s,a}=fixture();const h=new LifeHistory({retain:1});for(const age of [100,200,300]){a.age=age;h.complete(lifeRow(a,0,age,'age'));}assert(h.retainedRows().length===1,'Лимит подробностей не соблюдён');const r=h.summary();assert(r.completed.count===3&&r.completed.meanAge===200&&r.completed.medianAge===200&&r.omittedDetails===2,'Накопительная статистика потеряла жизнь');}},
];
export async function runBrowserChecks(ids,onResult){
 const selected=ids?.length?BROWSER_CHECKS.filter(c=>ids.includes(c.id)):BROWSER_CHECKS;
 assert(selected.length>0,'Не найдены запрошенные проверки');
 const results=[];
 for(const check of selected){const start=performance.now();let result;
  try{await check.run();result={id:check.id,label:check.label,status:'passed',durationMs:performance.now()-start};}
  catch(error){result={id:check.id,label:check.label,status:'failed',durationMs:performance.now()-start,error:{message:error.message,stack:error.stack??null}};}
  results.push(result);onResult?.(result);await new Promise(resolve=>setTimeout(resolve,0));
 }
 return results;
}
