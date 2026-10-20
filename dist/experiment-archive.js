/** Переносимый архив v1: оглавление + независимые gzip-блоки.
 * Имена полей общие, null и отсутствие различаются, числа не округляются.
 * Это отчёт наблюдений, а не снимок мира для продолжения симуляции. */
import {populationTimeline} from './population-statistics.js';
const MAGIC='BEXPAR01',ENC=new TextEncoder(),DEC=new TextDecoder('utf-8',{fatal:true});
const origins=new WeakMap(),CHUNK=512,PERIOD=500,MAX_BLOCK=64*1024*1024,MAX_FILE=2**31;
const clone=value=>JSON.parse(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const fail=()=>{throw new Error('Повреждён или несовместим архив опытов.');};
export const archiveOrigin=life=>origins.get(life);
function flatten(value,path=[],out=new Map()){
 for(const [key,v]of Object.entries(value)){
  const next=[...path,key];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length)flatten(v,next,out);
  else out.set(JSON.stringify(next),{path:next,value:v});
 }return out;
}
function assign(row,path,value){
 for(let i=0;i<path.length;i++){
  const key=path[i];if(i===path.length-1)Object.defineProperty(row,key,{value,writable:true,enumerable:true,configurable:true});
  else{if(!Object.hasOwn(row,key))Object.defineProperty(row,key,{value:{},writable:true,enumerable:true,configurable:true});row=row[key];}
 }
}
export function encodeLifeTable(rows,schemas){
 const maps=rows.map(row=>flatten(clone(row))),paths=new Map();
 for(const map of maps)for(const [key,entry]of map)paths.set(key,entry.path);
 const keys=[...paths.keys()],schema=[...paths.values()],signature=JSON.stringify(schema);
 let id=schemas.findIndex(s=>JSON.stringify(s)===signature);if(id<0){id=schemas.length;schemas.push(schema);}
 const constants=[],variables=[];
 for(let i=0;i<keys.length;i++){
  const key=keys[i],first=maps[0]?.get(key)?.value;
  if(maps.length&&(!first||typeof first!=='object')&&maps.every(m=>m.has(key)&&Object.is(m.get(key).value,first)))constants.push([i,first]);else variables.push(i);
 }
 const missing=[],values=maps.map((map,index)=>{const absent=[];const row=variables.map((column,j)=>{if(!map.has(keys[column])){absent.push(j);return null;}return map.get(keys[column]).value;});if(absent.length)missing.push([index,absent]);return row;});
 return {schema:id,table:{variables,constants,missing,rows:values}};
}
export function decodeLifeTable(table,schema){
 if(!Array.isArray(schema)||schema.length>4096||!schema.every(p=>Array.isArray(p)&&p.length>0&&p.length<32&&p.every(k=>typeof k==='string'))||!Array.isArray(table.rows)||table.rows.length>CHUNK||!Array.isArray(table.variables)||!Array.isArray(table.constants)||!Array.isArray(table.missing))fail();
 const occupied=new Set(),check=i=>{if(!Number.isSafeInteger(i)||i<0||i>=schema.length||occupied.has(i))fail();occupied.add(i);};
 table.variables.forEach(check);for(const pair of table.constants){if(!Array.isArray(pair)||pair.length!==2)fail();check(pair[0]);}if(occupied.size!==schema.length)fail();
 const missing=new Map();for(const [i,columns]of table.missing){if(!Number.isSafeInteger(i)||i<0||i>=table.rows.length||missing.has(i)||!Array.isArray(columns)||columns.some(c=>!Number.isSafeInteger(c)||c<0||c>=table.variables.length))fail();missing.set(i,new Set(columns));}
 return table.rows.map((values,i)=>{if(!Array.isArray(values)||values.length!==table.variables.length)fail();const row={};for(const [column,value]of table.constants)assign(row,schema[column],value);for(let j=0;j<values.length;j++)if(!missing.get(i)?.has(j))assign(row,schema[table.variables[j]],values[j]);return row;});
}
async function compressed(value){
 if(typeof CompressionStream==='undefined')throw new Error('Браузер не поддерживает gzip. Можно скачать обычный JSON.');
 const data=ENC.encode(JSON.stringify(value));if(data.length>MAX_BLOCK)throw new Error('Слишком большой блок отчёта.');
 return {blob:await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).blob(),raw:data.length};
}
async function unpack(blob,raw){
 if(typeof DecompressionStream==='undefined')throw new Error('Браузер не поддерживает распаковку gzip.');
 const reader=blob.stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>raw||size>MAX_BLOCK)fail();parts.push(value);}if(size!==raw)fail();}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 return JSON.parse(await new Blob(parts).text());
}
function lifeMeta(life){const {dead,living,foodAvailability,foodProductionHistory,...meta}=life;return clone(meta);}
/** Снимок состава делаем до первого await; законченные строки неизменяемы.
 * Для уже открытого архива копируем сжатые блоки, а не ограниченное окно. */
