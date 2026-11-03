import * as careLayout from './care-brain-layout.js';
import * as careInputs from './care-inputs.js';
/** Нынешний v13 использует тот же численный оценщик с новым контрактом входов. */
import * as physiologyLayout from './physiology-brain-layout.js';
import * as physiologyInputs from './physiology-inputs.js';
import * as layout from './temporal-layout.js';
import * as inputs from './temporal-inputs.js';
import {createSetBrainEngine} from './set-brain-engine.js';
import {STRUCTURAL_BLOCKS,FIXED_PARAMETERS,contextForward,contextBackward} from './structural-brain.js';
const old=createSetBrainEngine(layout,inputs),dag=createSetBrainEngine({...layout,SET_BLOCKS:STRUCTURAL_BLOCKS,SET_PARAMETER_COUNT:FIXED_PARAMETERS,contextForward,contextBackward},inputs);
const physiology=createSetBrainEngine({...physiologyLayout,contextForward,contextBackward},physiologyInputs);
const care=createSetBrainEngine({...careLayout,contextForward,contextBackward},careInputs);
const engine=brain=>brain.care?care:brain.physiology?physiology:brain.structure?dag:old;
export const {setCommonForward,setCandidateForward,operationProbabilities,setGradient}=old;
export const structuralEngine=dag;
export const evaluateSetBrain=(brain,...args)=>engine(brain).evaluateSetBrain(brain,...args);
export const expectedSetValue=(brain,...args)=>engine(brain).expectedSetValue(brain,...args);
export const learnSetBrain=(brain,...args)=>engine(brain).learnSetBrain(brain,...args);
