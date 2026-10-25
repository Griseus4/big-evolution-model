import {EVOLUTION_RULES as R,MUTATION_GROUPS,LEGACY_MUTATION_GROUPS} from './brain-evolution-rules.js';
import {initialLayerCounts} from './brain-initialization.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN} from './temporal-layout.js';
import {ATTENTION_INPUTS,dualBrainLayout} from './dual-brain-layout.js';
import {encodeMutationPair} from './dual-brain-genome.js';
export function dagConnectionBudget(inputs,outputs,counts,percent=100){
 const sizes=[inputs,...counts.filter(Boolean),outputs];let base=0,maximum=0;
 for(let a=0;a<sizes.length-1;a++)for(let b=a+1;b<sizes.length;b++){maximum+=sizes[a]*sizes[b];if(b===a+1)base+=sizes[a]*sizes[b];}
 const maxPercent=100*maximum/base;
 if(!Number.isFinite(percent)||percent<0||percent>maxPercent+1e-9)throw new Error(`Связность: от 0 до ${maxPercent.toFixed(2)}%.`);
 return {base,maximum,maxPercent,count:Math.min(maximum,Math.round(base*percent/100))};
}
export function dualStructureSettings(input={}, {historical=false}={}){
 historical||=dualBrainLayout(input.baseGenome)?.version===15;
 const result={};
 for(const [prefix,I,O]of [['',CONTEXT_INPUTS,CONTEXT_HIDDEN],['attention',ATTENTION_INPUTS,1]]){
  const key=name=>prefix?prefix+name[0].toUpperCase()+name.slice(1):name;
  const maxNeurons=input[key('maxNeurons')]??R.maxNeurons,maxLayers=input[key('maxLayers')]??R.maxLayers;
  if(!Number.isSafeInteger(maxNeurons)||maxNeurons<0||maxNeurons>R.technicalNeurons||!Number.isSafeInteger(maxLayers)||maxLayers<0||maxLayers>R.technicalLayers)throw new Error('Неверные пределы структуры мозга.');
  const counts=initialLayerCounts(input[key('initialNeurons')]??[],maxNeurons,maxLayers),percent=input[key('initialConnections')]??R.initialConnections;
  if(!input.baseGenome)dagConnectionBudget(I,O,counts,percent);
  Object.assign(result,{[key('maxNeurons')]:maxNeurons,[key('maxLayers')]:maxLayers,[key('initialNeurons')]:counts,[key('initialConnections')]:percent});
 }
 if(input.structuralMutations!==undefined&&typeof input.structuralMutations!=='boolean')throw new Error('Неверный переключатель структурных мутаций.');
 result.structuralMutations=input.structuralMutations!==false;
 const groups=historical?[...new Set([...MUTATION_GROUPS,...LEGACY_MUTATION_GROUPS])]:MUTATION_GROUPS,initialMutation={};
 for(const group of groups){const value=input.initialMutation?.[group];if(value){
  if(Object.keys(value).some(k=>!['rate','strength'].includes(k)))throw new Error('Неизвестная настройка мутации.');
  encodeMutationPair(value.rate??R.initialRateMin,value.strength??R.initialStrengthMin);initialMutation[group]={...value};
 }}
 if(input.initialMutation&&Object.keys(input.initialMutation).some(k=>!groups.includes(k)))throw new Error('Неизвестная группа мутации.');
 if(Object.keys(initialMutation).length)result.initialMutation=initialMutation;
 if(input.mutationEnabled!==undefined&&(!input.mutationEnabled||typeof input.mutationEnabled!=='object'||Array.isArray(input.mutationEnabled)||Object.entries(input.mutationEnabled).some(([k,v])=>!groups.includes(k)||typeof v!=='boolean')))throw new Error('Неверные переключатели мутаций блоков.');
 if(!historical||input.mutationEnabled!==undefined)result.mutationEnabled=Object.fromEntries(groups.map(key=>[key,input.mutationEnabled?.[key]!==false]));
 return result;
}
