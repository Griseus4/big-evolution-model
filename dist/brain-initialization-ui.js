import {INITIAL_NEURONS,initialLayerCounts,initialConnectionBudget} from './brain-initialization.js';
/** Общая горизонтальная форма для мира, условий и значений фактора опыта.
 * Здесь нет RNG; изменение формы не меняет уже созданных жителей. */
export function initialNeuronsInput(doc,value=INITIAL_NEURONS,getLimits=()=>({maxNeurons:64,maxLayers:4})){
 const make=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;},host=make('div'),scroll=make('div'),table=make('table'),summary=make('p');
 host.className='initial-brain-control';scroll.className='initial-brain-scroll';table.className='initial-brain-table';summary.className='note';scroll.append(table);host.append(scroll,summary);
 let values=[],inputs=[],disabled=false;
 const limits=()=>getLimits(),raw=()=>(inputs.length?inputs.map(i=>i.value):values).map(v=>String(v).trim()===''?NaN:Number(v));
 host.readSetting=()=>initialLayerCounts(raw(),limits().maxNeurons,limits().maxLayers);
 host.refresh=()=>{
  const cap=limits(),next=raw();values=next;
  if(Number.isSafeInteger(cap.maxLayers)&&cap.maxLayers>=0&&cap.maxLayers<=16){
   const columns=Math.max(cap.maxLayers,next.findLastIndex(n=>n!==0)+1),head=make('tr'),body=make('tr');head.append(make('th','Слой'));body.append(make('th','Нейроны'));inputs=[];
   for(let j=0;j<columns;j++){head.append(make('th',String(j+1)));const cell=make('td'),input=make('input');input.type='number';input.min=0;input.max=cap.maxNeurons;input.step=1;input.value=next[j]??0;input.disabled=disabled;input.setAttribute('aria-label',`Слой ${j+1}: скрытых нейронов`);cell.append(input);body.append(cell);inputs.push(input);input.addEventListener('input',updateSummary);}
   table.replaceChildren(head,body);
  }
  for(const input of inputs)input.max=cap.maxNeurons;updateSummary();
 };
 function updateSummary(){
  const cap=limits(),a=raw();let error='';try{host.readSetting();}catch(e){error=e.message;}
  const total=a.reduce((sum,n)=>sum+n,0),depth=a.filter(n=>n>0).length;
  summary.textContent=error||`${total} из ${cap.maxNeurons} нейронов · ${depth} из ${cap.maxLayers} слоёв. Нулевые столбцы пропускаются.`;summary.className=error?'error':'note';
  for(const input of inputs)input.setCustomValidity?.(error);
 }
 Object.defineProperty(host,'value',{get:()=>JSON.stringify(inputs.length?inputs.map(i=>i.value):values),set:value=>{values=value===''?[]:value==null?INITIAL_NEURONS.slice():typeof value==='string'?JSON.parse(value):value.slice();inputs=[];host.refresh();}});
 host.setDisabled=value=>{disabled=value;for(const input of inputs)input.disabled=value;};
 host.value=value;return host;
}
export function wireInitialStructure(neurons,percent,maxNeurons,maxLayers,{onChange=()=>{},isGenome=()=>false}={}){
 const doc=neurons.ownerDocument??globalThis.document,note=doc.createElement('p');note.className='note';neurons.append(note);
 function refresh(rebuild=false){
  if(rebuild)neurons.refresh();const imported=isGenome();neurons.setDisabled(imported);percent.disabled=imported;
  if(imported){note.textContent='Геном из файла задаёт свою структуру; начальные нейроны и связность не применяются.';return;}
  try{const counts=neurons.readSetting(),budget=initialConnectionBudget(counts);percent.max=budget.maxPercent;
   const actual=initialConnectionBudget(counts,String(percent.value).trim()===''?NaN:Number(percent.value));note.textContent=`Связей: ${actual.count}. 100% = ${budget.base} соседних; максимум ${budget.maximum} (${budget.maxPercent.toLocaleString('ru-RU',{maximumFractionDigits:2})}%).`;percent.setCustomValidity?.('');
  }catch(e){note.textContent=e.message;percent.setCustomValidity?.(e.message);}
 }
 for(const cap of [maxNeurons,maxLayers])cap.addEventListener('change',()=>{refresh(true);onChange();});
 neurons.addEventListener('input',()=>{refresh();onChange();});percent.addEventListener('input',()=>{refresh();onChange();});
 refresh();return {refresh};
}
