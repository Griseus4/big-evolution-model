import {STRUCTURAL_TYPE,STRUCTURAL_TYPE_LAYOUT,structuralLayout} from './structural-brain.js';
import {DUAL_BRAIN_TYPE,DUAL_TYPE_LAYOUT,dualBrainLayout} from './dual-brain-layout.js';
/** Схема mlp-local-v1: фиксированный порядок чисел, не готовая стратегия.
 * Один общий оценщик вариантов: 32 входа → 16 tanh → линейный Q.
 * 512 связей + 16 смещений + 16 выходных связей + 1 смещение = 545.
 * Затем 13 свойств ощущений/пластичности/памяти. Координаты не входят в сеть.
 */
import {TEMPORAL_LAYOUT} from './temporal-layout.js';
import {SET_LAYOUT} from './set-brain-layout.js';
export {SET_BRAIN_TYPE} from './set-brain-layout.js';
export const NEURAL_BRAIN_TYPE='mlp-local-v1',NEURAL_INPUT_SCHEMA='local-features-32-v1';
export const INPUT_COUNT=32,HIDDEN_COUNT=16,PARAMETER_COUNT=545,NEURAL_GENE_COUNT=558;
export const HIDDEN_BIAS=512,OUTPUT_WEIGHTS=528,OUTPUT_BIAS=544,TRAIT_OFFSET=545;
export const NEURAL_TRAIT_INDICES=Object.freeze([0,1,2,3,4,5,6,7,8,15,16,17,18]);
export const NETWORK_SCHEMA=Object.freeze({inputSchema:NEURAL_INPUT_SCHEMA,inputs:INPUT_COUNT,hidden:HIDDEN_COUNT,outputs:1,activation:'tanh',parameterOrder:'hidden-row-major-bias-output-bias-v1'});
export const NEURAL_INPUT_NAMES=Object.freeze([
 'Действие: вперёд','Действие: назад','Действие: назад-влево','Действие: вперёд-влево','Действие: назад-вправо','Действие: вперёд-вправо',
 'Действие: подобрать','Действие: съесть','Действие: ждать','Действие: родить','Действие: положить',
 'Энергия / 100','Здоровье / 100','Боль / 100','Переносимый запас / вместимость','Желудок / вместимость',
 'Шаг к видимой пище','Шаг в опасный рельеф','Повтор направления','Градиент памяти пищи','Память повреждений','Непосещённое место','Неопределённость памяти','Градиент × голод','Риск × голод',
 'Пища здесь','Порции в видимой клетке / 10','Опасный видимый рельеф','Повтор действия','Уверенность памяти места','Прогноз пищи места / 10','Давность наблюдения / масштаб памяти',
]);
/** Версия 7 неизменна: её веса относятся именно к 32 входам. Новая схема
 * добавляет три ощущения плотности, но не цель искать/избегать толпу.
 * Порядок первых 32 признаков сохраняется; веса v7 не переносятся в v8.
 */
export const NEIGHBOUR_BRAIN_TYPE='mlp-neighbours-v1';
function layout(version,brainType,inputs,inputNames,inputSchema){
 const hiddenBias=inputs*HIDDEN_COUNT,outputWeights=hiddenBias+HIDDEN_COUNT,outputBias=outputWeights+HIDDEN_COUNT,parameters=outputBias+1;
 return Object.freeze({version,brainType,inputs,hidden:HIDDEN_COUNT,parameters,hiddenBias,outputWeights,outputBias,traitOffset:parameters,
  genes:parameters+NEURAL_TRAIT_INDICES.length,inputNames:Object.freeze(inputNames),
  network:Object.freeze({...NETWORK_SCHEMA,inputSchema,inputs})});
}
export const NEURAL_LAYOUTS=Object.freeze([
 layout(7,NEURAL_BRAIN_TYPE,INPUT_COUNT,NEURAL_INPUT_NAMES,NEURAL_INPUT_SCHEMA),
 layout(8,NEIGHBOUR_BRAIN_TYPE,35,[...NEURAL_INPUT_NAMES,'Другие на своей клетке','Другие в клетке варианта','Другие во всём обзоре'],'local-neighbours-35-v1'),
 SET_LAYOUT,TEMPORAL_LAYOUT,
]);
// Не создаём callback find при каждой оценке действия. Это неизменный реестр
// форматов, а не кэш изменяемых весов или состояния организма.
const byType=new Map(NEURAL_LAYOUTS.map(l=>[l.brainType,l]));
const byGenes=new Map(NEURAL_LAYOUTS.map(l=>[l.genes,l]));
// v9 дописывает два регулятора наследования. Сам мозг и его схема входов
// прежние: byType/byParameters не меняем, сеть их не вычисляет и не обучает.
for(const l of NEURAL_LAYOUTS)byGenes.set(l.genes+2,Object.freeze({...l,version:l.version>=10?l.version:9,genes:l.genes+2,mutationOffset:l.genes}));
const byParameters=new Map(NEURAL_LAYOUTS.map(l=>[l.parameters,l]));
export const layoutForType=type=>type===DUAL_BRAIN_TYPE?DUAL_TYPE_LAYOUT:type===STRUCTURAL_TYPE?STRUCTURAL_TYPE_LAYOUT:byType.get(type)??null;
export const layoutForGenes=genes=>dualBrainLayout(genes)??structuralLayout(genes)??byGenes.get(genes.length)??null;
export const layoutForParameters=parameters=>byParameters.get(parameters.length)??null;
