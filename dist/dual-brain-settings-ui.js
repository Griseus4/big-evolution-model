import {initialNeuronsInput,wireInitialStructure} from './brain-initialization-ui.js';
import {dagConnectionBudget} from './dual-brain-settings.js';
import {ATTENTION_INPUTS} from './dual-brain-layout.js';
import {EVOLUTION_RULES as R,MUTATION_GROUPS} from './brain-evolution-rules.js';
import {mutationSettingsTable,structureSettingsTable} from './brain-settings-tables.js';
/** Только форма следующего запуска; пустые p/s оставляют случайный диапазон. */
export function dualBrainSettingsUI(doc,host,isGenome=()=>false){
 const panel=doc.createElement('div');panel.className='dual-brain-settings';const inputs=new Map();
 const field=(key,min,max,value)=>{const n=doc.createElement('input');n.type='number';n.min=min;n.max=max;n.step='any';n.value=value??'';n.name=key;inputs.set(key,n);return n;};
 const neurons=field('attentionMaxNeurons',0,R.technicalNeurons,R.maxNeurons),layers=field('attentionMaxLayers',0,R.technicalLayers,R.maxLayers);neurons.step=layers.step=1;
 const initial=initialNeuronsInput(doc,[],()=>({maxNeurons:Number(neurons.value),maxLayers:Number(layers.value)}));inputs.set('attentionInitialNeurons',initial);
 const percent=field('attentionInitialConnections',0,1e6,R.initialConnections);
 panel.append(structureSettingsTable(doc,'Малый мозг',neurons,layers,initial,percent));
 const controls=wireInitialStructure(initial,percent,neurons,layers,{isGenome,connectionBudget:(counts,p=100)=>dagConnectionBudget(ATTENTION_INPUTS,1,counts,p)});
 for(const key of MUTATION_GROUPS){const toggle=doc.createElement('input');toggle.type='checkbox';toggle.checked=true;inputs.set('mutationEnabled.'+key,toggle);
  field('initialMutation.'+key+'.rate',R.rateFloor*100,100);field('initialMutation.'+key+'.strength',R.strengthFloor,Number.MAX_VALUE);
 }
 const mutations=doc.createElement('fieldset'),legend=doc.createElement('legend');legend.textContent='Мутации основателей';mutations.append(legend,mutationSettingsTable(doc,inputs));
 const note=doc.createElement('p');note.className='note';note.textContent=`Пустые поля: вероятность ${100*R.initialRateMin}–${100*R.initialRateMax}%, сила ${R.initialStrengthMin}–${R.initialStrengthMax}. Выключение сохраняет веса, структуру и регуляторы при рождении; личное обучение задаётся отдельно.`;mutations.append(note);panel.append(mutations);host.append(panel);
 return {inputs,refresh:()=>{controls.refresh();for(const [key,n]of inputs)if(key.startsWith('initialMutation.'))n.disabled=isGenome();},read:()=>{
  const result={attentionMaxNeurons:Number(neurons.value),attentionMaxLayers:Number(layers.value),mutationEnabled:Object.fromEntries(MUTATION_GROUPS.map(key=>[key,inputs.get('mutationEnabled.'+key).checked]))};
  if(!isGenome()){
   Object.assign(result,{attentionInitialNeurons:initial.readSetting(),attentionInitialConnections:Number(percent.value)});
   const initialMutation={};for(const key of MUTATION_GROUPS){const values={};for(const name of ['rate','strength']){const input=inputs.get('initialMutation.'+key+'.'+name);if(String(input.value).trim()!=='')values[name]=Number(input.value)/(name==='rate'?100:1);}if(Object.keys(values).length)initialMutation[key]=values;}
   if(Object.keys(initialMutation).length)result.initialMutation=initialMutation;
  }return result;
 }};
}
