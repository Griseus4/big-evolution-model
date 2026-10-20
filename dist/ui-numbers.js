/** Округление только представления. Числовые поля используют точку без
 * разделителей; подписи — русскую запись. Исходные значения мира не меняются. */
const formats=new Map();
export function inputNumber(value,digits=1){const rounded=Number(Number(value).toFixed(digits));return rounded===0?0:rounded;}
export function formatNumber(value,digits=1){
 if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
 if(!formats.has(digits))formats.set(digits,new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}));
 return formats.get(digits).format(inputNumber(value,digits));
}
