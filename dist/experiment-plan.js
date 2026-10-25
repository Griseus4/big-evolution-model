import {WORLD_LIMITS} from './world-defaults.js';
import {structuralSettings,structuralLayout} from './structural-brain.js';
import {DUAL_BRAIN_TYPE,dualBrainLayout,unpackDualBrain} from './dual-brain-layout.js';
import {dualStructureSettings} from './dual-brain-settings.js';
/** Неизменяемый план серии. Seed назначаются до запуска и не зависят от
 * очередности Workers. Настройки каждого мира отделены от глобальных правил. */
import {genomeMetadata,validateGenomeFile} from './genome.js';
import {EXPERIMENT_FACTOR_FIELDS,factorDesign,setSetting,MAX_EXPERIMENT_COMBINATIONS} from './experiment-fields.js';
import {validateFounderSenses} from './founder-senses.js';
import {WORLD_DEFAULTS} from './world-defaults.js';
import {validateDigestionTime} from './evolution.js';
import {validateFoodSettings} from './food-settings.js';
import {validateEnvironmentSettings} from './environment-settings.js';
import {reproductionProfile} from './reproduction.js';
import {COMPUTATION_WORKER_COUNTS} from './computation-settings.js';
import {DEFAULT_SEEDS} from './experiment-runner.js';
export const EXPERIMENT_PROTOCOL='world-constructor-v3';
export const EXPERIMENT_PLAN_VERSION=3;
export const EXPERIMENT_PLAN_PROTOCOLS=Object.freeze([EXPERIMENT_PROTOCOL,'world-constructor-v2']);
export const EXPERIMENT_TERRAIN_SEED=42;
export const EXPERIMENT_FOOD_SEED=42;
export const EXPERIMENT_DEFAULTS=Object.freeze({worlds:5,steps:20000,budget:Math.max(1,Math.min(32,(globalThis.navigator?.hardwareConcurrency??4)-1)),maxWorkers:4,allocation:'auto'});
export function standardSeeds(count){const seeds=DEFAULT_SEEDS.slice(0,count);let x=0x12345678;while(seeds.length<count){x=(Math.imul(x,1664525)+1013904223)>>>0;if(x&&!seeds.includes(x))seeds.push(x);}return seeds;}
export function seedMatrix(seeds){const used=new Set(seeds);return seeds.map(seed=>{let x=seed;const row=[seed];while(row.length<3){x=(Math.imul(x,1664525)+1013904223)>>>0;if(x&&!used.has(x)){used.add(x);row.push(x);}}return row;});}
const integer=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw new Error(`${label}: целое от ${min} до ${max}.`);return v;};
export function validateWorldOptions(input={}, {historical=false}={}){
 const population=integer(input.population??WORLD_DEFAULTS.population,WORLD_LIMITS.populationMin,WORLD_LIMITS.populationMax,'Основатели'),limit=integer(input.limit??WORLD_DEFAULTS.limit,population,WORLD_LIMITS.populationMax,'Лимит');
 for(const name of ['memory','learning','mutations'])if(input[name]!==undefined&&typeof input[name]!=='boolean')throw new Error(`Некорректный переключатель ${name}.`);
 const founderSenses=validateFounderSenses(input.founderSenses);
 const digestionTime=validateDigestionTime(input.digestionTime);
 const structure=historical?(input.attentionMaxNeurons!==undefined?dualStructureSettings(input):{}):dualStructureSettings(input);if(input.baseGenome&&!historical){
  if(!dualBrainLayout(input.baseGenome))throw new Error('Для нового опыта нужен геном двух сетей v15.');
  const d=unpackDualBrain(input.baseGenome);if(d.main.layers.length>structure.maxNeurons||Math.max(0,...d.main.layers)>structure.maxLayers||d.attention.layers.length>structure.attentionMaxNeurons||Math.max(0,...d.attention.layers)>structure.attentionMaxLayers)throw new Error('Геном превышает пределы структуры мозга.');
 }
 return {population,limit,digestionTime,...structure,...(founderSenses?{founderSenses}:{}),...(input.terrainSeed!==undefined?{terrainSeed:integer(input.terrainSeed,1,4294967295,'Seed карты')}:{}),...(input.foodSeed!==undefined?{foodSeed:integer(input.foodSeed,1,4294967295,'Seed пищи')}:{}),...validateFoodSettings({...input,foodGeneralSettings:input.foodGeneralSettings||input.foodRegrowInterval!==undefined&&(!Number.isInteger(input.foodRegrowInterval)||input.foodRegrowInterval<10||input.foodRegrowInterval>300)||input.foodIslandCount===0}),...(input.baseGenome?{baseGenome:validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(input.baseGenome),genes:input.baseGenome})}:{}),automaticEnvironment:validateEnvironmentSettings(input.automaticEnvironment),reproduction:reproductionProfile(input.reproduction),memory:input.memory!==false,learning:input.learning!==false,mutations:input.mutations!==false};
}
export function validatePlan(input,{historical=false}={}){
 const worlds=integer(input.worlds??EXPERIMENT_DEFAULTS.worlds,1,64,'Миров на вариант'),steps=integer(input.steps??EXPERIMENT_DEFAULTS.steps,1,1000000,'Длительность, Т'),budget=integer(input.budget??EXPERIMENT_DEFAULTS.budget,1,64,'Бюджет потоков');
 const maxWorkers=input.maxWorkers??4;if(!COMPUTATION_WORKER_COUNTS.includes(maxWorkers))throw new Error('Недоступное число вычислителей.');
 const allocation=input.allocation??'auto';if(!['auto','fixed'].includes(allocation))throw new Error('Неизвестный режим распределения.');
 if(allocation==='fixed'&&workerCost(maxWorkers)>budget)throw new Error('Бюджета не хватает на выбранный фиксированный режим с координатором.');
 const seeds=input.seeds??standardSeeds(worlds);if(!Array.isArray(seeds)||seeds.length!==worlds||new Set(seeds).size!==worlds)throw new Error('Число уникальных seed должно совпадать с числом миров.');seeds.forEach(v=>integer(v,1,4294967295,'Seed'));
 if(input.factors!==undefined&&input.common?.terrainSeed!==undefined&&input.common.terrainSeed!==EXPERIMENT_TERRAIN_SEED)throw new Error(`Для этой схемы опыта используется общая карта с seed ${EXPERIMENT_TERRAIN_SEED}.`);
 if(input.factors!==undefined&&input.common?.foodSeed!==undefined&&input.common.foodSeed!==EXPERIMENT_FOOD_SEED)throw new Error(`Для этой схемы опыта используется общая пища с seed ${EXPERIMENT_FOOD_SEED}.`);
 const common=validateWorldOptions(input.factors!==undefined?{...input.common,terrainSeed:EXPERIMENT_TERRAIN_SEED,foodSeed:EXPERIMENT_FOOD_SEED}:input.common,{historical});let raw=input.variants,design=null;
 if(input.factors!==undefined){
  design=factorDesign(input.factors,{historical});if(design.count>MAX_EXPERIMENT_COMBINATIONS)throw new Error(`Получилось ${design.count} сочетаний; максимум ${MAX_EXPERIMENT_COMBINATIONS} на seed.`);
  raw=[];
  function expand(index,settings,labels){
   if(index===design.factors.length){raw.push({name:labels.length?`Вариант ${raw.length+1} · ${labels.join(' · ')}`:'Общие условия',settings});return;}
   const f=design.factors[index],field=EXPERIMENT_FACTOR_FIELDS.find(d=>d[1]===f.key);
   for(const value of f.values){const next={...settings,automaticEnvironment:{...settings.automaticEnvironment},reproduction:{...settings.reproduction},founderSenses:{...settings.founderSenses}};setSetting(next,f.key,field[3]==='genome'?value.genes:value);expand(index+1,next,[...labels,`${field[2]}: ${field[3]==='genome'?value.name:typeof value==='boolean'?(value?'вкл':'выкл'):value}`]);}
  }
  expand(0,{},[]);
 }
 // Готовые варианты остаются внутренним контрактом исполнителя и чтения
 // прежних результатов. Редактор принимает только новую схему factors.
 if(!Array.isArray(raw)||!raw.length||raw.length>MAX_EXPERIMENT_COMBINATIONS)throw new Error(`Нужно от 1 до ${MAX_EXPERIMENT_COMBINATIONS} вариантов.`);
 const variants=raw.map((v,i)=>{try{validateFounderSenses(v.settings?.founderSenses);return {id:`v${i+1}`,name:String(v.name??`Вариант ${i+1}`).trim().slice(0,240)||`Вариант ${i+1}`,settings:validateWorldOptions({...common,...v.settings,automaticEnvironment:{...common.automaticEnvironment,...v.settings?.automaticEnvironment},reproduction:{...common.reproduction,...v.settings?.reproduction},founderSenses:{...common.founderSenses,...v.settings?.founderSenses}},{historical})};}catch(e){throw new Error(`Вариант ${i+1}: ${e.message}`);}});
 return {protocolId:EXPERIMENT_PROTOCOL,name:String(input.name??'Новый опыт').slice(0,120),worlds,steps,budget,maxWorkers,allocation,seeds:seeds.slice(),seedMatrix:seedMatrix(seeds),common,...(design?{factors:design.factors}:{}),variants};
}
export const workerCost=count=>count===1?1:count+1;
/** Сначала независимые миры. Смена режима только при изменении очереди,
 * окончаниях задач и редких сообщениях о численности; не на подшаге. */
