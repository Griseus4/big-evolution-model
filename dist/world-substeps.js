/** Медленный наблюдатель использует те же физические и когнитивные фазы,
 * что ParallelWorld.step, но отдаёт управление после одного подшага.
 * Обычный быстрый путь не получает дополнительных сообщений/снимков. */
import {advancePhysiologyBodies} from './physiology-world.js';
import {advanceTemporalBodies,finishTemporal} from './temporal-world.js';
export async function parallelSubstep(pool){
 pool.ensureOpen();if(pool.busy)throw new Error('Подшаг мира уже выполняется.');pool.busy=true;
 try{
  const w=pool.world;if(!w.agents.length)return;
  if(w.physiology){await pool.cognition();advancePhysiologyBodies(w,a=>pool.removed(a));finishTemporal(w);return;}
  if(!w._primed){await pool.cognition(true);w._primed=true;}
  if(w.agents.length){advanceTemporalBodies(w,a=>pool.removed(a));await pool.cognition(false);}
  finishTemporal(w);
 }catch(error){pool.fail(error);throw error;}finally{pool.busy=false;}
}
