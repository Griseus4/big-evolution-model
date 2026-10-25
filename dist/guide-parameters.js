/** Именованные привязки пособия. Читают только принятые настройки;
 * отсутствующее значение не подменяется настройкой нового мира. */
import {RULES} from './evolution.js';
import {REPRODUCTION_DEFAULTS,reproductionProfile} from './reproduction.js';
import {guideSourceUrl} from './project-guide-search.js';

export const GUIDE_PARAMETERS=Object.freeze({
 digestionTime:{label:'Усвоение одной порции',unit:'Т',file:'evolution.js',symbol:'validateDigestionTime',default:()=>RULES.foodEnergy/RULES.digestionRate,read:s=>s.digestionTime},
 maturity:{label:'Возраст начала родов',unit:'Т',file:'reproduction.js',symbol:'reproductionProfile',default:()=>REPRODUCTION_DEFAULTS.maturity,read:s=>s.reproduction?.maturity},
 birthEnergy:{label:'Энергия для начала родов',unit:'',file:'reproduction.js',symbol:'reproductionProfile',default:()=>REPRODUCTION_DEFAULTS.energy,read:s=>s.reproduction?.energy},
 birthHealth:{label:'Здоровье для начала родов',unit:'',file:'reproduction.js',symbol:'reproductionProfile',default:()=>REPRODUCTION_DEFAULTS.health,read:s=>s.reproduction?.health},
 birthInterval:{label:'Интервал после родов',unit:'Т',file:'reproduction.js',symbol:'reproductionProfile',default:()=>REPRODUCTION_DEFAULTS.birthInterval,read:s=>s.reproduction?.birthInterval},
});
const format=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4});
export function guideParameterValue(key,settings=null){
 const spec=GUIDE_PARAMETERS[key];if(!spec)return null;
 let accepted=settings;
 // Старые профили мира тоже имеют явный ID; объект с пропусками не дополняем.
 if(typeof settings?.reproduction==='string')accepted={...settings,reproduction:reproductionProfile(settings.reproduction)};
 const n=accepted===null?spec.default():spec.read(accepted);
 return typeof n==='number'&&Number.isFinite(n)?n:null;
}
export function formatGuideParameter(key,settings=null){const n=guideParameterValue(key,settings),unit=GUIDE_PARAMETERS[key]?.unit;return n===null?'нет данных':format.format(n)+(unit?' '+unit:'');}

export function installGuideParameters({root,getWorld=()=>null,getVariants=()=>[]}={}){
 const select=root.getElementById('guide-context'),note=root.getElementById('guide-context-note'),rows=root.getElementById('guide-parameter-rows');
 if(!select||!note||!rows)return {refresh(){}};
 let signature='',contexts=[];
 const make=(tag,text)=>{const n=root.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function refresh(){
  const world=getWorld(),variants=getVariants()??[];
  contexts=[{id:'defaults',label:'По умолчанию',settings:null},{id:'world',label:'Основной мир',settings:world??{}}];
  for(const v of variants)contexts.push({id:'variant:'+v.id,label:'Опыт: '+v.name,settings:v.settings??{}});
  const optionsKey=JSON.stringify(contexts.map(c=>[c.id,c.label]));
  if(optionsKey!==signature){const previous=select.value;select.replaceChildren(...contexts.map(c=>{const o=make('option',c.label);o.value=c.id;return o;}));select.value=contexts.some(c=>c.id===previous)?previous:'defaults';signature=optionsKey;}
  const context=contexts.find(c=>c.id===select.value)??contexts[0];
  note.textContent=context.id==='defaults'?'Базовые значения нового мира. Выбор здесь меняет только пособие.':'Принятые настройки: '+context.label+'. Черновик плана не используется. Пропуски показаны как «нет данных».';
  for(const node of root.querySelectorAll('[data-guide-param]'))node.textContent=formatGuideParameter(node.dataset.guideParam,context.settings);
  rows.replaceChildren(...Object.entries(GUIDE_PARAMETERS).map(([key,spec])=>{
   const row=make('tr'),name=make('th',spec.label),value=make('td',formatGuideParameter(key,context.settings)),cell=make('td'),link=make('a',spec.symbol);
   name.scope='row';value.className='guide-value';link.href=guideSourceUrl(spec.file);link.dataset.help='guide-code-index';link.target='_blank';link.rel='noopener';cell.append(link);row.append(name,value,cell);return row;
  }));
 }
 select.addEventListener('change',refresh);refresh();return {refresh};
}
