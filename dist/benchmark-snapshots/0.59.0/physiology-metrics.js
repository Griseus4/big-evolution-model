import {CARE_GENE_FIELDS} from './care-settings.js';
import {BODY_GENE_FIELDS} from './physiology-settings.js';
export const BODY_HERITABLE_METRICS=Object.freeze(Object.entries(CARE_GENE_FIELDS).map(([key,f])=>Object.freeze({id:'bodyGene_'+key,label:f.label,unit:f.unit,digits:4,inherited:true})));
export const PHYSIOLOGY_METRICS=Object.freeze([
 ...[['bodyMass','Средняя масса тканей','масса'],['maximumMass','Средняя рекордная масса','масса'],['energyCapacity','Средняя энергетическая ёмкость','энергии'],['healthCapacity','Средний максимум здоровья','здоровья'],['stomachVolume','Средняя ёмкость желудка','порций']].map(([id,label,unit])=>({id,label,unit,digits:3,mean:true})),
 ...[['basal','Содержание тела'],['motor','Двигательные затраты'],['pregnancy','Вклад в вынашивание'],['healing','Цена лечения'],['overflow','Потеря переполнения'],['excreted','Энергия выведенной пищи']].map(([id,label])=>({id:'phys_'+id,label,unit:'энергии / 100 Т',digits:3,field:id})),
 ...['grass','fruit','meat'].flatMap((type,j)=>[{id:'absorbed_'+type,label:'Усвоено: '+['трава','плоды','мясо'][j],unit:'энергии / 100 Т',digits:3,array:'absorbed',index:j},{id:'ingested_'+type,label:'Проглочено: '+['трава','плоды','мясо'][j],unit:'порций / 100 Т',digits:3,array:'ingested',index:j}]),
 {id:'pregnancyTime',label:'Доля жизни с беременностью',unit:'%',digits:2,field:'pregnancyTime'},
 {id:'laborTime',label:'Доля времени родов',unit:'%',digits:2,field:'laborTime'},
 {id:'attackDamage',label:'Нанесённые повреждения',unit:'здоровья / 100 Т',digits:3,field:'attackDamage'},
 {id:'attackDeath',label:'Доля погибших от атак',unit:'%',digits:2,death:true},
 ...[['carriedTime','Доля времени на родителе','%'],['carryingTime','Доля времени ношения ребёнка','%'],['feedAttempts','Попытки кормления ребёнка','попыток / 100 Т'],['fedPortions','Передано пищи ребёнку','порций / 100 Т'],['receivedPortions','Получено пищи от родителя','порций / 100 Т']].map(([id,label,unit])=>({id,label,unit,digits:3,care:true})),
].map(Object.freeze));
export function physiologyMetric(row,id){
 const metric=PHYSIOLOGY_METRICS.find(m=>m.id===id);if(!metric)return undefined;
 const p=row.physiology;if(metric.care){const c=row.care;if(c?.schema!=='postnatal-care-v1'||!(p?.samples>0))return null;const v=id==='fedPortions'?c.fed.reduce((a,b)=>a+b,0):id==='receivedPortions'?c.received.reduce((a,b)=>a+b,0):c[id];return Number.isFinite(v)?100*v/p.samples:null;}
if(p?.schema!=='physiology-life-v1')return null;
 if(metric.death)return row.status==='dead'?Number(row.cause==='attack')*100:null;
 if(metric.mean)return p.samples>0&&Number.isFinite(p[id+'Total'])?p[id+'Total']/p.samples:null;
 const v=metric.array?p[metric.array]?.[metric.index]:p[metric.field];return p.samples>0&&Number.isFinite(v)?100*v/p.samples:null;
}
