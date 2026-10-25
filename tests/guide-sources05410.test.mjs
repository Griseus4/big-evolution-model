import test from 'node:test';
import assert from 'node:assert/strict';
import {guideProductionExample} from '../dist/guide-food-sources-text.js';
import {regrowFoodIslands,createIndividualFoodLayout} from '../dist/food-islands.js';
import {Evolution} from '../dist/evolution.js';
import {Random} from '../dist/simulation.js';
import {islandSizes} from '../dist/food-islands.js';

test('production example sums group rates, not total sources divided by mean period',()=>{
 const e=guideProductionExample();assert.equal(e.production,.25);assert.notEqual(e.production,3/15);
});
test('full source skips a harvest without banking it for the next vacancy',()=>{
 const cell={food:2,maxFood:2};
 const w={tick:1,foodIslands:[{sources:[{x:0,y:0}],period:2,nextTick:1}],tile:()=>cell,stats:{regrown:0}};
 regrowFoodIslands(w);assert.equal(w.foodIslands[0].nextTick,3);assert.equal(w.stats.regrown,0);
 cell.food=0;w.tick=2;regrowFoodIslands(w);assert.equal(cell.food,0);
 w.tick=3;regrowFoodIslands(w);assert.equal(cell.food,1);assert.equal(w.stats.regrown,1);
});
test('integer group sizes preserve the source budget even with uneven weights',()=>{
 const sizes=islandSizes(31,7,90,new Random(42));assert.equal(sizes.reduce((a,b)=>a+b,0),31);assert.ok(sizes.every(n=>n>=1));
});
test('manual change of period leaves positions and existing food in place',()=>{
 const w=new Evolution({population:1,seed:42,foodSources:20,automaticEnvironment:{enabled:false}});
 const positions=w.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y]);const stocks=w.tiles.map(c=>c.food);
 const current=w.foodSettings;
 w.changeFoodEnvironment({foodSources:20,foodIslandCount:current.requestedIslandCount,foodPeriodSpread:current.periodSpread,foodSizeSpread:current.sizeSpread,foodRegrowInterval:40});
 assert.deepEqual(w.tiles.filter(c=>c.maxFood>0).map(c=>[c.x,c.y]),positions);
 assert.deepEqual(w.tiles.map(c=>c.food),stocks);assert.equal(w.automaticEnvironment.preparationCancelled,true);
});
