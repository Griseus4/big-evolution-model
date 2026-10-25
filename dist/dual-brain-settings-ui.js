import {initialNeuronsInput,wireInitialStructure} from './brain-initialization-ui.js';
import {dagConnectionBudget} from './dual-brain-settings.js';
import {ATTENTION_INPUTS} from './dual-brain-layout.js';
import {EVOLUTION_RULES as R,MUTATION_GROUPS,MUTATION_LABELS} from './brain-evolution-rules.js';
/** Настройки основателей читаются перед созданием мира, не меняют живую сеть.
 * Пустые поля регуляторов оставляют согласованные случайные диапазоны. */
export function dualBrainSettingsUI(doc,host,isGenome=()=>false){
 const panel=doc.createElement('fieldset'),legend=doc.createElement('legend');panel.className='dual-brain-settings common-fields';legend.textContent='Малый мозг и мутации основателей';panel.append(legend);
 const field=(text,min,max,value)=>{const label=doc.createElement('label'),span=doc.createElement('span'),input=doc.createElement('input');span.textContent=text;input.type='number';input.min=min;input.max=max;input.step='any';input.value=value??'';label.append(span,input);panel.append(label);return input;};
 const neurons=field('Малый мозг: предел скрытых нейронов',0,R.technicalNeurons,R.maxNeurons),layers=field('Малый мозг: предел скрытых слоёв',0,R.technicalLayers,R.maxLayers);
 neurons.step=layers.step=1;
 const initial=initialNeuronsInput(doc,[],()=>({maxNeurons:Number(neurons.value),maxLayers:Number(layers.value)}));panel.append(initial);
 const percent=field('Малый мозг: начальная связность, %',0,1e6,R.initialConnections);
 const controls=wireInitialStructure(initial,percent,neurons,layers,{isGenome,connectionBudget:(counts,p=100)=>dagConnectionBudget(ATTENTION_INPUTS,1,counts,p)});
 const mutation=new Map(),enabled=new Map();
 for(const key of MUTATION_GROUPS){
  const title=MUTATION_LABELS[key],label=doc.createElement('label'),toggle=doc.createElement('input'),span=doc.createElement('span');
  toggle.type='checkbox';toggle.checked=true;span.textContent=title+': мутации потомков';
  label.title='Выключение сохраняет веса, структуру и регуляторы блока при рождении. Личное обучение задаётся отдельно.';
  label.append(toggle,span);panel.append(label);enabled.set(key,toggle);mutation.set(key,{
  rate:field(title+': начальная вероятность мутации, % (пусто: 1–5)',R.rateFloor*100,100),
  strength:field(title+': начальная сила (пусто: 0,05–0,2)',R.strengthFloor,Number.MAX_VALUE)});
 }
 host.append(panel);
 return {refresh:()=>{controls.refresh();for(const group of mutation.values())for(const input of Object.values(group))input.disabled=isGenome();},read:()=>{
  const result={attentionMaxNeurons:Number(neurons.value),attentionMaxLayers:Number(layers.value),mutationEnabled:Object.fromEntries(MUTATION_GROUPS.map(key=>[key,enabled.get(key).checked]))};
  if(!isGenome()){
   Object.assign(result,{attentionInitialNeurons:initial.readSetting(),attentionInitialConnections:Number(percent.value)});
   const initialMutation={};for(const key of MUTATION_GROUPS){const values={};for(const [name,input]of Object.entries(mutation.get(key)))if(input.value.trim()!=='')values[name]=Number(input.value)/(name==='rate'?100:1);if(Object.keys(values).length)initialMutation[key]=values;}
   if(Object.keys(initialMutation).length)result.initialMutation=initialMutation;
  }
  return result;
 }};
}
