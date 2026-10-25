import {compileDag,dagParameters} from './dag-network.js';
import {validateDualBrain} from './dual-brain-genome.js';
import {FIXED_PARAMETERS,STRUCTURAL_BLOCKS} from './structural-brain.js';
import {brainCostProfile} from './brain-cost.js';

/** Адаптер общего DAG к прежней раскладке обучаемого контекста. Фиксированные
 * кодировщик/проекции сохраняют все индексы и существующий быстрый оценщик. */
export function compileDualState(genes){
 const d=validateDualBrain(genes),g=compileDag(d.main),H=g.hidden,O=g.outputs;
 const parameter=index=>index<H?FIXED_PARAMETERS+index:index<H+O?STRUCTURAL_BLOCKS[1].bias+index-H:FIXED_PARAMETERS+index-O;
 const activeParameters=[];
 for(const b of STRUCTURAL_BLOCKS)for(let j=0;j<b.weights+(b.bias===null?0:b.outputs);j++)activeParameters.push(b.offset+j);
 for(const index of g.activeParameters)if(index<H||index>=H+O)activeParameters.push(parameter(index));
 const structure={...g,parameters:d.layout.parameters,activeParameters,
  incoming:g.incoming.map(edges=>edges.map(edge=>({...edge,index:parameter(edge.index)}))),outputBias:STRUCTURAL_BLOCKS[1].bias};
 const attentionStructure=compileDag(d.attention);
 return {structure,costProfile:brainCostProfile(structure),attentionStructure,gateBase:dagParameters(d.attention),dual:true,lastDecisionSubtick:0};
}
