import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {advanceEnvironment,configureEnvironment} from '../dist/automatic-environment.js';
import {ENVIRONMENT_RULES} from '../dist/environment-settings.js';

function fixture(){return new Evolution({population:1,seed:42,foodSources:60,foodIslandCount:4,
 automaticEnvironment:{enabled:true,preparationInterval:2,randomInterval:3,targetSources:40,targetPeriod:20,minimumRate:.01,maximumRate:100}});}
test('preparation follows its calendar and changes production without transporting stocks or biological RNG',()=>{
 const w=fixture(),stocks=w.tiles.map(c=>c.food),rng=w.random.state;assert.equal(w.automaticEnvironment.enabled,true);
 w.tick=1;assert.equal(advanceEnvironment(w),false);
 for(let n=1;n<=ENVIRONMENT_RULES.preparationSteps;n++){
  w.tick=n*2;assert.equal(advanceEnvironment(w),true);
  assert.equal(w.automaticEnvironment.completedSteps,n);assert.deepEqual(w.tiles.map(c=>c.food),stocks);
 }
 assert.equal(w.random.state,rng);assert.equal(w.automaticEnvironment.nextTick,w.tick+3);
 assert.equal(w.foodSettings.sourceCount,40);assert.equal(w.environmentChanges.length,ENVIRONMENT_RULES.preparationSteps);
});
test('targets do not reset the calendar, intervals do; disable and enable preserve preparation progress',()=>{
 const w=fixture();w.tick=2;advanceEnvironment(w);const completed=w.automaticEnvironment.completedSteps,next=w.automaticEnvironment.nextTick;
 w.tick=2.5;configureEnvironment(w,{targetSources:45});assert.equal(w.automaticEnvironment.nextTick,next);
 configureEnvironment(w,{preparationInterval:4});assert.equal(w.automaticEnvironment.nextTick,w.tick+4);
 configureEnvironment(w,{enabled:false});assert.equal(w.automaticEnvironment.nextTick,null);
 configureEnvironment(w,{enabled:true});assert.equal(w.automaticEnvironment.completedSteps,completed);assert.equal(w.automaticEnvironment.nextTick,w.tick+4);
});
test('invalid environment configuration is rejected before replacing its settings',()=>{
 const w=fixture(),before={...w.automaticEnvironment};
 assert.throws(()=>configureEnvironment(w,{minimumRate:100,maximumRate:1}));
 assert.deepEqual(w.automaticEnvironment,before);
});
