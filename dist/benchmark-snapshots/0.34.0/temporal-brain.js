/** Нынешний v13 использует тот же численный оценщик с новым контрактом входов. */
import * as layout from './temporal-layout.js';
import * as inputs from './temporal-inputs.js';
import {createSetBrainEngine} from './set-brain-engine.js';
export const {setCommonForward,setCandidateForward,operationProbabilities,evaluateSetBrain,expectedSetValue,setGradient,learnSetBrain}=createSetBrainEngine(layout,inputs);
