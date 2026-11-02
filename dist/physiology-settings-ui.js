import {PHYSIOLOGY_FIELDS,BODY_GENE_FIELDS,physiologySettings,bodyGeneValues} from './physiology-settings.js';
import {bodyPlan,createBody,bodyCapacities,bodySpeed} from './body-physiology.js';
import {createHelpButton} from './help.js';
import {formatStatistic} from './statistics-format.js';
/** Поля происходят из того же реестра, что валидация физики. Производные
 * только читаются: пользователь не задаёт отдельно массу/энергию/желудок. */
export function physiologySettingsUI(doc,host){
 const inputs=new Map(),make=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 for(const [prefix,title,fields]of [['bodyGenes','Тело и пищеварение основателей',BODY_GENE_FIELDS],['physiology','Физические правила мира',PHYSIOLOGY_FIELDS]]){
  const details=make('details'),summary=make('summary',title),table=make('table');details.className='physiology-settings';table.className='brain-settings-table';details.append(summary);
  const note=make('p',prefix==='bodyGenes'?'Эти значения получают случайные основатели. У потомков они наследуются и меняются числовой мутацией поведенческих свойств.':'Общие правила действуют на всех жителей этого мира. Они не являются генами.');note.className='note';details.append(note,table);
  for(const [key,f]of Object.entries(fields)){
   const n=make('input');n.type='number';n.step=f.unit==='подшаги'?1:'any';n.min=f.exclusiveMin&&f.min===0?Number.MIN_VALUE:f.min;if(Number.isFinite(f.max))n.max=f.max;n.value=f.value;n.setAttribute('aria-label',f.label);inputs.set(prefix+'.'+key,n);
   const row=make('tr'),label=make('th'),cell=make('td');label.append(createHelpButton(prefix+'.'+key,f.label,doc));label.title=`${f.label}. Единица: ${f.unit}. ${prefix==='bodyGenes'?'Наследуемое стартовое значение.':'Общий параметр мира.'}`;cell.append(n);row.append(label,cell,make('td',f.unit));table.append(row);
  }
  host.append(details);
 }
 const derived=make('p');derived.className='note';host.append(derived);
 const read=()=>{const result={physiology:{},bodyGenes:{}};for(const [path,n]of inputs){const [group,key]=path.split('.');result[group][key]=Number(n.value);}result.physiology=physiologySettings(result.physiology);result.bodyGenes=bodyGeneValues(result.bodyGenes);return {...result,genomeVersion:18};};
 const refresh=()=>{try{const s=read(),p=bodyPlan(s.bodyGenes),a=createBody(p,s.physiology),c=bodyCapacities(a,s.physiology),f=v=>formatStatistic(v,3);derived.textContent=`Основатель: масса ${f(a.L)}, энергия ${f(a.energy)} из ${f(c.energy)}, здоровье ${f(c.health)}, желудок ${f(c.volume)} порции. Скорость ${f(bodySpeed(a,s.physiology))} гекса/Т. Плановая масса ребёнка ${f(p.birthMass)}.`;}catch(e){derived.textContent=e.message;}};
 for(const input of inputs.values())input.addEventListener('input',refresh);refresh();return {inputs,read,refresh};
}
