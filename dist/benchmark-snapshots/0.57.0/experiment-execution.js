import {ParallelWorld} from './parallel-world.js';
import {clearCognitionSummary} from './cognition-summary.js';
/** Перестройка владельцев только между целыми шагами. Старый пул остаётся
 * пригодным до подтверждения нового; операция не расходует мировой RNG. */
export class ExperimentExecution{
 constructor(world,createWorker){this.world=world;this.createWorker=createWorker;this.pool=null;this.count=1;this.changes=[];}
 async resize(count){
  if(count===this.count)return;
  const old=this.pool;let next=null;
  if(old)await old.syncAll();
  try{if(count>1){next=new ParallelWorld(this.world,{workers:count,...(this.createWorker?{createWorker:this.createWorker}:{})});await next.ready();await next.attach();}}
  catch(error){await next?.close();throw error;}
  this.pool=next;this.count=count;if(!next)for(const a of this.world.agents)clearCognitionSummary(a);
  await old?.close();this.changes.push({tick:this.world.tick,workers:count});
 }
 async step(){if(this.pool)await this.pool.step();else this.world.step();}
 async sync(){await this.pool?.syncAll();}
 async close(){await this.pool?.close();}
}
