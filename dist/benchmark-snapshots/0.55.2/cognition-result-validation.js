import {RESULT,RESULT_WIDTH} from './cognition-packet.js';
/** Проверяем весь пакет до применения RNG/оплаты. Нулевая цена допустима
 * только для отсутствующего вызова; обучение может отсутствовать. */
export function validateCognitionCosts(result,agents,priming){
 if(!(result instanceof Float64Array)||result.length<agents.length*RESULT_WIDTH)throw new Error('Неполный ответ вычислителя.');
 for(let i=0;i<agents.length;i++){
  const a=agents[i],at=i*RESULT_WIDTH,decision=result[at+RESULT.decision],gate=result[at+RESULT.gateCost],learning=result[at+RESULT.learningCost];
  const checked=a.brain.dual&&!priming&&(a.process||a.resting)&&a.process?.action!==9;
  if(!Number.isFinite(gate)||(checked?gate<=0:gate!==0))throw new Error('Некорректная стоимость проверки диспетчера. Перезапустите страницу; мир остановлен.');
  if(!Number.isFinite(learning)||learning<0)throw new Error('Некорректная стоимость обучения вычислителя.');
  if(![0,1,2].includes(decision))throw new Error('Некорректный признак решения вычислителя.');
  if((priming||(!a.process&&!a.resting))&&!decision)throw new Error('Вычислитель пропустил обязательное решение.');
  if(!decision)continue;
  const mask=result[at+RESULT.mask];
  if(!Number.isInteger(mask)||mask<=0||mask>=1<<11)throw new Error('Некорректная маска действий вычислителя.');
  for(let k=0;k<11;k++)if(mask&(1<<k)){
   const cost=result[at+RESULT.costs+k];
   if(!Number.isFinite(cost)||cost<=0)throw new Error('Некорректная стоимость основного выбора. Перезапустите страницу; мир остановлен.');
  }
 }
}
