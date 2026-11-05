import {PHYSIOLOGY_ACTIONS,PHYSIOLOGY_OPERATIONS} from './physiology-actions.js';
export const CARE_ACTIONS=Object.freeze([...PHYSIOLOGY_ACTIONS,'Накормить ребёнка']);
export const CARE_OPERATIONS=Object.freeze([...PHYSIOLOGY_OPERATIONS,'Накормить ребёнка']);
export const FEED_ACTION=12,FEED_OPERATION=7;
export const careOperation=action=>action<6?0:action-5;
