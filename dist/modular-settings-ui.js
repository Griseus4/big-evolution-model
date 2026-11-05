import {MODULAR_GRAPH_SPECS} from './modular-brain-layout.js';
import {EVOLUTION_RULES as R} from './brain-evolution-rules.js';
import {initialNeuronsInput,wireInitialStructure} from './brain-initialization-ui.js';
import {structureSettingsTable} from './brain-settings-tables.js';
import {dagConnectionBudget} from './dual-brain-settings.js';
/** Только конфигурация следующей случайной популяции. Импортированная основа
 * сохраняет параметры; меняются лишь разрешённые пределы дальнейшего роста. */
export function modularSettingsUI(doc,host,isGenome){
 const inputs=new Map(),blocks=[];
 for(const spec of MODULAR_GRAPH_SPECS.filter(s=>!['context','attention'].includes(s.key))){
  const field=(key,min,max,value)=>{const n=doc.createElement('input');n.type='number';n.name='brainModules.'+spec.key+'.'+key;n.min=min;n.max=max;n.step=1;n.value=value;inputs.set(n.name,n);return n;};
  const neurons=field('maxNeurons',0,R.technicalNeurons,R.maxNeurons),layers=field('maxLayers',0,R.technicalLayers,R.maxLayers),percent=field('initialConnections',0,1e6,R.initialConnections);percent.step='any';
  const initial=initialNeuronsInput(doc,[],()=>({maxNeurons:Number(neurons.value),maxLayers:Number(layers.value)}));inputs.set('brainModules.'+spec.key+'.initialNeurons',initial);
  host.append(structureSettingsTable(doc,spec.label,neurons,layers,initial,percent));const controls=wireInitialStructure(initial,percent,neurons,layers,{isGenome,connectionBudget:(counts,p=100)=>dagConnectionBudget(spec.inputs,spec.outputs,counts,p)});
  blocks.push({spec,neurons,layers,percent,initial,controls});
 }
 return {inputs,refresh:()=>blocks.forEach(b=>b.controls.refresh(true)),read:()=>Object.fromEntries(blocks.map(b=>[b.spec.key,{maxNeurons:Number(b.neurons.value),maxLayers:Number(b.layers.value),initialNeurons:b.initial.readSetting(),initialConnections:Number(b.percent.value)}]))};
}
