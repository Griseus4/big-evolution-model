import {MODULAR_GRAPH_SPECS,MODULAR_DEFAULTS as D} from './modular-brain-layout.js';
import {moduleLimits} from './modular-brain-genome.js';
import {EVOLUTION_RULES as R,MUTATION_GROUPS,mutationGroupsForVersion} from './brain-evolution-rules.js';
import {initialLayerCounts} from './brain-initialization.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN} from './temporal-layout.js';
import {ATTENTION_INPUTS,dualBrainLayout,DUAL_SCHEMAS,DUAL_VERSION} from './dual-brain-layout.js';
import {numericMutationProfile,NUMERIC_MUTATION_GROUPS} from './numeric-mutation.js';
import {dualDimensions} from './dual-brain-layout.js';
import {encodeMutationPair} from './dual-brain-genome.js';
export function dagConnectionBudget(inputs,outputs,counts,percent=100){
 const sizes=[inputs,...counts.filter(Boolean),outputs];let base=0,maximum=0;
 for(let a=0;a<sizes.length-1;a++)for(let b=a+1;b<sizes.length;b++){maximum+=sizes[a]*sizes[b];if(b===a+1)base+=sizes[a]*sizes[b];}
 const maxPercent=100*maximum/base;
 if(!Number.isFinite(percent)||percent<0||percent>maxPercent+1e-9)throw new Error(`Связность: от 0 до ${maxPercent.toFixed(2)}%.`);
 return {base,maximum,maxPercent,count:Math.min(maximum,Math.round(base*percent/100))};
}
export function dualStructureSettings(input={}, {historical=false}={}){
 const encoded=input.genomeVersion??dualBrainLayout(input.baseGenome)?.version??Number(Object.keys(DUAL_SCHEMAS).find(v=>DUAL_SCHEMAS[v]===input.mutationProtocol));
 const keys=Object.keys(input.mutationEnabled??input.initialMutation??{}),version=encoded|| (historical?(keys.includes('main')?15:keys.includes('context')||keys.includes('attention')?16:DUAL_VERSION):DUAL_VERSION);
 historical||=version<DUAL_VERSION;
 const result={},dim=dualDimensions(version);
 for(const [prefix,I,O]of [['',dim.inputs,CONTEXT_HIDDEN],['attention',dim.attentionInputs,1]]){
  const key=name=>prefix?prefix+name[0].toUpperCase()+name.slice(1):name;
  const maxNeurons=input[key('maxNeurons')]??R.maxNeurons,maxLayers=input[key('maxLayers')]??R.maxLayers;
  if(!Number.isSafeInteger(maxNeurons)||maxNeurons<0||maxNeurons>R.technicalNeurons||!Number.isSafeInteger(maxLayers)||maxLayers<0||maxLayers>R.technicalLayers)throw new Error('Неверные пределы структуры мозга.');
  const counts=initialLayerCounts(input[key('initialNeurons')]??[],maxNeurons,maxLayers),percent=input[key('initialConnections')]??R.initialConnections;
  if(!input.baseGenome)dagConnectionBudget(I,O,counts,percent);
  Object.assign(result,{[key('maxNeurons')]:maxNeurons,[key('maxLayers')]:maxLayers,[key('initialNeurons')]:counts,[key('initialConnections')]:percent});
 }
 if(version>=20){
  const allowed=MODULAR_GRAPH_SPECS.filter(s=>!['context','attention'].includes(s.key));
  if(input.brainModules&&(typeof input.brainModules!=='object'||Array.isArray(input.brainModules)||Object.keys(input.brainModules).some(key=>!allowed.some(s=>s.key===key))))throw new Error('Неизвестный блок мозга.');
  result.brainModules=Object.fromEntries(allowed.map(spec=>{const limits=moduleLimits(input,spec.key),counts=initialLayerCounts(limits.initialNeurons,limits.maxNeurons,limits.maxLayers);if(!input.baseGenome)dagConnectionBudget(spec.inputs,spec.outputs,counts,limits.initialConnections);return [spec.key,{...limits,initialNeurons:counts}];}));
 }
 if(input.structuralMutations!==undefined&&typeof input.structuralMutations!=='boolean')throw new Error('Неверный переключатель структурных мутаций.');
 result.structuralMutations=input.structuralMutations!==false;
 const groups=mutationGroupsForVersion(version),initialMutation={};
 for(const group of groups){const value=input.initialMutation?.[group];if(value){
  if(version>=18&&NUMERIC_MUTATION_GROUPS.includes(group)){if(Object.keys(value).some(k=>!['shape','ceiling'].includes(k)))throw new Error('v18 требует A/r, прежние p/s не преобразуются.');numericMutationProfile(value.shape,value.ceiling);initialMutation[group]={...value};continue;}
  if(Object.keys(value).some(k=>!['rate','strength'].includes(k)))throw new Error('Неизвестная настройка мутации.');
  encodeMutationPair(value.rate??R.initialRateMin,value.strength??R.initialStrengthMin);initialMutation[group]={...value};
 }}
 if(input.initialMutation&&Object.keys(input.initialMutation).some(k=>!groups.includes(k)))throw new Error('Неизвестная группа мутации.');
 if(version>=20)for(const key of groups)initialMutation[key]={...(NUMERIC_MUTATION_GROUPS.includes(key)?{shape:D.shape,ceiling:D.ceiling}:{rate:D.rate,strength:D.strength}),...initialMutation[key]};
 if(Object.keys(initialMutation).length)result.initialMutation=initialMutation;
 if(input.mutationEnabled!==undefined&&(!input.mutationEnabled||typeof input.mutationEnabled!=='object'||Array.isArray(input.mutationEnabled)||Object.entries(input.mutationEnabled).some(([k,v])=>!groups.includes(k)||typeof v!=='boolean')))throw new Error('Неверные переключатели мутаций блоков.');
 if(!historical||input.mutationEnabled!==undefined)result.mutationEnabled=Object.fromEntries(groups.map(key=>[key,input.mutationEnabled?.[key]!==false]));
 return result;
}
