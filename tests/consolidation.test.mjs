import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,GENE_COUNT,COGNITIVE_GENES} from '../dist/evolution.js';
import {createBrain,observe,getMemory,rememberDecision,rememberExperience,memoryStrength} from '../dist/cognition.js';
const genes=()=>Array(GENE_COUNT).fill(0);
function experience(brain,place,before,after,tick){
 rememberDecision(brain,place,tick);
 rememberExperience(brain,{choice:{row:0,action:8},beforeFeeling:before},after,tick+1);
}

test('one strong event survives overflow of the short memory and remains revisable',()=>{
 const b=createBrain(genes()),p={q:0,r:0,food:3,terrain:'land'};
 observe(b,[p],p,1);experience(b,p,0,-30,1);
 assert.equal(b.longMemory.size,1);assert.equal(b.memory.size,0);
 for(let i=1;i<200;i++)observe(b,[{q:i,r:0,food:0,terrain:'land'}],{q:-1,r:-1},i+2);
 assert.equal(getMemory(b,'0,0').food,3);
 observe(b,[{...p,food:0}],{q:-1,r:-1},250);assert.equal(getMemory(b,'0,0').food,0);
 assert.equal(getMemory(b,'0,0').maxFoodSeen,3);assert.ok(getMemory(b,'0,0').consolidationReason);
});
test('repeated returns consolidate a neutral place, while idle time alone does not count as returns',()=>{
 const b=createBrain(genes()),p={q:0,r:0,food:0,terrain:'land'},away={q:1,r:0,food:0,terrain:'land'};
 for(let i=1;i<=20;i++)observe(b,[p],p,i);
 assert.equal(getMemory(b,'0,0').encounters,1);assert.equal(b.longMemory.size,0);
 for(let i=21;i<=28;i++){const place=i%2?p:away;observe(b,[place],place,i);}
 assert.ok(b.longMemory.has('0,0'));assert.equal(getMemory(b,'0,0').consolidationReason,'повторные посещения');
});
test('a late positive result reinforces the earlier pickup place as well as the eating place',()=>{
 const b=createBrain(genes()),source={q:0,r:0,food:3,terrain:'land'},meal={q:1,r:0,food:0,terrain:'land'};
 observe(b,[source],source,1);rememberDecision(b,source,1);
 observe(b,[meal],meal,2);rememberDecision(b,meal,2);
 rememberExperience(b,{choice:{row:0,action:7},beforeFeeling:-20},30,3);
 assert.ok(b.longMemory.has('0,0'));assert.ok(b.longMemory.has('1,0'));
});
test('consolidation works without TD, and newborns inherit no protected places or episodes',()=>{
 const s=new Evolution({population:1,limit:3,learning:false,mutations:false}),a=s.agents[0];
 a.x=6;a.y=6;a.frameRotation=0;a.genome.fill(0);
 a.genome[COGNITIVE_GENES.find(g=>g.key==='health').index]=8;
 a.genome[COGNITIVE_GENES.find(g=>g.key==='pain').index]=-8;a.brain=createBrain(a.genome);
 for(const c of s.tiles)c.risk=0;s.tile(7,6).risk=1;
 s.choose=a=>s.evaluate(a).find(o=>o.action===0);s.step();s.tile(7,6).risk=0;
 s.choose=a=>s.evaluate(a).find(o=>o.action===8);s.step();
 assert.equal(a.brain.updates,0);assert.ok(a.brain.longMemory.has('1,0'));
 a.age=100;a.energy=100;a.health=100;const child=s.reproduce(a);
 assert.equal(child.brain.longMemory.size,0);assert.equal(child.brain.recentEvents.length,0);
 assert.deepEqual(child.brain.position,{q:0,r:0});assert.equal(child.brain.facing,0);
});
test('salience fades and a stronger event can replace the weakest protected place',()=>{
 const b=createBrain(genes());b.traits.longCapacity=1;
 const p={q:0,r:0,food:0,terrain:'land'},q={q:1,r:0,food:0,terrain:'land'};
 observe(b,[p],p,1);experience(b,p,0,10,1);
 const original=getMemory(b,'0,0');assert.ok(memoryStrength(original,10000,b.traits)<memoryStrength(original,2,b.traits));
 b.recentEvents=[];observe(b,[q],q,3);experience(b,q,0,-50,3);
 assert.equal(b.longMemory.size,1);assert.ok(b.longMemory.has('1,0'));
});
