/** Текущая деятельность, без личностей, намерений и социальной памяти.
 * Координатор один раз на общую границу собирает 11 счётчиков на клетку.
 * Движение видно на исходном гексе до завершения; направления переводятся
 * в систему взгляда наблюдателя. Новые решения видны со следующей границы. */
import {ACTION_TURNS} from './navigation.js';
import {ACTIONS} from './action-catalog.js';
export const ACTIVITY_COUNT=ACTIONS.length;
export const ACTIVITY_NAMES=Object.freeze(ACTIONS.map((name,i)=>i<6?'Движутся: '+name.toLowerCase():'Выполняют: '+name.toLowerCase()));

function worldActivity(a){
 const p=a.process;if(!p)return -1;
 return p.action<6?(a.frameRotation+a.brain.facing+ACTION_TURNS[p.action])%6:p.action;
}
export function rebuildActivities(w){
 let s=w._activities;
 if(!s)s=w._activities={counts:new Int32Array(w.tiles.length*ACTIVITY_COUNT),marked:new Uint8Array(w.tiles.length),width:w.tiles.at(-1).x+1,touched:[],epoch:-1,revision:0};
 // Очищаем только ранее занятые строки, а не обходим всю карту.
 for(const at of s.touched){s.counts.fill(0,at,at+ACTIVITY_COUNT);s.marked[at/ACTIVITY_COUNT]=0;}
 s.touched.length=0;
 for(const a of w.agents){
  const action=worldActivity(a);a._observedActivity=action;if(!a.alive||action<0)continue;
  const cell=a.y*s.width+a.x,at=cell*ACTIVITY_COUNT;
  // Метка строки не зависит от того, какие категории в ней уже встречались.
  if(!s.marked[cell]){s.marked[cell]=1;s.touched.push(at);}
  s.counts[at+action]++;
 }
 s.epoch=w._viewEpoch;
 s.revision++;
 // Собственную деятельность исключаем по тому же снимку, а не по решению,
 // уже принятому в текущем проходе. Иначе порядок жителей менял бы входы.
 return s;
}
export function sampleActivities(w,a,tile,out){
 const s=w._activities?.epoch===w._viewEpoch?w._activities:rebuildActivities(w);
 const at=(tile.y*s.width+tile.x)*ACTIVITY_COUNT,rotation=(a.frameRotation+a.brain.facing)%6,own=tile.x===a.x&&tile.y===a.y;
 for(let i=0;i<ACTIVITY_COUNT;i++){
  const category=i<6?(rotation+ACTION_TURNS[i])%6:i;
  out[i]=s.counts[at+category]-Number(own&&a.alive&&category===a._observedActivity);
 }
 return out;
}
