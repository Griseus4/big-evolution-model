import {FEELING_SCALES,LEARNING_RULES} from './brain-input-scales.js';
import {INPUT_SCALES} from './brain-input-scales.js';
import {brainCostProfile} from './brain-cost.js';
import {STRUCTURAL_TYPE,compileStructure} from './structural-brain.js';
import {DUAL_BRAIN_TYPE} from './dual-brain-layout.js';
import {compileDualState} from './dual-brain-state.js';
/** Маленький нелинейный оценщик, без мира, DOM и случайных бросков.
 * Выход Q — прогноз дисконтированного субъективного подкрепления. Те же Q
 * определяют softmax; отдельного врождённого бонуса поверх критика здесь нет.
 * Генетическая основа неизменна. Обучаем только личную добавку к параметрам.
 */
import {TEMPORAL_BRAIN_TYPE,TEMPORAL_TRAIT_INDICES} from './temporal-layout.js';
import {createGate} from './attention-gate.js';
import {createBrain,getMemory,memoryBelief,fillActionFeatures,FEATURE_NAMES,spatialContext} from './cognition.js';
import {cognitiveTraits,COGNITIVE_GENES,bodySenses} from './brain-parameters.js';
import {BASE_GENE_COUNT,ACTION_COUNT} from './policy-layout.js';
import {localNeighbours,positionKey} from './navigation.js';
import {HIDDEN_COUNT,NEURAL_TRAIT_INDICES,layoutForGenes,layoutForType,layoutForParameters} from './neural-layout.js';
import {densitySignal} from './neighbour-perception.js';
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const ZERO_POTENTIALS=Object.freeze(Array(7).fill(0));
export const NEURAL_TEMPERATURE=LEARNING_RULES.choiceTemperature;
/** Буферы реализации, а не память жителя: не наследуются/экспортируются.
 * WeakMap не удерживает умершего владельца. На мозг v7: (545+16+545)*8 =
 * 8848 байт; v8: (593+16+593)*8 = 9616 байт. Продолжение лениво добавляет 22 Float64 (176 байт) и
 * 43/46 слотов обычных массивов input32/35, features9, senses2, плюс объекты.
 * Они не выделяются, если этот путь не нужен. Нет кэша между оценками: веса собираются заново перед
 * каждым пакетом и после TD, так что смена delta/режима сразу видна.
 * Вызовы мозга синхронны: рабочие hidden/gradient не покидают текущий вызов.
 */
const workspaces=new WeakMap();
function workspace(brain){
 const {parameters:PARAMETER_COUNT}=layoutForType(brain.controllerType);
 let w=workspaces.get(brain);
 if(!w){w={parameters:new Float64Array(PARAMETER_COUNT),hidden:new Float64Array(HIDDEN_COUNT),gradient:new Float64Array(PARAMETER_COUNT)};workspaces.set(brain,w);}
 return w;
}
function continuationBuffers(work,brain){
 const {inputs:INPUT_COUNT}=layoutForType(brain.controllerType);
 if(!work.continuation){
  // input остаётся обычным числовым Array, как входы публичного оценщика:
  // горячему neuralValue не нужен дополнительный тип Float64Array для входа.
  const senses=[0,0];
  work.continuation={input:Array(INPUT_COUNT).fill(0),features:Array(FEATURE_NAMES.length).fill(0),senses,
   values:new Float64Array(ACTION_COUNT),weights:new Float64Array(ACTION_COUNT),body:{senses,energy:0,health:0,pain:0}};
 }
 return work.continuation;
}
function effectiveParameters(brain,learningEnabled,output){
 const {parameters:PARAMETER_COUNT}=layoutForType(brain.controllerType);
 for(let i=0;i<PARAMETER_COUNT;i++)output[i]=brain.networkBase[i]+(learningEnabled?brain.networkDelta[i]:0);
 return output;
}
/** Один скаляр Q: тот же порядок сумм по входам и выходным нейронам.
 * hidden передаётся только если он нужен ближайшему градиенту. При оценке
 * действий tanh сразу входит в сумму выхода; отдельный массив не нужен.
 * Не пропускаем нулевые входы и не переупорядочиваем арифметику.
 */
export function neuralValue(parameters,input,hidden=null){
 const {inputs:INPUT_COUNT,hiddenBias:HIDDEN_BIAS,outputWeights:OUTPUT_WEIGHTS,outputBias:OUTPUT_BIAS}=layoutForParameters(parameters);
 let value=parameters[OUTPUT_BIAS];
 for(let h=0;h<HIDDEN_COUNT;h++){
  const offset=h*INPUT_COUNT;let sum=parameters[HIDDEN_BIAS+h];
  for(let i=0;i<INPUT_COUNT;i++)sum+=parameters[offset+i]*input[i];
  const activation=Math.tanh(sum);if(hidden)hidden[h]=activation;
  value+=parameters[OUTPUT_WEIGHTS+h]*activation;
 }
 return value;
}

