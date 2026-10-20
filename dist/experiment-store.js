import {experimentArchive,openExperimentArchive} from './experiment-archive.js';
/** Отчёты хранятся по завершённым попыткам, а не одним растущим JSON
 * при каждом сообщении прогресса. Личные мозги в хранилище не попадают. */
export class ExperimentStore{
 constructor(database=globalThis.indexedDB){this.ready=!database?Promise.resolve(null):new Promise(resolve=>{const r=database.open('big-evolution-experiments',1);r.onupgradeneeded=()=>{for(const name of ['runs','attempts','templates'])r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});}
 async transaction(store,mode,action){const db=await this.ready;if(!db)throw new Error('Хранилище браузера недоступно. Скачайте результаты.');return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),stores=Array.isArray(store)?Object.fromEntries(store.map(name=>[name,tx.objectStore(name)])):tx.objectStore(store),r=action(stores);let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(new Error('Не удалось сохранить/прочитать данные. Скачайте результаты; освободите место или удалите старые опыты.'));});}
 async save(report){
  if(!await this.ready)throw new Error('Хранилище браузера недоступно. Скачайте результаты.');
  this.saved??=new WeakMap();if(!this.saved.has(report))this.saved.set(report,new Set());const saved=this.saved.get(report),updates=[];
  // Сжатие асинхронно: новая завершённая попытка не должна попасть в
  // оглавление раньше, чем для неё подготовлен блок этой же записи.
  const groups=report.groups.map(g=>({...g,attempts:g.attempts.map(a=>({...a}))}));
  const meta={...report,groups:groups.map(g=>({...g,attempts:g.attempts.map(a=>({id:a.id,number:a.number,seed:a.seed,status:a.status,tick:a.tick}))}))};
  for(const g of groups)for(const a of g.attempts)if(a.status!=='running'&&!saved.has(a.id)){const blob=await experimentArchive({groups:[{attempts:[a]}]});updates.push({id:a.id,blob});}
  // Блоки и оглавление фиксируются одной транзакцией: при нехватке места
  // прежний сохранённый опыт не превращается в смесь двух импортов.
  await this.transaction(['attempts','runs'],'readwrite',s=>{for(const item of updates)s.attempts.put(item.blob,report.createdAt+'/'+item.id);return s.runs.put(meta,report.createdAt);});
  for(const item of updates)saved.add(item.id);
 }
 list(){return this.transaction('runs','readonly',s=>s.getAll());}
 async load(id){const r=await this.transaction('runs','readonly',s=>s.get(id));if(!r)return null;for(const g of r.groups)for(let i=0;i<g.attempts.length;i++){const meta=g.attempts[i],stored=await this.transaction('attempts','readonly',s=>s.get(id+'/'+meta.id)),a=stored instanceof Blob?(await openExperimentArchive(stored,{validate:false})).groups[0].attempts[0]:stored;if(a)g.attempts[i]=a;else if(meta.status==='running')meta.status='interrupted';}if(['running','stopping'].includes(r.status)){r.status='interrupted';for(const g of r.groups)if(['running','pending'].includes(g.status))g.status='interrupted';}return r;}
 async delete(id){const r=await this.transaction('runs','readonly',s=>s.get(id));if(r)for(const g of r.groups)for(const a of g.attempts)await this.transaction('attempts','readwrite',s=>s.delete(id+'/'+a.id));await this.transaction('runs','readwrite',s=>s.delete(id));}
 saveTemplate(name,plan){return this.transaction('templates','readwrite',s=>s.put(plan,name));}
 templates(){return this.transaction('templates','readonly',s=>s.getAllKeys());}
 template(name){return this.transaction('templates','readonly',s=>s.get(name));}
}
