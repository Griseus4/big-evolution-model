/** Отчёты хранятся по завершённым попыткам, а не одним растущим JSON
 * при каждом сообщении прогресса. Личные мозги в хранилище не попадают. */
export class ExperimentStore{
 constructor(database=globalThis.indexedDB){this.ready=!database?Promise.resolve(null):new Promise(resolve=>{const r=database.open('big-evolution-experiments',1);r.onupgradeneeded=()=>{for(const name of ['runs','attempts','templates'])r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null);});}
 async transaction(store,mode,action){const db=await this.ready;if(!db)throw new Error('Хранилище браузера недоступно. Скачайте JSON.');return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),r=action(tx.objectStore(store));let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(new Error('Не удалось сохранить/прочитать данные. Скачайте JSON; освободите место или удалите старые опыты.'));});}
 async save(report){
  this.saved??=new Set();
  for(const g of report.groups)for(const a of g.attempts)if(a.status!=='running'&&!this.saved.has(a.id+'@'+report.createdAt)){await this.transaction('attempts','readwrite',s=>s.put(a,report.createdAt+'/'+a.id));this.saved.add(a.id+'@'+report.createdAt);}
  const meta={...report,groups:report.groups.map(g=>({...g,attempts:g.attempts.map(a=>({id:a.id,number:a.number,seed:a.seed,status:a.status,tick:a.tick}))}))};
  await this.transaction('runs','readwrite',s=>s.put(meta,report.createdAt));
 }
 list(){return this.transaction('runs','readonly',s=>s.getAll());}
 async load(id){const r=await this.transaction('runs','readonly',s=>s.get(id));if(!r)return null;for(const g of r.groups)for(let i=0;i<g.attempts.length;i++){const meta=g.attempts[i],a=await this.transaction('attempts','readonly',s=>s.get(id+'/'+meta.id));if(a)g.attempts[i]=a;else if(meta.status==='running')meta.status='interrupted';}if(['running','stopping'].includes(r.status)){r.status='interrupted';for(const g of r.groups)if(['running','pending'].includes(g.status))g.status='interrupted';}return r;}
 async delete(id){const r=await this.transaction('runs','readonly',s=>s.get(id));if(r)for(const g of r.groups)for(const a of g.attempts)await this.transaction('attempts','readwrite',s=>s.delete(id+'/'+a.id));await this.transaction('runs','readwrite',s=>s.delete(id));}
 saveTemplate(name,plan){return this.transaction('templates','readwrite',s=>s.put(plan,name));}
 templates(){return this.transaction('templates','readonly',s=>s.getAllKeys());}
 template(name){return this.transaction('templates','readonly',s=>s.get(name));}
}
