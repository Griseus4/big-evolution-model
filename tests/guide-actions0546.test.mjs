import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {temporalSelectedChoice,acceptTemporalChoice,prepareTemporalBoundary} from '../dist/temporal-world.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {GUIDE_ACTIONS_TEXT} from '../dist/guide-actions-text.js';

test('continuation preserves process identity and progress; a different action records voluntary interruption',()=>{
 const w=new Evolution({population:1,seed:42}),a=w.agents[0];
 acceptTemporalChoice(w,a,temporalSelectedChoice(w,a,8));const process=a.process;process.elapsed=2;
 const continuation=temporalSelectedChoice(w,a,8);assert.equal(continuation.continuation,true);
 acceptTemporalChoice(w,a,continuation);assert.equal(a.process,process);assert.equal(a.process.elapsed,2);
 a.inventory=1;a.stomach=0;acceptTemporalChoice(w,a,temporalSelectedChoice(w,a,7));
 assert.notEqual(a.process,process);assert.equal(a.process.elapsed,0);assert.equal(a.life.observer.interruptions.voluntary,1);
 assert.equal(GUIDE_ARTICLES.find(a=>a.id==='actions').reviewedVersion,'0.54.6');
});
test('food disappearing cancels gathering before the shared activity snapshot',()=>{
 const w=new Evolution({population:1,seed:42}),a=w.agents[0],cell=w.tile(a.x,a.y);cell.food=1;a.inventory=0;
 acceptTemporalChoice(w,a,temporalSelectedChoice(w,a,6));cell.food=0;prepareTemporalBoundary(w);
 assert.equal(a.process,null);assert.equal(a.life.observer.interruptions.physical,1);assert.equal(a.inventory,0);
 assert.match(GUIDE_ACTIONS_TEXT['guide-actions-body'],/конкурент забирает последнюю порцию/);
});
