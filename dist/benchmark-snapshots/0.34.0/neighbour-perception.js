/** Текущая видимость, отдельно от памяти мест и личного обучения.
 * Индекс принадлежит миру. Map клетки содержит Set стабильных ID, без тел
 * и родословных. Второй Map позволяет убрать ID из прежней клетки за O(1).
 * Нормальные шаги/рождения/смерти обновляют индекс сразу, в порядке действий.
 * Поэтому следующий житель видит уже совершившиеся перемещения, не будущее.
 */
import {key} from './simulation.js';
import {localNeighbours,memoryWorldPosition} from './navigation.js';
export const NEIGHBOUR_SCHEMA='visible-neighbours-v1';
export const densitySignal=count=>count/(count+1);
export function createOccupancy(){return {cells:new Map(),locations:new Map()};}
export function removeOccupant(index,id){
 const old=index.locations.get(id);if(old===undefined)return;
 const cell=index.cells.get(old);cell.delete(id);if(!cell.size)index.cells.delete(old);
 index.locations.delete(id);
}
export function placeOccupant(index,agent){
 removeOccupant(index,agent.id);if(!agent.alive)return;
 const location=key(agent.x,agent.y);let cell=index.cells.get(location);
 if(!cell){cell=new Set();index.cells.set(location,cell);}
 cell.add(agent.id);index.locations.set(agent.id,location);
}
export function countOthers(index,agent,x,y){
 const cell=index.cells.get(key(x,y));return cell?cell.size-Number(cell.has(agent.id)):0;
}
/** ID узнаваем только при непосредственном контакте на одной клетке.
 * Не строим список для каждого прохода сети: он нужен панели/будущему выбору
 * цели. В толпе это предотвращает копирование всех ID для всех жителей.
 * Мозг v8 пока использует только количества; ID не превращается в число веса.
 */
export function contactIds(index,agent){
 if(!agent.alive)return [];
 return [...(index.cells.get(key(agent.x,agent.y))??[])].filter(id=>id!==agent.id);
}
/** Семь локальных клеток; за краем карты нет наблюдения. Никаких глобальных
 * x/y, ID соседних клеток, сведений об их здоровье/действиях/родстве.
 * Не сохраняется в память: исчезновение из обзора сразу убирает контакт.
 */
export function visibleNeighbours(world,agent){
 const positions=[agent.brain.position,...localNeighbours(agent.brain)],cells=[];
 let visibleCount=0,ownCount=0;
 if(agent.alive)for(let i=0;i<positions.length;i++){
  const p=positions[i],w=memoryWorldPosition(agent,p);if(!world.tile(w.x,w.y))continue;
  const count=countOthers(world.occupancy,agent,w.x,w.y);
  cells.push({q:p.q,r:p.r,action:i===0?null:i-1,count});visibleCount+=count;
  if(i===0)ownCount=count;
 }
 return {schema:NEIGHBOUR_SCHEMA,ownCount,visibleCount,cells};
}
