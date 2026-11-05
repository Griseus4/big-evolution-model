import * as care from './care-brain-layout.js';
import {CARE_GENE_KEYS} from './care-settings.js';
import {EVOLUTION_RULES as R,MODULAR_MUTATION_GROUPS} from './brain-evolution-rules.js';
export const MODULAR_VERSION=20,MODULAR_MAGIC=20060020;
export const MODULAR_DEFAULTS=Object.freeze({shape:1,ceiling:.10,rate:.50,strength:.50});
export const MODULAR_GRAPH_SPECS=Object.freeze([
 ...care.SET_BLOCKS.map(b=>Object.freeze({key:b.key,label:({cells:'Кодировщик клеток',context:'Контекст ситуации',target:'Проекция цели',operation:'Проекция операции',direct:'Прямая оценка'})[b.key],inputs:b.inputs,outputs:b.outputs})),
 Object.freeze({key:'attention',label:'Малый мозг',inputs:care.ATTENTION_INPUTS,outputs:1}),
]);
export const graphWeightGroup=key=>key==='context'?'contextWeights':key==='attention'?'attentionWeights':key;
export const graphStructureGroup=key=>key+'Structure';
export const MODULAR_NETWORK=Object.freeze({...care.NETWORK,architecture:'all-blocks-dag-v1',parameterOrder:'six-dag-traits-body-thirteen-regulator-pairs-topology-v1',activation:'hidden-tanh-cells-output-tanh-other-outputs-linear'});
/** Каждая сеть хранит только существующие рёбра. Footer задаёт размеры до
 * создания массивов; индексы параметров и топологии выводятся один раз. */
export function modularBrainLayout(genes){
 if(genes?.at(-1)!==MODULAR_MAGIC)return null;
 const sizes=genes.slice(-13,-1);if(sizes.length!==12)throw new Error('Неполный footer шести сетей.');
 let parameter=0,topologySize=0;const modules=[];
 for(let j=0;j<MODULAR_GRAPH_SPECS.length;j++){
  const spec=MODULAR_GRAPH_SPECS[j],H=sizes[2*j],E=sizes[2*j+1];
  if(!Number.isSafeInteger(H)||H<0||H>R.technicalNeurons||!Number.isSafeInteger(E)||E<0||E>(spec.inputs+H)*(H+spec.outputs))throw new Error('Повреждены размеры блока '+spec.key);
  if(spec.key==='attention')parameter+=12+CARE_GENE_KEYS.length;
  const parameters=H+spec.outputs+E;modules.push({...spec,hidden:H,edgeCount:E,offset:parameter,parameters});parameter+=parameters;topologySize+=H+2*E;
 }
 const main=modules.find(m=>m.key==='context'),attention=modules.at(-1),traitOffset=attention.offset-12-CARE_GENE_KEYS.length,bodyOffset=traitOffset+12,regulatorOffset=parameter,regulatorCount=2*MODULAR_MUTATION_GROUPS.length,topologyOffset=regulatorOffset+regulatorCount;
 if(genes.length!==topologyOffset+topologySize+13)throw new Error('Неполный геном шести сетей.');
 return {version:MODULAR_VERSION,brainType:'set-duration-dual-dag-v1',inputs:main.inputs,attentionInputs:attention.inputs,parameters:traitOffset,fixedParameters:0,
  blocks:modules.slice(0,-1).map(m=>({...m,weights:m.edgeCount,bias:m.offset+m.hidden})),modules,hidden:main.hidden,edgeCount:main.edgeCount,gateHidden:attention.hidden,gateEdges:attention.edgeCount,
  traitOffset,traitCount:12,bodyOffset,bodyCount:CARE_GENE_KEYS.length,gateOffset:attention.offset,gateParameters:attention.parameters,regulatorOffset,regulatorCount,
  mutationGroups:MODULAR_MUTATION_GROUPS,mutationOffset:regulatorOffset+4,topologyOffset,genes:genes.length,inputNames:care.CONTEXT_NAMES,network:MODULAR_NETWORK};
}
export function unpackModularBrain(genes){
 const l=modularBrainLayout(genes);if(!l)throw new Error('Нужен геном шести сетей.');let at=l.topologyOffset;const graphs={};
 for(const m of l.modules){const layers=genes.slice(at,at+m.hidden);at+=m.hidden;const edges=Array.from({length:m.edgeCount},(_,j)=>({from:genes[at+2*j],to:genes[at+2*j+1],weight:genes[m.offset+m.hidden+m.outputs+j]}));at+=2*m.edgeCount;
  graphs[m.key]={inputs:m.inputs,outputs:m.outputs,layers,biases:genes.slice(m.offset,m.offset+m.hidden+m.outputs),edges};}
 return {layout:l,graphs,main:graphs.context,attention:graphs.attention,fixed:[],traits:genes.slice(l.traitOffset,l.bodyOffset),body:Object.fromEntries(CARE_GENE_KEYS.map((key,j)=>[key,genes[l.bodyOffset+j]])),regulators:genes.slice(l.regulatorOffset,l.topologyOffset)};
}
export function packModularBrain(d){
 const values=g=>[...g.biases,...g.edges.map(e=>e.weight)],topology=g=>[...g.layers,...g.edges.flatMap(e=>[e.from,e.to])];
 return [...MODULAR_GRAPH_SPECS.slice(0,-1).flatMap(m=>values(d.graphs[m.key])),...d.traits,...CARE_GENE_KEYS.map(k=>d.body[k]),...values(d.graphs.attention),...d.regulators,
  ...MODULAR_GRAPH_SPECS.flatMap(m=>topology(d.graphs[m.key])),...MODULAR_GRAPH_SPECS.flatMap(m=>[d.graphs[m.key].layers.length,d.graphs[m.key].edges.length]),MODULAR_MAGIC];
}
