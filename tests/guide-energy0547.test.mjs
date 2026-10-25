import test from 'node:test';
import assert from 'node:assert/strict';
import {guideDeficitExample,GUIDE_ENERGY_TEXT} from '../dist/guide-energy-text.js';
import {Evolution} from '../dist/evolution.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {ENERGY_DEFICIT_FACTOR} from '../dist/energy-budget.js';

test('handbook deficit example covers partial payment, exact zero and lethal shortage',()=>{
 const example=guideDeficitExample();assert.equal(example.paid,.25);assert.equal(example.missing,.75);assert.equal(example.after.health,6.875);
 const exact=guideDeficitExample({energy:1,health:10,cost:1});assert.equal(exact.after.energy,0);assert.equal(exact.after.health,10);
 const lethal=guideDeficitExample({energy:0,health:1,cost:1});assert.equal(lethal.after.health,0);assert.equal(lethal.paid,0);
 const small=guideDeficitExample({energy:0,health:10,cost:.1});assert.ok(Math.abs(small.healthLoss-.1*ENERGY_DEFICIT_FACTOR)<1e-10);
 assert.equal(GUIDE_ARTICLES.find(a=>a.id==='energy').reviewedVersion,'0.54.7');
});
test('death records resource losses without placing body food on the world cell',()=>{
 const w=new Evolution({population:1,seed:42}),a=w.agents[0],cell=w.tile(a.x,a.y),food=cell.food;
 a.inventory=2;a.energy=3;a.stomach=4;const discarded=w.stats.discardedFood,lost=w.stats.deathEnergy;
 w.die(a,'starvation');assert.equal(cell.food,food);assert.equal(w.stats.discardedFood-discarded,2);assert.equal(w.stats.deathEnergy-lost,7);
 assert.equal(a.alive,false);assert.equal(w.records.get(a.id).cause,'starvation');
 assert.match(GUIDE_ENERGY_TEXT['guide-energy-body'],/еда его не восстанавливает/);
 assert.doesNotMatch(GUIDE_ARTICLES.find(a=>a.id==='deposits').summary,/остатки после гибели: их можно/);
});
