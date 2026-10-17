/** Одинаковый смысл полей нового мира, вмешательства и длинных испытаний.
 * Поля только готовят настройки: сами не изменяют мир и не расходуют RNG. */
const byId=id=>document.getElementById(id);
export function readFoodControls(prefix=''){
 return {foodSources:Number(byId(prefix+'food-sources').value),foodRegrowInterval:Number(byId(prefix+'food-period').value),
  foodIslandCount:Number(byId(prefix+'food-islands').value),foodPeriodSpread:Number(byId(prefix+'food-period-spread').value),foodSizeSpread:Number(byId(prefix+'food-size-spread').value)};
}
export function installFoodControls(prefix=''){
 const fields=[['sources','источников'],['period','шагов'],['period-spread','%'],['size-spread','%']];
 const update=()=>{for(const [name,unit] of fields)byId(prefix+'food-'+name+'-value').textContent=`${byId(prefix+'food-'+name).value} ${unit}`;};
 for(const [name] of fields)byId(prefix+'food-'+name).addEventListener('input',update);
 update();return update;
}
export function syncFoodControls(prefix,settings){
 for(const [name,value] of [['sources',settings.sourceCount],['period',settings.regrowInterval],
  ['islands',settings.requestedIslandCount],['period-spread',settings.periodSpread],['size-spread',settings.sizeSpread]])
  byId(prefix+'food-'+name).value=value;
}
