const formats=new Map();
/** Округляется только подпись. Малое ненулевое значение не превращается
 * в ложный ноль; обычные величины сохраняют один знак после запятой. */
export function formatStatistic(value,digits=1){
 if(!Number.isFinite(value))return '—';
 const minimum=Math.max(0,Math.min(8,digits)),magnitude=Math.abs(value),small=magnitude>0&&magnitude<10**(-minimum);
 const maximum=small?Math.max(minimum,2-Math.floor(Math.log10(magnitude))):minimum,scientific=maximum>8,key=`${minimum}:${maximum}:${scientific}`;
 if(!formats.has(key))formats.set(key,new Intl.NumberFormat('ru-RU',scientific?{notation:'scientific',maximumFractionDigits:2}:{minimumFractionDigits:minimum,maximumFractionDigits:maximum}));
 return formats.get(key).format(Object.is(value,-0)?0:value);
}
export const metricDisplayDigits=metric=>metric?.id==='brainCost'?metric.digits??3:1;
const compact=new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1});
export const formatChartNumber=(value,digits=1)=>Math.abs(value)>=1000?compact.format(value):formatStatistic(value,digits).replace(/,0$/,'');
export const formatInterval=(range,digits=1)=>range?`[${formatStatistic(range.low,digits)}; ${formatStatistic(range.high,digits)}]`:'ДИ недоступен';
/** Значение и целый ДИ — неразрывные фрагменты с пробелом между ними.
 * Перенос возможен между фрагментами, а не внутри числа/границ. */
export function estimateCell(root,value,range,{pending=false,digits=1}={}){
 const td=root.createElement('td'),number=root.createElement('span');number.className='estimate-value';number.textContent=pending?'Вычисление…':formatStatistic(value,digits);td.append(number);
 if(Number.isFinite(value)){const space=root.createElement('span');space.textContent=' ';const ci=root.createElement('small');ci.className='estimate-interval';ci.textContent=formatInterval(range,digits);td.append(space,ci);}return td;
}
