/** cognition-v1: offset + span * sigmoid(ген). Span хранится явно, чтобы
 * перенос не менял порядок/точность прежних вычислений. */
export const COGNITIVE_SCALE_RULES=Object.freeze(Object.fromEntries(Object.entries({
 alpha:{offset:.002,span:.078},forgetting:{offset:0,span:.002},
 trace:{offset:.15,span:.8},discount:{offset:.7,span:.28},
 memoryAge:{offset:20,span:980},shortCapacity:{offset:8,span:112},
 longCapacity:{offset:2,span:60},consolidationThreshold:{offset:.005,span:.05},
 longRetention:{offset:200,span:5800},
}).map(([key,rule])=>[key,Object.freeze(rule)])));
export const MEMORY_RULES=Object.freeze({importanceLimit:10,encounterImportance:.012,
 forgetAgeFactor:3,forgetStrengthFraction:.15,recoveryTimeFloor:1,
 foodPredictionScale:6,riskPrior:2});
