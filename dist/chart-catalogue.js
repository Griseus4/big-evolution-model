import {LIFE_METRICS} from './life-cohorts.js';
import {HERITABLE_METRICS} from './heritable-statistics.js';
import {ANALYSIS_DEFAULT,validateAnalysis} from './analysis-builder-core.js';
import {validateChartPins} from './chart-context.js';
export const CHART_CATEGORIES=Object.freeze([
 {id:'survival',label:'Выживание',charts:['population','lifetime','survival','curve']},
 {id:'behavior',label:'Поведение',charts:['movement','eating','reviews','interruptions','brainCalls']},
 {id:'resources',label:'Ресурсы',charts:['inventory','energy','health','feeling','hunger','food','production']},
 {id:'reproduction',label:'Размножение',charts:['children','reproduced','firstBirth']},
 {id:'genome',label:'Наследуемые свойства',charts:LIFE_METRICS.filter(m=>m.inherited&&!m.signed).map(m=>m.id)},
 {id:'distributions',label:'Распределения',charts:HERITABLE_METRICS.filter(m=>m.signed).map(m=>'distribution-'+m.id)},
]);
export const CATALOGUE_METRICS=Object.freeze([...LIFE_METRICS.filter(m=>!m.signed),{id:'population',label:'Средняя численность населения',unit:'живых особей'},{id:'survival',label:'Доля доживших до выбранного возраста',unit:'%'},{id:'food',label:'Среднее количество еды на карте',unit:'порций на земле'},{id:'production',label:'Потенциальная выработка пищи',unit:'порций / Т'}]);
const categoryFor=id=>CHART_CATEGORIES.find(c=>c.charts.includes(id))?.id??'resources';
export const STANDARD_CHARTS=Object.freeze([
 ...CATALOGUE_METRICS.map(m=>({id:m.id,name:m.label,kind:'metric',metric:m.id,category:categoryFor(m.id),standard:true})),
 ...HERITABLE_METRICS.filter(m=>m.signed).map(m=>({id:'distribution-'+m.id,name:'Распределение: '+m.label,kind:'histogram',metric:m.id,category:'distributions',standard:true})),
 {id:'curve',name:'Кривая дожития одной группы рождения',kind:'curve',metric:'curve',category:'survival',standard:true},
].map(Object.freeze));
export const emptyCatalogue=()=>({version:2,categories:[],charts:[],hidden:[]});
const idOK=id=>typeof id==='string'&&/^user-[a-zA-Z0-9-]{1,90}$/.test(id);
const nameOK=name=>typeof name==='string'&&name.trim().length>0&&name.length<=100;
export function validateCatalogue(input){
 if(!input||![1,2].includes(input.version)||!Array.isArray(input.categories)||!Array.isArray(input.charts)||!Array.isArray(input.hidden)||input.categories.length>30||input.charts.length>100)throw new Error('Некорректный каталог: до 30 категорий и 100 пользовательских графиков.');
 const categories=input.categories.map(c=>{if(!idOK(c.id)||!nameOK(c.label))throw new Error('Неверная категория.');return {id:c.id,label:c.label.trim()};});
 if(new Set(categories.map(c=>c.id)).size!==categories.length||new Set([...CHART_CATEGORIES,...categories].map(c=>c.label)).size!==CHART_CATEGORIES.length+categories.length)throw new Error('Категории не должны повторяться.');
 const known=new Set([...CHART_CATEGORIES,...categories].map(c=>c.id));
 const charts=input.charts.map(d=>{if(!idOK(d.id)||!nameOK(d.name)||!known.has(d.category)||!['metric','histogram','curve','expression'].includes(d.kind))throw new Error('Неверное определение графика.');
  const chart={id:d.id,name:d.name.trim(),category:d.category,kind:d.kind,standard:false};
  if(d.kind==='expression'){const c=validateAnalysis({...ANALYSIS_DEFAULT,...d.recipe,name:d.name,group:'',split:'',variantFilters:[]});chart.recipe=Object.fromEntries(['expression','filter','aggregate','axis','maxChild','chart'].map(k=>[k,c[k]]));chart.unit=typeof d.unit==='string'?d.unit.slice(0,50):'';}
  else{const allowed=d.kind==='curve'?['curve']:d.kind==='histogram'?HERITABLE_METRICS.filter(m=>m.signed).map(m=>m.id):CATALOGUE_METRICS.map(m=>m.id);if(!allowed.includes(d.metric))throw new Error('Неизвестный встроенный показатель.');chart.metric=d.metric;}
  const pins=validateChartPins(d.pins,chart);if(Object.keys(pins).length)chart.pins=pins;
  return chart;
 });
 const ids=[...STANDARD_CHARTS,...charts].map(d=>d.id);if(new Set(ids).size!==ids.length||input.hidden.some(id=>!ids.includes(id)))throw new Error('Повторяющийся ID или неизвестный скрытый график.');
 return {version:2,categories,charts,hidden:[...new Set(input.hidden)]};
}
export const catalogueCharts=state=>[...STANDARD_CHARTS,...state.charts];
export const catalogueCategories=state=>[...CHART_CATEGORIES,...state.categories];
export function migrateAnalysisTemplate(config,id,category='resources'){
 const c=validateAnalysis(config);return {id,name:c.name,category,kind:'expression',recipe:c,standard:false};
}
