/** Один каталог общих условий и факторов. Редактор и проверка сочетаний
 * используют те же типы/границы; зависимые ограничения проверяет мир. */
export const EXPERIMENT_FIELDS=Object.freeze([
 ['Мир','population','Основателей',1,1000,1],['Мир','limit','Лимит живых',1,1000,1],
 ['Возможности','memory','Память мест','check'],['Возможности','learning','Личное обучение','check'],['Возможности','mutations','Мутации потомков','check'],
 ['Размножение','reproduction.energy','Энергия для начала родов',0,100,.1],['Размножение','reproduction.health','Здоровье для начала родов',0,100,.1],['Размножение','reproduction.maturity','Возраст зрелости, Т',0,1000000,.1],['Размножение','reproduction.birthInterval','Интервал между рождениями, Т',0,1000000,.1],
 ['Пища на старте','foodSources','Количество источников',0,384,1],['Пища на старте','foodRegrowInterval','Средний период, Т',.1,1e9,.1],['Пища на старте','foodIslandCount','Количество островков',0,384,1],['Пища на старте','foodSizeSpread','Разброс размеров, %',0,90,1],['Пища на старте','foodPeriodSpread','Разброс периодов, %',0,90,1],['Пища на старте','foodCapacityMin','Минимальная вместимость',1,24,1],['Пища на старте','foodCapacityMax','Максимальная вместимость',1,24,1],
 ['Изменение пищи','automaticEnvironment.enabled','Автоматическое изменение пищи','check'],['Изменение пищи','automaticEnvironment.targetSources','Целевое число источников',1,384,1],['Изменение пищи','automaticEnvironment.targetPeriod','Целевой средний период, Т',.1,1e9,.1],['Изменение пищи','automaticEnvironment.minimumRate','Минимальная выработка, порций/Т',Number.MIN_VALUE,3840,'any'],['Изменение пищи','automaticEnvironment.maximumRate','Максимальная выработка, порций/Т',Number.MIN_VALUE,Number.MAX_VALUE,'any'],['Изменение пищи','automaticEnvironment.preparationInterval','Интервал пяти подготовительных событий, Т',1,1e9,1],['Изменение пищи','automaticEnvironment.randomInterval','Интервал последующих изменений, Т',1,1e9,1],
].map(Object.freeze));
export const settingAt=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
export function setSetting(o,path,value){const keys=path.split('.');let at=o;for(const key of keys.slice(0,-1))at=at[key]??={};at[keys.at(-1)]=value;}
export function settingInput(root,field,value){const input=root.createElement('input');input.type=field[3]==='check'?'checkbox':'number';if(input.type==='checkbox')input.checked=Boolean(value);else{input.min=field[3];input.max=field[4];input.step=field[5];input.value=value??'';}return input;}
export const MAX_EXPERIMENT_COMBINATIONS=64;
/** Сначала считаем размер произведения, потом создаём условия: ошибочный
 * огромный план не выделяет массив миров/сочетаний. Никакого мирового RNG. */
export function factorDesign(input=[]){
 if(!Array.isArray(input)||input.length>EXPERIMENT_FIELDS.length)throw new Error('Нужен список изменяемых параметров.');
 const used=new Set();let count=1;
 const factors=input.map(f=>{const field=EXPERIMENT_FIELDS.find(d=>d[1]===f?.key);if(!field||used.has(f.key))throw new Error('Неизвестный или повторный параметр опыта.');used.add(f.key);
  if(!Array.isArray(f.values)||!f.values.length)throw new Error(`${field[2]}: выберите хотя бы одно значение.`);
  const values=f.values.slice();if(new Set(values).size!==values.length)throw new Error(`${field[2]}: значения повторяются.`);
  for(const v of values)if(field[3]==='check'?typeof v!=='boolean':!Number.isFinite(v)||v<field[3]||v>field[4]||field[5]===1&&!Number.isInteger(v))throw new Error(`${field[2]}: недопустимое значение.`);
  count*=values.length;return {key:f.key,values};
 });
 return {factors,count};
}
