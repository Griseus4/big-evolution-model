/** Наследуемая изменчивость v9. Два последних числа — логарифмические
 * координаты свойств, НЕ дополнительные входы или веса нейросети.
 * Начальный разброс — условия опыта, не предел дальнейшего развития.
 * Нижние пределы исключают полное генетическое замирание при включённых
 * мутациях. Верх силы ограничен только представимостью конечного Number;
 * сами прежние веса мозга по-прежнему находятся в пределах −8…8.
 */
import {layoutForGenes} from './neural-layout.js';
import {BODY_GENE_OFFSET,BODY_WEIGHT_COUNT} from './policy-layout.js';
export const MUTATION_SCHEMA='heritable-log-mutation-v1';
export const MUTATION_RULES=Object.freeze({rateFloor:.0001,strengthFloor:.000001,
 initialRateMin:.001,initialRateMax:.1,initialStrengthMin:.05,initialStrengthMax:1,
 slowRateFactor:.25,slowStrengthFactor:.2});
const TABLE_GENES=BODY_GENE_OFFSET+BODY_WEIGHT_COUNT;
const LOG_MIN=Math.log(MUTATION_RULES.strengthFloor),LOG_MAX=Math.log(Number.MAX_VALUE);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function mutationOffset(genes){return layoutForGenes(genes)?.mutationOffset??(genes.length===TABLE_GENES+2?TABLE_GENES:null);}
/** p = floor + (1-floor)*sigmoid(g). Устойчиво при больших |g|; вероятность
 * никогда не округляется до нуля. Сила = exp(g), нижний предел отдельный.
 * Возвращаем пару один раз на рождение, не внутри обхода каждого гена. */
export function mutationProfile(genes){
 const offset=mutationOffset(genes);if(offset===null)return null;
 const g=genes[offset],e=Math.exp(-Math.abs(g)),sigmoid=g>=0?1/(1+e):e/(1+e);
 return {schema:MUTATION_SCHEMA,rate:MUTATION_RULES.rateFloor+(1-MUTATION_RULES.rateFloor)*sigmoid,
  strength:Math.max(MUTATION_RULES.strengthFloor,Math.exp(genes[offset+1]))};
}
export function mutationGenes(rate,strength){
 const p=clamp((rate-MUTATION_RULES.rateFloor)/(1-MUTATION_RULES.rateFloor),Number.EPSILON,1-Number.EPSILON);
 return [Math.log(p/(1-p)),clamp(Math.log(Math.max(strength,MUTATION_RULES.strengthFloor)),LOG_MIN,LOG_MAX)];
}
/** Равномерность по логарифму: равные отношения величин имеют равную долю
 * основателей. Два броска отдельного RNG, без изменения генов/позиций мозга. */
export function randomMutationGenes(random){
 const logUniform=(lo,hi)=>Math.exp(Math.log(lo)+random.next()*Math.log(hi/lo));
 return mutationGenes(logUniform(MUTATION_RULES.initialRateMin,MUTATION_RULES.initialRateMax),
  logUniform(MUTATION_RULES.initialStrengthMin,MUTATION_RULES.initialStrengthMax));
}
/** Только явное преобразование. Старый мозг остаётся побайтно тем же;
 * личный опыт сюда не переносится. Готовый v9 не получает второй хвост. */
export function withMutationGenes(genes,random){return mutationOffset(genes)!==null?genes.slice():[...genes,...randomMutationGenes(random)];}
export function validMutationGenes(genes){
 const offset=mutationOffset(genes);return offset!==null&&Number.isFinite(genes[offset])&&
  Number.isFinite(genes[offset+1])&&genes[offset+1]>=LOG_MIN&&genes[offset+1]<=LOG_MAX;
}
/** Оба регулятора меняются с обычной родительской вероятностью, без
 * гарантированной мета-мутации. Прибавка в лог-координатах даёт относительный
 * масштаб: odds вероятности и сила умножаются на exp(u*log(1+strength)).
 * Все величины родителя фиксируются заранее; ребёнок не меняет правила
 * собственного рождения. log1p предотвращает взрыв шага при большой силе. */
export function mutateRegulator(value,index,offset,profile,random){
 if(random.next()>=profile.rate)return value;
 const delta=(random.next()*2-1)*Math.log1p(profile.strength);
 return index===offset+1?clamp(value+delta,LOG_MIN,LOG_MAX):clamp(value+delta,-Number.MAX_VALUE,Number.MAX_VALUE);
}
export function effectiveMutationRate(profile,slow){return Math.max(MUTATION_RULES.rateFloor,profile.rate*(slow?MUTATION_RULES.slowRateFactor:1));}
