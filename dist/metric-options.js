import {LIFE_METRICS} from './life-cohorts.js';
const time=new Set(['population','food','production']);
/** Ключ расчёта содержит только влияющие на показатель настройки.
 * Возраст дожития не меняет питание, а вид прерываний — возраст смерти. */
export function metricOptions(metric,options){
 const {survivalAge,interruptionKind,origin,mode,curveStart,...common}=options;
 if(time.has(metric))return common;
 return {...common,origin:origin??'all',...(!LIFE_METRICS.find(m=>m.id===metric)?.inherited&&metric!=='survival'?{mode:mode??'dead'}:{}),...(metric==='survival'?{survivalAge:survivalAge??100}:{}),...(metric==='interruptions'?{interruptionKind:interruptionKind??'all'}:{})};
}
