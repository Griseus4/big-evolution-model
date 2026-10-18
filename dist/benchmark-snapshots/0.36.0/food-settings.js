/** Параметры производства, скрытые от мозга. Общее число источников — бюджет,
 * число островков делит его на группы. Разбросы — проценты относительно
 * центрального периода и среднего размера; фазы выбираются один раз.
 * Ёмкости 3…6, старт заполнен. Миграция/выживание не гарантируются. */
import {Random} from './simulation.js';
export const FOOD_LIMITS=Object.freeze({sourcesMin:0,sourcesMax:384,sourcesDefault:384,
 intervalMin:10,intervalMax:300,individualIntervalMax:1600,intervalDefault:20,islandsMin:1,islandsMax:384,islandsDefault:8,
 spreadMin:0,spreadMax:90,periodSpreadDefault:30,sizeSpreadDefault:30,scatteredFraction:.2});
export function validateFoodSettings({foodSources=FOOD_LIMITS.sourcesDefault,foodRegrowInterval=FOOD_LIMITS.intervalDefault,
 foodIslandCount=FOOD_LIMITS.islandsDefault,foodPeriodSpread=FOOD_LIMITS.periodSpreadDefault,foodSizeSpread=FOOD_LIMITS.sizeSpreadDefault}={}){
 if(!Number.isInteger(foodSources)||foodSources<FOOD_LIMITS.sourcesMin||foodSources>FOOD_LIMITS.sourcesMax)
  throw new Error(`Количество источников: целое число ${FOOD_LIMITS.sourcesMin}…${FOOD_LIMITS.sourcesMax}.`);
 if(!Number.isInteger(foodRegrowInterval)||foodRegrowInterval<FOOD_LIMITS.intervalMin||foodRegrowInterval>FOOD_LIMITS.intervalMax)
  throw new Error(`Период восстановления: целое число ${FOOD_LIMITS.intervalMin}…${FOOD_LIMITS.intervalMax} шагов.`);
 if(!Number.isInteger(foodIslandCount)||foodIslandCount<FOOD_LIMITS.islandsMin||foodIslandCount>FOOD_LIMITS.islandsMax)
  throw new Error(`Количество островков: целое число ${FOOD_LIMITS.islandsMin}…${FOOD_LIMITS.islandsMax}.`);
 for(const [value,label] of [[foodPeriodSpread,'Разброс периодов'],[foodSizeSpread,'Разброс размеров']])
  if(!Number.isInteger(value)||value<FOOD_LIMITS.spreadMin||value>FOOD_LIMITS.spreadMax)throw new Error(`${label}: целое число 0…90%.`);
 return {foodSources,foodRegrowInterval,foodIslandCount,foodPeriodSpread,foodSizeSpread};
}
/** Отдельный поток еды не сдвигает случайность геномов/позиций основателей.
 * Для данного seed первые N ёмкостей повторяются при увеличении N. Размещение
 * затем группирует их в островки; источник — одна клетка, островок — группа.
 */
export function createFoodTemplate(count,seed){
 const random=new Random(seed^0x595716e3);
 return Array.from({length:count},()=>{const maxFood=3+Math.floor(random.next()*4);return {food:maxFood,maxFood};});
}
/** Старые названия нужны только для чтения прежних отчётов/проверок. Они больше
 * не являются выбираемыми режимами интерфейса. Не подменяем старые наблюдения
 * новыми параметрами, которых в тех отчётах не было.
 */
export function foodLabel(settings={}){
 const edited=settings.foodSettings?.generation?.includes('edited');
 if(!edited&&settings.scenario==='balanced')return 'Умеренная пища (прежняя среда)';
 if(!edited&&settings.scenario==='scarce')return 'Редкая пища (прежняя среда)';
 const sources=settings.foodSources??settings.foodSettings?.sourceCount;
 const period=settings.foodRegrowInterval??settings.foodSettings?.regrowInterval;
 const individual=settings.foodSettings?.synchronized===false||settings.foodIslandCount!==undefined;
 return `${sources??'—'} источников · ${individual?'центр периода':'1 порция/'} ${period??'—'} шагов`;
}
