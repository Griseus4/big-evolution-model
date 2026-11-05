import {modularSettingsUI} from './modular-settings-ui.js';
import {MODULAR_DEFAULTS as D} from './modular-brain-layout.js';
import {MODULAR_MUTATION_GROUPS} from './brain-evolution-rules.js';
import {NUMERIC_MUTATION_GROUPS,NUMERIC_MUTATION_RULES as N} from './numeric-mutation.js';
import {ATTENTION_INPUTS as BODY_ATTENTION_INPUTS} from './care-brain-layout.js';
import {createHelpButton} from './help.js';
import {initialNeuronsInput,wireInitialStructure} from './brain-initialization-ui.js';
import {dagConnectionBudget} from './dual-brain-settings.js';
import {ATTENTION_INPUTS} from './dual-brain-layout.js';
import {EVOLUTION_RULES as R,MUTATION_GROUPS} from './brain-evolution-rules.js';
import {mutationSettingsTable,structureSettingsTable} from './brain-settings-tables.js';
/** Только форма следующего запуска; пустые p/s оставляют случайный диапазон. */
export function dualBrainSettingsUI(doc,host,isGenome=()=>false,{physiology=false}={}){
 const groups=physiology?MODULAR_MUTATION_GROUPS:MUTATION_GROUPS;
 const panel=doc.createElement('div');panel.className='dual-brain-settings';const inputs=new Map();
 const field=(key,min,max,value)=>{const n=doc.createElement('input');n.type='number';n.min=min;n.max=max;n.step='any';n.value=value??'';n.name=key;inputs.set(key,n);return n;};
 const neurons=field('attentionMaxNeurons',0,R.technicalNeurons,R.maxNeurons),layers=field('attentionMaxLayers',0,R.technicalLayers,R.maxLayers);neurons.step=layers.step=1;
 const initial=initialNeuronsInput(doc,[],()=>({maxNeurons:Number(neurons.value),maxLayers:Number(layers.value)}));inputs.set('attentionInitialNeurons',initial);
 const percent=field('attentionInitialConnections',0,1e6,R.initialConnections);
 panel.append(structureSettingsTable(doc,'Малый мозг',neurons,layers,initial,percent));
 const controls=wireInitialStructure(initial,percent,neurons,layers,{isGenome,connectionBudget:(counts,p=100)=>dagConnectionBudget(physiology?BODY_ATTENTION_INPUTS:ATTENTION_INPUTS,1,counts,p)});
 for(const key of groups){const toggle=doc.createElement('input');toggle.type='checkbox';toggle.checked=true;inputs.set('mutationEnabled.'+key,toggle);
  if(physiology&&NUMERIC_MUTATION_GROUPS.includes(key)){field('initialMutation.'+key+'.shape',Number.MIN_VALUE,Number.MAX_VALUE,D.shape);field('initialMutation.'+key+'.ceiling',N.ceilingMin,N.ceilingMax,D.ceiling);continue;}
  field('initialMutation.'+key+'.rate',R.rateFloor*100,100,physiology?D.rate*100:undefined);field('initialMutation.'+key+'.strength',R.strengthFloor,Number.MAX_VALUE,physiology?D.strength:undefined);
 }
 const modules=physiology?modularSettingsUI(doc,panel,isGenome):null;if(modules)for(const [key,n]of modules.inputs)inputs.set(key,n);
 const mutations=doc.createElement('fieldset'),legend=doc.createElement('legend');legend.append(createHelpButton('mutation-founders','Мутации: старт и потомки',doc));mutations.append(legend,mutationSettingsTable(doc,inputs,{groups}));
 const note=doc.createElement('p');note.className='note';note.textContent=physiology?'Числовые гены: A определяет распределение изменений, r — их относительный предел. Структурные p/s действуют отдельно. Выключенная группа сохраняет параметры и регуляторы при рождении.':`Пустые поля: вероятность ${100*R.initialRateMin}–${100*R.initialRateMax}%, сила ${R.initialStrengthMin}–${R.initialStrengthMax}. Выключение сохраняет веса, структуру и регуляторы при рождении; личное обучение задаётся отдельно.`;mutations.append(note);panel.append(mutations);host.append(panel);
 return {inputs,refresh:()=>{controls.refresh();modules?.refresh();for(const [key,n]of inputs)if(key.startsWith('initialMutation.'))n.disabled=isGenome();},read:()=>{
  const result={...(physiology?{brainModules:modules.read(),genomeVersion:20}:{}),attentionMaxNeurons:Number(neurons.value),attentionMaxLayers:Number(layers.value),mutationEnabled:Object.fromEntries(groups.map(key=>[key,inputs.get('mutationEnabled.'+key).checked]))};
  if(!isGenome()){
   Object.assign(result,{attentionInitialNeurons:initial.readSetting(),attentionInitialConnections:Number(percent.value)});
   const initialMutation={};for(const key of groups){const values={};for(const name of physiology&&NUMERIC_MUTATION_GROUPS.includes(key)?['shape','ceiling']:['rate','strength']){const input=inputs.get('initialMutation.'+key+'.'+name);if(String(input.value).trim()!=='')values[name]=Number(input.value)/(name==='rate'?100:1);}if(Object.keys(values).length)initialMutation[key]=values;}
   if(Object.keys(initialMutation).length)result.initialMutation=initialMutation;
  }return result;
 }};
}
