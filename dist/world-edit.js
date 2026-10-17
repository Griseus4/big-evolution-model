/** Подготовка изменения пищи в уже живущем мире.
 * Этот модуль не выбирает действия организмов и не читает их память/геномы.
 * Он сначала строит полный план на копии рельефа. Ошибка параметров или
 * размещения оставляет настоящий мир нетронутым; применяет план Evolution.
 * Еда не переносится вместе с источником: план задаёт только производство.
 */
import {Random} from './simulation.js';
import {validateFoodSettings,createFoodTemplate} from './food-settings.js';
import {placeFoodIslands,worldDistance} from './food-layout.js';
import {createIndividualFoodLayout,scheduleFoodIslands,islandScheduleSummary} from './food-islands.js';
export const SOURCE_CAPACITY_LIMITS=Object.freeze({min:1,max:24,default:6});
const positionKey=p=>`${p.x},${p.y}`;
function shuffle(values,random){
 const copy=values.slice();
 for(let i=copy.length-1;i>0;i--){const j=Math.floor(random.next()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy;
}
/** null означает «сохранить ёмкости оставшихся; новым дать обычные 3…6».
 * Число означает одинаковую ёмкость всех действующих источников после применения.
 * Снижение ёмкости не удаляет лежащие порции: избыток будет доступен для сбора.
 */
export function validateWorldFoodChange(input){
 const food=validateFoodSettings(input),sourceCapacity=input.sourceCapacity??null,relocate=input.relocate??false;
 if(sourceCapacity!==null&&(!Number.isInteger(sourceCapacity)||sourceCapacity<SOURCE_CAPACITY_LIMITS.min||sourceCapacity>SOURCE_CAPACITY_LIMITS.max))
  throw new Error(`Ёмкость: целое число ${SOURCE_CAPACITY_LIMITS.min}…${SOURCE_CAPACITY_LIMITS.max} порций.`);
 if(typeof relocate!=='boolean')throw new Error('Перераспределение источников должно быть включено или выключено.');
 return {...food,sourceCapacity,relocate};
}
/** Настройки наблюдателя: ёмкость считается по действующим источникам,
 * а не по лежащей еде. После уменьшения ёмкости еды временно может быть больше.
 */
export function foodEnvironment(world){
 const active=world.tiles.filter(c=>c.maxFood>0),capacities=active.map(c=>c.maxFood);
 return {sourceCount:active.length,regrowInterval:world.foodSettings.regrowInterval,
  capacityMin:capacities.length?Math.min(...capacities):null,capacityMax:capacities.length?Math.max(...capacities):null,
  ...(world.individualFood?islandScheduleSummary(world.foodIslands):{islandCount:world.foodIslands.length}),
  requestedIslandCount:world.foodSettings.requestedIslandCount,periodSpread:world.foodSettings.periodSpread,sizeSpread:world.foodSettings.sizeSpread};
}
export function planWorldFoodChange(world,input,width,height){
 const options=validateWorldFoodChange(input),current=world.tiles.filter(c=>c.maxFood>0);
 const land=world.tiles.filter(c=>c.terrain==='land');
 if(options.foodSources>land.length)throw new Error('Для выбранного числа источников недостаточно суши.');
 // Случайность вмешательства отделена от действий, повреждений и мутаций.
 // Один seed и одинаковая последовательность изменений дают одинаковые места.
 // Повторная перестановка использует следующий номер изменения, без Date.now().
 const seed=(world.seed^Math.imul(world.environmentRevision+1,0x6d2b79f5))>>>0;
 const random=new Random(seed^0x371b4a09),template=createFoodTemplate(options.foodSources,seed);
 if(world.individualFood){
  const sizeChanged=options.foodIslandCount!==world.foodSettings.requestedIslandCount||options.foodSizeSpread!==world.foodSettings.sizeSpread;
  const layoutChanged=options.relocate||sizeChanged||options.foodSources!==current.length;
  const changed=layoutChanged||options.foodRegrowInterval!==world.foodSettings.regrowInterval||
   options.foodPeriodSpread!==world.foodSettings.periodSpread||
   options.sourceCapacity!==null&&current.some(c=>c.maxFood!==options.sourceCapacity);
  if(!changed)return {options,sources:[],islands:[],changed:false};
  let sources,islands;
  if(layoutChanged){
   const capacities=shuffle(current,random),inventory=template.map((p,i)=>({food:0,maxFood:options.sourceCapacity??capacities[i]?.maxFood??p.maxFood}));
   ({sources,islands}=createIndividualFoodLayout(world.tiles,inventory,seed,options));
  }else{
   sources=current.map(({x,y,maxFood})=>({x,y,maxFood:options.sourceCapacity??maxFood}));
   islands=world.foodIslands;
  }
  // План не изменяет настоящие группы. Новый цикл начинается с вмешательства,
  // старые порции остаются на клетках; расписания входят в журнал наблюдателя.
  islands=scheduleFoodIslands(islands,seed,options,world.tick);
  return {options,sources,islands,changed:true,layoutChanged};
 }
 let sources,islands;
 if(options.relocate||!current.length){
  const capacities=shuffle(current,random);
  const inventory=template.map((p,i)=>({food:0,maxFood:options.sourceCapacity??capacities[i]?.maxFood??p.maxFood}));
  const scratch=world.tiles.map(c=>({...c}));
  // При вмешательстве нет обещанного острова возле основателей или жителей.
  // Используем всю сушу; прежний стартовый остров сохранён только для генерации.
  islands=placeFoodIslands(scratch,inventory,seed,width,height,{anchorFirstIsland:false});
  sources=scratch.filter(c=>c.maxFood>0).map(({x,y,maxFood})=>({x,y,maxFood}));
 }else{
  // Уменьшение оставляет подмножество прежних клеток. Случайный выбор не знает,
  // кто там живёт: он не спасает и не преследует определённую родословную.
  const retained=options.foodSources<current.length?shuffle(current,random).slice(0,options.foodSources):current;
  sources=retained.map(({x,y,maxFood})=>({x,y,maxFood:options.sourceCapacity??maxFood}));
  if(options.foodSources>sources.length){
   const occupied=new Set(sources.map(positionKey)),scratch=world.tiles.map(c=>({...c}));
   const proposed=placeFoodIslands(scratch,template,seed,width,height,{anchorFirstIsland:false});
   // Сначала берём свободные клетки предложенных островков. Поскольку полный
   // предложенный набор имеет нужный размер, свободных клеток в нём достаточно.
   const candidates=proposed.flatMap(g=>g.sources).filter(p=>!occupied.has(positionKey(p)));
   const additions=options.foodSources-sources.length;
   sources.push(...candidates.slice(0,additions).map((p,i)=>({...p,maxFood:options.sourceCapacity??template[i].maxFood})));
  }
  const active=new Set(sources.map(positionKey));
  islands=world.foodIslands.map(g=>({id:g.id,centre:{...g.centre},sources:g.sources.filter(p=>active.has(positionKey(p))).map(p=>({...p}))}));
  const grouped=new Set(islands.flatMap(g=>g.sources).map(positionKey));
  for(const p of sources){
   if(grouped.has(positionKey(p)))continue;
   // Это группировка для карты наблюдателя, без передачи центров мозгу.
   if(!islands.length)islands.push({id:0,centre:{x:p.x,y:p.y},sources:[]});
   const nearest=islands.reduce((best,g)=>worldDistance(p,g.centre)<worldDistance(p,best.centre)?g:best);
   nearest.sources.push({x:p.x,y:p.y});
  }
  islands=islands.filter(g=>g.sources.length);
 }
 const unique=new Set(sources.map(positionKey));
 if(sources.length!==options.foodSources||unique.size!==sources.length||sources.some(p=>world.tile(p.x,p.y)?.terrain!=='land'))
  throw new Error('Не удалось разместить точное число разных источников на суше.');
 const changed=options.foodRegrowInterval!==world.foodSettings.regrowInterval||current.length!==sources.length||
  sources.some(p=>world.tile(p.x,p.y).maxFood!==p.maxFood);
 return {options,sources,islands,changed};
}
