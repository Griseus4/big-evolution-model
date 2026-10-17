/** Пользовательские проверки новой среды. Управляемые решения используются
 * только здесь: не требуют миграции, спасения популяции или конкретного генома. */
import {LegacyEvolution as Evolution} from './evolution.js';
import {Random} from './simulation.js';
import {validateFoodSettings,createFoodTemplate} from './food-settings.js';
import {createIndividualFoodLayout,islandSizes,scheduleFoodIslands,regrowFoodIslands} from './food-islands.js';
import {experimentJobs,validateExperimentConfig} from './experiment-runner.js';
const assert=(v,m)=>{if(!v)throw new Error(m);};
const equal=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m);
const land=()=>Array.from({length:24*16},(_,i)=>({x:i%24,y:Math.floor(i/24),terrain:i%24===12?'water':'land',food:0,maxFood:0}));
const world=options=>new Evolution({population:1,limit:1,learning:false,memory:false,foodSources:24,...options});
export const FOOD_ISLAND_CHECKS=[
 {id:'island-budget',label:'Островки: точный бюджет, суша и одиночные кусты',run(){
  for(const foodSources of [0,1,2,24,80])for(const foodIslandCount of [1,8,384]){
   const tiles=land(),copy=JSON.stringify(tiles),template=createFoodTemplate(foodSources,42);
   const result=createIndividualFoodLayout(tiles,template,42,{foodSources,foodIslandCount});
   const keys=result.sources.map(p=>`${p.x},${p.y}`);
   assert(keys.length===foodSources&&new Set(keys).size===foodSources,'Потеряны/дублированы источники');
   assert(result.sources.every(p=>tiles[p.y*24+p.x].terrain==='land'),'Источник на воде');
   equal(result.sources.map(p=>p.maxFood).sort(),template.map(p=>p.maxFood).sort(),'Изменены ёмкости');
   assert(result.islands.filter(g=>g.kind==='island').length===Math.min(foodIslandCount,foodSources),'Неверное число островков');
   assert(result.islands.every(g=>g.sources.length>0&&(g.kind!=='bush'||g.sources.length===1)),'Пустой островок/многоклеточный куст');
   assert(result.islands.flatMap(g=>g.sources).length===foodSources,'Потеряна принадлежность источника');
   equal(JSON.stringify(tiles),copy,'План изменил настоящую карту');
  }
 }},
 {id:'island-reproducibility',label:'Островки: повторяемые размеры, места и расписания',run(){
  const input={foodSources:80,foodIslandCount:8,foodRegrowInterval:100,foodPeriodSpread:30,foodSizeSpread:90};
  const make=()=>{const layout=createIndividualFoodLayout(land(),createFoodTemplate(80,23),23,input);return {...layout,islands:scheduleFoodIslands(layout.islands,23,input,37)};};
  equal(make(),make(),'Среда не повторяется');
  const sizes=islandSizes(80,8,0,new Random(42));assert(sizes.every(n=>n===10),'Нулевой разброс не даёт равные размеры');
  const groups=make().islands;assert(groups.every(g=>g.period>=70&&g.period<=130&&g.nextTick>37&&g.nextTick<=37+g.period),'Периоды/фазы вне диапазона');
  assert(new Set(groups.map(g=>g.phase)).size>1,'Все фазы синхронны');
 }},
 {id:'island-regrowth',label:'Островки: разные фазы и одна порция без долга',run(){
  const cells=[{x:0,y:0,food:0,maxFood:2},{x:1,y:0,food:0,maxFood:2}],s={tick:0,stats:{regrown:0},tile:x=>cells[x],foodIslands:[
   {period:10,nextTick:2,sources:[{x:0,y:0}]},{period:10,nextTick:7,sources:[{x:1,y:0}]}]};
  for(let tick=1;tick<=7;tick++){s.tick=tick;regrowFoodIslands(s);assert(cells[0].food===Number(tick>=2)&&cells[1].food===Number(tick>=7),'Неверная фаза');}
  cells[0].food=2;s.tick=12;regrowFoodIslands(s);assert(cells[0].food===2,'Переполнение');
  cells[0].food=0;s.tick=21;regrowFoodIslands(s);assert(cells[0].food===0,'Накоплен долг');
  s.tick=22;regrowFoodIslands(s);assert(cells[0].food===1,'Восстановлено больше одной порции');
 }},
 {id:'island-founder-independence',label:'Островки: настройки не подбирают гены/старт основателей',run(){
  const base=world({seed:42}),other=world({seed:42,foodIslandCount:3,foodSizeSpread:90,foodPeriodSpread:0});
  equal(base.agents.map(a=>[a.x,a.y,a.genome]),other.agents.map(a=>[a.x,a.y,a.genome]),'Смена островков изменила основателей');
 }},
 {id:'island-edit-conservation',label:'Островки: вмешательство сохраняет пищу, тело и опыт',run(){
  const s=world(),a=s.agents[0],food=s.tiles.map(c=>c.food),protectedState=JSON.stringify([a,s.random.state,s.mutationRandom.state]);
  const change=s.changeFoodEnvironment({foodSources:32,foodRegrowInterval:100,foodIslandCount:4,foodPeriodSpread:50,foodSizeSpread:70});
  equal(s.tiles.map(c=>c.food),food,'Перенесён/добавлен запас');equal(JSON.stringify([a,s.random.state,s.mutationRandom.state]),protectedState,'Изменены организм/RNG');
  assert(change.after.sourceCount===32&&change.after.islandCount===4&&change.islands.length===s.foodIslands.length,'Журнал потерял параметры');
  const b=s.balances();assert(b.foodError===0&&Math.abs(b.energyError)<1e-6,'Потерян баланс');
  const captured=JSON.stringify(change);s.changeFoodEnvironment({foodSources:0,foodRegrowInterval:100});
  equal(JSON.stringify(change),captured,'Переписан прошлый журнал');assert(s.nextFoodRegrowth()===null,'Назначен рост без источников');
 }},
 {id:'island-noop-validation',label:'Островки: повторное применение и ошибка сохраняют мир',run(){
  const s=world(),before=JSON.stringify(s.snapshot());
  assert(s.changeFoodEnvironment({foodSources:24,foodRegrowInterval:20})===null,'Сброшен цикл без изменения');
  for(const input of [{foodIslandCount:0},{foodIslandCount:385},{foodIslandCount:1.5},{foodPeriodSpread:-1},{foodPeriodSpread:91},{foodSizeSpread:NaN}]){
   let rejected=false;try{s.changeFoodEnvironment({foodSources:24,foodRegrowInterval:20,...input});}catch{rejected=true;}
   assert(rejected,'Принят неверный ввод');equal(JSON.stringify(s.snapshot()),before,'Оставлено частичное изменение');
  }
 }},
 {id:'island-period-only',label:'Островки: изменение периода не переносит источники',run(){
  const s=world(),positions=s.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y,c.maxFood]),food=s.tiles.map(c=>c.food);
  s.changeFoodEnvironment({foodSources:24,foodRegrowInterval:100});
  equal(s.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y,c.maxFood]),positions,'Период перенёс источники');equal(s.tiles.map(c=>c.food),food,'Период изменил запас');
  assert(s.foodIslands.every(g=>g.nextTick>s.tick),'Новый цикл выдаёт пищу задним числом');
 }},
 {id:'island-job-settings',label:'Островки: параметры доходят до длинных испытаний',run(){
  const config=validateExperimentConfig({seeds:[42],steps:1000,parallel:1,population:1,limit:1,foodSources:24,foodIslandCount:3,foodPeriodSpread:70,foodSizeSpread:80});
  for(const job of experimentJobs(config)){assert(job.foodIslandCount===3&&job.foodPeriodSpread===70&&job.foodSizeSpread===80,'Задание потеряло настройки');}
  let rejected=false;try{validateFoodSettings({foodPeriodSpread:Infinity});}catch{rejected=true;}assert(rejected,'Принят бесконечный разброс');
 }},
];
