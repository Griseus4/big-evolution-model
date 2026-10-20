/** Сводка только для наблюдателя/редактора, не вход мозга. Вызывается при
 * изменении среды, а не в каждом подшаге. Разброс здесь — относительное
 * отклонение крайних значений от среднего, не стандартное отклонение. */
export function foodDistribution(world){
 const groups=world.foodIslands,main=groups.filter(g=>g.kind==='island'),sizes=main.map(g=>g.sources.length),periods=groups.map(g=>g.period),capacities=world.tiles.filter(c=>c.maxFood>0).map(c=>c.maxFood);
 const mean=a=>a.length?a.reduce((n,x)=>n+x,0)/a.length:0,spread=(a,m)=>m?100*Math.max(...a.map(x=>Math.abs(x-m)))/m:0;
 const regrowInterval=mean(periods),sizeMean=mean(sizes),capacityMin=capacities.length?Math.min(...capacities):3,capacityMax=capacities.length?Math.max(...capacities):6,capacityMean=(capacityMin+capacityMax)/2;
 return {sourceCount:capacities.length,requestedIslandCount:main.length,regrowInterval:regrowInterval||world.foodSettings.regrowInterval,
  periodSpread:spread(periods,regrowInterval),sizeSpread:spread(sizes,sizeMean),sizeMean,capacityMin,capacityMax,capacityMean,capacitySpread:100*(capacityMax-capacityMin)/(2*capacityMean)};
}
