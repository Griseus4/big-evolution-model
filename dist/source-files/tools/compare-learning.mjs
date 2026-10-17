/** Длинное воспроизводимое сравнение; вывод — JSON по строке на контрольную точку.
 * Запуск: node tools/compare-learning.mjs. Может занять несколько минут.
 * Память включена в обоих режимах; TD выключен только в контроле.
 */
import {Evolution,worldDistance} from '../dist/evolution.js';
// Одинаковые исходные миры/геномы, мутации включены. После первых решений RNG
// расходится из-за разных действий: это сравнение режимов, не пар отдельных жизней.
for(const seed of [42,23])for(const learning of [false,true]){
 const s=new Evolution({seed,learning}),start=performance.now();
 for(let checkpoint=10000;checkpoint<=30000;checkpoint+=10000){
  s.advance(Math.max(0,checkpoint-s.tick));
  const sources=s.foodIslands.flatMap(g=>g.sources),sum=s.summary();
  const near=s.agents.filter(a=>sources.some(p=>worldDistance(a,p)<=3)).length;
  const result={seed,learning,requested:checkpoint,tick:s.tick,live:s.agents.length,births:s.stats.births,generation:s.maxGeneration,lineages:sum.survivingFounders,nearFood:near,longPlaces:s.agents.reduce((n,a)=>n+a.brain.longMemory.size,0),updates:sum.learningUpdates,seconds:Math.round((performance.now()-start)/1000)};
  console.log(JSON.stringify(result));
  if(!s.agents.length)break;
 }
}
