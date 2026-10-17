/** Индивидуальные островки — физика мира, не память/цель организма.
 * Все источники входят ровно в одну группу. Около 20% бюджета оставляем
 * одиночными кустами; если запрошено много островков, приоритет их числу.
 * Генерация выполняется при создании/изменении среды, не для каждого жителя.
 * Отдельные RNG размещения и расписания не расходуют RNG жизни/мутаций. */
import {Random} from './simulation.js';
import {worldDistance} from './food-layout.js';
import {FOOD_LIMITS,validateFoodSettings} from './food-settings.js';
export const ISLAND_SCHEMA='individual-food-islands-v1';
const point=c=>({x:c.x,y:c.y});

/** Минимум один источник на островок. Взвешенные доли округляем методом
 * наибольшего остатка: сумма точно равна бюджету, без потери/создания еды.
 * Разброс определяет веса до нормировки, а не строгие пределы целых размеров. */
export function islandSizes(total,count,spread,random){
 if(!count)return [];
 const weights=Array.from({length:count},()=>1+(random.next()*2-1)*spread/100);
 const remaining=total-count,sum=weights.reduce((n,w)=>n+w,0);
 const quotas=weights.map(w=>remaining*w/sum),sizes=quotas.map(q=>1+Math.floor(q));
 const order=quotas.map((q,i)=>({i,fraction:q-Math.floor(q)})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 const rest=total-sizes.reduce((n,s)=>n+s,0);
 for(let i=0;i<rest;i++)sizes[order[i].i]++;
 return sizes;
}

/** Не меняет плитки/запасы: возвращает размещение источников и группы.
 * Центры островков разнесены, ближайшие свободные клетки дают компактность.
 * Кусты выбираются на остальной суше с весом расстояния от крупных групп:
 * это повышает шанс отдельного куста между группами, не гарантирует спасения. */
export function createIndividualFoodLayout(tiles,template,seed,input){
 const options=validateFoodSettings(input),land=tiles.filter(c=>c.terrain==='land');
 if(template.length>land.length)throw new Error('Недостаточно суши для источников.');
 if(!template.length)return {sources:[],islands:[]};
 const random=new Random(seed^0x784ea133),count=Math.min(options.foodIslandCount,template.length);
 const bushes=Math.min(Math.floor(template.length*FOOD_LIMITS.scatteredFraction),template.length-count);
 const sizes=islandSizes(template.length-bushes,count,options.foodSizeSpread,random);
 const centres=[land[Math.floor(random.next()*land.length)]],centreSet=new Set(centres);
 // Минимальное расстояние обновляется только по новому центру. Это O(суша ×
 // число островков), а не повторный обход всех прежних центров в каждой итерации.
 const distances=land.map(cell=>({cell,d:worldDistance(cell,centres[0])}));
 while(centres.length<count){
  let best=null,score=-Infinity;
  for(const entry of distances){if(centreSet.has(entry.cell))continue;
   const value=entry.d+random.next()*1.5;if(value>score){best=entry.cell;score=value;}
  }
  centres.push(best);centreSet.add(best);
  for(const entry of distances)entry.d=Math.min(entry.d,worldDistance(entry.cell,best));
 }
 const inventory=template.slice();
 for(let i=inventory.length-1;i>0;i--){const j=Math.floor(random.next()*(i+1));[inventory[i],inventory[j]]=[inventory[j],inventory[i]];}
 const used=new Set(),sources=[],islands=[];let cursor=0;
 function addGroup(cells,centre,kind){
  const group={id:islands.length,kind,centre:point(centre),sources:cells.map(point)};
  for(const cell of cells){used.add(cell);sources.push({...inventory[cursor++],...point(cell)});}
  islands.push(group);
 }
 // Резервируем центры остальных групп: большой первый остров не поглотит
 // клетку, выбранную центром последнего. Каждый остров остаётся непустым.
 for(let i=0;i<count;i++){
  const nearby=land.filter(c=>!used.has(c)&&(!centreSet.has(c)||c===centres[i]))
   .map(c=>({cell:c,d:worldDistance(c,centres[i]),tie:random.next()})).sort((a,b)=>a.d-b.d||a.tie-b.tie);
  addGroup(nearby.slice(0,sizes[i]).map(p=>p.cell),centres[i],'island');centreSet.delete(centres[i]);
 }
 // Взвешенная выборка без возвращения: сортируем один раз, не ищем всю
 // свободную карту заново для каждого из десятков одиночных кустов.
 const scattered=land.filter(c=>!used.has(c)).map(cell=>{
  let distance=Infinity;for(const centre of centres)distance=Math.min(distance,worldDistance(cell,centre));
  return {cell,key:-Math.log(Math.max(Number.MIN_VALUE,random.next()))/(1+distance)};
 }).sort((a,b)=>a.key-b.key);
 for(let i=0;i<bushes;i++)addGroup([scattered[i].cell],scattered[i].cell,'bush');
 return {sources,islands};
}

/** Период каждой группы фиксирован до вмешательства; округление до целых
 * шагов и границы 10…1600 заданы физикой. Фаза 0 означает первое событие
 * через полный период, остальные фазы — через 1…period-1 шагов от начала.
 * Таким образом первые задержки равномерны от 1 до period, события не
 * восполняют пропущенные порции и не зависят от часов/отрисовки. */
export function scheduleFoodIslands(islands,seed,input,startTick=0){
 const options=validateFoodSettings(input),random=new Random(seed^0x59f2a731);
 return islands.map(g=>{
  const period=Math.max(FOOD_LIMITS.intervalMin,Math.min(FOOD_LIMITS.intervalMax,
   Math.round(options.foodRegrowInterval*(1+(random.next()*2-1)*options.foodPeriodSpread/100))));
  const phase=Math.floor(random.next()*period);
  return {...g,centre:{...g.centre},sources:g.sources.map(point),period,phase,cycleStart:startTick,nextTick:startTick+(phase||period)};
 });
}

/** На шаге проверяем группы, а клетки читаем только в момент плодоношения.
 * Стоимость O(группы + источники с наступившим событием), без обхода карты
 * или населения. Полный источник пропускает порцию без накопления долга. */
export function regrowFoodIslands(world){
 for(const group of world.foodIslands){
  if(world.tick<group.nextTick)continue;
  for(const p of group.sources){const c=world.tile(p.x,p.y);if(c.food<c.maxFood){c.food++;world.stats.regrown++;}}
  group.nextTick=world.tick+group.period;
 }
}
export function islandScheduleSummary(islands){
 const main=islands.filter(g=>g.kind==='island'),periods=islands.map(g=>g.period),sizes=main.map(g=>g.sources.length);
 return {islandCount:main.length,bushCount:islands.length-main.length,
  periodMin:periods.length?Math.min(...periods):null,periodMax:periods.length?Math.max(...periods):null,
  sizeMin:sizes.length?Math.min(...sizes):null,sizeMax:sizes.length?Math.max(...sizes):null};
}
