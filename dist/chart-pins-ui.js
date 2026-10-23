import {chartSettings,chartContext,validateChartPins} from './chart-context.js';
const labels={period:'Период рождения, Т',width:'Ширина временного интервала, Т',mode:'Состояние жизней',origin:'Происхождение'};
export function installChartPins({root,host,getDefinition,getCommon}){
 const make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;},rows=make('div'),add=make('select'),title=make('label','Закрепить настройку');title.append(add);add.name='catalogue-pin-add';add.setAttribute('aria-label','Закрепить настройку графика');host.append(make('p','Без закреплений график использует общую панель. Удаление закрепления возвращает наследование.'),rows,title);let inputs=new Map();
 function read(){const pins={};for(const [key,fields]of inputs){const number=n=>n.value.trim()===''?NaN:Number(n.value);pins[key]=key==='period'?{start:number(fields[0]),end:number(fields[1])}:key==='width'?number(fields[0]):fields[0].value;}return pins;}
 function render(pins){
  const allowed=chartSettings(getDefinition());inputs=new Map();rows.replaceChildren();
  for(const key of allowed)if(pins[key]!==undefined){const row=make('div');row.className='catalogue-pin-row';row.append(make('strong',labels[key]));const fields=[];
   const field=(name,value,choices)=>{const input=make(choices?'select':'input'),label=make('label',name);input.name='pin-'+key+(name==='От'?'-start':name==='До'?'-end':'');input.setAttribute('aria-label',labels[key]+': '+name);if(choices)for(const [value,text]of choices){const o=make('option',text);o.value=value;input.append(o);}else{input.type='number';input.min=key==='period'&&name==='От'?0:1;input.step=1;}input.value=String(value);label.append(input);row.append(label);fields.push(input);};
   if(key==='period'){field('От',pins[key].start);field('До',pins[key].end);}else if(key==='width')field('Значение',pins[key]);else field('Значение',pins[key],key==='mode'?[['dead','Только завершённые'],['observed','Включая прожитую часть живых']]:[['all','Все'],['founders','Основатели'],['descendants','Потомки']]);
   inputs.set(key,fields);const remove=make('button','Использовать общую настройку');remove.type='button';remove.addEventListener('click',()=>{const next=read();delete next[key];render(next);});row.append(remove);rows.append(row);
  }
  add.replaceChildren(...[['','Добавить закрепление…'],...allowed.filter(k=>pins[k]===undefined).map(k=>[k,labels[k]])].map(([value,text])=>{const o=make('option',text);o.value=value;return o;}));add.value='';add.disabled=allowed.every(k=>pins[k]!==undefined);
 }
 add.addEventListener('change',()=>{const key=add.value;if(!key)return;const common=chartContext(getDefinition(),getCommon()),pins=read();pins[key]=key==='period'?{start:common.start,end:common.end}:common[key];render(pins);});
 return {fill:render,refresh:()=>render(read()),read:()=>validateChartPins(read(),getDefinition())};
}
