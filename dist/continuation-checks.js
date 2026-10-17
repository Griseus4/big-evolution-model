import {NEURAL_BRAIN_TYPE} from './neural-layout.js';
/** Регрессии 0.22 запускает пользователь. Входы 0.21 ниже записаны отдельной
 * формулой, чтобы ошибка общего writer не совпала с ошибкой его «эталона».
 * Полные миры сравниваются с прежним подробным путём продолжения/TD. */
import {Evolution as CurrentEvolution,RULES} from './evolution.js';
import {createControllerState,evaluateController,expectedControllerValue,recordControllerOutcome,prepareControllerOutcome,finishControllerOutcome,hasPendingDecision,BRAIN_TYPE} from './brain-controller.js';
import {fillNeuralInputs,expectedNeuralValue,NEURAL_TEMPERATURE} from './neural-brain.js';
import {referenceForward} from './neural-v018-reference.js';
import {bodySenses} from './brain-parameters.js';
import {getMemory,memoryBelief,spatialContext} from './cognition.js';
import {localNeighbours,positionKey} from './navigation.js';
import {BENCHMARK_CASES,createBenchmarkFixture,evaluatorRequests} from './benchmark-fixtures.js';
import {INPUT_COUNT,PARAMETER_COUNT,OUTPUT_WEIGHTS} from './neural-layout.js';
import {ACTION_COUNT,BIRTH_ACTION,STATE_COUNT} from './policy-layout.js';
// Исторический эталон 32 входа: явно сохраняем его мозг.
class Evolution extends CurrentEvolution{constructor(options={}){super({brainType:NEURAL_BRAIN_TYPE,heritableMutations:false,...options});}}
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
function exact(a,b,message){assert(a.length===b.length,message);for(let i=0;i<a.length;i++)assert(Object.is(a[i],b[i]),message+' '+i);}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
function fixture(){const spec=BENCHMARK_CASES[2],world=createBenchmarkFixture(spec,{brainType:NEURAL_BRAIN_TYPE}),agent=world.agents[0];return {world,agent,request:evaluatorRequests(world,spec)[0]};}
/** Независимый прежний вход, включая старый полный расчёт признаков при
 * выключенной памяти, последующее обнуление и clamp. Не оптимизировать. */
