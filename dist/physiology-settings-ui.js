import {SUBSTEPS} from './action-timing.js';
import {PHYSIOLOGY_FIELD_GROUPS} from './physiology-field-groups.js';
import {CARE_GENE_FIELDS,careGeneValues} from './care-settings.js';
import {PHYSIOLOGY_FIELDS,BODY_GENE_FIELDS,physiologySettings,bodyGeneValues} from './physiology-settings.js';
import {bodyPlan,createBody,bodyCapacities,bodySpeed} from './body-physiology.js';
import {createHelpButton} from './help.js';
import {formatStatistic} from './statistics-format.js';
/** Поля происходят из того же реестра, что валидация физики. Производные
 * только читаются: пользователь не задаёт отдельно массу/энергию/желудок. */
export function physiologySettingsUI(doc,host){
 const inputs=new Map(),make=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function appendFields(host,prefix,fields,keys){
  const table=make('table');table.className='brain-settings-table';host.append(table);
  for(const key of keys){const f=fields[key],n=make('input');n.type='number';n.step=f.unit==='подшаги'?1:'any';n.min=f.exclusiveMin&&f.min===0?Number.MIN_VALUE:f.min;if(Number.isFinite(f.max))n.max=f.max;n.value=f.value;n.setAttribute('aria-label',f.label);inputs.set(prefix+'.'+key,n);
   const row=make('tr'),label=make('th'),cell=make('td'),unit=make('td',f.unit);label.append(createHelpButton(prefix+'.'+key,f.label,doc));cell.append(n);row.append(label,cell,unit);table.append(row);
   if(f.unit==='подшаги'){const refreshUnit=()=>{unit.textContent=`${f.unit} (${formatStatistic(Number(n.value)/SUBSTEPS,3)} Т)`;};n.addEventListener('input',refreshUnit);refreshUnit();}
  }
 }
 const body=make('details');body.className='physiology-settings';body.append(make('summary','Тело и пищеварение основателей'),make('p','Стартовые наследуемые значения. У потомков меняются числовой мутацией поведенческих свойств. Подпись каждого параметра открывает пояснение.'));appendFields(body,'bodyGenes',CARE_GENE_FIELDS,Object.keys(CARE_GENE_FIELDS));host.append(body);
 const world=make('details');world.className='physiology-settings';world.append(make('summary','Физические правила мира'),make('p','Общие правила следующего запуска. Раскройте нужную группу; подписи поясняют последствия увеличения и уменьшения. Время показано в подшагах и Т, ставки энергии — за Т.'));
 for(const group of PHYSIOLOGY_FIELD_GROUPS){const section=make('details');section.className='physiology-settings-group';section.dataset.physiologyGroup=group.id;section.append(make('summary',group.title));appendFields(section,'physiology',PHYSIOLOGY_FIELDS,group.keys);world.append(section);}host.append(world);
 const derived=make('p');derived.className='note';host.append(derived);
 const read=()=>{const result={physiology:{},bodyGenes:{}};for(const [path,n]of inputs){const [group,key]=path.split('.');result[group][key]=Number(n.value);}result.physiology=physiologySettings(result.physiology);result.bodyGenes=careGeneValues(result.bodyGenes);return {...result,genomeVersion:20};};
 const refresh=()=>{try{const s=read(),p=bodyPlan(s.bodyGenes),a=createBody(p,s.physiology),c=bodyCapacities(a,s.physiology),f=v=>formatStatistic(v,3);derived.textContent=`Основатель: масса ${f(a.L)}, энергия ${f(a.energy)} из ${f(c.energy)}, здоровье ${f(c.health)}, желудок ${f(c.volume)} порции. Скорость ${f(bodySpeed(a,s.physiology))} гекса/Т. Плановая масса ребёнка ${f(p.birthMass)}.`;}catch(e){derived.textContent=e.message;}};
 for(const input of inputs.values())input.addEventListener('input',refresh);refresh();return {inputs,read,refresh};
}
