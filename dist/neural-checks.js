/** Проверки новой сети: запускает пользователь, не загрузка страницы.
 * Управляемые входы/геномы нужны проверке математики и границ; настоящие
 * основатели случайны. Успех этих проверок не доказывает пользу обучения.
 */
import {Evolution as CurrentEvolution,RULES,hexCenter,memoryWorldPosition} from './evolution.js';
import {createControllerState,controllerProblems,evaluateController,BRAIN_TYPE} from './brain-controller.js';
import {NEURAL_BRAIN_TYPE,NEURAL_GENE_COUNT,PARAMETER_COUNT,INPUT_COUNT,HIDDEN_COUNT,TRAIT_OFFSET,NEIGHBOUR_BRAIN_TYPE,OUTPUT_WEIGHTS,OUTPUT_BIAS,NETWORK_SCHEMA} from './neural-layout.js';
import {neuralForward,neuralGradient,learnNeural} from './neural-brain.js';
import {randomNeuralGenome,mutateGenome,validateGenomeFile,genomeMetadata} from './genome.js';
import {analyzeGenome,compareGenomes} from './genome-analysis.js';
import {localNeighbours} from './navigation.js';
import {Random} from './simulation.js';
import {checkInvariants} from './experiment-runner.js';
// Проверки исторических v7/v8 не расширяют геном регуляторами v9.
class Evolution extends CurrentEvolution{constructor(options={}){super({brainType:NEIGHBOUR_BRAIN_TYPE,heritableMutations:false,...options});}}
const assert=(v,msg)=>{if(!v)throw new Error(msg);};
const equal=(a,b,msg)=>assert(JSON.stringify(a)===JSON.stringify(b),msg);
function fixture(options={}){
 const s=new Evolution({population:1,limit:3,foodSources:0,...options}),a=s.agents[0];
 for(const c of s.tiles){c.terrain='land';c.food=0;c.maxFood=0;c.risk=0;}
 a.x=12;a.y=12;a.frameRotation=0;a.genome=Array(NEURAL_GENE_COUNT).fill(0);a.genome[TRAIT_OFFSET]=2;
 a.brain=createControllerState(a.genome);s.rebuildOccupancy();return {s,a};
}
export const NEURAL_CHECKS=[
 {id:'neural-shape',label:'Сеть имеет 32 входа, 16 скрытых узлов и 545 параметров',run(){
  const {s,a}=fixture(),options=s.evaluate(a);
  assert(a.genome.length===558&&a.brain.networkDelta.length===545,'Размер сети');
  assert(options.every(o=>o.input.length===32&&o.input.every(Number.isFinite)),'Форма входа');
  assert(Math.abs(options.reduce((n,o)=>n+o.probability,0)-1)<1e-12,'Вероятности');
  assert(!controllerProblems(a.brain).length,'Инварианты сети');
 }},
 {id:'neural-gradient',label:'Производные всех связей и смещений совпадают с конечными разностями',run(){
  const genes=randomNeuralGenome(new Random(23)),base=genes.slice(0,PARAMETER_COUNT),delta=new Float64Array(PARAMETER_COUNT);
  const input=Array.from({length:INPUT_COUNT},(_,i)=>Math.sin(i+1)*.6),f=neuralForward(base,delta,input),gradient=neuralGradient(base,delta,input,f.hidden),epsilon=1e-6;
  for(let i=0;i<PARAMETER_COUNT;i++){
   delta[i]=epsilon;const plus=neuralForward(base,delta,input).value;delta[i]=-epsilon;const minus=neuralForward(base,delta,input).value;delta[i]=0;
   assert(Math.abs((plus-minus)/(2*epsilon)-gradient[i])<2e-7,`Градиент параметра ${i}`);
  }
 }},
 {id:'neural-inputs',label:'Сеть различает запасы/желудок и не получает мировые координаты',run(){
  const {s,a}=fixture();a.inventory=1;a.stomach=22;const one=s.evaluate(a).find(o=>o.action===8);
  a.inventory=2;a.stomach=44;const two=s.evaluate(a).find(o=>o.action===8);
  assert(one.input[14]===1/3&&two.input[14]===2/3&&two.input[15]===2/3,'Не различает тело');
  const frame=s.decisionFrame(a),pure=evaluateController(a.brain,a.genome,frame.request);
  assert(pure.every(o=>!Object.hasOwn(o,'destination')),'Глобальное назначение попало в сеть');
  const before=pure.map(o=>o.input);a.x=34;a.y=20;
  equal(s.evaluate(a).map(o=>o.input),before,'Мировое положение изменило входы в одинаковом локальном окружении');
 }},
 {id:'neural-availability',label:'Сеть выбирает только физически доступные действия',run(){
  const {s,a}=fixture();a.inventory=2;a.energy=90;a.age=100;s.tile(a.x,a.y).food=1;
  assert(s.evaluate(a).length===11,'Доступные действия потеряны');
  s.tile(a.x,a.y).food=0;a.inventory=3;a.stomach=66;a.health=39;
  const actions=s.evaluate(a).map(o=>o.action);
  assert(!actions.includes(6)&&!actions.includes(7)&&!actions.includes(9),'Сеть обходит ограничения тела');
 }},
 {id:'neural-learning',label:'TD меняет личную сеть и смещение, сохраняя геном',run(){
  const {s,a}=fixture(),original=a.genome.slice(),option=s.evaluate(a).find(o=>o.action===8);
  learnNeural(a.brain,option,{beforeFeeling:0,afterFeeling:50,nextValue:0,terminal:false,tick:1});
  assert(a.brain.networkDelta[OUTPUT_BIAS]>0&&a.brain.lastLearning.afterValue>a.brain.lastLearning.beforeValue,'Нет обновления смещения');
  equal(a.genome,original,'Опыт переписал гены');equal(Array.from(a.brain.networkBase),original.slice(0,PARAMETER_COUNT),'Основа изменена');
 }},
 {id:'neural-cycle',label:'Обычный цикл копирует входы до действия и обучает сеть',run(){
  const {s,a}=fixture();a.inventory=2;a.stomach=22;a.energy=80;s.choose=a=>s.evaluate(a).find(o=>o.action===8);
  s.step();const input=a.brain.pending.choice.input.slice();assert(input[14]===2/3,'Исходный запас потерян');
  s.step();assert(a.brain.updates===1&&a.brain.networkDelta.some(v=>v!==0),'Цикл не обучает сеть');
  assert(!controllerProblems(a.brain).length,'Повреждён личный мозг');
 }},
 {id:'neural-terminal',label:'Смерть завершает один сетевой переход без будущей оценки',run(){
  const {s,a}=fixture();a.energy=0;a.health=1;s.choose=a=>s.evaluate(a).find(o=>o.action===8);s.step();
  assert(!a.alive&&a.brain.updates===1&&a.brain.pending===null,'Переход не завершён');
  assert(a.brain.eligibility.every(v=>v===0),'После смерти остался градиентный след');
  assert(a.brain.lastLearning.beforeValue===0,'Исходный прогноз неверен');
 }},
 {id:'neural-modes',label:'Выключение TD исключает личные веса, памяти — только её входы',run(){
  const {s,a}=fixture();a.brain.networkDelta[OUTPUT_BIAS]=1;
  const learned=s.evaluate(a).find(o=>o.action===8).learningValue;s.learningEnabled=false;
  assert(learned===1&&s.evaluate(a).find(o=>o.action===8).learningValue===0,'TD не отключён');
  s.memoryEnabled=false;const o=s.evaluate(a)[0];
  assert(o.input.slice(19,25).every(v=>v===0)&&o.input.slice(29).every(v=>v===0),'Память просочилась');
  assert(o.input[11]===a.energy/100,'Тело отключено вместе с памятью');
 }},
 {id:'neural-inheritance',label:'Ребёнок наследует основу сети без опыта и мест родителя',run(){
  const {s,a}=fixture({mutations:false});a.energy=90;a.age=100;a.brain.networkDelta.fill(.2);a.brain.eligibility.fill(.3);
  const child=s.reproduce(a);assert(child,'Нет рождения');equal(child.genome,a.genome,'Гены изменены');
  assert(child.brain.controllerType===NEURAL_BRAIN_TYPE&&child.brain.networkDelta.every(v=>v===0)&&child.brain.eligibility.every(v=>v===0),'Наследован опыт');
  assert(child.brain.memory.size===0&&child.brain.longMemory.size===0,'Наследованы места');
 }},
 {id:'neural-mutations',label:'Сетевые мутации повторяемы и не изменяют исходный геном',run(){
  const genes=randomNeuralGenome(new Random(42)),before=genes.slice();
  const a=mutateGenome(genes,new Random(7),1),b=mutateGenome(genes,new Random(7),1);
  equal(a,b,'Мутации неповторяемы');equal(genes,before,'Изменён родитель');
  assert(a.some((v,i)=>v!==genes[i])&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=8),'Мутации не работают');
  equal(mutateGenome(genes,new Random(7),0),genes,'Нулевая вероятность изменила гены');
 }},
 {id:'neural-repeatability',label:'Сетевые миры повторяются по seed, просмотр не расходует RNG',run(){
  const a=new Evolution({population:4,limit:12,seed:23}),b=new Evolution({population:4,limit:12,seed:23});
  const before=JSON.stringify(a.snapshot());for(const agent of a.agents)a.evaluate(agent);equal(JSON.stringify(a.snapshot()),before,'Просмотр изменил мир');
  a.advance(40);b.advance(40);equal(a.snapshot(),b.snapshot(),'Миры расходятся');checkInvariants(a);
 }},
 {id:'neural-files',label:'Геном v7 требует точную схему, старые основы сохраняют таблицу',run(){
  const {s,a}=fixture(),file=s.genomeFile(a);assert(file.version===7&&file.network.hidden===16,'Контекст сети');
  equal(validateGenomeFile(file),a.genome,'Импорт изменил сеть');
  for(const patch of [{brainType:BRAIN_TYPE},{network:{...NETWORK_SCHEMA,inputs:33}},{network:null}]){
   let rejected=false;try{validateGenomeFile({...file,...patch});}catch{rejected=true;}assert(rejected,'Принята неверная схема');
  }
  const old=new Evolution({population:1,baseGenome:Array(435).fill(0)});assert(old.agents[0].brain.controllerType===BRAIN_TYPE&&old.genomeFile(old.agents[0]).version===6,'Старая основа переименована в сеть');
 }},
 {id:'neural-analysis',label:'Анализ сетей сохраняет параметры и не сравнивает их с таблицей',run(){
  const genes=Array(NEURAL_GENE_COUNT).fill(0),file={format:'big-evolution-genome',...genomeMetadata(genes),genes},a=analyzeGenome(file);
  const changed=genes.slice();changed[0]=.25;const b=analyzeGenome({...file,genes:changed}),pair=compareGenomes(a,b);
  assert(a.properties.length===558&&a.policy.length===0&&pair.sharedGenes===558&&pair.changedGenes===1,'Схема анализа');
  const old=analyzeGenome({format:'big-evolution-genome',version:6,genes:Array(572).fill(0)}),mixed=compareGenomes(old,a);
  assert(mixed.sharedGenes===13&&!mixed.policyComparable&&mixed.onlyB===545,'Сеть сопоставлена с таблицей');
 }},
 {id:'neural-defaults-facing',label:'Новые начальные условия и шесть мировых направлений взгляда',run(){
  const s=new Evolution(),a=s.agents[0];assert(s.initialPopulation===150&&s.limit===1000&&s.mutationRate===.02&&s.foodSettings.sourceCount===384&&s.foodSettings.regrowInterval===20,'Начальные условия');
  assert(s.agents.every(a=>a.brain.controllerType===NEIGHBOUR_BRAIN_TYPE),'Основатели без сети');
  const directions=new Set();a.frameRotation=0;a.brain.facing=0;const first=hexCenter(memoryWorldPosition(a,localNeighbours(a.brain)[0])),origin=hexCenter(a);
  for(let rotation=0;rotation<6;rotation++){a.frameRotation=rotation;const p=hexCenter(memoryWorldPosition(a,localNeighbours(a.brain)[0]));directions.add(Math.atan2(p.y-origin.y,p.x-origin.x).toFixed(6));}
  assert(directions.size===6&&first.x>origin.x,'Личный поворот не учтён');
 }}
];
