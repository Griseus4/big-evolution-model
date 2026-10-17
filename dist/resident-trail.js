/** След наблюдателя: только одна выбранная жизнь, максимум 20 перемещений.
 * 21 точка образует 20 отрезков. Ожидание/еда/рождение не стирают маршрут.
 * Объект живёт у наблюдателя в расчётном Worker, не в мозге/геноме.
 * Повторный клик той же особи сохраняет след; новая жизнь/мир очищает его. */
export const TRAIL_MOVES=20;
export class ResidentTrail {
 constructor(){this.world=null;this.id=null;this.points=[];}
 select(world,agent){
  if(this.world===world&&this.id===agent?.id)return;
  this.world=world;this.id=agent?.id??null;this.points=agent?[{x:agent.x,y:agent.y}]:[];
 }
 moved(agent){
  if(agent.id!==this.id)return;
  const last=this.points.at(-1);if(last?.x===agent.x&&last?.y===agent.y)return;
  this.points.push({x:agent.x,y:agent.y});
  if(this.points.length>TRAIL_MOVES+1)this.points.shift();
 }
}
/** Подключаем только наблюдаемый основной мир. Событие приходит после
 * перемещения, даже если между кадрами прошло много шагов. Испытания без следа.
 * Делегирование сохраняет физику moveAgent и не расходует случайность. */
export function attachResidentTrail(world,trail){
 const move=world.moveAgent.bind(world);
 world.moveAgent=(agent,destination)=>{move(agent,destination);trail.moved(agent);};
}
