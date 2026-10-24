import {EXPERIMENT_FACTOR_FIELDS as EXPERIMENT_FIELDS,settingAt,settingInput,factorDesign,MAX_EXPERIMENT_COMBINATIONS} from './experiment-fields.js';
import {readGenomeChoices} from './experiment-genomes.js';
import {PAGE_TEXT} from './ui-text.js';
/** Только редактор/схема. Дерево создаёт дочерние ветви при раскрытии,
 * не строит worlds × combinations × parameters узлов при каждом вводе. */
export function installExperimentDesign({root=document,readCommon,onChange=()=>{},onError=()=>{}}){
 const byId=id=>root.getElementById(id),make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;},rows=new Map(),picker=byId('constructor-factor-add');let treeKey=null;
 function refreshPicker(){picker.replaceChildren();const empty=make('option','Добавить изменение…');empty.value='';picker.append(empty);for(const group of new Set(EXPERIMENT_FIELDS.map(f=>f[0]))){const options=make('optgroup');options.label=group;for(const f of EXPERIMENT_FIELDS.filter(f=>f[0]===group&&!rows.has(f[1]))){const o=make('option',f[2]);o.value=f[1];options.append(o);}picker.append(options);}picker.value='';}
 function read(){if([...rows.values()].some(r=>r.loading))throw new Error('Дождитесь загрузки геномов.');return [...rows].map(([key,r])=>({key,values:r.field[3]==='genome'?r.genomes:r.field[3]==='check'?r.inputs.filter(i=>i.checked).map(i=>i.factorValue):r.inputs.map(i=>String(i.value).trim()===''?NaN:Number(i.value))}));}
 function changed(){onChange();}
 function add(key,values){
  if(rows.has(key))return;const field=EXPERIMENT_FIELDS.find(f=>f[1]===key);if(!field)return;
  const tr=make('tr'),name=make('th',`${field[0]} → ${field[2]}`),valuesCell=make('td'),actions=make('td'),valuesBox=make('div'),remove=make('button','Убрать');name.scope='row';valuesBox.className='factor-values';valuesCell.append(valuesBox);actions.append(remove);tr.append(name,valuesCell,actions);byId('constructor-factors').append(tr);
  const row={field,tr,inputs:[]};rows.set(key,row);
  if(field[3]==='genome'){
   row.genomes=values??[];
   const label=make('label','Добавить геномы (.json)'),input=make('input');input.type='file';input.accept='.json,application/json';input.multiple=true;input.setAttribute('aria-label','Добавить геномы в значения фактора');label.append(input);valuesCell.append(label);
   function render(){valuesBox.replaceChildren();for(const choice of row.genomes){const item=make('span'),del=make('button','×');item.className='factor-value';del.type='button';del.disabled=Boolean(row.loading);del.setAttribute('aria-label','Убрать геном: '+choice.name);item.append(make('span',choice.name),del);valuesBox.append(item);del.addEventListener('click',()=>{if(row.loading)return;row.genomes=row.genomes.filter(v=>v!==choice);render();changed();});}}
   input.addEventListener('change',async()=>{if(row.loading)return;const files=Array.from(input.files??[]);if(!files.length)return;row.loading=true;input.disabled=true;render();changed();try{const choices=await readGenomeChoices(files,row.genomes);if(rows.get(key)!==row)return;row.genomes=choices;onError('');}catch(error){if(rows.get(key)===row)onError(error.message);}finally{row.loading=false;input.disabled=false;input.value='';render();changed();}});render();
   valuesCell.append(make('p',PAGE_TEXT['factor-genome']));
  }
  else if(field[3]==='check')for(const value of [true,false]){const label=make('label',value?'Включено':'Выключено'),input=make('input');input.type='checkbox';input.checked=values?values.includes(value):true;input.factorValue=value;input.setAttribute('aria-label',`${field[2]}: ${label.textContent}`);label.className='check';label.append(input);valuesBox.append(label);row.inputs.push(input);input.addEventListener('change',changed);}
  else{
   const plus=make('button','+ Значение');plus.setAttribute('aria-label',`Добавить значение: ${field[2]}`);
   function valueInput(value){const wrap=make('span'),input=settingInput(root,field,value),del=make('button','×');wrap.className='factor-value';input.setAttribute('aria-label',field[2]);input.placeholder='Значение';del.setAttribute('aria-label',`Удалить значение: ${field[2]}`);wrap.append(input,del);valuesBox.append(wrap);row.inputs.push(input);input.addEventListener('input',changed);del.addEventListener('click',()=>{row.inputs=row.inputs.filter(i=>i!==input);wrap.remove();changed();});}
   for(const value of values??[settingAt(readCommon(),key)])valueInput(value);
   valuesCell.append(plus);plus.addEventListener('click',()=>{valueInput('');changed();row.inputs.at(-1).focus?.();});
   if(key.startsWith('founderSenses.'))valuesCell.append(make('p',PAGE_TEXT['factor-founder-senses']));
  }
  remove.addEventListener('click',()=>{rows.delete(key);tr.remove();refreshPicker();changed();});refreshPicker();
 }
 picker.addEventListener('change',()=>{if(picker.value){add(picker.value);changed();}});
 function preview({worlds,seeds}){
  const summary=byId('constructor-design-summary'),tree=byId('constructor-design-tree');
  try{
   const {factors,count}=factorDesign(read());if(!Number.isSafeInteger(worlds)||worlds<1||worlds>64||seeds.length!==worlds||new Set(seeds).size!==worlds||seeds.some(s=>!Number.isSafeInteger(s)||s<1||s>4294967295))throw new Error('Укажите число миров и столько же разных seed.');
   summary.textContent=`Сочетаний на seed: ${count} · основных миров: ${count*worlds} · запусков с повторами: до ${count*worlds*3}.`;
   if(count>MAX_EXPERIMENT_COMBINATIONS)throw new Error(`Получилось ${count} сочетаний на seed. Максимум ${MAX_EXPERIMENT_COMBINATIONS}; уменьшите число значений.`);
   summary.className='note';const key=JSON.stringify([seeds,factors.map(f=>[f.key,f.values.length])]);if(key===treeKey)return true;treeKey=key;tree.replaceChildren();
   const sizes=factors.map(f=>f.values.length),strides=sizes.map((_,i)=>sizes.slice(i+1).reduce((a,b)=>a*b,1));
   function branch(parent,index,offset){
    if(index===factors.length){parent.append(make('li',`Вариант ${offset+1} · до 3 попыток`));return;}
    const f=factors[index],field=EXPERIMENT_FIELDS.find(d=>d[1]===f.key);
    for(let i=0;i<f.values.length;i++){const li=make('li'),details=make('details'),title=make('summary',`${field[2]} · значение №${i+1}`),children=make('ul');let built=false;details.append(title,children);details.addEventListener('toggle',()=>{if(details.open&&!built){built=true;branch(children,index+1,offset+i*strides[index]);}});li.append(details);parent.append(li);}
   }
   for(const seed of seeds){const details=make('details'),title=make('summary',`Seed ${seed} · ${count} условий`),children=make('ul');let built=false;details.append(title,children);details.addEventListener('toggle',()=>{if(details.open&&!built){built=true;branch(children,0,0);}});tree.append(details);}return true;
  }catch(e){summary.textContent=e.message;summary.className='error';tree.replaceChildren();treeKey=null;return false;}
 }
 refreshPicker();return {read,preview,snapshot(){return [...rows].map(([key,r])=>({key,values:r.field[3]==='genome'?r.genomes:r.field[3]==='check'?r.inputs.filter(i=>i.checked).map(i=>i.factorValue):r.inputs.map(i=>i.value)}));},write(factors){rows.clear();byId('constructor-factors').replaceChildren();for(const f of factors)add(f.key,f.values);refreshPicker();treeKey=null;}};
}
