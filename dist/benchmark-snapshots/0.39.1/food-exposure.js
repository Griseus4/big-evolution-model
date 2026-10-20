/** Интеграл порций на земле, только для наблюдателя. Карта не обходится:
 * начальный запас + выросло − подобрано + выложено. Смена источников
 * сохраняет лежащую пищу; гибель уничтожает инвентарь, а не пищу на земле.
 * Один Float64 на целую Т, блоки растут без копирования прежней истории. */
import {SUBSTEPS} from './action-timing.js';
const BLOCK=2048;
export const FOOD_EXPOSURE_SCHEMA='ground-food-exposure-v1';
export const MAX_HISTORY_INTERVALS=5000;
export function createFoodExposure(){return {blocks:[new Float64Array(BLOCK)],length:1,partialSum:0,substeps:0};}
export function sampleFoodExposure(w){
 const e=w.foodExposure;if(!e)return;
 e.partialSum+=w.initialFood+w.stats.regrown-w.stats.gathered+w.stats.deposited;
 if(++e.substeps!==SUBSTEPS)return;
 const i=e.length,previous=e.blocks[Math.floor((i-1)/BLOCK)][(i-1)%BLOCK];
 if(i%BLOCK===0)e.blocks.push(new Float64Array(BLOCK));
 e.blocks[Math.floor(i/BLOCK)][i%BLOCK]=previous+e.partialSum;e.length++;e.partialSum=0;e.substeps=0;
}
export function foodExposureReport(e){
 if(!e)return null;
 const prefix=new Float64Array(e.length);
 for(let i=0;i<e.blocks.length;i++)prefix.set(e.blocks[i].subarray(0,Math.min(BLOCK,e.length-i*BLOCK)),i*BLOCK);
 return {schema:FOOD_EXPOSURE_SCHEMA,prefix,partialSum:e.partialSum,substeps:e.substeps};
}
/** Только целые границы Т и последний наблюдаемый дробный конец. */
function integralAt(e,tick){
 const whole=Math.floor(tick),fraction=tick-whole;
 if(whole>=e.prefix.length)return null;
 if(fraction<1e-9)return e.prefix[whole]/SUBSTEPS;
 if(whole===e.prefix.length-1&&Math.abs(fraction-e.substeps/SUBSTEPS)<1e-9)return (e.prefix[whole]+e.partialSum)/SUBSTEPS;
 return null;
}
export function foodCohorts(e,tick,width){
 if(!Number.isFinite(tick)||tick<0||!Number.isSafeInteger(width)||width<1)throw new Error('Неверные границы истории пищи.');
 if(Math.ceil(tick/width)>MAX_HISTORY_INTERVALS)throw new Error(`Слишком много интервалов. Увеличь ширину хотя бы до ${Math.ceil(tick/MAX_HISTORY_INTERVALS)} Т; данные сохраняются полностью.`);
 if(e?.schema!==FOOD_EXPOSURE_SCHEMA)return [];
 const rows=[];
 for(let start=0;start<tick;start+=width){const end=Math.min(tick,start+width),a=integralAt(e,start),b=integralAt(e,end);rows.push({id:start/width,start,end:start+width,observedTime:end-start,complete:end===start+width,mean:a===null||b===null?null:(b-a)/(end-start)});}
 return rows;
}
