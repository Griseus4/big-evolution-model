import test from 'node:test';
import assert from 'node:assert/strict';
import {guideNavigationExample} from '../dist/guide-geography-text.js';
import {memoryWorldPosition,worldAxial,worldOffset,localNeighbours} from '../dist/navigation.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';

test('handbook route explains the changed meaning of forward after walking back',()=>{
 const route=guideNavigationExample();
 assert.deepEqual(route.map(s=>s.position),[{q:1,r:0},{q:0,r:0},{q:-1,r:0}]);
 assert.deepEqual(route.map(s=>s.facing),[0,3,3]);
 assert.equal(GUIDE_ARTICLES.find(a=>a.id==='geography').reviewedVersion,'0.54.5');
});
test('personal route maps to neighboring world cells for every rotation, without moving the agent',()=>{
 for(let rotation=0;rotation<6;rotation++){
  const agent={x:10,y:10,frameRotation:rotation,brain:{position:{q:0,r:0},facing:0}};
  const before=JSON.stringify(agent),cells=localNeighbours(agent.brain).map(place=>memoryWorldPosition(agent,place));
  assert.equal(new Set(cells.map(c=>`${c.x},${c.y}`)).size,6);
  for(const c of cells)assert.deepEqual(worldOffset(worldAxial(c)),c);
  assert.deepEqual(memoryWorldPosition(agent,agent.brain.position),{x:10,y:10});assert.equal(JSON.stringify(agent),before);
 }
});
