import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {advanceTemporalBodies} from '../dist/temporal-world.js';
import {RULES,BODY_LIMITS} from '../dist/model-rules.js';
import {ACTION_DURATIONS,DT} from '../dist/action-timing.js';

function fixture(population=1){
 const w=new Evolution({population,seed:42,foodSources:0,automaticEnvironment:{enabled:false}});
 for(const a of w.agents){a.process=null;a.energy=50;a.stomach=0;a.inventory=0;a.health=BODY_LIMITS.health;}
 return w;
}
const process=(action,a)=>({action,elapsed:ACTION_DURATIONS[action]-1,duration:ACTION_DURATIONS[action],destination:{x:a.x,y:a.y}});

test('a completed meal reaches the stomach before its first digestion substep',()=>{
 const w=fixture(),a=w.agents[0];a.inventory=1;a.process=process(7,a);
 const energy=a.energy;advanceTemporalBodies(w);
 assert.equal(a.inventory,0);assert.equal(a.stomach,RULES.foodEnergy);assert.ok(a.energy<energy);
 const before=a.energy;advanceTemporalBodies(w);
 assert.ok(Math.abs(a.energy-before-w.digestionRate*DT)<1e-10);
 assert.ok(Math.abs(a.stomach-(RULES.foodEnergy-w.digestionRate*DT))<1e-10);
});
test('full body still consumes stomach content and records overflow',()=>{
 const w=fixture(),a=w.agents[0];a.energy=BODY_LIMITS.energy;a.stomach=RULES.foodEnergy;
 const overflow=w.stats.overflow;advanceTemporalBodies(w);
 assert.equal(a.energy,BODY_LIMITS.energy);
 assert.ok(Math.abs(a.stomach-(RULES.foodEnergy-w.digestionRate*DT))<1e-10);
 assert.ok(Math.abs(w.stats.overflow-overflow-w.digestionRate*DT)<1e-10);
});
test('simultaneous gatherers do not reserve or duplicate a scarce portion',()=>{
 const w=fixture(2),[a,b]=w.agents;w.moveAgent(b,{x:a.x,y:a.y});w.rebuildOccupancy();
 const cell=w.tile(a.x,a.y);cell.terrain='land';cell.food=1;cell.maxFood=0;
 a.process=process(6,a);b.process=process(6,b);const failed=w.stats.interrupted[6];
 advanceTemporalBodies(w);
 assert.equal(cell.food,0);assert.equal(a.inventory+b.inventory,1);
 assert.equal(w.stats.interrupted[6]-failed,1);
});
test('deposit threshold differs from source capacity and leaves no new source',()=>{
 const w=fixture(),a=w.agents[0],cell=w.tile(a.x,a.y);cell.terrain='land';cell.maxFood=0;
 a.inventory=1;cell.food=RULES.groundFoodCapacity-1;
 assert.equal(w.depositFood(a),true);assert.equal(cell.food,RULES.groundFoodCapacity);
 assert.equal(cell.maxFood,0);a.inventory=1;assert.equal(w.canDeposit(a),false);
});
