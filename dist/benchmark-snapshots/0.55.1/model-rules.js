/** Единственный источник физиологии и стоимости деятельности.
 * Энергия/здоровье — единицы тела; ставки — энергия/Т, роды — разовый платёж.
 * Настройки конкретного мира (усвоение/роды) сохраняются отдельно от этих базовых правил. */
import {reproductionProfile,REPRODUCTION_DEFAULTS} from './reproduction.js';
import {BIRTH_ACTION,DEPOSIT_ACTION} from './policy-layout.js';
import {DT} from './action-timing.js';
export const BODY_LIMITS=Object.freeze({energy:100,health:100,pain:100});
/** Пороги описательных категорий наблюдателя/старой табличной политики. */
export const BODY_THRESHOLDS=Object.freeze({hungry:30,highEnergy:70});
export const RULES=Object.freeze({foodEnergy:22,digestionRate:1.1,stomachCapacity:66,
 inventoryCapacity:3,initialEnergy:68,newbornEnergy:28,birthCost:32,birthThreshold:reproductionProfile().energy,birthHealth:reproductionProfile().health,
 maturity:REPRODUCTION_DEFAULTS.maturity,birthInterval:REPRODUCTION_DEFAULTS.birthInterval,maxAge:10000,regrowInterval:80,
 waitCost:.30,depositCost:.36,groundFoodCapacity:10,actionCost:.48,moveExtra:.30,gatherExtra:.18});
export const DIGESTION_TIME_LIMITS=Object.freeze({min:DT,max:1e9});
/** Время усвоения одной порции, Т. Прежняя скорость задаёт значение по
 * умолчанию; энергоценность пищи не меняется. Нижний предел — один подшаг. */
export function validateDigestionTime(value=RULES.foodEnergy/RULES.digestionRate){
 if(!Number.isFinite(value)||value<DIGESTION_TIME_LIMITS.min||value>DIGESTION_TIME_LIMITS.max)throw new Error(`Усвоение одной порции: время от ${DIGESTION_TIME_LIMITS.min.toLocaleString('ru-RU')} до ${DIGESTION_TIME_LIMITS.max.toLocaleString('ru-RU')} Т.`);
 return value;
}
/** Обычная ставка состоит из основы и добавки деятельности. Роды — отдельный
 * разовый платёж. Эти величины определяет физика, а не предпочтения мозга. */
export function actionEnergyCost(action){return action===BIRTH_ACTION?RULES.birthCost:action===DEPOSIT_ACTION?RULES.depositCost:action===8?RULES.waitCost:
 RULES.actionCost+(action<6?RULES.moveExtra:action===6?RULES.gatherExtra:0);}
