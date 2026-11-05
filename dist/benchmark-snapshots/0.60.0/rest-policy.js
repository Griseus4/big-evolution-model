import {EVOLUTION_RULES as R} from './brain-evolution-rules.js';
/** Внутренняя оценка покоя использует стабильный исторический код 8, но
 * покой не становится моторным процессом. Одна политика для выбора и TD.
 * Счётчики целей включают только прошедшие допуск варианты. */
export function restProbabilities(values,actions,operations,temperature,threshold=R.restThreshold){
 if(values.length!==actions.length||actions.length!==operations.length||!Number.isFinite(temperature)||temperature<=0||!Number.isFinite(threshold)||!values.every(Number.isFinite))throw new Error('Неверные входы политики покоя.');
 const rest=actions.indexOf(8);if(rest<0)throw new Error('Нет внутренней оценки покоя.');
 const probabilities=new Float64Array(values.length),counts=new Map(),v=values[rest];
 for(let i=0;i<values.length;i++)if(i!==rest&&values[i]-v>threshold)counts.set(operations[i],(counts.get(operations[i])??0)+1);
 if(!counts.size){probabilities[rest]=1;return probabilities;}
 let peak=-Infinity;
 for(let i=0;i<values.length;i++)if(i!==rest&&values[i]-v>threshold)peak=Math.max(peak,values[i]/temperature-Math.log(counts.get(operations[i])));
 let total=0;
 for(let i=0;i<values.length;i++)if(i!==rest&&values[i]-v>threshold){const weight=Math.exp(values[i]/temperature-Math.log(counts.get(operations[i]))-peak);probabilities[i]=weight;total+=weight;}
 for(let i=0;i<values.length;i++)probabilities[i]/=total;
 return probabilities;
}
