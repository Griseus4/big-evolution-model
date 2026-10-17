/** Проверяем личную навигацию независимо от позиции в мире и общей сетки. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,GENE_COUNT,memoryWorldPosition} from '../dist/evolution.js';
import {createBrain} from '../dist/cognition.js';
import {localNeighbours,rotate,worldAxial,localDistance} from '../dist/navigation.js';
const probabilities=(s,a)=>s.evaluate(a).map(({action,features,score,probability})=>({action,features,score,probability}));

test('translated and rotated newborns have identical local choices and no inherited map',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];
 a.x=8;a.y=20;a.frameRotation=0;a.genome.fill(.2);a.brain=createBrain(a.genome);
 const b=s.addAgent({x:38,y:25},a.genome.slice(),null);b.frameRotation=3;
 assert.deepEqual(probabilities(s,a),probabilities(s,b));
 assert.deepEqual(a.brain.position,{q:0,r:0});assert.deepEqual(b.brain.position,{q:0,r:0});
 assert.equal(a.brain.memory.size,0);assert.equal(b.brain.memory.size,0);
});
test('turning and stepping update personal displacement, projecting exactly into the world',()=>{
 const s=new Evolution({population:1,learning:false}),a=s.agents[0];a.x=28;a.y=20;a.frameRotation=2;
 const origin=worldAxial(a);
 for(const action of [0,3,0,2,1,5,4]){
  const before={...a.brain.position},next=localNeighbours(a.brain)[action];
  s.choose=a=>s.evaluate(a).find(o=>o.action===action);s.step();
  assert.equal(localDistance(before,a.brain.position),1);
  assert.deepEqual(a.brain.position,{q:next.q,r:next.r});assert.equal(a.brain.facing,next.direction);
  const delta=rotate(a.brain.position,a.frameRotation),actual=worldAxial(a);
  assert.deepEqual(actual,{q:origin.q+delta.q,r:origin.r+delta.r});
  assert.deepEqual(memoryWorldPosition(a,{q:0,r:0}),{x:28,y:20});
 }
});
test('brain observations and pending experiences contain personal coordinates only',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];a.x=30;a.y=20;
 s.step();s.step();assert.ok(a.brain.memory.size>0);
 function inspect(value){
  if(value instanceof Map){for(const item of value.values())inspect(item);return;}
  if(!value||typeof value!=='object')return;
  assert.ok(!Object.hasOwn(value,'x')&&!Object.hasOwn(value,'y'),'world coordinates leaked into brain');
  for(const item of Object.values(value))inspect(item);
 }
 inspect(a.brain);
});
test('world boundaries exclude a move without changing personal position during evaluation',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];a.x=47;a.y=25;a.frameRotation=0;a.brain=createBrain(Array(GENE_COUNT).fill(0));
 const before={...a.brain.position};assert.ok(!s.evaluate(a).some(o=>o.action===0));
 assert.deepEqual(a.brain.position,before);
});
