import * as care from './care-brain-layout.js';
import {CARE_GENE_KEYS,careGeneValues} from './care-settings.js';
import {FIXED_PARAMETERS,STRUCTURAL_BLOCKS} from './structural-brain.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN,CONTEXT_NAMES,TEMPORAL_LAYOUT} from './temporal-layout.js';
import {EVOLUTION_RULES as R,mutationGroupsForVersion} from './brain-evolution-rules.js';
import * as physiology from './physiology-brain-layout.js';
import {BODY_GENE_KEYS,BODY_GENE_DEFAULTS} from './physiology-settings.js';
export const CARE_GENOME_VERSION=19,CARE_GENOME_MAGIC=19059019;
export const PHYSIOLOGY_GENOME_VERSION=18,PHYSIOLOGY_GENOME_MAGIC=18057018;
export const DUAL_BRAIN_TYPE='set-duration-dual-dag-v1',DUAL_VERSION=17,DUAL_MAGIC=17056018,V16_DUAL_MAGIC=16055116,LEGACY_DUAL_MAGIC=15055015,ATTENTION_INPUTS=18;
export const LEGACY_DUAL_NETWORK=Object.freeze({...TEMPORAL_LAYOUT.network,architecture:'context-attention-dag-v1',
 activation:'cells-tanh-context-dag-hidden-tanh-linear-readout',
 inputSchema:'local-process-rest-timer-v1',parameterOrder:'fixed-main-traits-attention-six-regulators-topology-v1',
 policy:'rest-relative-operation-logmeanexp-v1',contextHidden:null,contextOutputs:CONTEXT_HIDDEN,gateInputs:ATTENTION_INPUTS,gateHidden:null,gateParameters:null});
export const V16_DUAL_NETWORK=Object.freeze({...LEGACY_DUAL_NETWORK,parameterOrder:'fixed-main-traits-attention-seven-regulator-pairs-topology-v1'});
export const DUAL_NETWORK=Object.freeze({...LEGACY_DUAL_NETWORK,parameterOrder:'fixed-main-traits-attention-nine-regulator-pairs-topology-v1'});
export const PHYSIOLOGY_NETWORK=Object.freeze({...DUAL_NETWORK,...physiology.NETWORK,parameterOrder:'fixed-main-traits-body-attention-numeric-structural-pairs-topology-v1'});
export const DUAL_SCHEMAS=Object.freeze({15:'three-heritable-log-pairs-v1',16:'seven-heritable-log-pairs-v1',17:'nine-heritable-log-pairs-v1',18:'seven-numeric-two-structural-pairs-v1',19:'seven-numeric-two-structural-care-v1'});
export const dualDimensions=version=>version>=19?{fixed:care.SET_PARAMETER_COUNT,blocks:care.SET_BLOCKS,inputs:care.CONTEXT_INPUTS,attentionInputs:care.ATTENTION_INPUTS,names:care.CONTEXT_NAMES}:version>=18?{fixed:physiology.SET_PARAMETER_COUNT,blocks:physiology.SET_BLOCKS,inputs:physiology.CONTEXT_INPUTS,attentionInputs:physiology.ATTENTION_INPUTS,names:physiology.CONTEXT_NAMES}:{fixed:FIXED_PARAMETERS,blocks:STRUCTURAL_BLOCKS,inputs:CONTEXT_INPUTS,attentionInputs:ATTENTION_INPUTS,names:CONTEXT_NAMES};
const networkForVersion=version=>version===19?{...PHYSIOLOGY_NETWORK,...care.NETWORK}:version===15?LEGACY_DUAL_NETWORK:version===16?V16_DUAL_NETWORK:version===18?PHYSIOLOGY_NETWORK:DUAL_NETWORK;
const magicForVersion=version=>version===19?CARE_GENOME_MAGIC:version===15?LEGACY_DUAL_MAGIC:version===16?V16_DUAL_MAGIC:version===18?PHYSIOLOGY_GENOME_MAGIC:DUAL_MAGIC;
export const DUAL_TYPE_LAYOUT=Object.freeze({...TEMPORAL_LAYOUT,version:DUAL_VERSION,brainType:DUAL_BRAIN_TYPE,network:DUAL_NETWORK});

/** Числа параметров отделены от целочисленной топологии. Смещения областей
 * всегда выводятся из footer; прежние смещения v14 здесь не применимы. */
