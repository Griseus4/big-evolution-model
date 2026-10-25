import {FIXED_PARAMETERS,STRUCTURAL_BLOCKS} from './structural-brain.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN,CONTEXT_NAMES,TEMPORAL_LAYOUT} from './temporal-layout.js';
import {EVOLUTION_RULES as R} from './brain-evolution-rules.js';
export const DUAL_BRAIN_TYPE='set-duration-dual-dag-v1',DUAL_MAGIC=15055015,ATTENTION_INPUTS=18;
export const DUAL_NETWORK=Object.freeze({...TEMPORAL_LAYOUT.network,architecture:'context-attention-dag-v1',
 activation:'cells-tanh-context-dag-hidden-tanh-linear-readout',
 inputSchema:'local-process-rest-timer-v1',parameterOrder:'fixed-main-traits-attention-six-regulators-topology-v1',
 policy:'rest-relative-operation-logmeanexp-v1',contextHidden:null,contextOutputs:CONTEXT_HIDDEN,gateInputs:ATTENTION_INPUTS,gateHidden:null,gateParameters:null});
export const DUAL_TYPE_LAYOUT=Object.freeze({...TEMPORAL_LAYOUT,version:15,brainType:DUAL_BRAIN_TYPE,network:DUAL_NETWORK});

/** Числа параметров отделены от целочисленной топологии. Смещения областей
 * всегда выводятся из footer; прежние смещения v14 здесь не применимы. */
export function dualBrainLayout(genes){
 if(genes?.at(-1)!==DUAL_MAGIC)return null;
 const [H,E,A,F]=genes.slice(-5,-1);
 if(![H,E,A,F].every(Number.isSafeInteger)||H<0||A<0||H>R.technicalNeurons||A>R.technicalNeurons||
 E<0||F<0||E>(CONTEXT_INPUTS+H)*(H+CONTEXT_HIDDEN)||F>(ATTENTION_INPUTS+A)*(A+1))throw new Error('Повреждены размеры двух сетей.');
 const parameters=FIXED_PARAMETERS+H+E,traitOffset=parameters,gateOffset=traitOffset+12,
 gateParameters=A+1+F,regulatorOffset=gateOffset+gateParameters,topologyOffset=regulatorOffset+6;
 if(genes.length!==topologyOffset+H+2*E+A+2*F+5)throw new Error('Неполный геном двух сетей.');
 return {version:15,brainType:DUAL_BRAIN_TYPE,inputs:CONTEXT_INPUTS,hidden:H,edgeCount:E,parameters,
 traitOffset,traitCount:12,gateOffset,gateParameters,gateHidden:A,gateEdges:F,regulatorOffset,
 mutationOffset:regulatorOffset+4,topologyOffset,genes:genes.length,inputNames:CONTEXT_NAMES,network:DUAL_NETWORK};
}

export function unpackDualBrain(genes){
 const l=dualBrainLayout(genes);if(!l)throw new Error('Нужен геном двух сетей v15.');
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
 return {layout:l,fixed:genes.slice(0,FIXED_PARAMETERS),traits:genes.slice(l.traitOffset,l.gateOffset),main,attention,
 regulators:genes.slice(l.regulatorOffset,l.topologyOffset)};
}

export function packDualBrain({fixed,traits,main,attention,regulators}){
 const copy=fixed.slice();
 copy.splice(STRUCTURAL_BLOCKS[1].bias,CONTEXT_HIDDEN,...main.biases.slice(main.layers.length));
 const topology=graph=>[...graph.layers,...graph.edges.flatMap(edge=>[edge.from,edge.to])];
 return [...copy,...main.biases.slice(0,main.layers.length),...main.edges.map(edge=>edge.weight),...traits,
 ...attention.biases,...attention.edges.map(edge=>edge.weight),...regulators,...topology(main),...topology(attention),
 main.layers.length,main.edges.length,attention.layers.length,attention.edges.length,DUAL_MAGIC];
}
