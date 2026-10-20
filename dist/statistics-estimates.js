/** Анализ готовых миров, без RNG симуляции. Приближённые поточечные 95% ДИ
 * percentile cluster bootstrap: перевыбирается мир целиком, веса особей
 * внутри мира сохраняют выбранный смысл. 999 повторов не равны 999 новым мирам. */
export const BOOTSTRAP_REPEATS=999,MIN_CONFIDENCE_WORLDS=5;
export const quantile=(a,p)=>{const x=(a.length-1)*p,i=Math.floor(x);return a[i]+(a[Math.ceil(x)]-a[i])*(x-i);};
const upper=(a,x)=>{let l=0,r=a.length;while(l<r){const m=(l+r)>>>1;if(a[m]<=x)l=m+1;else r=m;}return l;};
const draws=new Map();
export function bootstrapDraws(n){
 if(draws.has(n))return draws.get(n);let seed=0x41b007;const counts=[];
 for(let b=0;b<BOOTSTRAP_REPEATS;b++){const row=new Uint16Array(n);for(let i=0;i<n;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;row[Math.floor((seed>>>0)/4294967296*n)]++;}counts.push(row);}
 draws.set(n,counts);return counts;
}
// Общая подготовка для обычной сводки и парного сравнения: одна сортировка,
// одна CDF; summarize принимает кратности миров, не копирует особей.
export function createWorldEstimator(input,weightMode='worlds'){
 const worlds=input.filter(w=>w.values.length).map(w=>{const values=Float64Array.from(w.values).sort();let sum=0;for(const v of values){if(!Number.isFinite(v))throw new Error('Нечисловое наблюдение в статистике.');sum+=v;}return {...w,values,sum};}),n=worlds.length;
 if(!n)return null;
 const all=Float64Array.from(worlds.flatMap(w=>Array.from(w.values))).sort(),values=[];for(const v of all)if(v!==values.at(-1))values.push(v);
 // Малые выборки: компактная CDF даёт O(worlds * log(values)) на медиану,
 // вместо повторного обхода/сортировки всех особей каждой перевыборки.
 const cdfs=values.length*n<=1000000?worlds.map(w=>{const cdf=new Uint32Array(values.length);let j=0;for(let i=0;i<values.length;i++){while(j<w.values.length&&w.values[j]<=values[i])j++;cdf[i]=j;}return cdf;}):null;
 function summarize(counts){
  let mass=0,sum=0;for(let i=0;i<n;i++){const w=worlds[i],factor=weightMode==='worlds'?counts[i]/w.values.length:counts[i];mass+=factor*w.values.length;sum+=factor*w.sum;}
  const cumulative=index=>{let s=0;for(let i=0;i<n;i++)if(counts[i])s+=(weightMode==='worlds'?counts[i]/worlds[i].values.length:counts[i])*(cdfs?cdfs[i][index]:upper(worlds[i].values,values[index]));return s;};
  let l=0,r=values.length-1;while(l<r){const m=(l+r)>>>1;if(cumulative(m)>=mass/2-1e-12)r=m;else l=m+1;}
  let median=values[l];
  if(Math.abs(cumulative(l)-mass/2)<=1e-12){let next=Infinity;for(let i=0;i<n;i++)if(counts[i])next=Math.min(next,worlds[i].values[upper(worlds[i].values,median)]??Infinity);if(Number.isFinite(next))median=(median+next)/2;}
  return {mean:sum/mass,median};
 }
 const center=summarize(new Uint16Array(n).fill(1)),individual=worlds.map(w=>({id:w.id,count:w.values.length,mean:w.sum/w.values.length,median:(w.values[(w.values.length-1)>>>1]+w.values[w.values.length>>>1])/2}));
 return {summarize,center,individual,count:all.length,worlds:n,min:all[0],max:all.at(-1)};
}
export function estimateWorlds(input,weightMode='worlds',{confidence=true}={}){
 const compiled=createWorldEstimator(input,weightMode);
 if(!compiled)return {count:0,worlds:0,mean:null,median:null,min:null,max:null,confidence:null,reason:'Нет доступных данных.',spread:null,individual:[]};
 const {summarize,center,individual,worlds:n}=compiled;
 const spread=Object.fromEntries(['mean','median'].map(stat=>{const a=individual.map(w=>w[stat]).sort((a,b)=>a-b);return [stat,{low:quantile(a,.25),high:quantile(a,.75)}];}));
 let intervals=null,reason=n<MIN_CONFIDENCE_WORLDS?`ДИ недоступен: ${n} миров, нужно не менее ${MIN_CONFIDENCE_WORLDS}.`:null;
 if(confidence&&n>=MIN_CONFIDENCE_WORLDS){
  const memo=new Map(),means=[],medians=[];
  for(const counts of bootstrapDraws(n)){const key=counts.join(','),result=memo.get(key)??summarize(counts);memo.set(key,result);means.push(result.mean);medians.push(result.median);}
  means.sort((a,b)=>a-b);medians.sort((a,b)=>a-b);
  intervals={mean:{low:quantile(means,.025),high:quantile(means,.975)},median:{low:quantile(medians,.025),high:quantile(medians,.975)}};
  if(means[0]===means.at(-1)||medians[0]===medians.at(-1))reason='Нулевой наблюдаемый разброс не доказывает точность оценки.';
 }
 return {...center,count:compiled.count,worlds:n,min:compiled.min,max:compiled.max,confidence:intervals,reason,spread,individual,smallSample:n<10};
}
