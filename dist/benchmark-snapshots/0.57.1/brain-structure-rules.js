/** Пределы структуры и начальные условия. Топологические ID генов сюда
 * не относятся; это параметры основателей и структурной мутации. */
export const STRUCTURAL_DEFAULTS=Object.freeze({maxNeurons:64,maxLayers:4,structuralMutations:true});
export const STRUCTURAL_LIMITS=Object.freeze({maxNeurons:256,maxLayers:16});
export const STRUCTURE_RULES=Object.freeze({founderNeuronsMin:4,founderNeuronsMax:6,
 initialConnections:100,initialConnectionsLimit:1e6,probabilityFloor:.0001,
 initialProbabilityMin:.01,initialProbabilitySpan:.04,maxConnectionChanges:5,
 newLayerChance:.5,removeConnectionChance:.5,newInputWeightFallback:.01,
 xavierFactor:6,traitSpan:5,ordinaryRateFallback:.06,ordinaryStrengthFallback:.1});
