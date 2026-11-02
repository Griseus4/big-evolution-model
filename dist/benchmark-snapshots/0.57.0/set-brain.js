/** Исторический v11 использует общую численную реализацию. */
import * as layout from './set-brain-layout.js';
import * as inputs from './set-brain-inputs.js';
import {createSetBrainEngine} from './set-brain-engine.js';
export const {setCommonForward,setCandidateForward,operationProbabilities,evaluateSetBrain,expectedSetValue,setGradient,learnSetBrain}=createSetBrainEngine(layout,inputs);