export async function experimentArchive(report,{onProgress=()=>{},yieldControl=pause}={}){
 const schemas=[],entries=[],parts=[],lives=[],jobs=[];
 const header={...report,groups:report.groups.map((g,gi)=>({...g,attempts:g.attempts.map((a,ai)=>{
  const next={...a};for(const key of ['lives','live'])if(a[key]){
   const life=a[key],origin=origins.get(life),meta=origin?clone(origin.info.meta):lifeMeta(life);
   const extra=origin?null:clone({foodAvailability:life.foodAvailability,foodProductionHistory:life.foodProductionHistory});
   next[key]={...meta,dead:[],living:[]};jobs.push({gi,ai,key,life,meta,extra,origin,dead:origin?null:[...(life.dead??[])],living:origin?null:[...(life.living??[])]});
  }return next;
 })}))};
 let offset=0;
 async function add(value,description){const {blob,raw}=await compressed(value),index=entries.length;entries.push({...description,offset,size:blob.size,raw});parts.push(blob);offset+=blob.size;onProgress(offset);await yieldControl();return index;}
 function copy(origin,index){const e=origin.reader.manifest.entries[index],copy={...e,offset};if(e.schema!==undefined){const schema=origin.reader.manifest.schemas[e.schema],signature=JSON.stringify(schema);let id=schemas.findIndex(s=>JSON.stringify(s)===signature);if(id<0){id=schemas.length;schemas.push(schema);}copy.schema=id;}
  const result=entries.length;entries.push(copy);parts.push(origin.reader.slice(index));offset+=e.size;return result;
 }
 for(const job of jobs){
  const info={path:[job.gi,job.ai,job.key],meta:job.meta,dead:[],living:[]};lives.push(info);
  if(job.origin){for(const key of ['dead','living'])info[key]=job.origin.info[key].map(i=>copy(job.origin,i));info.aux=copy(job.origin,job.origin.info.aux);continue;}
  for(const key of ['dead','living']){
   const buckets=new Map();for(let i=0;i<job[key].length;i++){const row=job[key][i],bucket=Number.isFinite(row.born)?Math.floor(row.born/PERIOD):0;let group=buckets.get(bucket);if(!group){group=[];buckets.set(bucket,group);}group.push(i);}
   for(const [bucket,indices]of buckets)for(let from=0;from<indices.length;from+=CHUNK){
    const positions=indices.slice(from,from+CHUNK),rows=positions.map(i=>job[key][i]),encoded=encodeLifeTable(rows,schemas);
    info[key].push(await add({...encoded.table,positions},{kind:'rows',schema:encoded.schema,count:rows.length,start:bucket*PERIOD,end:(bucket+1)*PERIOD}));
   }
  }
  const deathCauses={};for(const row of job.dead)deathCauses[row.cause]=(deathCauses[row.cause]??0)+1;
  info.aux=await add({extra:job.extra,timeline:populationTimeline({...job.meta,dead:job.dead,living:job.living}),ages:job.dead.map(r=>r.age),deathCauses,totalLiving:job.living.length},{kind:'aux'});
 }
 // Оглавление тоже сжато: настройки и контрольные точки повторяются между
 // мирами; оставлять этот слой несжатым означало бы терять мегабайты.
 const manifest=await compressed({format:'big-evolution-experiment-archive',version:1,report:header,schemas,entries,lives});
 const prefix=new Uint8Array(16),view=new DataView(prefix.buffer);prefix.set(ENC.encode(MAGIC));view.setUint32(8,manifest.blob.size,true);view.setUint32(12,manifest.raw,true);
 onProgress(offset+16+manifest.blob.size);return new Blob([prefix,manifest.blob,...parts],{type:'application/octet-stream'});
}
function checkedRow(row){if(!Number.isFinite(row.age)||!Number.isFinite(row.born)||row.age<0||row.born<0)throw new Error('Повреждена строка жизни.');}
export async function openExperimentArchive(blob,{validate=true,onProgress=()=>{}}={}){
 if(blob.size>MAX_FILE||blob.size<16)fail();const prefix=new Uint8Array(await blob.slice(0,16).arrayBuffer());if(DEC.decode(prefix.slice(0,8))!==MAGIC)fail();
 const prefixView=new DataView(prefix.buffer),length=prefixView.getUint32(8,true),raw=prefixView.getUint32(12,true);if(length<1||length>MAX_BLOCK||raw<1||raw>MAX_BLOCK||16+length>blob.size)fail();
 const manifest=await unpack(blob.slice(16,16+length),raw);
 if(manifest.format!=='big-evolution-experiment-archive'||manifest.version!==1||!Array.isArray(manifest.entries)||!Array.isArray(manifest.schemas)||!Array.isArray(manifest.lives)||!Array.isArray(manifest.report?.groups))fail();
 let end=0,totalRaw=0;for(const entry of manifest.entries){if(!Number.isSafeInteger(entry.offset)||entry.offset!==end||!Number.isSafeInteger(entry.size)||entry.size<1||!Number.isSafeInteger(entry.raw)||entry.raw<1||entry.raw>MAX_BLOCK||!['rows','aux'].includes(entry.kind))fail();end+=entry.size;totalRaw+=entry.raw;if(entry.kind==='rows'&&(!manifest.schemas[entry.schema]||!Number.isSafeInteger(entry.count)||entry.count<1||entry.count>CHUNK||!Number.isFinite(entry.start)||!Number.isFinite(entry.end)||entry.end<=entry.start))fail();}
 if(16+length+end!==blob.size||totalRaw>8*2**30)fail();
 const used=new Set(),paths=new Set(),report=manifest.report,reader={manifest,slice:i=>blob.slice(16+length+manifest.entries[i].offset,16+length+manifest.entries[i].offset+manifest.entries[i].size),reads:0};
 reader.read=async index=>{reader.reads++;return unpack(reader.slice(index),manifest.entries[index].raw);};
 for(const info of manifest.lives){
  const [gi,ai,key]=info.path??[],path=JSON.stringify(info.path);if(!Number.isSafeInteger(gi)||!Number.isSafeInteger(ai)||!['lives','live'].includes(key)||paths.has(path))fail();paths.add(path);const a=report.groups[gi]?.attempts?.[ai];if(!a?.[key]||!Array.isArray(info.dead)||!Array.isArray(info.living)||!info.meta)fail();
  for(const [kind,indices]of [['rows',[...info.dead,...info.living]],['aux',[info.aux]]])for(const i of indices){if(!Number.isSafeInteger(i)||!manifest.entries[i]||manifest.entries[i].kind!==kind||used.has(i))fail();used.add(i);}
  const life={...info.meta,dead:[],living:[]};a[key]=life;origins.set(life,{reader,info,aux:null,view:null,key:null});
 }
 if(used.size!==manifest.entries.length)fail();for(const g of report.groups)for(const a of g.attempts??[])for(const key of ['lives','live'])if(a[key]&&!origins.has(a[key]))fail();
 if(validate){let done=0;for(const info of manifest.lives){const origin=origins.get(report.groups[info.path[0]].attempts[info.path[1]][info.path[2]]);for(const kind of ['dead','living']){
   const positions=new Set();for(const index of info[kind]){const table=await reader.read(index),entry=manifest.entries[index],rows=decodeLifeTable(table,manifest.schemas[entry.schema]);if(rows.length!==entry.count||!Array.isArray(table.positions)||table.positions.length!==rows.length)fail();
    for(let j=0;j<rows.length;j++){const p=table.positions[j];if(!Number.isSafeInteger(p)||p<0||positions.has(p))fail();positions.add(p);checkedRow(rows[j]);if(rows[j].born<entry.start||rows[j].born>=entry.end)fail();}onProgress(++done,manifest.entries.length);
   }for(let i=0;i<positions.size;i++)if(!positions.has(i))fail();
  }await loadAux(origin);origin.aux=null;onProgress(++done,manifest.entries.length);}}
 return report;
}
async function loadAux(origin){
 if(!origin.aux){const aux=await origin.reader.read(origin.info.aux),count=key=>origin.info[key].reduce((n,i)=>n+origin.reader.manifest.entries[i].count,0);if(!Array.isArray(aux.ages)||aux.ages.length!==count('dead')||aux.ages.some(a=>!Number.isFinite(a)||a<0)||!Array.isArray(aux.timeline?.points)||!Number.isSafeInteger(aux.totalLiving)||aux.totalLiving!==count('living'))fail();let last=-1;for(const p of aux.timeline.points){if(!Number.isSafeInteger(p.at)||p.at<0||p.at<=last||!Number.isSafeInteger(p.count)||p.count<0)fail();last=p.at;}origin.aux=aux;}
 return origin.aux;
}
export function archiveWindowReady(life,windows){const origin=origins.get(life);return !origin||origin.key===JSON.stringify(windows);}
/** Декодируем только пересекающиеся интервалы. Небольшие соседние окна
 * кривой дожития объединены с общим периодом; строки возвращаются в прежнем
 * порядке, чтобы не менять суммирование и воспроизводимость статистики. */
