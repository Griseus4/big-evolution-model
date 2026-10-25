/**
 * Общая пространственная память и историческое табличное обучение.
 * Новая сеть находится в neural-brain.js и использует эту же память.
 * Наследуются исходные предпочтения и параметры обучения;
 * таблица опыта, наблюдения клеток и след последних решений начинаются пустыми.
 *
 * Алгоритм — ограниченный табличный TD-критик с линейными признаками и следами.
 * Он оценивает ожидаемые субъективные последствия действий. Политика в evolution.js
 * складывает геном и эту оценку, затем делает случайный выбор через softmax.
 * Ограничения архитектуры, признаки и формула обновления заданы разработчиком.
 * Знаки оценки еды, здоровья, боли и воспоминаний не заданы: они в геноме.
 */
import {positionKey,localDistance} from './navigation.js';
import {BASE_GENE_COUNT,EXPERIENCE_SIZE,OLD_GENE_COUNT,ACTION_COUNT,BODY_GENE_OFFSET,BODY_WEIGHT_COUNT,BODY_FEATURE_COUNT} from './policy-layout.js';
export {BASE_GENE_COUNT,EXPERIENCE_SIZE,OLD_GENE_COUNT};
export const MEMORY_LIMIT = 182, TRACE_LIMIT = 32;
export const FEATURE_NAMES = [
 'Видимая пища', 'Видимый опасный рельеф', 'Повтор направления',
 'Приближение к запомненной пище', 'Повреждения в этом месте',
 'Непосещённое место', 'Давний пищевой источник',
 'Приближение к пище × недостаток энергии', 'Повреждения × недостаток энергии',
];
// В v5 общий блок следует за таблицей 48×11 и тремя признаками движения.
// Прежние значения переносит expandGenome, не простое добавление нулей в конец.
import {COGNITIVE_GENES,GENE_COUNT,cognitiveTraits,bodySenseValue} from './brain-parameters.js';
export {COGNITIVE_GENES,GENE_COUNT,cognitiveTraits};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/** Внутренняя шкала −100..100. Ноль гена означает безразличие к сигналу.
 * Энергия и здоровье центрированы: 50 соответствует нулю признака.
 * Боль и пищеварение начинаются с нуля. Положительный ген боли допускает
 * удовольствие от боли. При нулевых весах самочувствие равно нулю.
 * Деление на сумму модулей ограничивает шкалу, но НЕ делает ощущения разных
 * геномов сопоставимой оценкой приспособленности. Полнота инвентаря не награждается.
 */
export function wellbeing(body,traits,stomachCapacity=66){
 const signals=[body.energy/50-1,body.health/50-1,body.pain/100,body.stomach/stomachCapacity];
 const normalizer=traits.values.reduce((sum,v)=>sum+Math.abs(v),0);
 if(normalizer<1e-12)return 0;
 return clamp(100*signals.reduce((sum,v,i)=>sum+v*traits.values[i],0)/normalizer,-100,100);
}

export function createBrain(genes){
 return {
  position:{q:0,r:0},facing:0,traits:cognitiveTraits(genes),memory:new Map(),longMemory:new Map(),recentEvents:[],outcomeExpectation:new Float64Array(EXPERIENCE_SIZE),experience:new Float64Array(EXPERIENCE_SIZE),
  weights:new Float64Array(FEATURE_NAMES.length),
  // Генетические веса неизменны за жизнь; 22 личные поправки начинаются с нуля.
  // Наблюдение тела работает даже при отключённой пространственной памяти.
  bodyGenes:Float64Array.from(Array.from({length:BODY_WEIGHT_COUNT},(_,i)=>genes[BODY_GENE_OFFSET+i]??0)),
  bodyWeights:new Float64Array(BODY_WEIGHT_COUNT),scale:1,traces:[],
  updates:0,lastLearning:null,lastObservation:null,wellbeing:0,
  feelingTotal:0,feelingSamples:0,
 };
}

/** Записываются только реально увиденные клетки. tick — время мира, не браузера.
 * Map упорядочен по давности наблюдения; вытесняем самую старую краткую запись при личном лимите.
 * visits считает пребывания, а не наблюдения соседнего гекса.
 * Положительная пища после пустоты даёт наблюдённый интервал восстановления:
 * это интервал между наблюдениями, а не доступ к тайному таймеру мира.
 */
