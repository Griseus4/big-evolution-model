import {NEURAL_BRAIN_TYPE} from './neural-layout.js';
/** Пользовательские проверки 0.19. Эталон — замороженный код сети 0.18,
 * не второй режим игры. Сравниваем числа точно, затем полные миры/RNG.
 * Здесь нет замеров скорости: их выполняет пользователь в обычном мире. */
import {Evolution as CurrentEvolution} from './evolution.js';
import {createControllerState,prepareControllerOutcome,hasPendingDecision,evaluateController} from './brain-controller.js';
import {createNeuralBrain,neuralValue,evaluateNeural,learnNeural,neuralGradient,neuralForward} from './neural-brain.js';
import {referenceForward,referenceGradient,referenceInputs,referenceEvaluate,referenceLearn} from './neural-v018-reference.js';
import {PARAMETER_COUNT,INPUT_COUNT,HIDDEN_COUNT} from './neural-layout.js';
import {randomNeuralGenome} from './genome.js';
import {Random} from './simulation.js';
import {spatialContext} from './cognition.js';
import {localNeighbours} from './navigation.js';
// Исторический эталон 32 входа: явно сохраняем его мозг.
class Evolution extends CurrentEvolution{constructor(options={}){super({brainType:NEURAL_BRAIN_TYPE,heritableMutations:false,...options});}}
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
function exact(a,b,message){assert(a.length===b.length,message+' (длина)');for(let i=0;i<a.length;i++)assert(Object.is(a[i],b[i]),message+' '+i);}
function probabilities(options){
 if(!options.length)return [];
 const peak=Math.max(...options.map(o=>o.score)),sum=options.reduce((n,o)=>n+Math.exp(o.score-peak),0);
 return options.map(o=>({...o,probability:Math.exp(o.score-peak)/sum}));
}
/** Сравниваем на одном уровне контракта: world.evaluate уже добавляет
 * destination (мировые координаты исполнения), referenceEvaluate — только
 * сведения мозга. Эталону добавляем тот же публичный слой исполнения.
 * Числа, порядок/поля вариантов и строгость equal не меняются.
 */
