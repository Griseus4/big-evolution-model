import {DT,SUBSTEPS} from './action-timing.js';

/** Контракт нового тела. Метаданные используются редактором, опытами и пособием;
 * численные значения определяются здесь один раз. Техническая сетка не является геном. */
const field=(label,unit,value,min=0,max=Infinity,exclusiveMin=false,exclusiveMax=false)=>
 Object.freeze({label,unit,value,min,max,exclusiveMin,exclusiveMax});
export const PHYSIOLOGY_SCHEMA='tissue-food-pregnancy-v1';
export const BODY_GENE_FIELDS=Object.freeze({
 gmax:field('Строительная мощность','масса/Т',.15,0,Infinity,true),
 tAdult:field('Окно развития','Т',200,0,Infinity,true),
 kBirth:field('Плановая доля рождения','доля',.1,0,1,true,true),
 alpha:field('Возраст допуска зачатия / окно развития','доля',.5,0,1,true,true),
 tPreg:field('Вынашивание','Т',50,0,Infinity,true),
 tau:field('Удержание пищи','Т',20,0,Infinity,true),
 Fg:field('Мощность усвоения травы','доля ёмкости/подшаг',.00125),
 Ff:field('Мощность усвоения плодов','доля ёмкости/подшаг',.00025),
 Fm:field('Мощность усвоения мяса','доля ёмкости/подшаг',.00025),
});
export const PHYSIOLOGY_FIELDS=Object.freeze({
 referenceMass:field('Эталонная масса','масса',100/3,0,Infinity,true),
 organFraction:field('Сохраняемая доля рекордной массы','доля',.5,0,1,true),
 energyPerMass:field('Энергетическая ёмкость тканей','энергия/масса',.48,0,Infinity,true),
 healthPerMass:field('Здоровье тканей','здоровье/масса',3,0,Infinity,true),
 volumePerOrgan:field('Пищеварительная ёмкость органов','порции/масса',.18,0,Infinity,true),
 tissueEnergy:field('Энергия тканей','энергия/масса',2.4,0,Infinity,true),
 synthesisEfficiency:field('КПД синтеза тканей','доля',.8,0,1,true),
 catabolismEfficiency:field('КПД катаболизма','доля',.7,0,1,true),
 inventoryCapacity:field('Общий инвентарь','порции',3,0,Infinity,true),
 founderEnergyFraction:field('Запас энергии основателя','доля ёмкости',.68,0,1),
 newbornEnergyFraction:field('Запас энергии ребёнка','доля ёмкости',.5,0,1),
 grassEnergy:field('Энергия травы','энергия/порция',22,0,Infinity,true),
 fruitEnergy:field('Энергия плодов','энергия/порция',22,0,Infinity,true),
 meatEnergy:field('Энергия мяса','энергия/порция',2.4,0,Infinity,true),
 tissueRate:field('Содержание эталонных тканей','энергия/Т',.25),
 digestionRate:field('Содержание эталонного пищеварения','энергия/Т',.05),
 digestionReferenceVolume:field('Эталонная пищеварительная ёмкость','порции',3,0,Infinity,true),
 digestionReferencePower:field('Эталонная суммарная мощность','доля/подшаг',.00175,0,Infinity,true),
 moveRate:field('Добавка перемещения эталона','энергия/Т',.48),
 gatherRate:field('Добавка сбора эталона','энергия/Т',.36),
 eatRate:field('Добавка еды эталона','энергия/Т',.18),
 depositRate:field('Добавка выкладывания эталона','энергия/Т',.06),
 gatherSteps:field('Длительность сбора','подшаги',5,1,Number.MAX_SAFE_INTEGER),
 eatSteps:field('Длительность еды','подшаги',2,1,Number.MAX_SAFE_INTEGER),
 depositSteps:field('Длительность выкладывания','подшаги',3,1,Number.MAX_SAFE_INTEGER),
 birthSteps:field('Длительность родов','подшаги',20,1,Number.MAX_SAFE_INTEGER),
 attackSteps:field('Длительность атаки','подшаги',3,1,Number.MAX_SAFE_INTEGER),
 speedPeak:field('Пиковая скорость','клетки/Т',2/3,0,Infinity,true),
 speedDecline:field('Ширина правого спада скорости','эталонные массы',4,0,Infinity,true),
 speedRightFloor:field('Нижняя доля правой ветви скорости','доля пика',.1,0,1,true),
 attackDamage:field('Урон эталонной силы','здоровье',10),
 attackMoveFraction:field('Цена атаки / физическая цена перехода','доля',1/3),
 catabolismGrowthFactor:field('Катаболизм / строительная мощность','коэффициент',4),
 deficitDamage:field('Ущерб непокрытого дефицита','здоровье/энергия',4),
 growthThreshold:field('Порог запаса для роста','доля ёмкости',.8,0,1),
 healingPrice:field('Цена лечения','энергия/здоровье',.5,0,Infinity,true),
 healingReserve:field('Сохраняемый запас при лечении','доля ёмкости',.3,0,1),
 healingDeficitFraction:field('Доля дефицита здоровья за лечение','доля/подшаг',1/200,0,1),
 healingMinimumFraction:field('Минимальный шаг лечения','доля Hmax/подшаг',1/2000,0,1),
 remainsOrganFraction:field('Сохраняемые органы в останках','доля',.5,0,1),
 grassMin:field('Минимальный запас травы','порции',3),
 grassMax:field('Максимальный запас травы','порции',5),
 grassRegrowth:field('Восстановление травы','порции/Т',.1),
 meatHalfLife:field('Полураспад мяса','Т',1,0,Infinity,true),
 portionPerAction:field('Предел сбора и выкладывания за действие','порции',1,0,Infinity,true),
});
const defaults=fields=>Object.freeze(Object.fromEntries(Object.entries(fields).map(([key,f])=>[key,f.value])));
export const BODY_GENE_DEFAULTS=defaults(BODY_GENE_FIELDS);
export const PHYSIOLOGY_DEFAULTS=defaults(PHYSIOLOGY_FIELDS);
export const BODY_GENE_KEYS=Object.freeze(Object.keys(BODY_GENE_FIELDS));
export const FOOD_TYPES=Object.freeze(['grass','fruit','meat']);
export const DIGESTION_GROUP_FRACTION=.05;

