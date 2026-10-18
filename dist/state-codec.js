/** Граф значений сохраняет общие ссылки (клетка карты/наблюдение), разреженные
 * массивы, Maps и Float64 без округления. Исполняемый код из файла не читается:
 * допустимые прототипы перечислены здесь, ключи прототипа запрещены. */
import {Random} from './simulation.js';
import {LifeHistory} from './life-history.js';
const TYPES={Float64Array,Float32Array,Uint32Array,Int32Array,Uint16Array,Int16Array,Uint8Array,Int8Array,Uint8ClampedArray};
const forbidden=k=>['__proto__','constructor','prototype'].includes(k);
export function encodeState(root){
 const ids=new Map(),nodes=[];
 function value(v){
  if(Object.is(v,-0))return {special:'negative-zero'};
  if(v===undefined)return {special:'undefined'};
  if(typeof v==='number'&&!Number.isFinite(v)){if(Number.isNaN(v))throw new Error('В состоянии есть NaN.');return {special:v>0?'infinity':'negative-infinity'};}
  if(v===null||typeof v!=='object'){if(typeof v==='function'||typeof v==='symbol')throw new Error('Исполняемые значения не сохраняются.');return v;}
  if(ids.has(v))return {ref:ids.get(v)};
  const id=nodes.length;ids.set(v,id);nodes.push(null);let kind,data;
  if(Array.isArray(v)){kind='Array';data={length:v.length,entries:Object.keys(v).map(k=>[k,value(v[k])])};}
  else if(ArrayBuffer.isView(v)){kind=v.constructor.name;if(!Object.hasOwn(TYPES,kind))throw new Error('Неизвестный числовой буфер.');data=Array.from(v,n=>Object.is(n,-0)?'-0':n);}
  else if(v instanceof Map){kind='Map';data=[...v].map(([k,x])=>[value(k),value(x)]);}
  else if(v instanceof Set){kind='Set';data=[...v].map(value);}
  else{kind=v instanceof Random?'Random':v instanceof LifeHistory?'LifeHistory':'Object';if(kind==='Object'&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw new Error('Неизвестный объект состояния.');
   data=Object.entries(v).map(([k,x])=>{if(forbidden(k))throw new Error('Недопустимый ключ состояния.');return [k,value(x)];});}
  nodes[id]=[kind,data];return {ref:id};
 }
 const entry=value(root);return {entry,nodes};
}
export function decodeState(graph){
 if(!graph||!Array.isArray(graph.nodes)||graph.nodes.length>2000000)throw new Error('Повреждённый граф сохранения.');
 let size=0;const objects=graph.nodes.map(node=>{
  if(!Array.isArray(node)||node.length!==2)throw new Error('Повреждённый узел сохранения.');const [kind,data]=node;
  if(kind==='Array'){if(!Number.isSafeInteger(data?.length)||data.length<0||data.length>20000000||!Array.isArray(data.entries))throw new Error('Повреждённый массив.');size+=data.entries.length;if(size>20000000)throw new Error('Слишком большое сохранение.');return new Array(data.length);}
  if(!Array.isArray(data))throw new Error('Повреждённые данные узла.');size+=data.length;
  if(size>20000000)throw new Error('Слишком большое сохранение.');
  if(Object.hasOwn(TYPES,kind)){if(data.some(n=>n!=='-0'&&!Number.isFinite(n)))throw new Error('Неконечный числовой буфер.');return TYPES[kind].from(data,n=>n==='-0'?-0:n);}
  if(kind==='Map')return new Map();if(kind==='Set')return new Set();if(kind==='Random')return new Random();if(kind==='LifeHistory')return Object.create(LifeHistory.prototype);if(kind==='Object')return {};
  throw new Error('Неизвестный тип узла сохранения.');
 });
 function value(v){
  if(v===null||typeof v!=='object'){if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Неконечное число.');return v;}
  if(Object.keys(v).length!==1)throw new Error('Повреждённая ссылка.');
  if(Object.hasOwn(v,'ref')){if(!Number.isInteger(v.ref)||v.ref<0||v.ref>=objects.length)throw new Error('Неизвестная ссылка.');return objects[v.ref];}
  if(v.special==='undefined')return undefined;if(v.special==='infinity')return Infinity;if(v.special==='negative-infinity')return -Infinity;if(v.special==='negative-zero')return -0;
  throw new Error('Неизвестное специальное значение.');
 }
 for(let i=0;i<objects.length;i++){
  const [kind,data]=graph.nodes[i],out=objects[i];if(Object.hasOwn(TYPES,kind))continue;
  if(kind==='Set'){for(const x of data)out.add(value(x));continue;}
  const entries=kind==='Array'?data.entries:data,seen=new Set();
  for(const pair of entries){if(!Array.isArray(pair)||pair.length!==2)throw new Error('Повреждённая запись.');const [k,x]=pair;
   if(kind==='Map'){out.set(value(k),value(x));continue;}
   if(typeof k!=='string'||forbidden(k)||seen.has(k)||kind==='Random'&&k!=='state'||kind==='LifeHistory'&&!['retain','rows','offset','omitted','all','founders','descendants','byCause'].includes(k)||kind==='Array'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=out.length))throw new Error('Недопустимый ключ.');seen.add(k);out[k]=value(x);
  }
 }
 return value(graph.entry);
}
