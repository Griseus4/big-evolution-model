/** Правила новой схемы двух сетей. Начальные диапазоны не ограничивают
 * наследственную эволюцию; технические пределы защищают формат/нагрузку. */
export const EVOLUTION_RULES=Object.freeze({rateFloor:.0001,strengthFloor:.000001,
 initialRateMin:.01,initialRateMax:.05,initialStrengthMin:.05,initialStrengthMax:.2,
 initialNeurons:Object.freeze([]),initialConnections:100,maxNeurons:64,maxLayers:4,
 technicalNeurons:256,technicalLayers:16,weightLimit:8,neuronScale:1,edgeScale:1,
 timerScaleT:1,restThreshold:0,newInputWeight:.01,maxGenomeFileBytes:8*1024*1024});
export const MUTATION_GROUPS=Object.freeze(['behavior','attention','main']);