export function observe(brain,cells,position,tick,visit=true,elapsed=1){
 brain.spatialCache=null;
 for(const cell of cells){
  const index=positionKey(cell);
  const previous=getMemory(brain,index);
  const record=previous??{q:cell.q,r:cell.r,visits:0,samples:0,foodTotal:0,maxFoodSeen:0,
   emptySince:null,recoveries:0,recoveryTotal:0,...(!brain.temporal?{exposures:0,injuries:0,damageTotal:0}:{}),encounters:0,importance:0,lastReinforced:tick};
  if(record.emptySince!==null&&cell.food>0){
   record.recoveries++;record.recoveryTotal+=Math.max(brain.temporal?.1:1,tick-record.emptySince);
  }
  if(cell.food===0&&record.emptySince===null)record.emptySince=tick;
  if(cell.food>0)record.emptySince=null;
  record.food=cell.food;record.terrain=cell.terrain;record.lastSeen=tick;
  // Последнее увиденное свойство места, не признак важности. Куст не даёт
  // бонуса закреплению и не обновляется при скрытом вмешательстве в мир.
  if(typeof cell.isFoodSource==='boolean')record.isFoodSource=cell.isFoodSource;
  record.samples+=elapsed;record.foodTotal+=cell.food*elapsed;record.maxFoodSeen=Math.max(record.maxFoodSeen,cell.food);
  if(visit&&cell.q===position.q&&cell.r===position.r){
   record.visits+=elapsed;record.lastVisit=tick;
   if(brain.lastVisitedKey!==index){record.encounters++;record.lastReinforced=tick;}
  }
  if(!brain.longMemory.has(index)){brain.memory.delete(index);brain.memory.set(index,record);}
  maybeConsolidate(brain,record,tick,'повторные посещения');
 }
 trimShort(brain);
 if(visit)brain.lastVisitedKey=positionKey(position);
 // Закреплённое место тоже может забыться. Уверенность в содержимом клетки
 // стареет независимо: долго помнить координаты не означает знать нынешнюю пищу.
 for(const [key,record]of brain.longMemory){
  if(tick-record.lastSeen>brain.traits.memoryAge*3&&memoryStrength(record,tick,brain.traits)<brain.traits.consolidationThreshold*.15)brain.longMemory.delete(key);
 }
 brain.lastObservation=tick;
}

/** Краткая и долгая память не дублируют записи. Этот итератор используется
 * оценкой пространства и UI, чтобы оба уровня влияли на поведение одинаково.
 */
export function* memoryEntries(brain){yield* brain.longMemory.values();yield* brain.memory.values();}
export const getMemory=(brain,key)=>brain.longMemory.get(key)??brain.memory.get(key);
function trimShort(brain){while(brain.memory.size>brain.traits.shortCapacity)brain.memory.delete(brain.memory.keys().next().value);}
export function memoryStrength(record,tick,traits){
 const evidence=(record.importance??0)+Math.max(0,(record.encounters??0)-1)*.012;
 return evidence*Math.exp(-Math.max(0,tick-(record.lastReinforced??record.lastSeen))/traits.longRetention);
}
function maybeConsolidate(brain,record,tick,reason){
 const key=positionKey(record),strength=memoryStrength(record,tick,brain.traits);
 if(brain.longMemory.has(key)||strength<brain.traits.consolidationThreshold)return;
 if(brain.longMemory.size>=brain.traits.longCapacity){
  let weakest=null,score=Infinity;
  for(const [oldKey,old]of brain.longMemory){const candidate=memoryStrength(old,tick,brain.traits);if(candidate<score){score=candidate;weakest=oldKey;}}
  if(strength<=score)return;
  brain.longMemory.delete(weakest);
 }
 record.consolidatedAt=tick;record.consolidationReason=reason;
 brain.memory.delete(key);brain.longMemory.set(key,record);brain.spatialCache=null;
}

/** Короткий событийный след связывает поздний результат с местами решений.
 * Он хранит только личные позиции, без снимков скрытых клеток. Если запись места
 * уже вытеснена, мы не восстанавливаем её содержимое задним числом.
 * Это отдельный след наблюдений: память может закрепляться и без TD-критика.
 */
export function rememberDecision(brain,place,tick){
 const decay=brain.temporal?(brain.traits.discount*brain.traits.trace)**Math.max(0,tick-(brain.lastEventTick??tick)):brain.traits.discount*brain.traits.trace;
 if(brain.temporal)brain.lastEventTick=tick;
 for(const entry of brain.recentEvents)entry.strength*=decay;
 brain.recentEvents.push({place:{q:place.q,r:place.r},strength:1,tick});
 if(brain.recentEvents.length>TRACE_LIMIT)brain.recentEvents.shift();
}
export function rememberExperience(brain,pending,afterFeeling,tick){
 const index=pending.choice.row*ACTION_COUNT+pending.choice.action;
 const change=(afterFeeling-pending.beforeFeeling)/100;
 const expected=brain.outcomeExpectation[index];
 const intensity=Math.abs(change),surprise=Math.abs(change-expected);
 brain.outcomeExpectation[index]+=brain.traits.alpha*(change-expected);
 const signal=intensity+surprise;
 if(signal<1e-12)return;
 // Повторения одного места в следе объединяются; сильный/неожиданный результат
 // постепенно повышает значимость. Здесь нет отдельного бонуса категории «еда».
 const places=new Map();
 for(const event of brain.recentEvents){const key=positionKey(event.place);places.set(key,(places.get(key)??0)+event.strength);}
 for(const [key,strength]of places){
  const record=getMemory(brain,key);if(!record)continue;
  const faded=(record.importance??0)*Math.exp(-Math.max(0,tick-record.lastReinforced)/brain.traits.longRetention);
  record.importance=Math.min(10,faded+signal*strength);record.lastReinforced=tick;
  record.lastExperience={tick,intensity,surprise};
  maybeConsolidate(brain,record,tick,surprise>intensity?'неожиданный результат':signal*strength>=brain.traits.consolidationThreshold?'сильное переживание':'накопленные переживания');
 }
 trimShort(brain);
}

