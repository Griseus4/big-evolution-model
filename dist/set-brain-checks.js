/** Проверки выполняет пользователь в Worker. Они не подбирают успешный геном
 * и не требуют возникновения выбранной стратегии. Фикстуры намеренно просты. */
import {LegacyEvolution as Evolution} from './evolution.js';
import {Random} from './simulation.js';
import {SET_BRAIN_TYPE,SET_LAYOUT,SET_BLOCKS,SET_PARAMETER_COUNT,OPERATION_NAMES,CANDIDATE_INPUTS,CELL_INPUTS} from './set-brain-layout.js';
import {createControllerState,evaluateController,expectedControllerValue,controllerProblems,recordControllerOutcome,finishControllerOutcome} from './brain-controller.js';
import {setCommonForward,setCandidateForward,setGradient,operationProbabilities,learnSetBrain} from './set-brain.js';
import {prepareSetInput,validSetInput} from './set-brain-inputs.js';
import {randomNeuralGenome,genomeMetadata,validateGenomeFile} from './genome.js';
import {withMutationGenes,mutationProfile} from './mutation-parameters.js';
import {analyzeGenome,compareGenomes} from './genome-analysis.js';
import {observe,getMemory,memoryBelief,spatialContext} from './cognition.js';
import {captureBenchmarkState,restoreBenchmarkState,benchmarkDigest} from './benchmark-state.js';
import {checkInvariants,validateExperimentConfig} from './experiment-runner.js';
const assert=(v,m)=>{if(!v)throw new Error(m);},equal=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m),near=(a,b,m)=>assert(Math.abs(a-b)<1e-9,m);
function fixture(options={}){
 const world=new Evolution({seed:42,population:1,limit:12,...options}),a=world.agents[0];
 for(const c of world.tiles){c.terrain='land';c.risk=0;c.food=0;c.maxFood=0;}
 world.moveAgent(a,{x:12,y:12});a.frameRotation=0;
 return {world,a};
}
function allRequest(world,a){const request=world.decisionFrame(a).request;
 const moves=request.candidates.filter(c=>c.action<6),place={...a.brain.position};
 request.candidates=[...moves,...Array.from({length:5},(_,i)=>({id:'action-'+(i+6),action:i+6,label:'fixture',localDestination:place,cell:{food:2,hazard:false,neighbours:0}}))];
 return request;
}
function zeroBrain(a){a.genome.fill(0,0,SET_PARAMETER_COUNT);a.brain=createControllerState(a.genome);}
export const SET_BRAIN_CHECKS=[
 {id:'set-layout',label:'Мозг Б: 975 параметров, v11/990, точная схема генома',run(){
  const {world,a}=fixture();assert(a.brain.controllerType===SET_BRAIN_TYPE&&SET_PARAMETER_COUNT===975&&a.genome.length===990,'Неверный новый мозг');
  const file=world.genomeFile(a);assert(file.version===11&&file.network.architecture==='set-b-source-v1'&&mutationProfile(a.genome),'Нет метаданных');equal(validateGenomeFile(file),a.genome,'Импорт изменил гены');
 }},
 {id:'set-operations',label:'Мозг Б: равные Q дают 1/6 на операцию и 1/36 на направление',run(){
  const options=operationProbabilities(Array.from({length:11},(_,action)=>({operation:action<6?0:action-5,score:0})));
  options.forEach((o,i)=>{near(o.probability,i<6?1/36:1/6,'Неверная совместная вероятность');near(o.operationProbability,1/6,'Неверная операция');});
  near(options.reduce((n,o)=>n+o.probability,0),1,'Вероятности не нормированы');
 }},
 {id:'set-target-count',label:'Мозг Б: дублирование одинаковых целей не повышает вероятность операции',run(){
  for(const count of [1,2,20]){const rows=operationProbabilities([...Array.from({length:count},()=>({operation:0,score:2})),{operation:1,score:2}]);near(rows[0].operationProbability,.5,'Количество целей изменило операцию');}
 }},
 {id:'set-zero-forward',label:'Мозг Б: общий прямой проход выдаёт все 11 оценок без врождённой стратегии',run(){
  const {world,a}=fixture();zeroBrain(a);const rows=evaluateController(a.brain,a.genome,allRequest(world,a));
  assert(rows.length===11&&rows.every(o=>o.learningValue===0),'Нейтральные веса не нейтральны');rows.forEach(o=>near(o.probability,o.action<6?1/36:1/6,'Неверная политика'));
 }},
 {id:'set-visible-privacy',label:'Мозг Б: только видимые личные координаты, без чужих ID и скрытых таймеров',run(){
  const {world,a}=fixture(),o=world.decisionObservation(a);
  assert(o.cells.length===7,'Неверный круговой обзор');for(const cell of o.cells)equal(Object.keys(cell).sort(),['food','hazard','isFoodSource','neighbours','q','r','terrain'],'Лишние сведения');
  assert(o.position.q===0&&o.position.r===0,'Выданы мировые координаты');
 }},
 {id:'set-permutation',label:'Мозг Б: порядок клеток/вариантов не меняет их оценки',run(){
  const {world,a}=fixture(),request=allRequest(world,a),before=evaluateController(a.brain,a.genome,request);
  const reordered={...request,observation:{...request.observation,cells:request.observation.cells.slice().reverse()},candidates:request.candidates.slice().reverse()},after=evaluateController(a.brain,a.genome,reordered);
  for(const x of before){const y=after.find(o=>o.id===x.id);near(x.learningValue,y.learningValue,'Порядок изменил Q');near(x.probability,y.probability,'Порядок изменил вероятность');}
 }},
 {id:'set-position',label:'Мозг Б: одинаковые местные условия в разных мировых координатах дают одинаковый выбор',run(){
  const {world,a}=fixture(),before=evaluateController(a.brain,a.genome,world.decisionFrame(a).request);world.moveAgent(a,{x:30,y:20});
  const after=evaluateController(a.brain,a.genome,world.decisionFrame(a).request);equal(before.map(o=>[o.action,o.probability]),after.map(o=>[o.action,o.probability]),'Утечка положения');
 }},
 {id:'set-memory-off',label:'Мозг Б: отключённая память не раскрывает записи через клетки/цели',run(){
  const {world,a}=fixture(),request=allRequest(world,a);request.observation.memoryEnabled=false;
  const prepared=prepareSetInput(a.brain,request);assert(prepared.memory.every(v=>v===0)&&prepared.cells.every(row=>row.slice(7,11).every(v=>v===0)),'Память осталась в общем входе');
  const rows=evaluateController(a.brain,a.genome,request);assert(rows.every(o=>o.candidateInput.slice(12,20).every(v=>v===0)),'Память осталась в кандидате');
 }},
 {id:'set-memory-effect',label:'Мозг Б: собственная запись действительно может менять Q',run(){
  const {world,a}=fixture();zeroBrain(a);a.brain.networkBase[SET_BLOCKS.find(b=>b.key==='direct').offset+14]=1;
  observe(a.brain,[{q:0,r:0,terrain:'land',food:3}],a.brain.position,world.tick,false);
  const request=world.decisionFrame(a).request,on=evaluateController(a.brain,a.genome,request).find(o=>o.action===8);
  request.observation.memoryEnabled=false;const off=evaluateController(a.brain,a.genome,request).find(o=>o.action===8);
  assert(on.learningValue>off.learningValue&&off.learningValue===0,'Запись не используется');
 }},
 {id:'set-gradient',label:'Мозг Б: производные всех 975 параметров совпадают с конечными разностями',run(){
  const p=Float64Array.from({length:SET_PARAMETER_COUNT},(_,i)=>Math.sin(i+1)*.12),frame={body:Float64Array.from([.6,.8,.2,.3,.5]),memory:Float64Array.from([.1,.2,.3,.4,.5,.6,.7]),cells:[Float64Array.from({length:CELL_INPUTS},(_,i)=>Math.sin(i)*.3),Float64Array.from({length:CELL_INPUTS},(_,i)=>Math.cos(i)*.4)],candidate:Float64Array.from({length:CANDIDATE_INPUTS},(_,i)=>Math.sin(i+2)*.4)};
  const g=setGradient(p,frame).gradient,epsilon=1e-6;
  const value=()=>setCandidateForward(p,setCommonForward(p,frame),frame.candidate).value;
  for(let i=0;i<p.length;i++){const saved=p[i];p[i]=saved+epsilon;const plus=value();p[i]=saved-epsilon;const minus=value();p[i]=saved;assert(Math.abs(g[i]-(plus-minus)/(2*epsilon))<1e-7,'Градиент '+i);}
 }},
 {id:'set-continuation',label:'Мозг Б: Expected SARSA использует всю иерархическую политику',run(){
  const {world,a}=fixture(),request=allRequest(world,a),rows=evaluateController(a.brain,a.genome,request),state=world.random.state;
  near(expectedControllerValue(a.brain,a.genome,request),rows.reduce((n,o)=>n+o.probability*o.learningValue,0),'Иное продолжение');assert(world.random.state===state,'Расход RNG оценкой');
  const p=Float64Array.from(a.brain.networkBase,(v,i)=>v+a.brain.networkDelta[i]);
  for(const row of rows)near(row.learningValue,setCandidateForward(p,setCommonForward(p,row.batchInput),row.batchInput.candidate).value,'Проекция операции изменила Q');
 }},
 {id:'set-learning',label:'Мозг Б: подкрепление меняет личный Q, генетическая основа неизменна',run(){
  const {world,a}=fixture();zeroBrain(a);const option=evaluateController(a.brain,a.genome,world.decisionFrame(a).request)[0],before=Array.from(a.brain.networkBase);
  a.brain.traits.forgetting=0;learnSetBrain(a.brain,option,{beforeFeeling:0,afterFeeling:60,nextValue:0,terminal:false,tick:1});
  assert(a.brain.lastLearning.afterValue>a.brain.lastLearning.beforeValue,'Нет обучения');equal(Array.from(a.brain.networkBase),before,'Переписаны гены');assert(a.brain.networkDelta.some(v=>v!==0),'Нет поправок');
 }},
 {id:'set-pending-snapshot',label:'Мозг Б: прошлое решение хранит собственные входы, терминал очищает след',run(){
  const {world,a}=fixture(),option=evaluateController(a.brain,a.genome,world.decisionFrame(a).request)[0];
  recordControllerOutcome(a.brain,option,{position:a.brain.position,damage:0,beforeFeeling:0,tick:0,memoryEnabled:false,learningEnabled:true});
  const saved=a.brain.pending.choice.batchInput,old=saved.cells[0][2];option.batchInput.cells[0][2]=.999;assert(saved.cells[0][2]===old&&validSetInput(saved),'Вход разделяет изменяемую ссылку');
  finishControllerOutcome(a.brain,{afterFeeling:0,tick:1,terminal:true,learningEnabled:true,nextValue:99});assert(!a.brain.pending&&a.brain.eligibility.every(v=>v===0),'Терминал не завершён');
 }},
 {id:'set-old-genomes',label:'Мозг Б: старые геномы не преобразуются и сохраняют прежний контроллер',run(){
  for(const type of ['mlp-local-v1','mlp-neighbours-v1']){
   const genes=randomNeuralGenome(new Random(23),type),world=new Evolution({population:1,baseGenome:genes});
   assert(world.agents[0].brain.controllerType===type,'Подменён мозг');equal(world.agents[0].genome,genes,'Расширен геном');
   const file=world.genomeFile(world.agents[0]);equal(validateGenomeFile(file),genes,'Сломан старый импорт');
  }
 }},
 {id:'set-analysis',label:'Мозг Б: анализ/сравнение подписывают блоки и не сравнивают разные связи',run(){
  const {world,a}=fixture(),analysis=analyzeGenome(world.genomeFile(a));assert(analysis.genomeVersion===11&&analysis.properties.filter(p=>p.group==='Сеть').length===975,'Не расшифрован новый формат');
  const genes=withMutationGenes(randomNeuralGenome(new Random(23),'mlp-neighbours-v1'),new Random(42)),old=analyzeGenome({format:'big-evolution-genome',...genomeMetadata(genes),genes});
  const pair=compareGenomes(old,analysis);assert(pair.sharedGenes===15,'Сопоставлены разные связи');
  for(const patch of [{version:9},{brainType:'mlp-neighbours-v1'},{network:{...world.genomeFile(a).network,cellInputs:99}}]){let rejected=false;try{validateGenomeFile({...world.genomeFile(a),...patch});}catch{rejected=true;}assert(rejected,'Повреждённый формат принят');}
 }},
 {id:'set-inheritance',label:'Мозг Б: потомство наследует все блоки, но не память и личные поправки',run(){
  const {world,a}=fixture({mutations:false});a.age=150;a.energy=90;a.brain.networkDelta.fill(.2);const child=world.reproduce(a);assert(child,'Нет рождения');
  equal(child.genome,a.genome,'Изменён геном');assert(child.brain.networkDelta.every(v=>v===0)&&!child.brain.memory.size&&!child.brain.longMemory.size,'Унаследован опыт');
 }},
 {id:'set-world-invariants',label:'Мозг Б: повторяемость мира, баланс и конечность в 64 шагах',run(){
  const options={seed:23,population:6,limit:20},a=new Evolution(options),b=new Evolution(options);
  // Валидатор длинных испытаний требует явных размеров популяции и числа
  // Worker. Их отсутствие проверяло ошибку формы, не выбор нового мозга.
  assert(validateExperimentConfig({seeds:[options.seed],population:options.population,limit:options.limit,steps:1000,parallel:1}).brainType===SET_BRAIN_TYPE,'Испытания используют старый мозг');
  for(let t=0;t<64&&a.agents.length;t++){a.step();b.step();equal(a.snapshot(),b.snapshot(),'Миры расходятся');checkInvariants(a);for(const agent of a.agents)assert(!controllerProblems(agent.brain).length,'Нарушен контроллер');}
 }},
 {id:'set-restore',label:'Мозг Б: восстановление снимка сохраняет ожидающий переход и продолжение',async run(){
  const {world}=fixture();world.step();const copy=restoreBenchmarkState(captureBenchmarkState(world));world.step();copy.step();
  assert(await benchmarkDigest(captureBenchmarkState(world))===await benchmarkDigest(captureBenchmarkState(copy)),'Восстановление меняет мир/обучение');
 }},
 {id:'source-perception',label:'Источники: пустой куст отличается от порций вне источника, действия прежние',run(){
  const {world,a}=fixture(),own=world.tile(a.x,a.y);own.maxFood=3;
  const destination=world.decisionFrame(a).executionDestinations.get('action-0').destination,loose=world.tile(destination.x,destination.y);loose.food=2;
  const request=world.decisionFrame(a).request,here=request.observation.cells.find(c=>c.q===0&&c.r===0),move=request.candidates.find(c=>c.action===0);
  assert(here.isFoodSource&&here.food===0&&!move.cell.isFoodSource&&move.cell.food===2,'Перепутаны куст и лежащие порции');
  assert(!request.candidates.some(c=>c.action===6)&&request.candidates.some(c=>c.action===8),'Куст изменил доступность действий');
  own.food=1;assert(world.decisionFrame(a).request.candidates.some(c=>c.action===6),'Подбор пищи исчез');
 }},
 {id:'source-privacy',label:'Источники: скрытые ёмкости, расписания и дальние кусты не меняют наблюдение',run(){
  const {world,a}=fixture(),own=world.tile(a.x,a.y);own.maxFood=3;
  const before=world.decisionFrame(a).request;own.maxFood=24;world.tile(40,25).maxFood=6;
  for(const group of world.foodIslands){group.period=1600;group.nextTick=9999;}
  equal(world.decisionFrame(a).request,before,'Раскрыты скрытые свойства источника');
  world.moveAgent(a,{x:0,y:0});const edge=world.decisionObservation(a).cells;
  assert(edge.length<7&&edge.every(c=>typeof c.isFoodSource==='boolean'),'Обзор у края неверен');
 }},
 {id:'source-network-input',label:'Источники: признак действует через общий обзор и конкретную цель',run(){
  const {world,a}=fixture();zeroBrain(a);const own=world.tile(a.x,a.y),direct=SET_BLOCKS.find(b=>b.key==='direct');
  a.brain.networkBase[direct.offset+CANDIDATE_INPUTS-1]=1;
  const value=()=>world.evaluate(a).find(o=>o.action===8);
  const empty=value();own.maxFood=3;const bush=value();
  assert(empty.learningValue===0&&bush.learningValue===1&&bush.candidateInput.at(-1)===1,'Цель не различает пустой куст');
  // Отдельно проверяем обучаемый путь через кодировщик клеток, без прямого выхода.
  a.brain.networkBase.fill(0);const [cells,context,target,operation]=SET_BLOCKS;
  a.brain.networkBase[cells.offset+CELL_INPUTS-1]=1;a.brain.networkBase[context.offset+5]=1;
  a.brain.networkBase[target.bias]=1;a.brain.networkBase[operation.offset+3]=1;
  const withBush=value();own.maxFood=0;const withoutBush=value();
  assert(withBush.learningValue>withoutBush.learningValue&&withoutBush.learningValue===0,'Общий обзор не использует куст');
 }},
 {id:'source-memory-observation',label:'Источники: память хранит наблюдение без бонуса закрепления, пересматривает только увиденное',run(){
  const {world,a}=fixture(),own=world.tile(a.x,a.y);own.maxFood=3;world.observe(a);
  const record=getMemory(a.brain,'0,0');assert(record.isFoodSource&&record.food===0&&!a.brain.longMemory.size,'Куст автоматически закрепился');
  assert(memoryBelief(record,10,a.brain.traits).food===0&&spatialContext(a.brain,[a.brain.position],10)[0]===0,'Пустой куст стал предполагаемой пищей');
  for(let tick=1;tick<=20;tick++)observe(a.brain,[{q:0,r:0,terrain:'land',food:0,isFoodSource:true}],a.brain.position,tick,true);
  assert(!a.brain.longMemory.size&&record.importance===0,'Само наблюдение наградило куст');
  // Закреплённая ранее запись тоже не читает скрытый мир и сохраняет прежнюю значимость.
  a.brain.memory.delete('0,0');a.brain.longMemory.set('0,0',record);own.maxFood=0;world.tick=21;
  assert(record.isFoodSource,'Скрытое удаление обновило воспоминание');world.observe(a);
  assert(record.isFoodSource===false&&a.brain.longMemory.has('0,0')&&record.importance===0,'Пересмотр изменил механизм памяти');
  const child=world.reproduce(Object.assign(a,{age:150,energy:90}));assert(child&&!child.brain.memory.size&&!child.brain.longMemory.size,'Унаследовано воспоминание о кусте');
 }},
 {id:'source-memory-disabled',label:'Источники: видимость работает при выключенной памяти, записей не создаёт',run(){
  const {world,a}=fixture({memory:false});world.tile(a.x,a.y).maxFood=3;world.observe(a);
  const request=world.decisionFrame(a).request,prepared=prepareSetInput(a.brain,request),rows=evaluateController(a.brain,a.genome,request);
  assert(!a.brain.memory.size&&!a.brain.longMemory.size&&prepared.cells.find(c=>c[6]===1).at(-1)===1,'Восприятие зависит от памяти');
  assert(prepared.cells.every(c=>c.slice(7,11).every(v=>v===0))&&prepared.memory.every(v=>v===0),'Раскрыта выключенная память');
  assert(rows.find(c=>c.action===8).candidateInput.at(-1)===1,'Нет текущего признака цели');
 }},
 {id:'source-v10-rejected',label:'Источники: прежний v10 не читается как v11, новый формат без регуляторов допустим',run(){
  const {world,a}=fixture();let message='';try{validateGenomeFile({...world.genomeFile(a),version:10,genes:Array(965).fill(0)});}catch(error){message=error.message;}
  assert(message.includes('v10')&&message.includes('v11'),'Нет понятной границы форматов');
  const genes=randomNeuralGenome(new Random(23),SET_BRAIN_TYPE);assert(genes.length===988,'Неверная базовая схема');
  equal(validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(genes),genes}),genes,'Сломан контрольный формат без регуляторов');
 }},
];
