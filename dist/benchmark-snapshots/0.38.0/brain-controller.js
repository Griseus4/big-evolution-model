/** Контракт между миром и контроллером, первый этап перехода к сети.
 * Модуль не импортирует Evolution, DOM или генератор случайных чисел.
 * На входе только собственное тело, личная позиция и видимые признаки вариантов.
 * Мировые x/y и исполнение остаются в Evolution. Новая сеть и прежний
 * табличный адаптер загруженных геномов используют один контракт мира.
 */
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
import * as temporalBrain from './temporal-brain.js';
import {prepareSetDecisionInput as prepareTemporalInput} from './temporal-inputs.js';
import {createBrain,observe,wellbeing,spatialContext,actionFeatures,spatialInstinct,learnedValue,TRACE_LIMIT,FEATURE_NAMES,
 learn,rememberOutcome,rememberDecision,rememberExperience} from './cognition.js';
import {localNeighbours} from './navigation.js';
import {ACTION_COUNT,STATE_COUNT,EXPERIENCE_SIZE,BODY_WEIGHT_COUNT} from './policy-layout.js';
import {bodySenses,bodySenseValue} from './brain-parameters.js';
import {NEURAL_BRAIN_TYPE,NEURAL_GENE_COUNT,PARAMETER_COUNT,layoutForGenes,layoutForType} from './neural-layout.js';
import {createNeuralBrain,evaluateNeural,expectedNeuralValue,learnNeural} from './neural-brain.js';
import {SET_BRAIN_TYPE} from './set-brain-layout.js';
import {evaluateSetBrain,expectedSetValue,learnSetBrain} from './set-brain.js';
import {cloneSetInput,validSetInput,prepareSetDecisionInput} from './set-brain-inputs.js';
import {beginComputePart,endComputePart} from './performance-probe.js';

export const BRAIN_TYPE='table-linear-v6',DECISION_SCHEMA='local-decision-v1';
export function createControllerState(genes){return layoutForGenes(genes)?createNeuralBrain(genes):{...createBrain(genes),controllerType:BRAIN_TYPE};}
export function controllerFeeling(brain,body,stomachCapacity){if(!brain.temporal)return wellbeing(body,brain.traits,stomachCapacity);const v=brain.traits.values,n=Math.abs(v[0])+Math.abs(v[1])+Math.abs(v[3]);return n<1e-12?0:Math.max(-100,Math.min(100,100*(v[0]*(body.energy/50-1)+v[1]*(body.health/50-1)+v[3]*body.stomach/stomachCapacity)/n));}
export function observeController(brain,cells,position,tick,visit){observe(brain,cells,position,tick,visit);}

/** Строка — особенность нынешнего контроллера, не правило физики мира.
 * Сохраняем прежние пороги/порядок пяти признаков для геномов v1…v6.
 */
export function controllerState(observation){
 const {body}=observation,energy=body.energy<30?0:body.energy<70?1:2;
 return ((((energy*2+Number(body.inventory>0))*2+Number(observation.currentFood))*2+
  Number(body.pain>1))*2+Number(body.stomach>0));
}

/** request = {schema, observation, candidates}. Кандидат содержит стабильный
 * id, action, подпись, личное назначение и видимые food/hazard. Он уже допустим
 * по физике. learningValue — оценка продолжения для обучения, score — оценка
 * выбора; сейчас они различаются, как в прежней врождённой политике + критике.
 */