export function dualBrainLayout(genes){
 const magic=genes?.at(-1);if(![CARE_GENOME_MAGIC,PHYSIOLOGY_GENOME_MAGIC,DUAL_MAGIC,V16_DUAL_MAGIC,LEGACY_DUAL_MAGIC].includes(magic))return null;
 const version=magic===CARE_GENOME_MAGIC?19:magic===PHYSIOLOGY_GENOME_MAGIC?18:magic===DUAL_MAGIC?DUAL_VERSION:magic===V16_DUAL_MAGIC?16:15,mutationGroups=mutationGroupsForVersion(version);
 const dim=dualDimensions(version),{fixed,blocks,inputs,attentionInputs}=dim;
 const [H,E,A,F]=genes.slice(-5,-1);
 if(![H,E,A,F].every(Number.isSafeInteger)||H<0||A<0||H>R.technicalNeurons||A>R.technicalNeurons||
 E<0||F<0||E>(inputs+H)*(H+CONTEXT_HIDDEN)||F>(attentionInputs+A)*(A+1))throw new Error('Повреждены размеры двух сетей.');
 const parameters=fixed+H+E,traitOffset=parameters,bodyOffset=traitOffset+12,bodyCount=version>=19?CARE_GENE_KEYS.length:version>=18?BODY_GENE_KEYS.length:0,gateOffset=bodyOffset+bodyCount,
 gateParameters=A+1+F,regulatorOffset=gateOffset+gateParameters,regulatorCount=2*mutationGroups.length,topologyOffset=regulatorOffset+regulatorCount;
 if(genes.length!==topologyOffset+H+2*E+A+2*F+5)throw new Error('Неполный геном двух сетей.');
 return {version,brainType:DUAL_BRAIN_TYPE,inputs,attentionInputs,fixedParameters:fixed,blocks,hidden:H,edgeCount:E,parameters,
 traitOffset,traitCount:12,bodyOffset,bodyCount,gateOffset,gateParameters,gateHidden:A,gateEdges:F,regulatorOffset,regulatorCount,mutationGroups,
 mutationOffset:regulatorOffset+4,topologyOffset,genes:genes.length,inputNames:dim.names,network:networkForVersion(version)};
}

export function unpackDualBrain(genes){
 const l=dualBrainLayout(genes);if(!l)throw new Error('Нужен геном двух сетей.');
 const FIXED_PARAMETERS=l.fixedParameters,STRUCTURAL_BLOCKS=l.blocks,CONTEXT_INPUTS=l.inputs,ATTENTION_INPUTS=l.attentionInputs;
 let at=l.topologyOffset;
 const read=(inputs,outputs,H,E,biases,weights)=>{
  const layers=genes.slice(at,at+H);at+=H;
  const edges=Array.from({length:E},(_,j)=>({from:genes[at+2*j],to:genes[at+2*j+1],weight:weights[j]}));at+=2*E;
  return {inputs,outputs,layers,biases,edges};
 };
 const main=read(CONTEXT_INPUTS,CONTEXT_HIDDEN,l.hidden,l.edgeCount,
 [...genes.slice(FIXED_PARAMETERS,FIXED_PARAMETERS+l.hidden),...genes.slice(STRUCTURAL_BLOCKS[1].bias,STRUCTURAL_BLOCKS[1].bias+CONTEXT_HIDDEN)],
 genes.slice(FIXED_PARAMETERS+l.hidden,l.parameters));
 const attention=read(ATTENTION_INPUTS,1,l.gateHidden,l.gateEdges,genes.slice(l.gateOffset,l.gateOffset+l.gateHidden+1),genes.slice(l.gateOffset+l.gateHidden+1,l.regulatorOffset));
 return {layout:l,fixed:genes.slice(0,FIXED_PARAMETERS),traits:genes.slice(l.traitOffset,l.bodyOffset),body:Object.fromEntries((l.version>=19?CARE_GENE_KEYS:BODY_GENE_KEYS).map((key,j)=>[key,l.bodyCount?genes[l.bodyOffset+j]:BODY_GENE_DEFAULTS[key]])),main,attention,
 regulators:genes.slice(l.regulatorOffset,l.topologyOffset)};
}

export function packDualBrain({fixed,traits,body=BODY_GENE_DEFAULTS,main,attention,regulators,layout}){
 const version=layout?.version??DUAL_VERSION,groups=mutationGroupsForVersion(version);
 if(regulators.length!==2*groups.length)throw new Error('Число регуляторов не соответствует версии генома.');
 const STRUCTURAL_BLOCKS=dualDimensions(version).blocks;
 const copy=fixed.slice();
 copy.splice(STRUCTURAL_BLOCKS[1].bias,CONTEXT_HIDDEN,...main.biases.slice(main.layers.length));
 const topology=graph=>[...graph.layers,...graph.edges.flatMap(edge=>[edge.from,edge.to])];
 return [...copy,...main.biases.slice(0,main.layers.length),...main.edges.map(edge=>edge.weight),...traits,...(version>=18?(version>=19?CARE_GENE_KEYS:BODY_GENE_KEYS).map(key=>body[key]):[]),
 ...attention.biases,...attention.edges.map(edge=>edge.weight),...regulators,...topology(main),...topology(attention),
 main.layers.length,main.edges.length,attention.layers.length,attention.edges.length,magicForVersion(version)];
}