function referenceWorldOptions(world,agent){
 const frame=world.decisionFrame(agent);
 return probabilities(referenceEvaluate(agent.brain,frame.request)).map(option=>world.executableDecision(frame,option));
}
function brainPair(seed=42){const genes=randomNeuralGenome(new Random(seed));return {genes,a:createNeuralBrain(genes),b:createNeuralBrain(genes)};}
class ReferenceWorld extends Evolution{
 evaluateFrame(agent){const frame=this.decisionFrame(agent);return {frame,options:probabilities(referenceEvaluate(agent.brain,frame.request))};}
 learnPending(agent,terminal=false){
  const brain=agent.brain;if(!hasPendingDecision(brain))return;
  const afterFeeling=this.feeling(agent);
  prepareControllerOutcome(brain,{afterFeeling,tick:this.tick,memoryEnabled:this.memoryEnabled});
  const options=this.learningEnabled&&!terminal?this.evaluate(agent):[];
  if(this.learningEnabled){const nextValue=terminal?0:options.reduce((sum,o)=>sum+o.probability*o.learningValue,0);
   referenceLearn(brain,brain.pending.choice,{beforeFeeling:brain.pending.beforeFeeling,afterFeeling,nextValue,terminal,tick:this.tick});}
  brain.pending=null;
 }
}
export const OPTIMIZATION_CHECKS=[
 {id:'optimization-scalar',label:'Оптимизация: Q и скрытые узлы точно совпадают с 0.18',run(){
  for(const seed of [1,42,101]){
   const {a}=brainPair(seed);for(let i=0;i<PARAMETER_COUNT;i++)a.networkDelta[i]=Math.sin(i+seed)*.37;
   const parameters=Float64Array.from(a.networkBase,(v,i)=>v+a.networkDelta[i]);
   for(const input of [Array(INPUT_COUNT).fill(0),Array(INPUT_COUNT).fill(1),Array.from({length:INPUT_COUNT},(_,i)=>Math.sin(i+seed)),Array(INPUT_COUNT).fill(-0)]){
    const hidden=new Float64Array(HIDDEN_COUNT),reference=referenceForward(a.networkBase,a.networkDelta,input);
    assert(Object.is(neuralValue(parameters,input,hidden),reference.value),'Q изменился');exact(hidden,reference.hidden,'Скрытые узлы');
    assert(Object.is(neuralValue(parameters,input),reference.value),'Скалярный путь отличается');
   }
  }
 }},
 {id:'optimization-inputs-policy',label:'Оптимизация: входы и вероятности совпадают с 0.18',run(){
  for(const memory of [true,false])for(const learning of [true,false]){
   const world=new Evolution({seed:42,population:1,limit:3,memory,learning,foodSources:24}),agent=world.agents[0];agent.age=100;agent.energy=90;agent.inventory=2;agent.stomach=22;
   world.tile(agent.x,agent.y).food=1;world.observe(agent,true);agent.brain.networkDelta.fill(.13);
   const request=world.decisionFrame(agent).request,o=request.observation,potentials=memory?spatialContext(agent.brain,[o.position,...localNeighbours(agent.brain)],o.tick):Array(7).fill(0);
   const actual=evaluateNeural(agent.brain,request),reference=referenceEvaluate(agent.brain,request);
   for(let i=0;i<actual.length;i++){
    exact(actual[i].input,referenceInputs(agent.brain,o,request.candidates[i],potentials).input,'Вход');
    exact(actual[i].features,reference[i].features,'Признаки');exact(actual[i].senses,reference[i].senses,'Ощущения');
    assert(Object.is(actual[i].learningValue,reference[i].learningValue),'Q варианта');
   }
   equal(evaluateController(agent.brain,agent.genome,request),probabilities(reference),'Политика/softmax изменилась');
  }
 }},
 {id:'optimization-gradient-td',label:'Оптимизация: градиент, след и 40 обновлений TD точно совпадают с 0.18',run(){
  const {a,b}=brainPair(23);
  for(let i=0;i<PARAMETER_COUNT;i++){a.networkDelta[i]=b.networkDelta[i]=Math.cos(i)*.2;a.eligibility[i]=b.eligibility[i]=Math.sin(i)*.1;}
  for(let tick=1;tick<=40;tick++){
   const input=Array.from({length:INPUT_COUNT},(_,i)=>Math.sin(i+tick)),choice={action:tick%11,input};
   const forward=neuralForward(a.networkBase,a.networkDelta,input),buffer=new Float64Array(PARAMETER_COUNT);
   assert(neuralGradient(a.networkBase,a.networkDelta,input,forward.hidden,buffer)===buffer,'Градиент не использует переданный буфер');
   exact(buffer,referenceGradient(b.networkBase,b.networkDelta,input,forward.hidden),'Градиент');
   const transition={beforeFeeling:tick%2?80:-60,afterFeeling:tick%3?40:-90,nextValue:Math.cos(tick),terminal:tick%9===0,tick};
   learnNeural(a,choice,transition);referenceLearn(b,choice,transition);
   exact(a.networkDelta,b.networkDelta,'Личные параметры');exact(a.eligibility,b.eligibility,'След');equal(a.lastLearning,b.lastLearning,'Отчёт TD');assert(a.updates===b.updates,'Счётчик TD');
  }
 }},
 {id:'optimization-buffer-isolation',label:'Оптимизация: следующие оценки не изменяют старые входы и другой мозг',run(){
  const world=new Evolution({population:2,limit:4,seed:42}),[a,b]=world.agents;
  const options=world.evaluate(a),saved=JSON.stringify(options),other=world.evaluate(b),otherSaved=JSON.stringify(other);
  world.evaluate(b);world.evaluate(a);a.brain.networkDelta.fill(.4);world.evaluate(a);
  equal(JSON.stringify(options),saved,'Переписаны сохранённые варианты');equal(JSON.stringify(other),otherSaved,'Переписан другой мозг');
  if(options.length>1){assert(options[0].input!==options[1].input&&options[0].senses!==options[1].senses,'Общий возвращённый буфер');}
  const changed=world.evaluate(a);equal(changed,referenceWorldOptions(world,a),'Устаревшие эффективные веса');
  world.learningEnabled=false;equal(world.evaluate(a),referenceWorldOptions(world,a),'Выключение TD использует личные веса');
 }},
 {id:'optimization-world-reference',label:'Оптимизация: полные миры и RNG совпадают с эталонной сетью 0.18',run(){
  for(const modes of [{},{learning:false},{memory:false},{learning:false,memory:false},{mutations:false}]){
   const options={seed:23,population:5,limit:16,foodSources:24,...modes},actual=new Evolution(options),reference=new ReferenceWorld(options);
   for(let i=0;i<120&&actual.agents.length;i++){
    actual.step();reference.step();equal(actual.snapshot(),reference.snapshot(),'Мир расходится на шаге '+actual.tick);
   }
  }
 }},
 {id:'optimization-softmax-extremes',label:'Оптимизация: softmax устойчив и совпадает с прежним при крайних оценках',run(){
  const {genes,a}=brainPair();a.networkDelta.fill(4);a.networkBase.fill(8);
  const request={schema:'local-decision-v1',observation:{body:{energy:90,health:100,pain:0,inventory:1,stomach:0},capacities:{inventory:3,stomach:66},position:{q:0,r:0},currentFood:true,previousAction:8,tick:1,memoryEnabled:false,learningEnabled:true},candidates:[0,7,8,9,10].map(action=>({id:'action-'+action,action,localDestination:{q:0,r:0},cell:{food:10,hazard:false}}))};
  const actual=evaluateController(a,genes,request),reference=probabilities(referenceEvaluate(a,request));
  equal(actual,reference,'Softmax отличается');assert(actual.every(o=>Number.isFinite(o.probability))&&Math.abs(actual.reduce((n,o)=>n+o.probability,0)-1)<1e-12,'Вероятности не нормированы');
 }},
];
