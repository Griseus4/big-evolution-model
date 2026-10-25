import {STRUCTURAL_TYPE} from './structural-brain.js';
/** Версионные нагрузки, а не образцы успешной эволюции. Геномы случайные,
 * воспоминания заполненных случаев синтетические. Миры не обязаны выживать.
 * Один случай создаётся/освобождается за раз: не держим три больших мира в RAM.
 * Изменение состава, объёма или подготовки требует нового SUITE_ID. */
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
import {ACTION_DURATIONS} from './action-timing.js';
import {Evolution} from './evolution.js';
import {observe} from './cognition.js';
import {positionKey,localNeighbours} from './navigation.js';
export const BENCHMARK_SUITE_ID='structural-brain-workloads-v1';
export const BENCHMARK_REPEATS=3;
export const BENCHMARK_CASES=Object.freeze([
 {id:'evaluator-empty',label:'Оценщик · пустая память',kind:'evaluator',seed:701,population:16,filled:false,work:4096,warmup:256},
 {id:'evaluator-memory',label:'Оценщик · заполненная память',kind:'evaluator',seed:702,population:16,filled:true,work:4096,warmup:256},
 {id:'evaluator-all-actions',label:'Оценщик · все 11 действий',kind:'evaluator',seed:703,population:16,filled:true,allActions:true,work:4096,warmup:256},
 {id:'world-150',label:'Мир · 150 основателей',kind:'world',seed:801,population:150,filled:false,work:64,warmup:8},
 {id:'world-400',label:'Мир · 400, заполненная память',kind:'world',seed:802,population:400,filled:true,work:64,warmup:8},
 {id:'world-1000',label:'Мир · 1000, заполненная память',kind:'world',seed:803,population:1000,filled:true,work:64,warmup:8},
].map(Object.freeze));
function fillMemory(brain){
 const count=brain.traits.shortCapacity+brain.traits.longCapacity,cells=[];
 const nearby=[brain.position,...localNeighbours(brain)],nearKeys=new Set(nearby.map(positionKey));
 for(let i=0;cells.length<count-nearby.length;i++){
  const position={q:i%19-9,r:Math.floor(i/19)-4};
  if(!nearKeys.has(positionKey(position)))cells.push({...position,food:i%3===0?3:0,terrain:'land'});
 }
 cells.push(...nearby.map((position,i)=>({...position,food:i%3===0?3:0,terrain:'land'})));
 // Используем штатный формат записей. Заполнение не тратит броски мира,
 // не выдаётся за личную жизнь и не создаёт полезную стратегию.
 // На время единственного пакетного заполнения удерживаем обе ёмкости.
 // Затем возвращаем исходную черту и раскладываем записи по двум Map.
 const shortCapacity=brain.traits.shortCapacity;brain.traits.shortCapacity=count;
 observe(brain,cells,brain.position,0,false);brain.traits.shortCapacity=shortCapacity;
 const records=Array.from(brain.memory.values());
 for(const record of records.slice(0,brain.traits.longCapacity)){
  const key=positionKey(record);brain.memory.delete(key);
  record.importance=.5;record.encounters=3;record.consolidatedAt=0;record.consolidationReason='синтетическая нагрузка';brain.longMemory.set(key,record);
 }
 brain.spatialCache=null;
}
export function createBenchmarkFixture(spec,options={}){
 const world=new Evolution({seed:spec.seed,population:spec.population,limit:1000,foodSources:384,foodRegrowInterval:20,
  temporal:options.temporal??(!options.brainType||[TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(options.brainType)),memory:true,learning:true,mutationRate:.02,mutations:true,lifeHistoryLimit:250,heritableMutations:!options.brainType,...options});
 for(const agent of world.agents){
  agent.brain.memory.clear();agent.brain.longMemory.clear();agent.brain.spatialCache=null;
  if(spec.filled)fillMemory(agent.brain);
  if(spec.kind==='evaluator')for(let i=0;i<agent.brain.networkDelta.length;i++)agent.brain.networkDelta[i]=Math.sin(i+agent.id)*.04;
 }
 return world;
}
export function evaluatorRequests(world,spec){
 return world.agents.map(agent=>{
  const request=world.decisionFrame(agent).request;
  if(spec.allActions){
   const neighbours=localNeighbours(agent.brain);
   // Контракт оценщика допускает все действия; исполнение здесь отсутствует.
   // Таким образом измеряется максимальный пакет, а не нарушение физики игры.
   request.candidates=Array.from({length:11},(_,action)=>({id:'action-'+action,action,duration:ACTION_DURATIONS[action],decisionCost:.10,continuation:false,repeat:false,
    localDestination:action<6?neighbours[action]:{...agent.brain.position},cell:{food:action%3,isFoodSource:action%2===0,hazard:action%4===0,neighbours:action<6?(request.observation.neighbours?.cells.find(c=>c.action===action)?.count??0):(request.observation.neighbours?.ownCount??0)}}));
  }
  return request;
 });
}
