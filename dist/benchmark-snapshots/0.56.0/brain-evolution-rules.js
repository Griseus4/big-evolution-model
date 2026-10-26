/** Правила новой схемы двух сетей. Начальные диапазоны не ограничивают
 * наследственную эволюцию; технические пределы защищают формат/нагрузку. */
export const EVOLUTION_RULES=Object.freeze({rateFloor:.0001,strengthFloor:.000001,
 initialRateMin:.01,initialRateMax:.05,initialStrengthMin:.05,initialStrengthMax:.2,
 initialNeurons:Object.freeze([]),initialConnections:100,maxNeurons:64,maxLayers:4,
 technicalNeurons:256,technicalLayers:16,weightLimit:8,neuronScale:1,edgeScale:1,
 timerScaleT:1,restThreshold:0,newInputWeight:.01,maxGenomeFileBytes:8*1024*1024});
export const V16_MUTATION_LABELS=Object.freeze({behavior:'Поведенческие свойства',attention:'Малый мозг v15/v16: веса и структура',context:'Контекст v16: веса и структура',
 cells:'Кодировщик клеток',target:'Проекция цели',operation:'Проекция операции',direct:'Прямая оценка'});
export const V16_MUTATION_GROUPS=Object.freeze(Object.keys(V16_MUTATION_LABELS));
export const MUTATION_LABELS=Object.freeze({behavior:'Поведенческие свойства',attentionWeights:'Малый мозг: веса',contextWeights:'Контекст ситуации: веса',cells:'Кодировщик клеток',target:'Проекция цели',operation:'Проекция операции',direct:'Прямая оценка',attentionStructure:'Малый мозг: структура',contextStructure:'Контекст ситуации: структура'});
export const MUTATION_GROUPS=Object.freeze(Object.keys(MUTATION_LABELS));
export function mutationGroupsForVersion(version){if(version===15)return LEGACY_MUTATION_GROUPS;if(version===16)return V16_MUTATION_GROUPS;if(version===17)return MUTATION_GROUPS;throw new Error('Неизвестная версия регуляторов.');}
export const LEGACY_MUTATION_GROUPS=Object.freeze(['behavior','attention','main']);