/** Прежние шкалы ощущений/памяти используем по смысловым ключам. Шесть
 * прямых пространственных бонусов таблицы не являются генами новой сети.
 */
export function neuralTraits(genes){
 const {traitOffset:TRAIT_OFFSET}=layoutForGenes(genes);
 const legacy=Array(BASE_GENE_COUNT+COGNITIVE_GENES.length).fill(0);
 ([TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE,DUAL_BRAIN_TYPE].includes(layoutForGenes(genes).brainType)?TEMPORAL_TRAIT_INDICES:NEURAL_TRAIT_INDICES).forEach((old,i)=>{legacy[BASE_GENE_COUNT+old]=genes[TRAIT_OFFSET+i];});
 return cognitiveTraits(legacy);
}
export function createNeuralBrain(genes){
 const layout=layoutForGenes(genes);if(!layout)throw new Error('Неверный размер нейросетевого генома.');
 const {parameters:PARAMETER_COUNT}=layout;
 const brain=createBrain([]);brain.traits=neuralTraits(genes);brain.controllerType=layout.brainType;
 // Пространственная память общая, но таблицы оценок/пар тела не храним.
 brain.experience=new Float64Array(0);brain.weights=new Float64Array(0);
 brain.bodyGenes=new Float64Array(0);brain.bodyWeights=new Float64Array(0);
 brain.outcomeExpectation=new Float64Array(ACTION_COUNT);
 if([TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE,DUAL_BRAIN_TYPE].includes(layout.brainType)){brain.temporal=true;brain.gateBase=createGate(genes,layout.gateOffset);const q=brain.traits.discount**.1;brain.timeReward={q,b:.04*(1-q)/(1-brain.traits.discount)};brain.decayTime=0;}
 if(layout.version===14){brain.structure=compileStructure(genes);brain.costProfile=brainCostProfile(brain.structure);}
 if(layout.version>=15)Object.assign(brain,compileDualState(genes));
 brain.networkBase=Float64Array.from(genes.slice(0,PARAMETER_COUNT));
 brain.networkDelta=new Float64Array(PARAMETER_COUNT);brain.eligibility=new Float64Array(PARAMETER_COUNT);
 return brain;
}
/** Полный прямой проход нужен градиенту; для просмотра возвращаем только Q.
 * Смещения обучаются тем же способом, что связи. Линейный выход не насыщен.
 */
export function neuralForward(base,delta,input){
 const {inputs:INPUT_COUNT,hiddenBias:HIDDEN_BIAS,outputWeights:OUTPUT_WEIGHTS,outputBias:OUTPUT_BIAS}=layoutForParameters(base);
 const hidden=new Float64Array(HIDDEN_COUNT);
 for(let h=0;h<HIDDEN_COUNT;h++){
  let sum=base[HIDDEN_BIAS+h]+delta[HIDDEN_BIAS+h];
  for(let i=0;i<INPUT_COUNT;i++)sum+=(base[h*INPUT_COUNT+i]+delta[h*INPUT_COUNT+i])*input[i];
  hidden[h]=Math.tanh(sum);
 }
 let value=base[OUTPUT_BIAS]+delta[OUTPUT_BIAS];
 for(let h=0;h<HIDDEN_COUNT;h++)value+=(base[OUTPUT_WEIGHTS+h]+delta[OUTPUT_WEIGHTS+h])*hidden[h];
 return {value,hidden};
}
/** Производная Q по каждому эффективному параметру, включая смещения.
 * d tanh(z)/dz = 1−tanh(z)^2; конечные разности проверяет пользователь.
 */
