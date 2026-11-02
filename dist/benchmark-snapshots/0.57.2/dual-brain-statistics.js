import {dualBrainLayout} from './dual-brain-layout.js';
import {dualMutationProfiles} from './dual-brain-genome.js';
import {MUTATION_LABELS} from './brain-evolution-rules.js';
import {NUMERIC_MUTATION_GROUPS} from './numeric-mutation.js';
export const DUAL_METRICS=Object.freeze([
 ...NUMERIC_MUTATION_GROUPS.flatMap(key=>[{id:key+'MutationShape',label:MUTATION_LABELS[key]+': форма мутации A',unit:'A',digits:4},{id:key+'MutationCeiling',label:MUTATION_LABELS[key]+': потолок изменения r',unit:'доля',digits:4}]),
 ...[['main','Контекст'],['attention','Диспетчер']].flatMap(([key,label])=>[
  {id:key+'Neurons',label:label+': скрытые нейроны',unit:'нейронов',digits:1},
  {id:key+'Connections',label:label+': связи',unit:'связей',digits:1},
  {id:key+'Layers',label:label+': скрытые слои',unit:'слоёв',digits:1}]),
 ...[['main','Основной оценщик v15'],['attention','Малый мозг v15/v16: веса и структура'],['context','Контекст v16: веса и структура'],...Object.entries(MUTATION_LABELS)].flatMap(([key,label])=>[
  {id:key+'MutationRate',label:label+': вероятность мутации',unit:'% / ген или событие',digits:3},
  {id:key+'MutationStrength',label:label+': сила мутации',unit:'сила',digits:3}])
].map(Object.freeze));
export function dualHeritable(genes){
 const l=dualBrainLayout(genes);if(!l)return {};
 const at=l.topologyOffset+l.hidden+2*l.edgeCount,profiles=dualMutationProfiles(genes),result={
  mainNeurons:l.hidden,mainConnections:l.edgeCount,mainLayers:Math.max(0,...genes.slice(l.topologyOffset,l.topologyOffset+l.hidden)),
  attentionNeurons:l.gateHidden,attentionConnections:l.gateEdges,attentionLayers:Math.max(0,...genes.slice(at,at+l.gateHidden))};
 for(const [key,p]of Object.entries(profiles)){if('shape' in p){result[key+'MutationShape']=p.shape;result[key+'MutationCeiling']=p.ceiling;}else{result[key+'MutationRate']=100*p.rate;result[key+'MutationStrength']=p.strength;}}
 return result;
}