export async function loadArchiveWindow(life,windows){
 const origin=origins.get(life);if(!origin)return life;const key=JSON.stringify(windows);if(origin.key===key)return origin.view;
 if(windows.some(([a,b])=>!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a))throw new Error('Неверное окно архива.');
 const sequence=(origin.sequence??0)+1;origin.sequence=sequence;
 const aux=await loadAux(origin),result={...origin.info.meta,...aux.extra,dead:[],living:[],populationSeries:aux.timeline,completedAges:aux.ages,deathCauses:aux.deathCauses,totalLiving:aux.totalLiving};
 const previous=origin.key?JSON.parse(origin.key):null,covered=origin.view&&windows.every(([a,b])=>previous.some(([from,to])=>a>=from&&b<=to));
 for(const kind of ['dead','living']){
  if(covered){result[kind]=origin.view[kind].filter(row=>windows.some(([a,b])=>row.born>=a&&row.born<b));continue;}
  const found=[];for(const index of origin.info[kind]){const entry=origin.reader.manifest.entries[index];if(!windows.some(([a,b])=>a<entry.end&&b>entry.start))continue;
   const table=await origin.reader.read(index),rows=decodeLifeTable(table,origin.reader.manifest.schemas[entry.schema]);for(let j=0;j<rows.length;j++){const row=rows[j];checkedRow(row);if(windows.some(([a,b])=>row.born>=a&&row.born<b))found.push([table.positions[j],row]);}
  }found.sort((a,b)=>a[0]-b[0]);result[kind]=found.map(item=>item[1]);
 }
 if(origin.sequence===sequence){origin.key=key;origin.view=result;}origins.set(result,origin);return result;
}
/** Старый JSON читается без изменения исходного файла. Новые архивы
 * проверяются блоками до замены текущего опыта; gzip JSON также допустим. */
export async function readExperimentFile(file,options={}){
 if(file.size>MAX_FILE)throw new Error('Файл отчёта больше 2 ГиБ.');
 const prefix=new Uint8Array(await file.slice(0,8).arrayBuffer());
 if(prefix.length===8&&prefix.every((byte,i)=>byte===MAGIC.charCodeAt(i)))return openExperimentArchive(file,options);
 if(prefix[0]===31&&prefix[1]===139){const reader=file.stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_FILE)throw new Error('Распакованный JSON больше 2 ГиБ.');parts.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}return JSON.parse(await new Blob(parts).text());}
 return JSON.parse(await file.text());
}
export async function materializeExperiment(report){
 const result={...report,groups:[]};
 for(const g of report.groups){const group={...g,attempts:[]};result.groups.push(group);for(const a of g.attempts){const attempt={...a};group.attempts.push(attempt);for(const key of ['lives','live'])if(a[key]){
  const origin=origins.get(a[key]);if(!origin)continue;const full=await loadArchiveWindow(a[key],[[0,Number.MAX_VALUE]]);attempt[key]={...origin.info.meta,...origin.aux.extra,dead:full.dead,living:full.living};
 }}}return result;
}
