/** География принадлежит физике и наблюдателю, а не мозгу.
 * Отдельные RNG рельефа и размещения не расходуют случайность действий/генов.
 * Профили явно различают новую карту, старую карту с равномерным стартом
 * и полностью прежние условия. Их ID записывается в наблюдения/испытания.
 */
import {Random} from './simulation.js';
import {worldAxial,localDistance} from './navigation.js';
export const DEFAULT_GEOGRAPHY='lakes-rivers-v1';
export const GEOGRAPHY_PROFILES=Object.freeze([
 {id:DEFAULT_GEOGRAPHY,label:'Реки и озёра · равномерный старт',terrain:'lakes-rivers-v1',placement:'balanced-land-v1'},
 {id:'legacy-uniform-v1',label:'Прежняя карта · равномерный старт',terrain:'legacy-strip-v1',placement:'balanced-land-v1'},
 {id:'legacy-v1',label:'Прежняя карта и прежний старт',terrain:'legacy-strip-v1',placement:'legacy-region-v1'},
]);
export function validateGeography(id=DEFAULT_GEOGRAPHY){
 if(!GEOGRAPHY_PROFILES.some(p=>p.id===id))throw new Error('Неизвестный вариант географии и старта.');
 return id;
}
export function geographyLabel(id){return GEOGRAPHY_PROFILES.find(p=>p.id===(id??'legacy-v1'))?.label??'Неизвестная география';}
export const TERRAIN_LIMITS=Object.freeze({targetWaterMin:.10,targetWaterMax:.20});
const cellKey=p=>`${p.x},${p.y}`;
const separation=(a,b)=>localDistance(worldAxial(a),worldAxial(b));
export function geographicNeighbours(p,width,height){
 const odd=p.y&1;
 return [[1,0],[-1,0],[odd-1,-1],[odd,-1],[odd-1,1],[odd,1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}))
  .filter(p=>p.x>=0&&p.y>=0&&p.x<width&&p.y<height);
}
function shuffled(values,random){const copy=values.slice();for(let i=copy.length-1;i>0;i--){const j=Math.floor(random.next()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
/** Река — непрерывный путь соседних гексов, ширина первого блока — один гекс.
 * Шум отклоняет путь от кратчайшего; повторные клетки исключены. Ограничение
 * длины защищает от бесконечного обхода. Река может кончиться внутри карты.
 */
export function riverPath(start,end,width,height,random){
 const path=[start],visited=new Set([cellKey(start)]);let current=start;
 while(separation(current,end)>0&&path.length<2*(width+height)){
  const options=geographicNeighbours(current,width,height).filter(p=>!visited.has(cellKey(p)))
   .map(p=>({p,score:separation(p,end)+random.next()*2.4})).sort((a,b)=>a.score-b.score);
  if(!options.length)break;current=options[0].p;visited.add(cellKey(current));path.push(current);
 }
 return path;
}
/** Брод — проходимый разрыв, без отдельной цены движения или плавания.
 * Выбираем воду реки с двумя разнесёнными сухими соседями: соединяем берега
 * через этот гекс, а не ставим случайную сухую точку посреди большого озера.
 * Брод может соединить уже связные берега; все районы принудительно не соединяем.
 */
export function carveRiverFords(tiles,paths,width,height,random){
 const tile=p=>tiles[p.y*width+p.x];let count=0;
 for(const path of paths){
  if(random.next()>.75)continue;
  const eligible=path.slice(2,-2).filter(p=>{
   const c=tile(p);if(c.terrain!=='water'||c.feature!=='river')return false;
   const banks=geographicNeighbours(p,width,height).filter(p=>tile(p).terrain==='land');
   return banks.some((a,i)=>banks.slice(i+1).some(b=>separation(a,b)>=2));
  });
  for(const p of shuffled(eligible,random).slice(0,1+Math.floor(random.next()*2))){
   const c=tile(p);if(c.terrain!=='water')continue;
   Object.assign(c,{terrain:'land',feature:'ford',food:0,maxFood:0,risk:0});count++;
  }
 }
 return count;
}
/** Случайная цель — 10…20% площади под воду. Реки получают до 75% бюджета,
 * остаток — озёра. Броды уменьшают итоговую долю. Вода никогда не превышает
 * 20%; для 48×32 остаётся достаточно суши для 1000 разных основателей.
 * Это геометрическое ограничение, не гарантия еды/выживания каждого района.
 */
export function createLakesAndRivers(tiles,width,height,seed){
 const random=new Random(seed^0x1f43ac69),tile=p=>tiles[p.y*width+p.x];
 for(const c of tiles)Object.assign(c,{terrain:'land',feature:null});
 const targetWaterCells=Math.floor(tiles.length*(TERRAIN_LIMITS.targetWaterMin+random.next()*(TERRAIN_LIMITS.targetWaterMax-TERRAIN_LIMITS.targetWaterMin)));
 const riverBudget=Math.floor(targetWaterCells*.75),paths=[];let waterCells=0,riverCount=0,lakeCount=0;
 const paint=(p,feature)=>{const c=tile(p);if(c.terrain==='water')return false;Object.assign(c,{terrain:'water',feature,food:0,maxFood:0,risk:0});waterCells++;return true;};
 for(let i=0,n=1+Math.floor(random.next()*3);i<n&&waterCells<riverBudget;i++){
  const horizontal=random.next()<.5,reverse=random.next()<.5;
  const start=horizontal?{x:reverse?width-1:0,y:Math.floor(random.next()*height)}:{x:Math.floor(random.next()*width),y:reverse?height-1:0};
  const end=random.next()<.35?{x:Math.floor(random.next()*width),y:Math.floor(random.next()*height)}:
   horizontal?{x:reverse?0:width-1,y:Math.floor(random.next()*height)}:{x:Math.floor(random.next()*width),y:reverse?0:height-1};
  const path=riverPath(start,end,width,height,random),actual=[];
  for(const p of path){if(tile(p).terrain!=='water'&&waterCells>=riverBudget)break;paint(p,'river');actual.push(p);}
  if(actual.length){paths.push(actual);riverCount++;}
 }
 const lakeTarget=1+Math.floor(random.next()*3);
 for(let i=0;i<lakeTarget&&waterCells<targetWaterCells;i++){
  const land=tiles.filter(c=>c.terrain==='land');if(!land.length)break;
  // Выбираем центр среди нескольких сухих кандидатов, предпочитая простор.
  // Затем наращиваем связное компактное пятно от центра по сухому фронту.
  const candidates=Array.from({length:12},()=>land[Math.floor(random.next()*land.length)]);
  const degree=p=>geographicNeighbours(p,width,height).filter(p=>tile(p).terrain==='land').length;
  const centre=candidates.sort((a,b)=>degree(b)-degree(a))[0];
  const quota=Math.ceil((targetWaterCells-waterCells)/(lakeTarget-i)),frontier=new Map([[cellKey(centre),centre]]);let painted=0;
  while(frontier.size&&painted<quota&&waterCells<targetWaterCells){
   const selected=[...frontier.values()].map(p=>({p,score:separation(p,centre)+random.next()*1.3})).sort((a,b)=>a.score-b.score)[0].p;
   frontier.delete(cellKey(selected));if(tile(selected).terrain==='water')continue;
   paint(selected,'lake');painted++;
   for(const p of geographicNeighbours(selected,width,height))if(tile(p).terrain==='land')frontier.set(cellKey(p),p);
  }
  if(painted)lakeCount++;
 }
 const fordCells=carveRiverFords(tiles,paths,width,height,random);
 return {terrainGeneration:'lakes-rivers-v1',targetWaterCells,waterCells:waterCells-fordCells,riverCount,lakeCount,fordCells};
}
/** Связность — только сведения наблюдателя. regionId не отправляется мозгу.
 * Каждый сухой гекс, включая брод, входит ровно в один район. Вода имеет −1.
 */
export function classifyLandRegions(tiles,width,height){
 for(const c of tiles)c.regionId=-1;
 const regions=[];
 for(const start of tiles){
  if(start.terrain!=='land'||start.regionId!==-1)continue;
  const id=regions.length,queue=[start];start.regionId=id;
  for(let i=0;i<queue.length;i++)for(const p of geographicNeighbours(queue[i],width,height)){
   const c=tiles[p.y*width+p.x];if(c.terrain==='land'&&c.regionId===-1){c.regionId=id;queue.push(c);}
  }
  regions.push({id,cells:queue.length,initialFounders:0,initialSources:0});
 }
 return regions;
}
/** Пространственно равномерный старт, а не независимые случайные точки.
 * Суша рекурсивно делится на участки с примерно равным числом клеток на одного
 * основателя; по одному месту выбирается в каждом конечном участке.
 * Разрез идёт по длинной стороне, без чтения food/risk/генома. Пропорция суши
 * сохраняется даже при озёрах. Позиции затем перемешиваются независимо от генов.
 * При N ≤ числу сухих клеток основатели не совпадают на одном гексе.
 */
export function balancedFounderPositions(tiles,count,seed){
 const land=tiles.filter(c=>c.terrain==='land'),random=new Random(seed^0x45c73a11),positions=[];
 if(!Number.isInteger(count)||count<1||count>land.length)throw new Error('Для равномерного старта недостаточно разных сухих клеток.');
 function divide(cells,n){
  if(n===1){const c=cells[Math.floor(random.next()*cells.length)];positions.push({x:c.x,y:c.y});return;}
  const spanX=Math.max(...cells.map(c=>c.x))-Math.min(...cells.map(c=>c.x)),spanY=Math.max(...cells.map(c=>c.y))-Math.min(...cells.map(c=>c.y));
  const horizontal=spanX*Math.sqrt(3)>=spanY*1.5,ordered=cells.slice().sort((a,b)=>horizontal?a.x-b.x||a.y-b.y:a.y-b.y||a.x-b.x);
  const left=Math.floor(n/2),cut=Math.floor(ordered.length*left/n);
  divide(ordered.slice(0,cut),left);divide(ordered.slice(cut),n-left);
 }
 divide(land,count);return shuffled(positions,random);
}
