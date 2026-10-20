export const formatStatistic=value=>Number.isFinite(value)?(Math.abs(value)<.05?0:value).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
export const formatInterval=range=>range?`[${formatStatistic(range.low)}; ${formatStatistic(range.high)}]`:'ДИ недоступен';
/** Значение и целый ДИ — неразрывные фрагменты с пробелом между ними.
 * Перенос возможен между фрагментами, а не внутри числа/границ. */
export function estimateCell(root,value,range,{pending=false}={}){
 const td=root.createElement('td'),number=root.createElement('span');number.className='estimate-value';number.textContent=pending?'Вычисление…':formatStatistic(value);td.append(number);
 if(Number.isFinite(value)){const space=root.createElement('span');space.textContent=' ';const ci=root.createElement('small');ci.className='estimate-interval';ci.textContent=formatInterval(range);td.append(space,ci);}return td;
}
