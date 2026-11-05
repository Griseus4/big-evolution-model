import {CARE_GENE_FIELDS,careGeneValues} from './care-settings.js';
import {EVOLUTION_RULES as R,MODULAR_MUTATION_GROUPS} from './brain-evolution-rules.js';
import {NUMERIC_MUTATION_GROUPS,NUMERIC_MUTATION_RULES as N,numericMutationProfile,mutateNumeric} from './numeric-mutation.js';
import {MODULAR_GRAPH_SPECS,MODULAR_DEFAULTS as D,graphWeightGroup,graphStructureGroup,packModularBrain} from './modular-brain-layout.js';
import {validateDag} from './dag-network.js';
export function validateModularBrain(d){
 for(const spec of MODULAR_GRAPH_SPECS)validateDag(d.graphs[spec.key]);
 if(d.traits.length!==12||d.traits.some(v=>!Number.isFinite(v)||Math.abs(v)>R.weightLimit))throw new Error('Неверные поведенческие параметры.');
 careGeneValues(d.body);return d;
}
export function moduleLimits(settings,key){
 const source=key==='context'?{maxNeurons:settings.maxNeurons,maxLayers:settings.maxLayers,initialNeurons:settings.initialNeurons,initialConnections:settings.initialConnections}:key==='attention'?{maxNeurons:settings.attentionMaxNeurons,maxLayers:settings.attentionMaxLayers,initialNeurons:settings.attentionInitialNeurons,initialConnections:settings.attentionInitialConnections}:settings.brainModules?.[key]??{};
 const result={maxNeurons:source.maxNeurons??R.maxNeurons,maxLayers:source.maxLayers??R.maxLayers,initialNeurons:source.initialNeurons??[],initialConnections:source.initialConnections??R.initialConnections};
 if(!Number.isSafeInteger(result.maxNeurons)||result.maxNeurons<0||result.maxNeurons>R.technicalNeurons||!Number.isSafeInteger(result.maxLayers)||result.maxLayers<0||result.maxLayers>R.technicalLayers)throw new Error('Неверные пределы блока '+key);
 return result;
}
export function randomModularBrain(random,settings,randomDag,encodePair){
 const graphs={};for(const spec of MODULAR_GRAPH_SPECS){const s=moduleLimits(settings,spec.key),g=randomDag(spec.inputs,spec.outputs,s.initialNeurons,s.initialConnections,random);if(g.layers.length>s.maxNeurons||Math.max(0,...g.layers)>s.maxLayers)throw new Error('Начальная структура превышает предел блока '+spec.key);graphs[spec.key]=g;}
 const regulators=MODULAR_MUTATION_GROUPS.flatMap(key=>{const p=settings.initialMutation?.[key];if(NUMERIC_MUTATION_GROUPS.includes(key)){const n=numericMutationProfile(p?.shape??D.shape,p?.ceiling??D.ceiling);return [n.shape,n.ceiling];}return encodePair(p?.rate??D.rate,p?.strength??D.strength);});
 return packModularBrain({graphs,traits:Array.from({length:12},()=>(random.next()-.5)*5),body:careGeneValues(settings.bodyGenes??{}),regulators});
}
/** Профили сняты с родителя до любых изменений. Числовая и структурная
 * части независимы; выключенный блок сохраняет также свои регуляторы. */
export function mutateModularBrain(d,profiles,random,settings,mutateTopology,encodePair){
 const enabled=key=>settings.mutationEnabled?.[key]!==false,domain={min:-R.weightLimit,max:R.weightLimit};
 const change=(v,key,scale=N.weightScale,bounds=domain)=>enabled(key)?mutateNumeric(v,scale,profiles[key],random,bounds):v;
 for(const spec of MODULAR_GRAPH_SPECS){const g=d.graphs[spec.key],key=graphWeightGroup(spec.key);g.biases=g.biases.map(v=>change(v,key));for(const e of g.edges)e.weight=change(e.weight,key);}
 d.traits=d.traits.map(v=>change(v,'behavior',N.traitScale));for(const [key,f]of Object.entries(CARE_GENE_FIELDS))d.body[key]=change(d.body[key],'behavior',Math.abs(f.value),f);
 for(let j=0;j<MODULAR_MUTATION_GROUPS.length;j++){const key=MODULAR_MUTATION_GROUPS[j];if(!enabled(key))continue;const parent=profiles[key],behavior=profiles.behavior;
  if(NUMERIC_MUTATION_GROUPS.includes(key)){d.regulators[2*j]=mutateNumeric(parent.shape,N.shapeScale,behavior,random,{min:0,exclusiveMin:true});d.regulators[2*j+1]=mutateNumeric(parent.ceiling,N.ceilingScale,behavior,random,{min:N.ceilingMin,max:N.ceilingMax});}
  else d.regulators.splice(2*j,2,...encodePair(mutateNumeric(parent.rate,N.traitScale,behavior,random,{min:R.rateFloor,max:1}),mutateNumeric(parent.strength,N.traitScale,behavior,random,{min:R.strengthFloor})));
 }
 if(settings.structuralMutations!==false)for(const spec of MODULAR_GRAPH_SPECS){const key=graphStructureGroup(spec.key),p=profiles[key];if(enabled(key)&&random.next()<p.rate){const s=moduleLimits(settings,spec.key);mutateTopology(d.graphs[spec.key],p.strength,random,s.maxNeurons,s.maxLayers);}}
 return packModularBrain(d);
}
