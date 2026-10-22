import {archiveOrigin,decodeLifeTable} from './experiment-archive.js';
import {numericField} from './analysis-expression.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
/** Читаем архив блоками, не материализуя целый опыт. Worker получает только
 * используемые столбцы. Полная связь родитель–дети нужна и вне когорты. */
export async function projectAnalysisWorld(report,fields,{start,end,mode,origin,needBirths=false},cancelled=()=>false){
 const columns=Object.fromEntries(fields.map(key=>[key,[]])),timeline={id:[],parent:[],born:[],children:[]};let omitted=report.omittedDetails??0,eligible=0,living=0;
 function consume(rows){for(const row of rows){
  if(needBirths){timeline.id.push(row.id);timeline.parent.push(row.parentId??NaN);timeline.born.push(row.born);timeline.children.push(row.children);}
  if(row.born<start||row.born>=end||mode==='dead'&&row.status!=='dead'||origin==='founders'&&row.parentId!==null||origin==='descendants'&&row.parentId===null)continue;
  eligible++;living+=Number(row.status==='alive');for(const field of fields)columns[field].push(field==='alive'?Number(row.status==='alive'):numericField(row,field)??NaN);
 }}
 const source=archiveOrigin(report);
 if(source){omitted=source.info.meta.omittedDetails??0;for(const key of ['dead','living'])for(const index of source.info[key]){
   if(cancelled())throw new Error('Расчёт отменён.');const entry=source.reader.manifest.entries[index];if(!needBirths&&(entry.end<=start||entry.start>=end))continue;
   const table=await source.reader.read(index);consume(decodeLifeTable(table,source.reader.manifest.schemas[entry.schema]));await pause();
  }
 }else for(const key of ['dead','living']){const rows=report[key]??[];for(let i=0;i<rows.length;i+=2048){if(cancelled())throw new Error('Расчёт отменён.');consume(rows.slice(i,i+2048));await pause();}}
 return {columns:Object.fromEntries(Object.entries(columns).map(([k,v])=>[k,Float64Array.from(v)])),timeline:needBirths?Object.fromEntries(Object.entries(timeline).map(([k,v])=>[k,Float64Array.from(v)])):null,eligible,living,omitted};
}
