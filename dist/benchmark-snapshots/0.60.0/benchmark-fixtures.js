import {attachChild} from './child-care.js';
import {STRUCTURAL_TYPE} from './structural-brain.js';
import {DUAL_BRAIN_TYPE} from './dual-brain-layout.js';
/** Версионные нагрузки, а не образцы успешной эволюции. Геномы случайные,
 * воспоминания заполненных случаев синтетические. Миры не обязаны выживать.
 * Один случай создаётся/освобождается за раз: не держим три больших мира в RAM.
 * Изменение состава, объёма или подготовки требует нового SUITE_ID. */
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
import {ACTION_DURATIONS} from './action-timing.js';
import {Evolution} from './evolution.js';
import {observe} from './cognition.js';
import {positionKey,localNeighbours} from './navigation.js';
export const BENCHMARK_SUITE_ID='all-blocks-dag-workloads-v1';
export const BENCHMARK_REPEATS=3;
export const BENCHMARK_CASES=Object.freeze([
 {id:'evaluator-empty',label:'Оценщик · пустая память',kind:'evaluator',seed:701,population:16,filled:false,work:4096,warmup:256},
 {id:'evaluator-memory',label:'Оценщик · заполненная память',kind:'evaluator',seed:702,population:16,filled:true,work:4096,warmup:256},
 {id:'evaluator-all-actions',label:'Оценщик · действия, виды пищи и жертва',kind:'evaluator',seed:703,population:16,filled:true,allActions:true,work:4096,warmup:256},
 {id:'world-150',label:'Мир · 150 основателей',kind:'world',seed:801,population:150,filled:false,work:64,warmup:8},
 {id:'world-400',label:'Мир · 400, заполненная память',kind:'world',seed:802,population:400,filled:true,work:64,warmup:8},
 {id:'world-1000',label:'Мир · 1000, заполненная память',kind:'world',seed:803,population:1000,filled:true,work:64,warmup:8},
 {id:'world-care',label:'Мир · 150, пары ношения',kind:'world',seed:804,population:150,filled:true,carried:true,work:32,warmup:4},
 {id:'world-modular',label:'Мир · 150, скрытые слои всех блоков',kind:'world',seed:805,population:150,filled:true,modular:true,work:32,warmup:4},
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
 const world=new Evolution({...(spec.modular?{initialNeurons:[4],attentionInitialNeurons:[4],brainModules:Object.fromEntries(['cells','target','operation','direct'].map(key=>[key,{initialNeurons:[4]}]))}:{}),...(options.brainType?{}:{physiology:{},genomeVersion:20}),seed:spec.seed,population:spec.population,limit:1000,foodSources:384,foodRegrowInterval:20,
  temporal:options.temporal??(!options.brainType||[TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE,DUAL_BRAIN_TYPE].includes(options.brainType)),brainType:options.brainType??DUAL_BRAIN_TYPE,memory:true,learning:true,mutationRate:.02,mutations:true,lifeHistoryLimit:250,heritableMutations:!options.brainType,...options});
 for(const agent of world.agents){
  agent.brain.memory.clear();agent.brain.longMemory.clear();agent.brain.spatialCache=null;
  if(spec.filled)fillMemory(agent.brain);
  if(spec.kind==='evaluator')for(let i=0;i<agent.brain.networkDelta.length;i++)agent.brain.networkDelta[i]=Math.sin(i+agent.id)*.04;
 }
 if(spec.carried&&world.childCare)for(let i=0;i+1<world.agents.length;i+=2){const p=world.agents[i],c=world.agents[i+1];world.moveAgent(c,p);attachChild(world,p,c);}
 return world;
}
export function evaluatorRequests(world,spec){
 return world.agents.map(agent=>{
  const request=world.decisionFrame(agent).request;
  if(spec.allActions&&world.physiology){
   const cell={...request.observation.cells[0],foods:[2,2,2],food:6},neighbours=localNeighbours(agent.brain);request.candidates=[];
   for(let action=0;action<12;action++)for(const foodType of [6,7,10].includes(action)?[0,1,2]:[null])request.candidates.push({id:`fixture-${action}-${foodType}`,action,foodType,targetHandle:action===11?1:null,visibleTarget:action===11?{size:agent.L,health:1,action:8,attacksMe:false,attacksOther:false}:null,duration:action===8?0:ACTION_DURATIONS[action]??3,decisionCost:.10,continuation:false,repeat:false,localDestination:action<6?neighbours[action]:{...agent.brain.position},cell});
  }else if(spec.allActions){
   const neighbours=localNeighbours(agent.brain);
   // Контракт оценщика допускает все действия; исполнение здесь отсутствует.
   // Таким образом измеряется максимальный пакет, а не нарушение физики игры.
   request.candidates=Array.from({length:11},(_,action)=>({id:'action-'+action,action,duration:ACTION_DURATIONS[action],decisionCost:.10,continuation:false,repeat:false,
    localDestination:action<6?neighbours[action]:{...agent.brain.position},cell:{food:action%3,isFoodSource:action%2===0,hazard:action%4===0,neighbours:action<6?(request.observation.neighbours?.cells.find(c=>c.action===action)?.count??0):(request.observation.neighbours?.ownCount??0)}}));
  }
  return request;
 });
}