function inputV021(brain,o,candidate,potentials){
 const {action,localDestination,cell}=candidate,moving=action<6;
 const oldRecord=getMemory(brain,positionKey(localDestination)),oldBelief=oldRecord?memoryBelief(oldRecord,o.tick,brain.traits):null;
 const gradient=moving?potentials[action+1]-potentials[0]:0,risk=oldBelief?.risk??0,hunger=1-o.body.energy/100;
 const features=[Number(moving&&cell.food>0),Number(moving&&cell.hazard),Number(moving&&action===o.previousAction),
  gradient,risk,Number(moving&&(!oldRecord||oldRecord.visits===0)),moving?(oldBelief?.uncertainty??0):0,hunger*gradient,hunger*risk];
 if(!o.memoryEnabled)features.fill(0,3);
 const senses=[clamp(o.body.inventory/o.capacities.inventory,0,1),clamp(o.body.stomach/o.capacities.stomach,0,1)];
 const record=o.memoryEnabled?getMemory(brain,positionKey(localDestination)):null,belief=record?memoryBelief(record,o.tick,brain.traits):null;
 const input=Array(INPUT_COUNT).fill(0);input[action]=1;
 input.splice(11,21,o.body.energy/100,o.body.health/100,o.body.pain/100,...senses,...features,
  Number(o.currentFood),cell.food/10,Number(cell.hazard),Number(o.previousAction===action),belief?.confidence??0,(belief?.food??0)/10,
  record?Math.max(0,o.tick-record.lastSeen)/brain.traits.memoryAge:0);
 return {input:input.map(v=>clamp(v,-1,1)),features,senses};
}
function expectationV021(brain,request){
 const o=request.observation,potentials=o.memoryEnabled?spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick):Array(7).fill(0);
 const delta=o.learningEnabled?brain.networkDelta:new Float64Array(PARAMETER_COUNT);
 const values=request.candidates.map(c=>referenceForward(brain.networkBase,delta,inputV021(brain,o,c,potentials).input).value);
 if(!values.length)return 0;
 const scores=values.map(v=>v/NEURAL_TEMPERATURE),peak=Math.max(...scores),weights=scores.map(s=>Math.exp(s-peak));
 const sum=weights.reduce((n,v)=>n+v,0);
 return values.reduce((n,v,i)=>n+(weights[i]/sum)*v,0);
}
class DetailedContinuationWorld extends Evolution{
 learnPending(agent,terminal=false){
  if(!hasPendingDecision(agent.brain))return;
  const afterFeeling=this.feeling(agent);prepareControllerOutcome(agent.brain,{afterFeeling,tick:this.tick,memoryEnabled:this.memoryEnabled});
  const options=this.learningEnabled&&!terminal?this.evaluate(agent):[];
  finishControllerOutcome(agent.brain,{afterFeeling,tick:this.tick,terminal,learningEnabled:this.learningEnabled,nextValues:options.map(o=>({probability:o.probability,value:o.learningValue}))});
 }
}
export const CONTINUATION_CHECKS=[
 {id:'continuation-input-writer',label:'Продолжение: все входы/ощущения точно совпадают с независимой формулой 0.21',run(){
  const {agent,request}=fixture(),input=new Float64Array(INPUT_COUNT),features=new Float64Array(9),senses=new Float64Array(2);
  const record=getMemory(agent.brain,positionKey(agent.brain.position));record.injuries=3;record.exposures=5;agent.brain.spatialCache=null;
  for(const memoryEnabled of [true,false])for(const tick of [0,41,900])for(const energy of [-0,50,100,130]){
   const o={...request.observation,tick,memoryEnabled,body:{energy,health:50,pain:20,inventory:energy===50?3:0,stomach:energy===100?66:0}};
   const potentials=memoryEnabled?spatialContext(agent.brain,[o.position,...localNeighbours(agent.brain)],tick):Array(7).fill(0);
   for(const candidate of request.candidates){
    input.fill(NaN);features.fill(NaN);senses.fill(NaN);assert(bodySenses(o.body,3,66,senses)===senses,'Создан другой буфер ощущений');
    fillNeuralInputs(agent.brain,o,candidate,potentials,input,features,senses);
    const reference=inputV021(agent.brain,o,candidate,potentials);exact(input,reference.input,'Вход');exact(features,reference.features,'Признаки');exact(senses,reference.senses,'Ощущения');
   }
  }
 }},
 {id:'continuation-expectation',label:'Продолжение: Expected Q совпадает с прежним softmax при смене режимов/весов/числа действий',run(){
  const {agent,request}=fixture();
  for(const memoryEnabled of [true,false])for(const learningEnabled of [true,false])for(const count of [11,1,5,2,0]){
   const next={...request,observation:{...request.observation,memoryEnabled,learningEnabled},candidates:request.candidates.slice(0,count)};
   const actual=expectedControllerValue(agent.brain,agent.genome,next),reference=expectationV021(agent.brain,next);
   assert(Object.is(actual,reference),'Expected Q изменился');
   agent.brain.networkDelta.fill(count%2?.37:-.22);assert(Object.is(expectedNeuralValue(agent.brain,next),expectationV021(agent.brain,next)),'Устаревшие параметры');
  }
  agent.brain.networkBase.fill(8);agent.brain.networkDelta.fill(4);
  assert(Object.is(expectedNeuralValue(agent.brain,request),expectationV021(agent.brain,request)),'Нестабильный softmax при крайних весах');
 }},
 {id:'continuation-buffer-isolation',label:'Продолжение: буферы не меняют решения/другой мозг, старый контракт TD сохранён',run(){
  const {world,agent,request}=fixture(),other=world.agents[1],options=world.evaluate(agent),saved=JSON.stringify(options),choice=options[0];
  recordControllerOutcome(agent.brain,choice,{position:agent.brain.position,damage:0,beforeFeeling:20,tick:0,memoryEnabled:false,learningEnabled:true});
  const pending=agent.brain.pending.choice,held=JSON.stringify(pending),otherState=JSON.stringify(other.brain.networkDelta);
  for(let i=0;i<5;i++)expectedControllerValue(agent.brain,agent.genome,request);
  assert(JSON.stringify(options)===saved&&JSON.stringify(pending)===held,'Переписаны исторические входы');assert(JSON.stringify(other.brain.networkDelta)===otherState,'Изменён другой мозг');
  const a=createControllerState(agent.genome),b=createControllerState(agent.genome);
  for(const brain of [a,b])recordControllerOutcome(brain,choice,{position:brain.position,damage:0,beforeFeeling:20,tick:0,memoryEnabled:false,learningEnabled:true});
  const transition={afterFeeling:-40,tick:1,terminal:false,learningEnabled:true};
  finishControllerOutcome(a,{...transition,nextValue:0});finishControllerOutcome(b,{...transition,nextValues:[{probability:1,value:0}]});
  exact(a.networkDelta,b.networkDelta,'TD-поправки');exact(a.eligibility,b.eligibility,'След TD');equal(a.lastLearning,b.lastLearning,'Отчёт TD');
 }},
 {id:'continuation-frame-contract',label:'Продолжение: компактный запрос прежний, RNG не расходуется, терминал/TD-off не оценивают будущее',run(){
  const {world,agent}=fixture(),full=world.decisionFrame(agent),compact=world.decisionFrame(agent,false);
  assert(full.executionDestinations instanceof Map&&compact.executionDestinations===null,'Неверный слой исполнения');equal(full.request,compact.request,'Изменён запрос мозга');
  const streams=[world.random,world.cognitiveRandom,world.bodyRandom,world.neuralRandom],before=streams.map(r=>r.state);world.expectedContinuation(agent);equal(streams.map(r=>r.state),before,'Потрачен RNG');
  let calls=0;world.expectedContinuation=()=>{calls++;throw new Error('Лишняя оценка');};
  const option=world.evaluate(agent)[0];
  function pending(){recordControllerOutcome(agent.brain,option,{position:agent.brain.position,damage:0,beforeFeeling:20,tick:world.tick,memoryEnabled:false,learningEnabled:true});}
  pending();world.learningEnabled=false;world.learnPending(agent);assert(!agent.brain.pending,'Не очищен pending без TD');
  pending();world.learningEnabled=true;world.learnPending(agent,true);assert(calls===0&&!agent.brain.pending,'Оценено будущее терминального перехода');
 }},
 {id:'continuation-world-equivalence',label:'Продолжение: полные миры/RNG совпадают с 0.21, включая рождения, смерти и старый мозг',run(){
  for(const modes of [{},{memory:false},{learning:false},{memory:false,learning:false},{brainType:BRAIN_TYPE}]){
   const config={seed:23,population:4,limit:16,foodSources:24,...modes},a=new Evolution(config),b=new DetailedContinuationWorld(config);
   for(const world of [a,b]){
    world.agents[0].age=RULES.maxAge-1; // Терминальный переход на первом шаге.
    const parent=world.agents[1];parent.age=100;
    const genes=parent.genome.slice();genes.fill(0);
    if(modes.brainType===BRAIN_TYPE)for(let row=0;row<STATE_COUNT;row++)genes[row*ACTION_COUNT+BIRTH_ACTION]=8;
    else{genes[BIRTH_ACTION]=8;genes[OUTPUT_WEIGHTS]=8;}
    parent.genome=genes;parent.brain=createControllerState(genes); // Только проверочная сильная склонность к рождению.
   }
   for(let i=0;i<100&&a.agents.length;i++){a.step();b.step();equal(a.snapshot(),b.snapshot(),'Миры разошлись на шаге '+a.tick);}
   assert(a.stats.births>0&&a.stats.deathsByCause.age>0,'Фикстура не охватила рождение и терминал');
  }
 }},
];