export function prepareControllerDecision(brain,request){
 if(request.schema!==DECISION_SCHEMA)throw new Error('Неизвестная схема наблюдений мозга.');
 return brain.temporal?prepareTemporalInput(brain,request):brain.controllerType===SET_BRAIN_TYPE?prepareSetDecisionInput(brain,request):null;
}
export function evaluateController(brain,genes,request,decision=null){
 if(request.schema!==DECISION_SCHEMA)throw new Error('Неизвестная схема наблюдений мозга.');
 if(brain.temporal)return temporalBrain.evaluateSetBrain(brain,request,true,decision);
 if(brain.controllerType===SET_BRAIN_TYPE)return evaluateSetBrain(brain,request,true,decision);
 if(Boolean(layoutForType(brain.controllerType))){
  const options=evaluateNeural(brain,request);if(!options.length)return [];
  return softmaxOptions(options);
 }
 if(brain.controllerType&&brain.controllerType!==BRAIN_TYPE)throw new Error('Неизвестный контроллер мозга.');
 const {observation:o,candidates}=request;
 if(!candidates.length)return [];
 const row=controllerState(o),positions=[o.position,...localNeighbours(brain)];
 const senses=bodySenses(o.body,o.capacities.inventory,o.capacities.stomach);
 const potentials=o.memoryEnabled?spatialContext(brain,positions,o.tick):Array(7).fill(0);
 const offset=STATE_COUNT*ACTION_COUNT,options=[];
 for(const candidate of candidates){
  const {action,localDestination,cell}=candidate;
  if(!Number.isInteger(action)||action<0||action>=ACTION_COUNT)throw new Error('Действие не поддержано табличным контроллером.');
  const extra=action<6?genes[offset]*Number(cell.food>0)+genes[offset+1]*Number(cell.hazard)+
   genes[offset+2]*Number(o.previousAction===action):0;
  const features=actionFeatures(brain,{action,destination:localDestination,current:o.position,cell,
   previousAction:o.previousAction,energy:o.body.energy,tick:o.tick,potentials});
  if(!o.memoryEnabled)features.fill(0,3);
  const bodyInnate=bodySenseValue(brain.bodyGenes,action,senses);
  const bodyExperience=o.learningEnabled?brain.scale*bodySenseValue(brain.bodyWeights,action,senses):0;
  const innate=genes[row*ACTION_COUNT+action]+extra+spatialInstinct(brain,features)+bodyInnate;
  const experience=o.learningEnabled?learnedValue(brain,row,action,features,senses):0;
  options.push({...candidate,row,features,senses:senses.slice(),bodyInnate,bodyExperience,
   innate,experience,learningValue:experience,score:innate+experience});
 }
 // Прежний порядок сумм и устойчивая экспонента: рефакторинг не меняет политику.
 return softmaxOptions(options);
}

/** Облегчённый контракт для TD: требуется одно ожидаемое значение, без
 * выбранного действия/исторических входов. Старый табличный адаптер сохраняет
 * полную оценку и прежний порядок reduce; сеть использует частные буферы. */
export function expectedControllerValue(brain,genes,request,decision=null){
 if(request.schema!==DECISION_SCHEMA)throw new Error('Неизвестная схема наблюдений мозга.');
 if(brain.temporal)return temporalBrain.expectedSetValue(brain,request,decision);
 if(brain.controllerType===SET_BRAIN_TYPE)return expectedSetValue(brain,request,decision);
 if(Boolean(layoutForType(brain.controllerType)))return expectedNeuralValue(brain,request);
 return evaluateController(brain,genes,request).reduce((sum,o)=>sum+o.probability*o.learningValue,0);
}

/** Массив вариантов принадлежит текущему вызову и ещё никому не возвращён.
 * Не создаём второй набор объектов и не считаем exp повторно. Сумма идёт
 * слева направо, как прежний reduce; probability записывается только после неё.
 */
function softmaxOptions(options){
 let peak=-Infinity;for(const o of options)peak=Math.max(peak,o.score);
 let sum=0;for(const o of options){o.probability=Math.exp(o.score-peak);sum+=o.probability;}
 for(const o of options)o.probability/=sum;
 return options;
}

/** Бросок принадлежит миру; оценка/просмотр ничего не расходуют. Один вызов
 * выбора получает один roll 0…1, как прежняя choose. Возвращаем вариант, а не
 * исполняем его: даже будущая сеть не сможет обойти доступность действий.
 */
export function selectControllerDecision(options,roll){
 if(!options.length)throw new Error('У мозга нет доступных действий.');
 let chosen=options.at(-1);
 for(const option of options){roll-=option.probability;if(roll<=0){chosen=option;break;}}
 return chosen;
}

/** Итог действия хранит место после него, а ощущения — ДО него. В 0.15
 * основной цикл копировал features, но забывал senses: личные пары всегда
 * получали нулевой вход. Теперь один переход копируется в одном месте.
 * Мировое destination и служебные поля исполнителя сюда не попадают.
 */