export function allocateComputations(plan,populations,pending){
 const n=populations.length;if(!n)return [];
 if(plan.allocation==='fixed')return populations.map(()=>plan.maxWorkers);
 const counts=populations.map(()=>1);if(pending)return counts;
 let free=plan.budget-n;
 for(let round=0;round<COMPUTATION_WORKER_COUNTS.length;round++)for(let i=0;i<n;i++){
  const next=COMPUTATION_WORKER_COUNTS.find(c=>c>counts[i]);
  if(next&&next<=plan.maxWorkers&&populations[i]>=next*32&&workerCost(next)-workerCost(counts[i])<=free){free-=workerCost(next)-workerCost(counts[i]);counts[i]=next;}
 }
 return counts;
}
export function selectAttempt(attempts,target){
 const completed=attempts.filter(a=>a.status==='completed');
 return completed.find(a=>!a.extinct&&a.tick>=target)??completed.reduce((best,a)=>!best||a.tick>best.tick?a:best,null);
}
export const EXPERIMENT_TEMPLATES=Object.freeze([
 {id:'baseline',name:'Текущие правила',factors:[]},
 {id:'learning',name:'Обучение включено / выключено',factors:[{key:'learning',values:[true,false]}]},
 {id:'memory',name:'Память включена / выключена',factors:[{key:'memory',values:[true,false]}]},
 {id:'factorial',name:'Память × обучение',factors:[{key:'memory',values:[true,false]},{key:'learning',values:[true,false]}]},
 {id:'mutations',name:'Мутации включены / выключены',factors:[{key:'mutations',values:[true,false]}]},
]);
