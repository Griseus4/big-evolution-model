/** Эти отпечатки сняты с версии 0.5 ДО расширения карты. Они проверяют
 * сохранение пищи и основателей, независимо от нового способа генерации.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Evolution,WORLD_WIDTH,WORLD_HEIGHT,INITIAL_WIDTH,INITIAL_HEIGHT,worldHexAt,hexCenter,COGNITIVE_GENES} from '../dist/evolution.js';
import {createBrain,observe} from '../dist/cognition.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const snapshots=[
 [42,'balanced',436,'373d191c91fb8d452839138408796c116f390dd420f2a9c44e9f0ec5ccfca252','98f38c1a3900e15b41c71b6524a4c9907d69658947893008023f36ec7b5420ca'],
 [42,'scarce',126,'eba95414f781f3dda1e8ab71b3db81ab48d34f445303b3b957906076996eefb1','beb91f2c94164f21f969d22f0cd6a6b92f5dcf48c56f85785408de6a75514b3d'],
 [23,'balanced',455,'b8068ef8676497242e570d4020e1da0f0552589558e99e7a7774f2dea56da927','126d3d35846f5468a67b4e67ebbb5d51c22190f22efc3678167b7198db716cfe'],
 [23,'scarce',155,'2d443cc310309f0d30144666816d6008fff2f332f7cdfae9654b67b66b89958a','4513b14d3452ebdc792bcbb0239650e66354264ef8796fa577ae24db8391fcd3'],
];
test('map keeps old source inventory and first 450 founder genes before relocation',()=>{
 assert.equal(WORLD_WIDTH,48);assert.equal(WORLD_HEIGHT,32);
 for(const [seed,scenario,food,cellsHash,foundersHash]of snapshots){
  const s=new Evolution({seed,scenario});assert.equal(s.tiles.length,1536);assert.equal(s.initialFood,food);
  const cells=s.sourceTemplate;
  assert.equal(hash(cells),cellsHash);
  assert.equal(hash(s.agents.map(a=>({x:a.x,y:a.y,genome:a.genome.slice(0,450)}))),foundersHash);
  assert.ok(s.agents.every(a=>a.x<INITIAL_WIDTH&&a.y<INITIAL_HEIGHT));
 }
});
test('movement can enter the extension while food and energy remain conserved',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];a.x=8;a.y=15;a.frameRotation=0;
 s.choose=a=>s.evaluate(a).find(o=>o.action===5);
 s.step();assert.equal(a.y,16);assert.equal(s.tile(a.x,a.y).terrain,'land');
 s.choose=a=>s.evaluate(a).find(o=>o.action===8);s.advance(160);
 const extension=s.tiles.filter(c=>c.x>=INITIAL_WIDTH||c.y>=INITIAL_HEIGHT);
 assert.equal(extension.length,1152);
 assert.ok(extension.every(c=>c.terrain==='land'));
 assert.equal(s.balances().foodError,0);assert.ok(Math.abs(s.balances().energyError)<1e-6);
});
test('every centre in the expanded map is clickable, including the far right and bottom',()=>{
 for(let y=0;y<WORLD_HEIGHT;y++)for(let x=0;x<WORLD_WIDTH;x++){
  const p={x,y},center=hexCenter(p);assert.deepEqual(worldHexAt(center.x,center.y),p);
 }
 assert.equal(worldHexAt(-100,-100),null);
 const outside=hexCenter({x:WORLD_WIDTH,y:WORLD_HEIGHT});assert.equal(worldHexAt(outside.x,outside.y),null);
});
test('a past food observation changes direction without reading that hidden cell again',()=>{
 const s=new Evolution({population:1,learning:false}),a=s.agents[0];a.x=5;a.y=5;a.frameRotation=0;a.genome.fill(0);
 a.genome[COGNITIVE_GENES.find(g=>g.key==='foodMemory').index]=8;a.brain=createBrain(a.genome);
 for(const c of s.tiles){c.food=0;c.risk=0;}
 const source={q:7,r:0,food:3,terrain:'land'};observe(a.brain,[source],source,1);
 s.tick=10;
 const remembered=s.evaluate(a),right=remembered.find(o=>o.action===0),left=remembered.find(o=>o.action===1);
 assert.ok(right.probability>left.probability);
 s.tile(12,5).food=0;assert.deepEqual(s.evaluate(a),remembered);
 s.memoryEnabled=false;const blind=s.evaluate(a);
 assert.ok(Math.abs(blind.find(o=>o.action===0).probability-blind.find(o=>o.action===1).probability)<1e-12);
 assert.equal(a.brain.memory.get('7,0').food,3);
});
