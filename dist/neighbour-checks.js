/** Проверки новой модели запускает пользователь. Фикстуры размещают тела
 * явно; симуляция не получает готовых стратегий или социальных наград.
 * Исторический v7 проверяем отдельно от правильности нового восприятия.
 */
import {LegacyEvolution as Evolution,RULES,memoryWorldPosition} from './evolution.js';
import {localNeighbours,moveLocally} from './navigation.js';
import {NEIGHBOUR_BRAIN_TYPE,NEURAL_BRAIN_TYPE,layoutForType} from './neural-layout.js';
import {createControllerState,controllerProblems,evaluateController,expectedControllerValue} from './brain-controller.js';
import {neuralForward,neuralGradient,learnNeural} from './neural-brain.js';
import {genomeMetadata,randomNeuralGenome,validateGenomeFile,mutateGenome} from './genome.js';
import {analyzeGenome,compareGenomes} from './genome-analysis.js';
import {captureBenchmarkState,restoreBenchmarkState} from './benchmark-state.js';
import {Random} from './simulation.js';
import {densitySignal} from './neighbour-perception.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
function fixture(brainType=NEIGHBOUR_BRAIN_TYPE){
 const world=new Evolution({population:1,limit:30,brainType,seed:42,mutations:false,heritableMutations:false}),agent=world.agents[0];
 for(const cell of world.tiles){cell.terrain='land';cell.risk=0;cell.food=0;cell.maxFood=0;}
 world.moveAgent(agent,{x:12,y:12});agent.frameRotation=0;
 return {world,agent};
}
function add(world,agent,position){return world.addAgent(position,agent.genome.slice(),null);}
function nearby(agent,action){return memoryWorldPosition(agent,localNeighbours(agent.brain)[action]);}
export const NEIGHBOUR_CHECKS=[
 {id:'neighbours-counts',label:'Соседи: своя и шесть клеток, себя не считает, направления различает',run(){
  const {world,agent}=fixture();add(world,agent,agent);add(world,agent,nearby(agent,0));add(world,agent,nearby(agent,0));add(world,agent,nearby(agent,1));
  const view=world.neighbours(agent);assert(view.ownCount===1&&view.visibleCount===4,'Неверный итог');
  assert(view.cells.length===7&&view.cells.find(c=>c.action===0).count===2&&view.cells.find(c=>c.action===1).count===1,'Направления смешаны');
 }},
 {id:'neighbours-privacy',label:'Соседи: дальние тела скрыты, чужие ID доступны только на своей клетке',run(){
  const {world,agent}=fixture(),contact=add(world,agent,agent),adjacent=add(world,agent,nearby(agent,0));
  add(world,agent,{x:30,y:20});equal(world.contacts(agent),[contact.id],'Узнаёт удалённую личность');
  const view=world.neighbours(agent);assert(view.visibleCount===2,'Видит за радиусом');
  assert(view.cells.every(c=>Object.keys(c).sort().join()==='action,count,q,r'),'Утечка ID/тела/мировых координат');
  assert(!JSON.stringify(world.decisionFrame(agent).request).includes('"parentId"'),'Родство в наблюдении');
  assert(!world.contacts(agent).includes(adjacent.id),'ID соседа раскрыт');
 }},
 {id:'neighbours-current-contact',label:'Соседи: контакт обновляется сразу после входа и выхода, прошлых встреч нет',run(){
  const {world,agent}=fixture(),other=add(world,agent,nearby(agent,0)),id=other.id;
  world.moveAgent(other,agent);equal(world.contacts(agent),[id],'Не узнаёт вошедшего');
  world.moveAgent(other,nearby(agent,1));equal(world.contacts(agent),[],'Сохранил прежний контакт');
  world.moveAgent(other,agent);equal(world.contacts(agent),[id],'ID изменился при новой встрече');
  assert(!Object.hasOwn(agent.brain,'socialMemory'),'Создана социальная память');
 }},
 {id:'neighbours-move-direction',label:'Соседи: успешный шаг меняет индекс и собственное направление согласованно',run(){
  const {world,agent}=fixture(),other=add(world,agent,nearby(agent,0));
  const destination=nearby(agent,0);world.moveAgent(agent,destination);moveLocally(agent.brain,0);
  equal(world.contacts(agent),[other.id],'После шага потерян контакт');
  assert(world.occupancy.locations.get(agent.id)===`${agent.x},${agent.y}`&&world.neighbours(agent).ownCount===1,'Индекс отстал');
 }},
 {id:'neighbours-birth-death',label:'Соседи: ребёнок появляется сразу, умерший исчезает из текущего обзора',run(){
  const {world,agent}=fixture();agent.age=100;agent.energy=90;
  const child=world.reproduce(agent);assert(child&&world.neighbours(agent).ownCount===1,'Рождение не обновило индекс');
  equal(world.contacts(child),[agent.id],'Ребёнок не видит текущий контакт');
  world.die(child,'age');assert(world.neighbours(agent).ownCount===0&&world.contacts(agent).length===0,'Мёртвый считается соседом');
  assert(world.contacts(child).length===0,'Мёртвый наблюдает');
 }},
 {id:'neighbours-border',label:'Соседи: край карты не добавляет выдуманные клетки или тела',run(){
  const {world,agent}=fixture();world.moveAgent(agent,{x:0,y:0});
  const view=world.neighbours(agent);assert(view.cells.length<7&&view.cells.length>1&&view.visibleCount===0,'Ошибочный край карты');
  assert(world.evaluate(agent).every(o=>o.input.every(Number.isFinite)),'Неконечный вход на краю');
 }},
 {id:'neighbours-local-symmetry',label:'Соседи: одинаковое локальное окружение даёт одинаковые входы независимо от места',run(){
  const {world,agent}=fixture();add(world,agent,nearby(agent,0));add(world,agent,agent);
  agent.brain=createControllerState(agent.genome);const before=world.evaluate(agent).map(o=>o.input);
  const shift={x:18,y:8};for(const a of world.agents)world.moveAgent(a,{x:a.x+shift.x,y:a.y+shift.y});
  equal(world.evaluate(agent).map(o=>o.input),before,'Глобальное положение повлияло');
 }},
 {id:'neighbours-inputs',label:'Соседи: 35 входов различают плотность, доступны без памяти/TD',run(){
  const {world,agent}=fixture();world.memoryEnabled=false;world.learningEnabled=false;
  add(world,agent,agent);add(world,agent,nearby(agent,0));add(world,agent,nearby(agent,0));
  const options=world.evaluate(agent),forward=options.find(o=>o.action===0),wait=options.find(o=>o.action===8);
  assert(forward.input.length===35&&forward.input[32]===densitySignal(1)&&forward.input[33]===densitySignal(2)&&forward.input[34]===densitySignal(3),'Не переданы количества');
  assert(wait.input[33]===densitySignal(1),'Бездействие не относится к своей клетке');
  assert(options.every(o=>o.input.slice(29,32).every(v=>v===0)),'Память не выключена');
  assert(densitySignal(99)<densitySignal(100),'Жёсткий потолок количества');
 }},
 {id:'neighbours-network-response',label:'Соседи: веса могут предпочитать или избегать плотную клетку, без заданного знака',run(){
  const {world,agent}=fixture(),layout=layoutForType(NEIGHBOUR_BRAIN_TYPE);add(world,agent,nearby(agent,0));
  for(const sign of [1,-1]){
   const genes=Array(layout.genes).fill(0);genes[33]=sign;genes[layout.outputWeights]=1;
   agent.genome=genes;agent.brain=createControllerState(genes);
   const options=world.evaluate(agent),forward=options.find(o=>o.action===0),back=options.find(o=>o.action===1);
   assert(sign*(forward.learningValue-back.learningValue)>0,'Сеть не реагирует на плотность');
  }
 }},
 {id:'neighbours-gradient',label:'Соседи: производные всех 593 параметров и TD соответствуют новой форме сети',run(){
  const {world,agent}=fixture(),base=agent.brain.networkBase,delta=agent.brain.networkDelta;
  const input=world.evaluate(agent).find(o=>o.action===8).input;input[32]=.5;input[33]=.7;input[34]=.9;
  const f=neuralForward(base,delta,input),g=neuralGradient(base,delta,input,f.hidden),epsilon=1e-6;
  assert(g.length===593,'Неверный градиент');
  for(let i=0;i<g.length;i++){delta[i]=epsilon;const plus=neuralForward(base,delta,input).value;delta[i]=-epsilon;const minus=neuralForward(base,delta,input).value;delta[i]=0;
   assert(Math.abs(g[i]-(plus-minus)/(2*epsilon))<2e-7,`Градиент ${i}`);}
  learnNeural(agent.brain,{action:8,input},{beforeFeeling:0,afterFeeling:50,nextValue:0,terminal:false,tick:1});
  assert(!controllerProblems(agent.brain).length&&agent.brain.networkDelta.some(v=>v!==0),'TD не обновил новую сеть');
 }},
 {id:'neighbours-continuation',label:'Соседи: компактный Expected Q совпадает с полной оценкой и не портит сохранённые входы',run(){
  const {world,agent}=fixture();add(world,agent,nearby(agent,0));
  const request=world.decisionFrame(agent).request,options=evaluateController(agent.brain,agent.genome,request),saved=JSON.stringify(options);
  const expected=options.reduce((n,o)=>n+o.probability*o.learningValue,0);
  assert(Object.is(expectedControllerValue(agent.brain,agent.genome,request),expected),'Продолжение изменило математику');
  equal(JSON.stringify(options),saved,'Буфер переписал варианты');
 }},
 {id:'neighbours-v7-compatibility',label:'Соседи: импорт v7 не расширяется, прежняя сеть не получает новые признаки',run(){
  const genes=randomNeuralGenome(new Random(7),NEURAL_BRAIN_TYPE),file={format:'big-evolution-genome',...genomeMetadata(genes),genes};
  equal(validateGenomeFile(file),genes,'v7 расширен');
  const {world,agent}=fixture(NEURAL_BRAIN_TYPE),before=world.evaluate(agent).map(o=>[o.input,o.learningValue,o.probability]);
  add(world,agent,nearby(agent,0));equal(world.evaluate(agent).map(o=>[o.input,o.learningValue,o.probability]),before,'Соседи изменили v7');
  assert(world.genomeFile(agent).version===7&&agent.genome.length===558,'Изменён формат v7');
 }},
 {id:'neighbours-v8-files',label:'Соседи: v8 экспортируется/наследуется точно, анализ v7/v8 сравнивает только общие свойства',run(){
  const {world,agent}=fixture(),file=world.genomeFile(agent);assert(file.version===8&&file.genes.length===606&&file.network.inputs===35,'Формат v8');
  equal(validateGenomeFile(file),agent.genome,'Импорт изменён');
  const legacy=randomNeuralGenome(new Random(7)),a=analyzeGenome(file),b=analyzeGenome({format:'big-evolution-genome',...genomeMetadata(legacy),genes:legacy});
  assert(compareGenomes(a,b).sharedGenes===13,'Сдвинутые связи сравниваются как те же гены');
  equal(mutateGenome(agent.genome,new Random(4),0),agent.genome,'Нулевая мутация изменила v8');
  const original=agent.genome.slice();agent.age=100;agent.energy=90;agent.brain.networkDelta.fill(.1);
  const child=world.reproduce(agent);equal(child.genome,original,'Наследован другой геном');
  assert(child.brain.networkDelta.every(v=>v===0)&&child.brain.memory.size===0&&child.brain.longMemory.size===0,'Наследован опыт');
 }},
 {id:'neighbours-index-restore',label:'Соседи: восстановление фиксированного мира сохраняет индекс, локальный запрос не обходит жителей',run(){
  const {world,agent}=fixture(),other=add(world,agent,agent),restored=restoreBenchmarkState(captureBenchmarkState(world));
  equal(restored.contacts(restored.agents[0]),[other.id],'Снимок потерял индекс');
  const held=world.agents;Object.defineProperty(world,'agents',{get(){throw new Error('Полный обход населения');},configurable:true});
  assert(world.neighbours(agent).ownCount===1&&world.contacts(agent)[0]===other.id,'Запрос неверен');
  Object.defineProperty(world,'agents',{value:held,writable:true,configurable:true});
 }},
 {id:'neighbours-index-cycle',label:'Соседи: индекс совпадает с независимым подсчётом после последовательных шагов мира',run(){
  const world=new Evolution({population:12,limit:30,seed:23});
  for(let tick=0;tick<64&&world.agents.length;tick++){
   world.step();assert(world.occupancy.locations.size===world.agents.length,'Размер индекса');
   for(const agent of world.agents)for(const cell of world.neighbours(agent).cells){
    const p=memoryWorldPosition(agent,cell),count=world.agents.filter(a=>a.id!==agent.id&&a.alive&&a.x===p.x&&a.y===p.y).length;
    assert(cell.count===count,'Индекс отстал от мира');
   }
  }
 }},
];
