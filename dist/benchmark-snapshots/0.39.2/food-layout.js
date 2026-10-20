/** Размещение выбранного запаса пищи на большой карте.
 * Меняются только места: каждый источник переносится с той же ёмкостью
 * и начальным содержимым. Случайность раскладки отдельная от геномов и физики.
 * islands — сведения наблюдателя; мозг получает только увиденные соседние клетки.
 */
import {Random} from './simulation.js';
import {worldAxial,localDistance} from './navigation.js';
export const worldDistance=(a,b)=>localDistance(worldAxial(a),worldAxial(b));
export function placeFoodIslands(tiles,template,seed,width,height,{anchorFirstIsland=true}={}){
 const random=new Random(seed^0x784ea133),land=tiles.filter(c=>c.terrain==='land');
 for(const tile of tiles){tile.food=0;tile.maxFood=0;}
 if(!template.length)return [];
 const count=Math.min(8,Math.max(1,Math.min(Math.floor(template.length/3),Math.round(Math.sqrt(template.length)*.8))));
 // При начальной генерации первый остров доступен из стартовой области.
 // Вмешательство может отключить эту привязку. Остальные центры выбираются
 // далеко от уже выбранных, без добавления сведений о них жителям.
 const starters=land.filter(c=>c.x>=3&&c.x<20&&c.y>=3&&c.y<14);
 const first=anchorFirstIsland?starters:land;
 const centres=[first[Math.floor(random.next()*first.length)]??land[0]];
 const candidates=land.filter(c=>c.x>=2&&c.y>=2&&c.x<width-2&&c.y<height-2);
 while(centres.length<count){
  let best=null,score=-Infinity;
  for(const tile of candidates){
   const distance=Math.min(...centres.map(c=>worldDistance(c,tile)));
   const value=distance+random.next()*1.5;
   if(value>score){score=value;best=tile;}
  }
  centres.push(best);
 }
 // Перемешивание меняет набор ёмкостей внутри острова, сохраняя общий список.
 const sources=template.slice();
 for(let i=sources.length-1;i>0;i--){const j=Math.floor(random.next()*(i+1));[sources[i],sources[j]]=[sources[j],sources[i]];}
 const used=new Set(),islands=centres.map((c,id)=>({id,centre:{x:c.x,y:c.y},sources:[]}));
 for(let group=0;group<count;group++){
  const inventory=sources.filter((_,i)=>i%count===group);
  // Ближайшие свободные клетки дают компактную группу. Вода исключена заранее.
  // Случайный ключ разрывает равенство расстояний, не перемещая центр острова.
  const nearby=land.filter(c=>!used.has(c)).map(c=>({tile:c,d:worldDistance(c,centres[group]),tie:random.next()}))
   .sort((a,b)=>a.d-b.d||a.tie-b.tie);
  inventory.forEach((source,i)=>{
   const tile=nearby[i].tile;used.add(tile);tile.food=source.food;tile.maxFood=source.maxFood;
   islands[group].sources.push({x:tile.x,y:tile.y});
  });
 }
 return islands;
}
