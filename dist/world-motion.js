/** Только наблюдатель. Подтверждённые рёбра маршрута не становятся знаниями
 * мозга; пиксельная позиция не записывается в особь/сохранение/RNG. */
import {hexCenter,WORLD_WIDTH} from './evolution.js';
import {DURATION_SUBSTEPS} from './action-timing.js';
export const MOTION_RULES=Object.freeze({fps:30,maxFrameMs:100,frameBudgetFraction:.2,
 maxDelayMs:250,maxProgressDelayMs:500,maxMoves:8192,maxPointsPerAgent:32,maxPoints:16384,hitRadius:12});
const STRIDE=4;
export function agentPoint(agent){const p=hexCenter(agent),angle=agent.id*2.399963;return {x:p.x+Math.cos(angle)*7,y:p.y+Math.sin(angle)*7};}
function adjacent(x,y,nx,ny){const dx=nx-x,dy=ny-y;return dy===0?Math.abs(dx)===1:Math.abs(dy)===1&&(dx===(y&1)-1||dx===(y&1));}
/** Подтверждённая доля незавершённого действия, а не предсказание следующего
 * подшага. Ключ отличает продолжение процесса от отмены и нового старта. */
function movement(a,tick){
 const m=a.movement;
 if(!m||!Number.isFinite(m.elapsed)||!Number.isFinite(m.duration)||m.duration<=0||m.elapsed<0||m.elapsed>m.duration||!adjacent(a.x,a.y,m.x,m.y))return null;
 const from=a.y*WORLD_WIDTH+a.x,to=m.y*WORLD_WIDTH+m.x,p=agentPoint(a),end=agentPoint({id:a.id,x:m.x,y:m.y}),f=m.elapsed/m.duration;
 return {key:`${from}:${to}:${tick-m.elapsed}`,from,to,start:tick-m.elapsed,point:{x:p.x+(end.x-p.x)*f,y:p.y+(end.y-p.y)*f}};
}

/** Один заранее выделенный буфер: O(1) на реальное перемещение. При переполнении
 * вместо выдуманного сокращения маршрута следующий кадр привязывается к факту. */
export class MotionCapture{
 constructor(){this.buffer=new Float64Array(MOTION_RULES.maxMoves*STRIDE);this.generation=0;this.enabled=false;this.reset(0);}
 reset(subtick){this.generation++;this.from=subtick;this.count=0;this.overflow=false;this.discontinuous=true;}
 configure(enabled,subtick){if(this.enabled!==enabled){this.enabled=enabled;this.reset(subtick);}}
 moved(agent,x,y,subtick){
  if(!this.enabled||this.overflow||x===agent.x&&y===agent.y)return;
  if(!adjacent(x,y,agent.x,agent.y)||this.count===MOTION_RULES.maxMoves){this.overflow=true;this.count=0;return;}
  const at=this.count++*STRIDE;this.buffer[at]=agent.id;this.buffer[at+1]=y*WORLD_WIDTH+x;
  this.buffer[at+2]=agent.y*WORLD_WIDTH+agent.x;this.buffer[at+3]=subtick;
 }
 take(subtick){
  const packet={generation:this.generation,from:this.from,to:subtick,reset:this.discontinuous||this.overflow,moves:this.buffer.slice(0,this.count*STRIDE)};
  this.from=subtick;this.count=0;this.overflow=false;this.discontinuous=false;return packet;
 }
}

/** Быстрый показ воспроизводит завершённые рёбра; медленный — известный
 * прогресс текущего действия. Пауза замораживает экранную
 * точку, отмена действия возвращает её к исходной физической клетке. */
