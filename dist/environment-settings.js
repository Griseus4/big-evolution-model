/** Сценарий наблюдателя. Его параметры/RNG недоступны мозгу. Единицы времени—Т,
 * производства—порции/Т. Исходная калибровка — lives217652; нижний порог 2 порции/Т выбран пользователем. */
export const ENVIRONMENT_DEFAULTS=Object.freeze({enabled:true,preparationInterval:500,randomInterval:1000});
export const ENVIRONMENT_RULES=Object.freeze({minimumRate:2,targetRate:5.4,preparationSteps:5,relativeSigma:.24345721982449078,relocationFraction:.2,relocationRadius:5});
export function validateEnvironmentSettings(input={}){
 const options={...ENVIRONMENT_DEFAULTS,...input};
 if(typeof options.enabled!=='boolean')throw new Error('Некорректный переключатель среды.');
 for(const key of ['preparationInterval','randomInterval'])if(!Number.isSafeInteger(options[key])||options[key]<1||options[key]>1000000000)throw new Error('Интервал среды: целое от1 до1000000000 Т.');
 return {enabled:options.enabled,preparationInterval:options.preparationInterval,randomInterval:options.randomInterval};
}
export function foodProduction(world){return world.individualFood?world.foodIslands.reduce((n,g)=>n+g.sources.length/g.period,0):world.tiles.reduce((n,c)=>n+Number(c.maxFood>0),0)/world.foodSettings.regrowInterval;}