function validated(input,fields){
 if(input===null||typeof input!=='object'||Array.isArray(input))throw new Error('Настройки тела должны быть объектом.');
 for(const key of Object.keys(input))if(!Object.hasOwn(fields,key))throw new Error(`Неизвестный параметр тела: ${key}`);
 const result={};
 for(const [key,f]of Object.entries(fields)){
  const value=input[key]??f.value;
  if(input[key]===null||!Number.isFinite(value)||value<f.min||value>f.max||f.exclusiveMin&&value===f.min||f.exclusiveMax&&value===f.max||f.unit==='подшаги'&&!Number.isSafeInteger(value))throw new Error(`Недопустимое значение: ${f.label} (${f.unit}).`);
  result[key]=value;
 }
 return result;
}
export function effectiveSubsteps(time){
 const steps=Math.max(1,Math.ceil(time*SUBSTEPS));
 if(!(time>0)||!Number.isSafeInteger(steps))throw new Error('Срок не помещается в целую сетку времени.');
 return steps;
}
export function bodyGeneValues(input={}){
 const g=validated(input,BODY_GENE_FIELDS);
 // Гены сохраняют исходные значения: округляется срок события, не наследуемая
 // координата. Повторное округление float-срока добавляло лишний подшаг.
 for(const key of ['tAdult','tPreg','tau'])effectiveSubsteps(g[key]);
 const potential=g.gmax*(effectiveSubsteps(g.tAdult)/SUBSTEPS)/(1-g.kBirth);
 if(!Number.isFinite(potential)||!(potential>0)||!Number.isFinite(potential*g.kBirth))throw new Error('Неконечная производная масса тела.');
 return g;
}
export function physiologySettings(input={}){
 const r=validated(input,PHYSIOLOGY_FIELDS);
 if(r.grassMax<r.grassMin)throw new Error('Максимальный запас травы меньше минимального.');
 if(!Number.isFinite(r.tissueEnergy/r.synthesisEfficiency)||!(r.tissueEnergy*r.catabolismEfficiency>0))throw new Error('Некорректная энергия преобразования тканей.');
 return r;
}
export const foodEnergies=r=>[r.grassEnergy,r.fruitEnergy,r.meatEnergy];