export class MotionPlayer{
 constructor(){this.tracks=new Map();this.active=false;this.tick=0;this.latest=0;this.lastArrival=0;this.generation=null;this.preview=false;this.paused=true;}
 makeTrack(agent,tick){const physical=agentPoint(agent),move=this.preview?movement(agent,tick):null,point={...(move?.point??physical)};return {point,cell:agent.y*WORLD_WIDTH+agent.x,physical,points:[{...point,tick}],fresh:true,move};}
 snap(agents,packet,now,animate=true){
  this.tracks.clear();this.latest=this.tick=packet?.to??0;this.generation=packet?.generation;this.preview=packet?.preview===true;this.paused=!animate;
  for(const a of agents)this.tracks.set(a.id,this.makeTrack(a,this.tick));
  this.active=false;this.lastArrival=now;this.endAt=now;
 }
 settle(){if(!this.preview){for(const t of this.tracks.values()){Object.assign(t.point,t.physical);t.points=[{...t.physical,tick:this.latest}];}this.tick=this.latest;}this.active=false;this.paused=true;}
 accept(agents,packet,now,animate=true){
  const preview=packet?.preview===true;
  // На паузе сохраняем именно последнюю нарисованную точку. Ручной подшаг
  // уже остановленного мира, напротив, показывает новую известную долю.
  if(animate)this.sample(now);
  if(!packet||packet.reset||preview!==this.preview||packet.generation!==this.generation||packet.from!==this.latest||packet.to<this.latest||packet.to===this.latest&&packet.moves.length||!animate&&this.paused&&packet.to>this.latest){this.snap(agents,packet,now,animate);return;}
  const alive=new Map(agents.map(a=>[a.id,a]));
  for(const id of this.tracks.keys())if(!alive.has(id))this.tracks.delete(id);
  for(const a of agents){const t=this.tracks.get(a.id);if(t)t.fresh=false;else this.tracks.set(a.id,this.makeTrack(a,packet.to));}
  const broken=new Set(),completed=new Set();
  for(let at=0;at<packet.moves.length;at+=STRIDE){
   const id=packet.moves[at],from=packet.moves[at+1],to=packet.moves[at+2],tick=packet.moves[at+3],t=this.tracks.get(id);
   if(!t||t.fresh||broken.has(id))continue;
   if(t.cell!==from||tick<packet.from||tick>packet.to||t.points.length+2>MOTION_RULES.maxPointsPerAgent){broken.add(id);continue;}
   if(preview&&t.move?.from===from&&t.move.to===to)completed.add(id);
   const p=agentPoint({id,x:to%WORLD_WIDTH,y:Math.floor(to/WORLD_WIDTH)}),last=t.points.at(-1),start=Math.max(packet.from,last.tick,tick-DURATION_SUBSTEPS.move);
   if(start>last.tick)t.points.push({x:last.x,y:last.y,tick:start});
   t.points.push({...p,tick});t.cell=to;
  }
  let count=0;
  for(const a of agents){let t=this.tracks.get(a.id);
   const next=preview?movement(a,packet.to):null;
   const cancelled=preview&&t.move&&t.move.key!==next?.key&&!completed.has(a.id);
   if(cancelled||broken.has(a.id)||t.cell!==a.y*WORLD_WIDTH+a.x){t=this.makeTrack(a,packet.to);this.tracks.set(a.id,t);}
   if(next){
    const last=t.points.at(-1);
    if(next.start>last.tick)t.points.push({x:last.x,y:last.y,tick:next.start});
    if(packet.to>t.points.at(-1).tick)t.points.push({...next.point,tick:packet.to});
    if(t.points.length>MOTION_RULES.maxPointsPerAgent){t=this.makeTrack(a,packet.to);this.tracks.set(a.id,t);}
   }
   t.move=next;
   t.physical=agentPoint(a);count+=t.points.length;
  }
  if(count>MOTION_RULES.maxPoints){this.snap(agents,packet,now,animate);return;}
  if(animate&&(packet.to>this.latest||this.paused)){
   this.startTick=this.tick;this.endTick=packet.to;this.startAt=now;
   this.endAt=now+Math.min(preview?MOTION_RULES.maxProgressDelayMs:MOTION_RULES.maxDelayMs,Math.max(1000/MOTION_RULES.fps,preview?packet.intervalMs:now-this.lastArrival));
  }
  this.latest=packet.to;this.lastArrival=now;
  this.active=animate&&[...this.tracks.values()].some(t=>t.points.length>1);this.paused=!animate;
 }
 sample(now){
  if(!this.active)return;
  const fraction=Math.min(1,Math.max(0,(now-this.startAt)/(this.endAt-this.startAt)));
  this.tick=this.startTick+(this.endTick-this.startTick)*fraction;let moving=false;
  for(const t of this.tracks.values()){
   while(t.points.length>1&&t.points[1].tick<=this.tick)t.points.shift();
   const a=t.points[0],b=t.points[1];
   if(b){const f=Math.min(1,Math.max(0,(this.tick-a.tick)/Math.max(1e-9,b.tick-a.tick)));t.point.x=a.x+(b.x-a.x)*f;t.point.y=a.y+(b.y-a.y)*f;moving=true;}
   else{t.point.x=a.x;t.point.y=a.y;}
  }
  this.active=moving&&fraction<1;
 }
 point(agent){return this.tracks.get(agent.id)?.point??agentPoint(agent);}
 hitTest(agents,x,y,radius=MOTION_RULES.hitRadius){let nearest=null,distance=radius*radius;
  for(const a of agents){const p=this.point(a),d=(p.x-x)**2+(p.y-y)**2;if(d<=distance){distance=d;nearest=a;}}return nearest;
 }
}
