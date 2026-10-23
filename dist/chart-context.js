import {LIFE_METRICS} from './life-cohorts.js';
const timeMetrics=new Set(['population','food','production']);
/** Закрепление заменяет одно общее поле, а не пересекается с ним.
 * Период — полуинтервал рождения в Т; ширина — размер временной корзины. */
export function chartSettings(def){
 if(def.kind==='metric'&&timeMetrics.has(def.metric))return ['width'];
 if(def.kind==='histogram'||def.kind==='curve')return ['period','origin'];
 const metric=LIFE_METRICS.find(m=>m.id===def.metric);
 return ['period','width','origin',...(def.kind==='expression'||!metric?.inherited&&!['lifetime','survival'].includes(def.metric)?['mode']:[])];
}
export function validateChartPins(input,def){
 if(input===undefined)return {};if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Некорректные закрепления графика.');
 const allowed=chartSettings(def),pins={};
 for(const key of Object.keys(input)){
  const value=input[key];if(!allowed.includes(key))throw new Error('Настройка неприменима к этому графику: '+key);
  if(key==='period'){if(!value||Object.keys(value).some(k=>!['start','end'].includes(k))||!Number.isSafeInteger(value.start)||!Number.isSafeInteger(value.end)||value.start<0||value.end<=value.start)throw new Error('Период рождения: целые Т, начало ≥ 0 и меньше конца.');pins.period={start:value.start,end:value.end};}
  if(key==='width'){if(!Number.isSafeInteger(value)||value<1)throw new Error('Ширина интервала — положительное целое Т.');pins.width=value;}
  if(key==='origin'){if(!['all','founders','descendants'].includes(value))throw new Error('Неизвестное происхождение.');pins.origin=value;}
  if(key==='mode'){if(!['dead','observed'].includes(value))throw new Error('Неизвестное состояние жизней.');pins.mode=value;}
 }return pins;
}
export function chartContext(def,common){
 const pins=def.pins??{},context={...common};
 if(def.kind==='curve'){context.start=common.curveStart??common.start;context.end=context.start+common.width;}
 if(pins.period){context.start=pins.period.start;context.end=pins.period.end;}
 for(const key of ['width','mode','origin'])if(pins[key]!==undefined)context[key]=pins[key];
 return context;
}
export const chartContextKey=c=>JSON.stringify([c.start,c.end,c.width,c.mode,c.origin,c.survivalAge,c.interruptionKind]);
export function pinnedWindows(cards){return cards.filter(c=>!c.card.hidden&&c.definition.pins?.period).map(c=>{const p=c.definition.pins.period;return [p.start,p.end];});}
export function normalizeChartWindows(windows){
 const result=[];for(const range of windows){if(!Array.isArray(range)||range.length!==2||!Number.isFinite(range[0])||!Number.isFinite(range[1])||range[0]<0||range[1]<=range[0])throw new Error('Неверный период загрузки статистики.');}
 for(const [a,b]of windows.slice().sort((x,y)=>x[0]-y[0]||x[1]-y[1])){const last=result.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else result.push([a,b]);}return result;
}
export function chartPinLabel(def){
 const p=def.pins??{},labels=[];
 if(p.period)labels.push(`рождения [${p.period.start}; ${p.period.end}) Т`);
 if(p.width!==undefined)labels.push(`интервал ${p.width} Т`);
 if(p.mode)labels.push(p.mode==='dead'?'только завершённые жизни':'включая прожитую часть живых');
 if(p.origin)labels.push({all:'все происхождения',founders:'основатели',descendants:'потомки'}[p.origin]);
 return labels.length?'Закреплено: '+labels.join(' · '):'';
}
