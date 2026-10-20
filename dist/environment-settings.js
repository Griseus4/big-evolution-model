/** Сценарий наблюдателя. Его параметры/RNG недоступны мозгу. Единицы времени—Т,
 * производства—порции/Т. Цели и границы — сценарий пользователя, не данные мозга. */
import {FOOD_LIMITS} from './food-settings.js';
import {DT} from './action-timing.js';
export const ENVIRONMENT_SCHEMA='target-food-v2';
export const ENVIRONMENT_DEFAULTS=Object.freeze({enabled:true,preparationInterval:500,randomInterval:1000,targetSources:300,targetPeriod:100,minimumRate:2,maximumRate:6});
export const ENVIRONMENT_RULES=Object.freeze({preparationSteps:5,relativeSigma:.24345721982449078,returnFraction:.25,relocationFraction:.2,relocationRadius:5,islandRelocationMinimum:5,islandRelocationRadius:20,islandRelocationAttempts:32,maximumPeriod:1e9});
export function validateEnvironmentSettings(input={}){
 const options={...ENVIRONMENT_DEFAULTS,...input};
 if(typeof options.enabled!=='boolean')throw new Error('Некорректный переключатель среды.');
 for(const key of ['preparationInterval','randomInterval'])if(!Number.isSafeInteger(options[key])||options[key]<1||options[key]>1000000000)throw new Error('Интервал среды: целое от1 до1000000000 Т.');
 if(!Number.isSafeInteger(options.targetSources)||options.targetSources<1||options.targetSources>FOOD_LIMITS.sourcesMax)throw new Error(`Целевое число источников: целое от 1 до ${FOOD_LIMITS.sourcesMax}.`);
 if(!Number.isFinite(options.targetPeriod)||options.targetPeriod<DT||options.targetPeriod>ENVIRONMENT_RULES.maximumPeriod)throw new Error('Целевой период: от 0,1 до 1 000 000 000 Т.');
 if(!Number.isFinite(options.minimumRate)||options.minimumRate<=0||!Number.isFinite(options.maximumRate)||options.maximumRate<=options.minimumRate)throw new Error('Границы выработки: 0 < минимум < максимум, порции/Т.');
 if(options.minimumRate>FOOD_LIMITS.sourcesMax/DT||options.maximumRate<1/ENVIRONMENT_RULES.maximumPeriod)throw new Error('Диапазон выработки недостижим при физических пределах источников и периодов.');
 return Object.fromEntries(Object.keys(ENVIRONMENT_DEFAULTS).map(key=>[key,options[key]]));
}
export function foodProduction(world){return world.individualFood?world.foodIslands.reduce((n,g)=>n+g.sources.length/g.period,0):world.tiles.reduce((n,c)=>n+Number(c.maxFood>0),0)/world.foodSettings.regrowInterval;}
