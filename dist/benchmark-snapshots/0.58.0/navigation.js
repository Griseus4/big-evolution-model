/** Личная навигация на гексах. Здесь нет карты, пищи и случайного генератора.
 * Мозг хранит осевые q/r относительно рождения и направление взгляда 0..5.
 * Физика знает поворот личной системы к миру; мозг его не получает.
 * Учёт успешных шагов пока точный, без ошибки ориентирования.
 */
export const ACTION_TURNS=[0,3,4,5,2,1];
const STEPS=[{q:1,r:0},{q:0,r:1},{q:-1,r:1},{q:-1,r:0},{q:0,r:-1},{q:1,r:-1}];
export const positionKey=p=>`${p.q},${p.r}`;
export const worldAxial=p=>({q:p.x-(p.y-(p.y&1))/2,r:p.y});
export const worldOffset=p=>({x:p.q+(p.r-(p.r&1))/2,y:p.r});
export const localDistance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
export function rotate(p,turns){
 let {q,r}=p;for(let i=0;i<((turns%6)+6)%6;i++){[q,r]=[-r,q+r];}
 return {q,r};
}
/** Направления согласованы с прежними шестью колонками генома, но теперь
 * они относительны взгляду. После движения взгляд поворачивается туда же.
 */
export function localNeighbours(brain){
 return ACTION_TURNS.map(turn=>{
  const direction=(brain.facing+turn)%6,step=STEPS[direction];
  return {q:brain.position.q+step.q,r:brain.position.r+step.r,direction};
 });
}
export function moveLocally(brain,action){
 const next=localNeighbours(brain)[action];
 brain.position={q:next.q,r:next.r};brain.facing=next.direction;brain.spatialCache=null;
}
/** Только физика/наблюдатель вызывают это преобразование. Положение самого
 * жителя берётся из мира, а личное смещение — из его учёта шагов.
 */
export function memoryWorldPosition(agent,place){
 const origin=worldAxial(agent),delta=rotate({q:place.q-agent.brain.position.q,r:place.r-agent.brain.position.r},agent.frameRotation);
 return worldOffset({q:origin.q+delta.q,r:origin.r+delta.r});
}