export function neuralGradient(base,delta,input,hidden,gradient=new Float64Array(base.length)){
 const {inputs:INPUT_COUNT,hiddenBias:HIDDEN_BIAS,outputWeights:OUTPUT_WEIGHTS,outputBias:OUTPUT_BIAS}=layoutForParameters(base);
 gradient[OUTPUT_BIAS]=1;
 for(let h=0;h<HIDDEN_COUNT;h++){
  gradient[OUTPUT_WEIGHTS+h]=hidden[h];
  const factor=(base[OUTPUT_WEIGHTS+h]+delta[OUTPUT_WEIGHTS+h])*(1-hidden[h]*hidden[h]);
  gradient[HIDDEN_BIAS+h]=factor;
  for(let i=0;i<INPUT_COUNT;i++)gradient[h*INPUT_COUNT+i]=factor*input[i];
 }
 return gradient;
}
export function neuralInputs(brain,observation,candidate,potentials,body=null){
 const {inputs:INPUT_COUNT}=layoutForType(brain.controllerType);
 // Публичные варианты принадлежат вызывающему: следующий расчёт и TD не
 // переписывают входы панели/lastDecision/pending задним числом.
 const senses=body?body.senses.slice():bodySenses(observation.body,observation.capacities.inventory,observation.capacities.stomach);
 // Writer ниже сам задаёт все входы выбранной схемы и 9 признаков. Заполнять массивы
 // нулями здесь означало бы повторять запись перед каждой оценкой действия.
 // Массивы по-прежнему самостоятельные: исторические входы не переиспользуем.
 const input=Array(INPUT_COUNT),features=Array(FEATURE_NAMES.length);
 fillNeuralInputs(brain,observation,candidate,potentials,input,features,senses,body);
 return {input,features,senses};
}
/** Все входы выбранной схемы и 9 признаков перезаписываются, даже после другого действия
 * или выключения памяти. senses уже подготовлены владельцем пакета. Этот
 * writer общий для публичных собственных массивов и частного скалярного пути;
 * его рабочие буферы никогда не сохраняются в pending/lastDecision. */
export function fillNeuralInputs(brain,observation,candidate,potentials,input,features,senses,body=null){
 const {inputs:INPUT_COUNT}=layoutForType(brain.controllerType);
 const o=observation,{action,localDestination,cell}=candidate;
 const record=o.memoryEnabled?(getMemory(brain,positionKey(localDestination))??null):null;
 const belief=record?memoryBelief(record,o.tick,brain.traits):null;
 fillActionFeatures(brain,{action,destination:localDestination,cell,previousAction:o.previousAction,energy:o.body.energy,tick:o.tick,potentials},features,record,belief);
 if(!o.memoryEnabled)features.fill(0,3);
 input.fill(0,0,ACTION_COUNT);input[action]=1;
 input[11]=body?.energy??o.body.energy/INPUT_SCALES.energy;input[12]=body?.health??o.body.health/INPUT_SCALES.health;input[13]=body?.pain??o.body.pain/INPUT_SCALES.pain;
 input[14]=senses[0];input[15]=senses[1];
 for(let i=0;i<features.length;i++)input[16+i]=features[i];
 input[25]=Number(o.currentFood);input[26]=cell.food/INPUT_SCALES.food;input[27]=Number(cell.hazard);input[28]=Number(o.previousAction===action);
 input[29]=belief?.confidence??0;input[30]=(belief?.food??0)/INPUT_SCALES.food;input[31]=record?Math.max(0,o.tick-record.lastSeen)/brain.traits.memoryAge:0;
 if(INPUT_COUNT>32){
  // Только текущие анонимные количества. ID и мировых координат среди входов нет.
  // Насыщение плавное: 1/2 и 100/101 различаются, жёсткого потолка счётчика нет.
  input[32]=densitySignal(o.neighbours?.ownCount??0);
  input[33]=densitySignal(cell.neighbours??0);
  input[34]=densitySignal(o.neighbours?.visibleCount??0);
 }
 // Вместо splice/map/spread оставляем один вход и тот же clamp по индексам.
 for(let i=0;i<INPUT_COUNT;i++)input[i]=clamp(input[i],-1,1);
 return input;
}
export function evaluateNeural(brain,request){
 const o=request.observation;
 const potentials=o.memoryEnabled?spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick):ZERO_POTENTIALS;
 const parameters=effectiveParameters(brain,o.learningEnabled,workspace(brain).parameters);
 const body={senses:bodySenses(o.body,o.capacities.inventory,o.capacities.stomach),energy:o.body.energy/INPUT_SCALES.energy,health:o.body.health/INPUT_SCALES.health,pain:o.body.pain/INPUT_SCALES.pain};
 return request.candidates.map(candidate=>{
  if(!Number.isInteger(candidate.action)||candidate.action<0||candidate.action>=ACTION_COUNT)throw new Error('Неизвестное действие сети.');
  const {input,features,senses}=neuralInputs(brain,o,candidate,potentials,body);
  const value=neuralValue(parameters,input);
  return {...candidate,row:0,input,features,senses,score:value/NEURAL_TEMPERATURE,learningValue:value};
 });
}
/** Expected Q для продолжения TD без создания массива подробных вариантов.
 * Политика прежняя: score=Q/temperature, exp(score-peak), сумма слева направо,
 * затем Σ (weight/sum)*Q в порядке кандидатов. Не заменяем её max(Q), не
 * объединяем деление с последующей суммой: это изменило бы арифметику.
 * Возвращается только число; input/features/weights остаются в WeakMap.
 * Никаких бросков RNG, обучения, обновления тела или межвызовного кэша. */
