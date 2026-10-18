/** Общие шкалы наследуемых свойств мозга, cognition-v1.
 * Игра и расшифровщик используют одну функцию: два независимых набора формул
 * могли бы незаметно разойтись. При будущей смене шкал добавляй другую именованную
 * версию, сохраняя эту для старых файлов. Здесь нет состояния мира или DOM.
 */
import {BASE_GENE_COUNT,BODY_GENE_OFFSET,BODY_WEIGHT_COUNT,BODY_FEATURE_COUNT} from './policy-layout.js';
export const TRAIT_SCALE_VERSION='cognition-v1';
export const COGNITIVE_GENES = [
 ['energy', 'Оценка энергии'], ['health', 'Оценка здоровья'],
 ['pain', 'Оценка боли'], ['stomach', 'Оценка пищеварения'],
 ['learningRate', 'Скорость обучения'], ['forgetting', 'Забывание опыта'],
 ['trace', 'Связь с давними действиями'], ['discount', 'Вес будущих ощущений'],
 ['memoryAge', 'Давность наблюдений'],
 ['foodMemory', 'Запомненная пища'], ['riskMemory', 'Запомненные повреждения'],
 ['unknown', 'Незнакомые места'], ['revisit', 'Давно замеченная пища'],
 ['hungryFood', 'Пища при низкой энергии'], ['hungryRisk', 'Повреждения при низкой энергии'],
 ['shortCapacity','Вместимость краткой памяти'], ['longCapacity','Вместимость долгой памяти'],
 ['consolidation','Порог закрепления'], ['longPersistence','Длительность закрепления'],
].map(([key,label],i)=>({key,label,index:BASE_GENE_COUNT+i}));
export const GENE_COUNT = BODY_GENE_OFFSET + BODY_WEIGHT_COUNT;
/** Шкала ощущений тела именована отдельно: старые шкалы памяти не меняются.
 * Порядок пары — доля переносимого запаса, доля заполнения желудка.
 * Веса оценочные, не ощущения удовольствия и не правила «экономь/рожай».
 */
export const BODY_SENSE_VERSION='inventory-stomach-fraction-v1';
export const BODY_FEATURE_NAMES=Object.freeze(['Заполненность переносимого запаса','Наполненность желудка']);
export const BODY_GENES=Object.freeze(Array.from({length:BODY_WEIGHT_COUNT},(_,i)=>({
 key:`body-${Math.floor(i/BODY_FEATURE_COUNT)}-${i%BODY_FEATURE_COUNT}`,
 action:Math.floor(i/BODY_FEATURE_COUNT),feature:i%BODY_FEATURE_COUNT,index:BODY_GENE_OFFSET+i,
 label:BODY_FEATURE_NAMES[i%BODY_FEATURE_COUNT],
})));
/** Только собственное тело; мировых координат, источников и таймеров здесь нет.
 * Нормирование сохраняет диапазон 0…1 при будущих разных вместимостях.
 */
export function bodySenses(body,inventoryCapacity,stomachCapacity,output=[0,0]){
 // Обычный вызов получает собственный массив. Внутренний скалярный расчёт
 // может передать буфер; оба элемента всегда перезаписываются той же формулой.
 output[0]=Math.max(0,Math.min(1,body.inventory/inventoryCapacity));
 output[1]=Math.max(0,Math.min(1,body.stomach/stomachCapacity));return output;
}
/** У каждого действия собственная пара, поэтому общий бонус не сокращается
 * при превращении оценок в вероятности через softmax.
 */
export function bodySenseValue(weights,action,senses){
 const offset=action*BODY_FEATURE_COUNT;
 return senses.reduce((sum,value,i)=>sum+value*weights[offset+i],0);
}
const sigmoid=v=>1/(1+Math.exp(-v));
const geneIndex=Object.fromEntries(COGNITIVE_GENES.map(g=>[g.key,g.index]));

/** Параметры положительных скоростей переводятся из генов плавно.
 * Малые мутации не переключают механизм между противоположными режимами.
 * Диапазоны — наши вычислительные ограничения, не биологические константы.
 */
export function cognitiveTraits(genes){
 const get=key=>genes[geneIndex[key]]??0;
 return {
  values:[get('energy'),get('health'),get('pain'),get('stomach')],
  alpha:.002+.078*sigmoid(get('learningRate')),
  forgetting:.002*sigmoid(get('forgetting')),
  trace:.15+.8*sigmoid(get('trace')),
  discount:.7+.28*sigmoid(get('discount')),
  memoryAge:20+980*sigmoid(get('memoryAge')),
  // Вместимость — число мест, длительность — шаги мира; цены энергии пока нет.
  shortCapacity:Math.round(8+112*sigmoid(get('shortCapacity'))),
  longCapacity:Math.round(2+60*sigmoid(get('longCapacity'))),
  consolidationThreshold:.005+.05*sigmoid(get('consolidation')),
  longRetention:200+5800*sigmoid(get('longPersistence')),
  spatial:['foodMemory','riskMemory','unknown','revisit','hungryFood','hungryRisk'].map(get),
 };
}