/** Отсутствие повреждения тоже опыт. Истинный риск мира в запись не попадает.
 * Сосед, на которого только посмотрели, не считается испытанным на безопасность.
 */
export function rememberOutcome(brain,position,tick,damage){
 const record=getMemory(brain,positionKey(position));
 if(!record)return;
 record.exposures++;record.injuries+=Number(damage>0);record.damageTotal+=damage;
 if(damage>0)record.lastInjury=tick;
}

/** Старое наблюдение плавно теряет уверенность. Для истощённого источника
 * возвращение пищи предполагается только после ранее наблюдённого восстановления.
 * Если такого опыта нет, остаётся смесь последнего наблюдения и исторического среднего.
 * Предсказание — доступная мозгу гипотеза, не чтение текущей скрытой клетки.
 */
export function memoryBelief(record,tick,traits){
 const age=Math.max(0,tick-record.lastSeen),confidence=Math.exp(-age/traits.memoryAge);
 const average=record.samples>0?record.foodTotal/record.samples:record.food;
 let predicted=record.food;
 if(record.food===0&&record.recoveries>0){
  const interval=record.recoveryTotal/record.recoveries;
  predicted=record.maxFoodSeen*Math.min(1,age/Math.max(1,interval));
 }
 return {
  food:clamp(predicted*confidence+average*(1-confidence),0,6),confidence,
  risk:(record.injuries??0)/((record.exposures??0)+2)*confidence,
  // Склад до 10 и источники до 24 не расширяют прежнюю шкалу признака.
  // Истинное количество в записи сохраняется; оценка пищи уже насыщалась на 6.
  uncertainty:(1-confidence)*Math.min(record.maxFoodSeen,6)/6,
 };
}

/** Обзор для шести возможных шагов вычисляется одним проходом по памяти.
 * Потенциал пищи — среднее по знакомым источникам с убыванием по расстоянию.
 * Мы предоставляем геометрический признак, но не задаём положительный вес:
 * его влияние врождённое либо выученное. Это не поиск пути и не готовая цель.
 * distance получает координаты известных мест, не полную карту мира.
 */
export function spatialContext(brain,positions,tick){
 const cache=brain.spatialCache,origin=positions[0];
 if(cache&&cache.tick===tick&&cache.q===origin.q&&cache.r===origin.r)return cache.potentials;
 const potentials=Array(positions.length).fill(0);let sources=0;
 for(const record of memoryEntries(brain)){
  if(record.terrain==='water'||record.maxFoodSeen===0)continue;
  const belief=memoryBelief(record,tick,brain.traits);sources++;
  for(let i=0;i<positions.length;i++)potentials[i]+=belief.food/6/(1+localDistance(positions[i],record));
 }
 if(sources)for(let i=0;i<potentials.length;i++)potentials[i]/=sources;
 brain.spatialCache={tick,q:origin.q,r:origin.r,potentials};
 return potentials;
}

/** Сеть передаёт уже найденную запись и её оценку текущего вызова. Это
 * устраняет второй поиск/расчёт, без кэша между шагами или обновлениями TD.
 * Старые вызовы без аргументов сохраняют прежний расчёт. Явный null означает
 * отсутствие памяти; параметры отдельно, чтобы не создавать объект-обёртку. */
export function actionFeatures(brain,context,
 record=getMemory(brain,positionKey(context.destination))??null,belief=record?memoryBelief(record,context.tick,brain.traits):null){
 return fillActionFeatures(brain,context,Array(FEATURE_NAMES.length).fill(0),record,belief);
}
/** Полная запись в переданный буфер. Он принадлежит текущему вызову/мозгу;
 * публичный actionFeatures выше всегда возвращает самостоятельный массив. */
