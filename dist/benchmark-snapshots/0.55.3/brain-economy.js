/** Условные операции остаются прежними; коэффициент меняет только энергию.
 * Это условие мира, не наследуемое свойство и не вход мозга. */
export const BRAIN_ECONOMY=Object.freeze({multiplier:1});
export function validateBrainCostMultiplier(value=BRAIN_ECONOMY.multiplier){
 if(!Number.isFinite(value)||value<=0)throw new Error('Коэффициент цены вычислений должен быть конечным числом больше нуля.');
 return value;
}
export function scaledBrainCost(cost,multiplier=BRAIN_ECONOMY.multiplier){
 const result=cost*multiplier;
 if(!Number.isFinite(cost)||cost<0||!Number.isFinite(result)||result<0||cost>0&&result===0)throw new Error('Цена вычислений вне численного диапазона: измените коэффициент.');
 return result;
}
