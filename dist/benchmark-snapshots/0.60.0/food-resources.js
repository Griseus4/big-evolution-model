import {DT} from './action-timing.js';
import {PHYSIOLOGY_DEFAULTS} from './physiology-settings.js';

/** Gamma для beta-разбиения биномиальной выборки; число итераций не
 * пропорционально количеству мяса. RNG передаёт только координатор мира. */
function gamma(shape,random){
 const d=shape-1/3,c=1/Math.sqrt(9*d);
 for(;;){
  const x=Math.sqrt(-2*Math.log(1-random.next()))*Math.cos(2*Math.PI*random.next()),v0=1+c*x;
  if(v0<=0)continue;
  const v=v0*v0*v0,u=1-random.next();
  if(u<1-.0331*x*x*x*x||Math.log(u)<.5*x*x+d*(1-v+Math.log(v)))return d*v;
 }
}
/** Точное распределение Binomial (в пределах арифметики Float64), без
 * нормального приближения. Beta — a-я порядковая статистика n uniform;
 * условно оставшиеся испытания снова биномиальны на меньшем интервале. */
export function sampleBinomial(n,p,random){
 if(!Number.isSafeInteger(n)||n<0||!Number.isFinite(p)||p<0||p>1)throw new Error('Неверные параметры биномиальной порчи.');
 if(p===0||n===0)return 0;if(p===1)return n;
 if(p>.5)return n-sampleBinomial(n,1-p,random);
 if(n*p<16){
  let mass=Math.exp(n*Math.log1p(-p)),u=random.next(),k=0;
  while(u>mass&&k<n){u-=mass;k++;mass*=((n-k+1)/k)*(p/(1-p));}
  return k;
 }
 const a=Math.floor(n/2)+1,b=n-a+1,g1=gamma(a,random),g2=gamma(b,random),x=g1/(g1+g2);
 return x>=p?sampleBinomial(a-1,p/x,random):a+sampleBinomial(b-1,(p-x)/(1-x),random);
}
const checkAmount=amount=>{if(!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(Math.floor(amount)))throw new Error('Количество ресурса превышает точность целых порций.');};
export function createMeat(amount=0,subtick=0){checkAmount(amount);return {whole:Math.floor(amount),fraction:amount-Math.floor(amount),subtick};}
export const meatAmount=c=>c.whole+c.fraction;
function setAmount(c,amount){checkAmount(amount);c.whole=Math.floor(amount);c.fraction=amount-c.whole;return c;}
export function decayMeat(c,subtick,random,r=PHYSIOLOGY_DEFAULTS){
 if(!Number.isSafeInteger(subtick)||subtick<c.subtick)throw new Error('Время порчи пошло назад.');
 if(subtick===c.subtick)return 0;
 const survival=Math.exp(-Math.LN2*(subtick-c.subtick)*DT/r.meatHalfLife),before=meatAmount(c);
 c.whole=sampleBinomial(c.whole,survival,random);
 if(c.fraction>0&&random.next()>=survival)c.fraction=0;
 c.subtick=subtick;return before-meatAmount(c);
}
export function addMeat(c,amount,subtick){
 checkAmount(amount);if(c.subtick!==subtick)throw new Error('Перед переносом мяса нужно учесть его порчу.');
 return setAmount(c,meatAmount(c)+amount);
}
export function takeMeat(c,maximum){checkAmount(maximum);const amount=Math.min(meatAmount(c),maximum);setAmount(c,meatAmount(c)-amount);return amount;}

/** Собственный детерминированный хеш не расходует RNG решений/порчи.
 * Запас травы непрерывен в заданном диапазоне и воспроизводится по seed. */
export function createGrass(seed,index,subtick=0,r=PHYSIOLOGY_DEFAULTS){
 let h=(seed^Math.imul(index+1,0x9e3779b1))>>>0;h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);h=(h^(h>>>16))>>>0;
 const maximum=r.grassMin+(r.grassMax-r.grassMin)*(h/0xffffffff);
 return {maximum,amount:maximum,subtick};
}
export function grassAmount(c,subtick,r=PHYSIOLOGY_DEFAULTS){
 if(subtick<c.subtick)throw new Error('Время восстановления травы пошло назад.');
 return Math.min(c.maximum,c.amount+(subtick-c.subtick)*DT*r.grassRegrowth);
}
export function takeGrass(c,maximum,subtick,r=PHYSIOLOGY_DEFAULTS){
 checkAmount(maximum);const grown=grassAmount(c,subtick,r),amount=Math.min(maximum,grown),regrown=grown-c.amount;
 c.amount=grown-amount;c.subtick=subtick;return {amount,regrown};
}
