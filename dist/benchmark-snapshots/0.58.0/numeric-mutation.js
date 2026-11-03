/** Семь числовых групп используют A/r вместо вероятности пропуска.
 * Параметры распределения принадлежат родителю на начало рождения. */
export const NUMERIC_MUTATION_RULES=Object.freeze({shape:.05,ceiling:.10,ceilingMin:.01,ceilingMax:.10,minimumFraction:.01,weightScale:.1,traitScale:1,shapeScale:.05,ceilingScale:.10});
export const NUMERIC_MUTATION_GROUPS=Object.freeze(['behavior','attentionWeights','contextWeights','cells','target','operation','direct']);
export function numericMutationProfile(shape=NUMERIC_MUTATION_RULES.shape,ceiling=NUMERIC_MUTATION_RULES.ceiling){
 if(!Number.isFinite(shape)||!(shape>0)||!Number.isFinite(ceiling)||ceiling<NUMERIC_MUTATION_RULES.ceilingMin||ceiling>NUMERIC_MUTATION_RULES.ceilingMax)throw new Error('Мутация: A > 0, r от 0,01 до 0,10.');
 return {shape,ceiling};
}
/** Отражение, не обрезание. Границы могут быть открытыми; следующий float
 * внутри интервала не создаёт искусственного биологического нижнего порога. */
function nextInside(value,up){
 if(value===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;
 const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value);
 let bits=view.getBigUint64(0);bits+=((value>0)===up)?1n:-1n;view.setBigUint64(0,bits);return view.getFloat64(0);
}
export function reflectMutation(value,{min=-Infinity,max=Infinity,exclusiveMin=false,exclusiveMax=false}={}){
 if(!Number.isFinite(value))throw new Error('Неконечный предложенный шаг мутации.');
 let x=value;
 if(Number.isFinite(min)&&Number.isFinite(max)){
  const width=max-min;if(!(width>0)||!Number.isFinite(2*width))throw new Error('Неверная область мутации.');
  if(x<min||x>max){const z=((x-min)%(2*width)+2*width)%(2*width);x=z<=width?min+z:max-(z-width);}
 }else if(x<min)x=min+(min-x);else if(x>max)x=max-(x-max);
 if(exclusiveMin&&x===min)x=nextInside(min,true);
 if(exclusiveMax&&x===max)x=nextInside(max,false);
 if(!Number.isFinite(x))throw new Error('Отражённый шаг не представим конечным числом.');
 return x;
}
export function mutateNumeric(value,scale,profile,random,domain){
 if(!Number.isFinite(value)||!Number.isFinite(scale)||!(scale>0))throw new Error('Неверная координата/шкала мутации.');
 const {shape:A,ceiling:r}=numericMutationProfile(profile.shape,profile.ceiling),u=random.next();
 if(!Number.isFinite(u)||u<0||u>=1)throw new Error('RNG мутации должен возвращать [0; 1).');
 const minimum=NUMERIC_MUTATION_RULES.minimumFraction*scale,maximum=r*Math.max(Math.abs(value),scale);
 // Эквивалент A(1−U)/(U+A), без переполнения произведения при большом A.
 const magnitude=minimum+(maximum-minimum)*(1-u)/(1+u/A);
 return reflectMutation(value+(random.next()<.5?-magnitude:magnitude),domain);
}