export function expectedNeuralValue(brain,request){
 const count=request.candidates.length;if(!count)return 0;
 if(count>ACTION_COUNT)throw new Error('Слишком много вариантов продолжения сети.');
 const o=request.observation,work=workspace(brain),buffers=continuationBuffers(work,brain);
 const parameters=effectiveParameters(brain,o.learningEnabled,work.parameters);
 const potentials=o.memoryEnabled?spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick):ZERO_POTENTIALS;
 const body=buffers.body;bodySenses(o.body,o.capacities.inventory,o.capacities.stomach,buffers.senses);
 body.energy=o.body.energy/INPUT_SCALES.energy;body.health=o.body.health/INPUT_SCALES.health;body.pain=o.body.pain/INPUT_SCALES.pain;
 let peak=-Infinity;
 for(let i=0;i<count;i++){
  const candidate=request.candidates[i];if(!Number.isInteger(candidate.action)||candidate.action<0||candidate.action>=ACTION_COUNT)throw new Error('Неизвестное действие сети.');
  fillNeuralInputs(brain,o,candidate,potentials,buffers.input,buffers.features,buffers.senses,body);
  const value=neuralValue(parameters,buffers.input),score=value/NEURAL_TEMPERATURE;
  buffers.values[i]=value;buffers.weights[i]=score;peak=Math.max(peak,score);
 }
 let sum=0;for(let i=0;i<count;i++){buffers.weights[i]=Math.exp(buffers.weights[i]-peak);sum+=buffers.weights[i];}
 let expected=0;for(let i=0;i<count;i++)expected+=(buffers.weights[i]/sum)*buffers.values[i];
 return expected;
}
/** Expected SARSA(λ), полу-градиент: будущая цель не дифференцируется.
 * Один накопленный вектор следа вместо 32 сохранённых полных градиентов.
 * Нормирование градиента, TD-ошибка ±2 и поправки ±4 ограничивают численный
 * разгон, не задают полезную стратегию. Забывание касается только личной части.
 * Подкрепление совпадает с прежним: .04 F_after + γ F_next − F_before.
 * При смерти F_next и Q_next равны нулю; отдельного штрафа за смерть нет.
 */
export function learnNeural(brain,choice,{beforeFeeling,afterFeeling,nextValue,terminal,tick}){
 const {parameters:PARAMETER_COUNT}=layoutForType(brain.controllerType);
 const {alpha,discount,trace,forgetting}=brain.traits;
 const work=workspace(brain),parameters=effectiveParameters(brain,true,work.parameters);
 const beforeValue=neuralValue(parameters,choice.input,work.hidden);
 const gradient=neuralGradient(brain.networkBase,brain.networkDelta,choice.input,work.hidden,work.gradient);
 let squaredNorm=0;for(let i=0;i<PARAMETER_COUNT;i++)squaredNorm+=gradient[i]*gradient[i];
 const norm=Math.max(1,Math.sqrt(squaredNorm));
 const reward=LEARNING_RULES.timeReward*afterFeeling/FEELING_SCALES.maximum+(terminal?0:discount*afterFeeling/FEELING_SCALES.maximum)-beforeFeeling/FEELING_SCALES.maximum;
 const delta=clamp(reward+(terminal?0:discount*nextValue)-beforeValue,-LEARNING_RULES.tdErrorLimit,LEARNING_RULES.tdErrorLimit);
 for(let i=0;i<PARAMETER_COUNT;i++){
  const e=discount*trace*brain.eligibility[i]+gradient[i]/norm;
  brain.eligibility[i]=e;
  brain.networkDelta[i]=clamp(brain.networkDelta[i]*(1-forgetting)+alpha*delta*e,-LEARNING_RULES.weightDeltaLimit,LEARNING_RULES.weightDeltaLimit);
 }
 // После обновления delta прежние эффективные веса уже недействительны.
 effectiveParameters(brain,true,parameters);
 const afterValue=neuralValue(parameters,choice.input);
 brain.updates++;brain.lastLearning={tick,action:choice.action,row:null,reward,delta,beforeValue,afterValue,change:afterValue-beforeValue,traceKind:'накопленный градиент',traceLength:null};
 if(terminal)brain.eligibility.fill(0);
}
