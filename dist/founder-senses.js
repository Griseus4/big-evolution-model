import {COGNITIVE_GENES} from './brain-parameters.js';
import {NEURAL_TRAIT_INDICES} from './neural-layout.js';
import {TEMPORAL_BRAIN_TYPE,TEMPORAL_TRAIT_INDICES} from './temporal-layout.js';
/** Только начальные гены, не правило поведения и не ограничитель потомков.
 * Пустой набор сохраняет прежнюю случайность. Коэффициенты — не проценты. */
export const FOUNDER_SENSE_FIELDS=Object.freeze([
 ['energy','Чувствительность к энергии'],['health','Чувствительность к здоровью'],['stomach','Чувствительность к наполнению желудка'],
].map(([key,label])=>Object.freeze({key,label,oldIndex:COGNITIVE_GENES.findIndex(g=>g.key===key),min:-8,max:8})));
export function validateFounderSenses(input){
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Чувствительности основателей: нужен набор коэффициентов.');
 const result={};for(const [key,value]of Object.entries(input)){
  const field=FOUNDER_SENSE_FIELDS.find(f=>f.key===key);
  if(!field||typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max)throw new Error('Коэффициенты чувствительности: конечные числа от −8 до 8.');
  result[key]=value;
 }return Object.keys(result).length?result:undefined;
}
/** Индексы вычисляются один раз на создание мира, до цикла основателей.
 * Геном каждого основателя уже собственный: исходный файл не изменяется. */
export function compileFounderSenses(input,layout){
 const settings=validateFounderSenses(input);if(!settings)return [];
 const indices=layout?.brainType===TEMPORAL_BRAIN_TYPE?TEMPORAL_TRAIT_INDICES:NEURAL_TRAIT_INDICES;
 return Object.entries(settings).map(([key,value])=>{const f=FOUNDER_SENSE_FIELDS.find(f=>f.key===key);return [layout?layout.traitOffset+indices.indexOf(f.oldIndex):COGNITIVE_GENES[f.oldIndex].index,value];});
}
