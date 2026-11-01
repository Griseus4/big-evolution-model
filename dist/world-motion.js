/** Только наблюдатель. Подтверждённые рёбра маршрута не становятся знаниями
 * мозга; пиксельная позиция не записывается в особь/сохранение/RNG. */
import {hexCenter,WORLD_WIDTH} from './evolution.js';
import {DURATION_SUBSTEPS} from './action-timing.js';
export const MOTION_RULES=Object.freeze({fps:30,maxFrameMs:100,frameBudgetFraction:.2,
 maxDelayMs:250,maxMoves:8192,maxPointsPerAgent:32,maxPoints:16384,hitRadius:12});
const STRIDE=4;
export function agentPoint(agent){const p=hexCenter(agent),angle=agent.id*2.399963;return {x:p.x+Math.cos(angle)*7,y:p.y+Math.sin(angle)*7};}
function adjacent(x,y,nx,ny){const dx=nx-x,dy=ny-y;return dy===0?Math.abs(dx)===1:Math.abs(dy)===1&&(dx===(y&1)-1||dx===(y&1));}

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

/** Не более 250 мс воспроизведения после последнего снимка. Новый пакет сжимает
 * оставшийся известный путь во времени, но не соединяет его концы прямой.
 * Пауза, неизвестный путь, рождение и разрыв истории показываются без анимации. */
export class MotionPlayer{
 constructor(){this.tracks=new Map();this.active=false;this.tick=0;this.latest=0;this.lastArrival=0;this.generation=null;}
 makeTrack(agent,tick){const point=agentPoint(agent);return {point,cell:agent.y*WORLD_WIDTH+agent.x,physical:{...point},points:[{...point,tick}],fresh:true};}
 snap(agents,packet,now){
  this.tracks.clear();this.latest=this.tick=packet?.to??0;this.generation=packet?.generation;
  for(const a of agents)this.tracks.set(a.id,this.makeTrack(a,this.tick));
  this.active=false;this.lastArrival=now;this.endAt=now;
 }
 settle(){for(const t of this.tracks.values()){Object.assign(t.point,t.physical);t.points=[{...t.physical,tick:this.latest}];}this.tick=this.latest;this.active=false;}
 accept(agents,packet,now,animate=true){
  this.sample(now);
  if(!animate||!packet||packet.reset||packet.generation!==this.generation||packet.from!==this.latest||packet.to<this.latest||packet.to===this.latest&&packet.moves.length){this.snap(agents,packet,now);return;}
  const alive=new Map(agents.map(a=>[a.id,a]));
  for(const id of this.tracks.keys())if(!alive.has(id))this.tracks.delete(id);
  for(const a of agents){const t=this.tracks.get(a.id);if(t)t.fresh=false;else this.tracks.set(a.id,this.makeTrack(a,packet.to));}
  let broken=new Set();
  for(let at=0;at<packet.moves.length;at+=STRIDE){
   const id=packet.moves[at],from=packet.moves[at+1],to=packet.moves[at+2],tick=packet.moves[at+3],t=this.tracks.get(id);
   if(!t||t.fresh||broken.has(id))continue;
   if(t.cell!==from||tick<packet.from||tick>packet.to||t.points.length+2>MOTION_RULES.maxPointsPerAgent){broken.add(id);continue;}
   const p=agentPoint({id,x:to%WORLD_WIDTH,y:Math.floor(to/WORLD_WIDTH)}),last=t.points.at(-1),start=Math.max(packet.from,last.tick,tick-DURATION_SUBSTEPS.move);
   if(start>last.tick)t.points.push({x:last.x,y:last.y,tick:start});
   t.points.push({...p,tick});t.cell=to;
  }
  let count=0;
  for(const a of agents){let t=this.tracks.get(a.id);
   if(broken.has(a.id)||t.cell!==a.y*WORLD_WIDTH+a.x){t=this.makeTrack(a,packet.to);this.tracks.set(a.id,t);}
   t.physical=agentPoint(a);count+=t.points.length;
  }
  if(count>MOTION_RULES.maxPoints){this.snap(agents,packet,now);return;}
  if(packet.to>this.latest){
   this.startTick=this.tick;this.endTick=packet.to;this.startAt=now;
   this.endAt=now+Math.min(MOTION_RULES.maxDelayMs,Math.max(1000/MOTION_RULES.fps,now-this.lastArrival));
  }
  this.latest=packet.to;this.lastArrival=now;
  this.active=[...this.tracks.values()].some(t=>t.points.length>1);
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
