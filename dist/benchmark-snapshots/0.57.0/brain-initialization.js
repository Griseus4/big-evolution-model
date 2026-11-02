import {STRUCTURAL_LIMITS,STRUCTURE_RULES} from './brain-structure-rules.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN} from './temporal-layout.js';
/** Только начальная структура главного контекста. Процент относительно
 * соседних непустых уровней, а не вероятность независимого броска на ребро. */
export const INITIAL_NEURONS=Object.freeze([5]);
export function initialLayerCounts(value,maxNeurons=STRUCTURAL_LIMITS.maxNeurons,maxLayers=STRUCTURAL_LIMITS.maxLayers){
 if(!Array.isArray(value)||value.length>STRUCTURAL_LIMITS.maxLayers||value.some(v=>!Number.isSafeInteger(v)||v<0||v>maxNeurons))throw new Error('Начальные нейроны: нужны целые неотрицательные количества по слоям.');
 const counts=value.filter(v=>v>0);
 if(counts.length>maxLayers||counts.reduce((a,b)=>a+b,0)>maxNeurons)throw new Error('Начальная структура превышает предел нейронов или слоёв.');
 return counts;
}
export function initialConnectionBudget(counts,percent=STRUCTURE_RULES.initialConnections){
 const sizes=[CONTEXT_INPUTS,...counts.filter(n=>n>0),CONTEXT_HIDDEN];let base=0,maximum=0,preceding=0;
 for(let j=0;j<sizes.length;j++){maximum+=preceding*sizes[j];preceding+=sizes[j];if(j)base+=sizes[j-1]*sizes[j];}
 const maxPercent=100*maximum/base;
 if(!Number.isFinite(percent)||percent<0||percent>maxPercent+1e-9)throw new Error(`Начальная связность: от 0 до ${maxPercent.toFixed(2)}% для этой структуры.`);
 return {base,maximum,maxPercent,count:Math.min(maximum,Math.round(base*percent/100))};
}
/** Резервуарный отбор без матрицы всех рёбер; выполняется при создании
 * основателя, не на подшаге. Память O(фактических связей), не O(всех пар). */
export function initialEdges(counts,percent,random){
 const budget=initialConnectionBudget(counts,percent),sizes=[CONTEXT_INPUTS,...counts,CONTEXT_HIDDEN],offsets=[];
 for(const size of sizes)offsets.push((offsets.at(-1)??0)+(offsets.length?sizes[offsets.length-1]:0));
 const chosen=[],sample=(adjacent,amount)=>{
  if(!amount)return;const selected=[];let seen=0;
  for(let a=0;a<sizes.length-1;a++)for(let b=a+1;b<sizes.length;b++)if((b===a+1)===adjacent){
   const scale=Math.sqrt(6/(sizes[a]+sizes[b]));
   for(let i=0;i<sizes[a];i++)for(let j=0;j<sizes[b];j++){
    seen++;const index=selected.length<amount?selected.length:Math.floor(random.next()*seen);
    if(index<amount)selected[index]={from:offsets[a]+i,to:offsets[b]+j,scale};
   }
  }
  chosen.push(...selected);
 };
 sample(true,Math.min(budget.base,budget.count));sample(false,Math.max(0,budget.count-budget.base));
 // Стабильный порядок не зависит от порядка замены элементов резервуара.
 chosen.sort((a,b)=>a.to-b.to||a.from-b.from);
 return chosen.map(({from,to,scale})=>({from,to,weight:(random.next()*2-1)*scale}));
}