export function fillActionFeatures(brain,{action,destination,cell,previousAction,energy,tick,potentials},output,
 record=getMemory(brain,positionKey(destination))??null,belief=record?memoryBelief(record,tick,brain.traits):null){
 const moving=action<6;
 const foodGradient=moving?potentials[action+1]-potentials[0]:0;
 const rememberedRisk=belief?.risk??0,hunger=1-energy/100;
 output[0]=Number(moving&&cell.food>0);output[1]=Number(moving&&cell.hazard);output[2]=Number(moving&&action===previousAction);
 output[3]=foodGradient;output[4]=rememberedRisk;output[5]=Number(moving&&(!record||record.visits===0));
 output[6]=moving?(belief?.uncertainty??0):0;output[7]=hunger*foodGradient;output[8]=hunger*rememberedRisk;return output;
}

export function learnedValue(brain,row,action,features,senses=[0,0]){
 return brain.scale*(brain.experience[row*ACTION_COUNT+action]+features.reduce((sum,f,i)=>sum+f*brain.weights[i],0)+bodySenseValue(brain.bodyWeights,action,senses));
}
export function spatialInstinct(brain,features){
 return features.slice(3).reduce((sum,f,i)=>sum+f*brain.traits.spatial[i],0);
}

/** TD-ошибка сопоставляет полученное ощущение и ожидаемое продолжение с прошлой
 * оценкой. След распределяет обновление между последними 32 решениями.
 * Он не доказывает причинность: случайные повреждения и чужой сбор создают шум.
 * Пища не получает отдельный ручной бонус за подбор; полезность цепочки может
 * выучиться через последующее усвоение и внутреннюю оценку состояния тела.
 *
 * reward = .04*F_next + gamma*F_next - F_before, где F = самочувствие/100.
 * Первая часть ценит длительность ощущения, остальные — его изменение с дисконтом.
 * Это формула подкрепления, заданная нами; смысл F определяется генами.
 * Выбранное рождение включает передачу энергии в последствие именно этого
 * действия. Только контрольный автоматизм исключает перенос из чужого решения.
 */
export function learn(brain,choice,{beforeFeeling,afterFeeling,nextValue,terminal,tick}){
 const {alpha,discount,trace,forgetting}=brain.traits;
 brain.scale*=1-forgetting;
 if(brain.scale<.5){
  for(let i=0;i<brain.experience.length;i++)brain.experience[i]*=brain.scale;
  for(let i=0;i<brain.weights.length;i++)brain.weights[i]*=brain.scale;
  for(let i=0;i<brain.bodyWeights.length;i++)brain.bodyWeights[i]*=brain.scale;
  brain.scale=1;
 }
 const senses=choice.senses??[0,0];
 const beforeValue=learnedValue(brain,choice.row,choice.action,choice.features,senses);
 const nextFeeling=terminal?0:afterFeeling/100;
 const reward=.04*afterFeeling/100+discount*nextFeeling-beforeFeeling/100;
 const delta=clamp(reward+(terminal?0:discount*nextValue)-beforeValue,-2,2);
 for(const entry of brain.traces)entry.strength*=discount*trace;
 // Копируем ощущения В МОМЕНТ выбора: после рождения/еды/сбора тело изменится.
 brain.traces.push({index:choice.row*ACTION_COUNT+choice.action,features:choice.features.slice(),senses:senses.slice(),strength:1});
 if(brain.traces.length>TRACE_LIMIT)brain.traces.shift();
 // Суммируем повторения одного параметра до обновления, чтобы порядок записей
 // не менял результат и чтобы лимит применялся к фактическому значению параметра.
 const changes=new Map(),featureChanges=Array(FEATURE_NAMES.length).fill(0),bodyChanges=Array(BODY_WEIGHT_COUNT).fill(0);
 for(const entry of brain.traces){
  changes.set(entry.index,(changes.get(entry.index)??0)+entry.strength);
  entry.features.forEach((f,i)=>featureChanges[i]+=f*entry.strength);
  const offset=(entry.index%ACTION_COUNT)*BODY_FEATURE_COUNT;
  entry.senses.forEach((f,i)=>bodyChanges[offset+i]+=f*entry.strength);
 }
 for(const [index,strength]of changes){
  brain.experience[index]=clamp(brain.experience[index]*brain.scale+alpha*delta*strength,-4,4)/brain.scale;
 }
 featureChanges.forEach((strength,i)=>{
  brain.weights[i]=clamp(brain.weights[i]*brain.scale+alpha*delta*strength,-4,4)/brain.scale;
 });
 // Те же скорость, забывание, след и предел ±4; награда за запасы не добавлена.
 bodyChanges.forEach((strength,i)=>{
  brain.bodyWeights[i]=clamp(brain.bodyWeights[i]*brain.scale+alpha*delta*strength,-4,4)/brain.scale;
 });
 const afterValue=learnedValue(brain,choice.row,choice.action,choice.features,senses);
 brain.updates++;brain.lastLearning={tick,action:choice.action,row:choice.row,
  reward,delta,beforeValue,afterValue,change:afterValue-beforeValue,traceLength:brain.traces.length};
}
