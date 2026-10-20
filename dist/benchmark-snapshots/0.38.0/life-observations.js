/** Статистика наблюдателя. Не читается мозгом и не расходует RNG.
 * Один целочисленный отсчёт запасов за физический подшаг, до завершений
 * действий: учитывается запас, который особь несла именно в этом интервале. */
import {SUBSTEPS} from './action-timing.js';
export const LIFE_OBSERVATION_SCHEMA='life-observer-v1';
export function createLifeObservations(capacity){return {inventorySubsteps:new Uint32Array(capacity+1),brainCalls:0,reviews:0,interruptions:{voluntary:0,physical:0,death:0}};}
export function describeLifeObservations(o){
 const bins=o.inventorySubsteps;let count=0,total=0;
 for(let i=0;i<bins.length;i++){count+=bins[i];total+=bins[i]*i;}
 let median=null;
 if(count){const lo=Math.floor((count-1)/2),hi=Math.floor(count/2);let cumulative=0,lower=null;for(let i=0;i<bins.length;i++){cumulative+=bins[i];if(lower===null&&cumulative>lo)lower=i;if(cumulative>hi){median=(lower+i)/2;break;}}}
 return {schema:LIFE_OBSERVATION_SCHEMA,inventorySubsteps:Array.from(bins),inventoryObservedSteps:count/SUBSTEPS,meanInventory:count?total/count:null,medianInventory:median,
  brainCalls:o.brainCalls,reviews:o.reviews,interruptions:{...o.interruptions}};
}
