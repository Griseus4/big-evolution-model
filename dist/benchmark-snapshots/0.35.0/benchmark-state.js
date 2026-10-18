/** Внутренний снимок только для повторяемых замеров, не формат сохранения игры.
 * structuredClone сохраняет Map, Float64Array, Infinity и общие ссылки. JSON
 * потерял бы эти свойства. Копирование выполняется только вне таймера.
 * Прототипы четырёх RNG и агрегатора историй восстанавливаются явно; частные
 * WeakMap-буферы сети создаются заново и не являются опытом организма. */
import {Evolution} from './evolution.js';
import {Random} from './simulation.js';
import {LifeHistory} from './life-history.js';
const RNG_KEYS=['random','cognitiveRandom','bodyRandom','neuralRandom','mutationRandom'];
export function captureBenchmarkState(world){
 const state=structuredClone(world);if(world.temporal===false){delete state.temporal;delete state._viewEpoch;}
 for(const agent of state.agents)agent.brain.spatialCache=null;
 return state;
}
export function restoreBenchmarkState(state){
 const world=Object.assign(Object.create(Evolution.prototype),structuredClone(state));
 for(const key of RNG_KEYS)Object.setPrototypeOf(world[key],Random.prototype);
 Object.setPrototypeOf(world.lifeHistory,LifeHistory.prototype);
 return world;
}
/** Контрольный отпечаток вне замера. Порядок Map и массивов значим, порядок
 * ключей объектов нормализован. Отдельно кодируем -0/Infinity и тип буфера.
 * Снимки внутренних фикстур ацикличны; загруженные файлы сюда не попадают. */
function canonical(value){
 if(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0)))return {$number:String(value),negativeZero:Object.is(value,-0)};
 if(value===undefined)return {$undefined:true};
 if(value===null||typeof value!=='object')return value;
 if(ArrayBuffer.isView(value))return {$typed:value.constructor.name,values:Array.from(value,canonical)};
 if(value instanceof Map)return {$map:Array.from(value,([k,v])=>[canonical(k),canonical(v)])};
 if(value instanceof Set)return {$set:Array.from(value,canonical)};
 if(Array.isArray(value))return value.map(canonical);
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
}
export async function benchmarkDigest(value){
 const bytes=new TextEncoder().encode(JSON.stringify(canonical(value)));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
