export const formatStatistic=value=>Number.isFinite(value)?value.toLocaleString('ru-RU',{maximumFractionDigits:3}):'—';
export const formatInterval=range=>range?`[${formatStatistic(range.low)}; ${formatStatistic(range.high)}]`:'ДИ недоступен';
/** Значение и ДИ — отдельные строки. Глобальное nowrap таблиц истории не
 * должно склеивать название варианта, число и границы интервала. */
export function estimateCell(root,value,range,{pending=false}={}){
 const td=root.createElement('td'),number=root.createElement('span');number.className='estimate-value';number.textContent=pending?'Вычисление…':formatStatistic(value);td.append(number);
 if(Number.isFinite(value)){const ci=root.createElement('small');ci.className='estimate-interval';ci.textContent=formatInterval(range);td.append(ci);}return td;
}
