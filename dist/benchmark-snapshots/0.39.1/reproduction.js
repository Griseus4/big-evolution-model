/** Варианты нужны для контролируемого опыта, не для оценки «правильной» жизни.
 * В новой модели только решение политики; автоматизм оставлен для чтения истории.
 * Последовательность четырёх вариантов отделяет выбор, энергию и здоровье.
 */
export const REPRODUCTION_PROFILES=Object.freeze([
 {id:'choice-50-40-v1',label:'Выбор · энергия 50 · здоровье 40',automatic:false,energy:50,health:40},
 {id:'automatic-86-55-v1',label:'Контроль: автоматически · 86 / 55',automatic:true,energy:86,health:55},
 {id:'choice-86-55-v1',label:'Контроль: выбор · 86 / 55',automatic:false,energy:86,health:55},
 {id:'choice-50-55-v1',label:'Контроль: выбор · 50 / 55',automatic:false,energy:50,health:55},
]);
export function reproductionLabel(id){return REPRODUCTION_PROFILES.find(p=>p.id===id)?.label??'Прежнее автоматическое размножение';}
export function reproductionSummary(c){return `Мог родить ${c.eligible} из ${c.decisions} решений; выбрал ${c.chosen}, рождений ${c.births}. Недоступность: ${Object.entries(c.blocked).map(([k,v])=>`${BIRTH_BLOCK_LABELS[k]} ${v}`).join(' · ')}. Причины могут совпадать.`;}
export const DEFAULT_REPRODUCTION=REPRODUCTION_PROFILES[0].id;
export const REPRODUCTION_DEFAULTS=Object.freeze({energy:50,health:40,maturity:90,birthInterval:100});
export function reproductionProfile(id=DEFAULT_REPRODUCTION){
 if(id&&typeof id==='object'){
  const value={...REPRODUCTION_DEFAULTS,...id};
  if(value.automatic)throw new Error('Автоматическое размножение недоступно.');
  for(const key of ['energy','health'])if(!Number.isFinite(value[key])||value[key]<0||value[key]>100)throw new Error('Пороги размножения: от 0 до 100.');
  for(const key of ['maturity','birthInterval'])if(!Number.isFinite(value[key])||value[key]<0||value[key]>1000000)throw new Error('Сроки размножения: от 0 до 1 000 000 Т.');
  return value;
 }
 const profile=REPRODUCTION_PROFILES.find(p=>p.id===id);
 if(!profile)throw new Error('Неизвестный вариант размножения.');return {...REPRODUCTION_DEFAULTS,...profile};
}
export const BIRTH_BLOCK_LABELS={energy:'энергия',health:'здоровье',immature:'возраст до зрелости',interval:'интервал',limit:'лимит живых',terminal:'предел жизни',inProgress:'идут роды'};
export function reproductionCounters(){return {decisions:0,eligible:0,chosen:0,births:0,
 blocked:Object.fromEntries(Object.keys(BIRTH_BLOCK_LABELS).filter(k=>k!=='inProgress').map(k=>[k,0]))};}