export function recordControllerOutcome(brain,decision,{position,damage,beforeFeeling,tick,memoryEnabled,learningEnabled}){
 if(memoryEnabled){rememberOutcome(brain,position,tick,damage);rememberDecision(brain,position,tick);}
 const copyMark=beginComputePart('copies');try{
 if(memoryEnabled||learningEnabled)brain.pending={choice:{
  id:decision.id,action:decision.action,row:decision.row,features:decision.features.slice(),
  senses:decision.senses.slice(),place:{q:position.q,r:position.r},
  ...(decision.input?{input:decision.input.slice()}:{}),
  ...(decision.batchInput?{batchInput:cloneSetInput(decision.batchInput)}:{}),
 },beforeFeeling};
 }finally{endComputePart(copyMark);}
}
export function hasPendingDecision(brain){return Boolean(brain.pending);}
/** Закрепление памяти идёт ДО новой оценки, сохраняя прежний порядок. Оно
 * может менять доступные записи; потому не объединяем эту фазу с finish.
 */
export function prepareControllerOutcome(brain,{afterFeeling,tick,memoryEnabled}){
 if(brain.pending&&memoryEnabled)rememberExperience(brain,brain.pending,afterFeeling,tick);
}
/** Следующий набор содержит только вероятность и оценку продолжения, без
 * физических назначений. Терминальный переход не получает будущую оценку.
 */
export function finishControllerOutcome(brain,{afterFeeling,tick,terminal,learningEnabled,nextValues,nextValue}){
 const pending=brain.pending;if(!pending)return;
 if(learningEnabled){
  // nextValue=0 — полноценная переданная оценка. ?? сохраняет старый вызов
  // с nextValues; терминальный переход в обоих случаях получает ровно ноль.
  const continuation=terminal?0:(nextValue??nextValues.reduce((sum,o)=>sum+o.probability*o.value,0));
  const update=brain.controllerType===SET_BRAIN_TYPE?learnSetBrain:Boolean(layoutForType(brain.controllerType))?learnNeural:learn;
  update(brain,pending.choice,{beforeFeeling:pending.beforeFeeling,afterFeeling,nextValue:continuation,terminal,tick});
 }
 brain.pending=null;
}
/** Исторический автоматизм рождения в контрольном режиме исключает перенос
 * энергии из последствия другого действия. Обычное рождение не вызывает это.
 */
export function adjustPendingFeeling(brain,delta){if(brain.pending)brain.pending.beforeFeeling+=delta;}

/** Испытания спрашивают адаптер о его инвариантах, а не знают размеры всех
 * будущих сетей. Это диагностическая функция без изменения опыта или RNG.
 */
export function controllerProblems(brain){
 const errors=[];
 if(brain.controllerType&&brain.controllerType!==BRAIN_TYPE&&!layoutForType(brain.controllerType))errors.push('Неизвестный контроллер');
 if(brain.memory.size>brain.traits.shortCapacity||brain.longMemory.size>brain.traits.longCapacity)errors.push('Превышена вместимость памяти');
 if(brain.traces.length>TRACE_LIMIT||brain.recentEvents.length>TRACE_LIMIT)errors.push('Превышен событийный след');
 if(Boolean(layoutForType(brain.controllerType))){
  const {parameters:PARAMETER_COUNT,inputs:INPUT_COUNT}=layoutForType(brain.controllerType);
  for(const key of ['networkBase','networkDelta','eligibility']){
   if(brain[key]?.length!==PARAMETER_COUNT)errors.push('Неверный размер '+key);
   else if(!brain[key].every(Number.isFinite))errors.push('Неконечные параметры '+key);
  }
  if(brain.networkBase?.some(v=>Math.abs(v)>8)||brain.networkDelta?.some(v=>Math.abs(v)>4))errors.push('Параметры сети вне границ');
  if(brain.pending&&(brain.temporal||brain.controllerType===SET_BRAIN_TYPE?!validSetInput(brain.pending.choice.batchInput):(brain.pending.choice.input?.length!==INPUT_COUNT||!brain.pending.choice.input.every(Number.isFinite))))errors.push('Неверный сохранённый вход сети');
 }else{
  if(brain.experience.length!==EXPERIENCE_SIZE||brain.weights.length!==FEATURE_NAMES.length||brain.bodyWeights.length!==BODY_WEIGHT_COUNT)errors.push('Неверный размер личного опыта');
  if(![...brain.experience,...brain.weights,...brain.bodyWeights].every(Number.isFinite))errors.push('Неконечные оценки опыта');
 }
 return errors;
}
