import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {physiologyFrame,advancePhysiologyBodies,preparePhysiologyBoundary,commitPhysiologyChoice} from '../dist/physiology-world.js';
import {startProcess,resolveAttacks} from '../dist/physiology-actions.js';
import {validSetInput} from '../dist/set-brain-inputs.js';
import {bodyCapacities} from '../dist/body-physiology.js';
import {checkPhysiologyInvariants} from '../dist/physiology-invariants.js';
const world=options=>new Evolution({population:2,seed:42,physiology:{},...options});
test('новый мир: конечные оценки и обучение с типами пищи, самостоятельные тела',()=>{
 const w=world();assert.equal(w.agents[0].genome.at(-1),18057018);
 for(let j=0;j<30;j++)w.substep();
 assert.equal(w.subtick,30);
 for(const a of w.agents){assert(Number.isFinite(a.energy));assert(a.health>0);assert(a.L<=a.M);assert(a.energy<=bodyCapacities(a,w.physiology).energy);assert(a.brain.networkDelta.every(Number.isFinite));if(a.brain.pending)assert(validSetInput(a.brain.pending.choice.batchInput));}
 assert(w.stats.brainCalls>0);assert(w.stats.physiology.basal>0);
});
test('все движения раньше ударов; одновременные удары не отменяют друг друга',()=>{
 const w=world(),[a,b]=w.agents;w.moveAgent(b,a);preparePhysiologyBoundary(w);
 a.health=b.health=1;
 a.process={action:11,targetHandle:b.id};b.process={action:11,targetHandle:a.id};
 const hits=resolveAttacks([a,b],new Map([[a.id,a],[b.id,b]]),{...w.physiology,attackDamage:1000});
 assert.equal(hits.length,2);assert.equal(a.health,0);assert.equal(b.health,0);
});
test('разные типы пищи имеют разные варианты, нулевой невидимый ID не входит в числа',()=>{
 const w=world(),a=w.agents[0],c=w.tile(a.x,a.y);c.food=2;
 const f=physiologyFrame(w,a),gather=f.request.candidates.filter(c=>c.action===6);
 assert(gather.some(c=>c.foodType===0));assert(gather.some(c=>c.foodType===1));assert.equal(new Set(gather.map(c=>c.id)).size,gather.length);
 const d=w.prepareDecision(a),options=w.evaluateFrame(a,d).options;assert(options.every(c=>Number.isFinite(c.probability)));
});
test('реестры энергии, ткани и пищи сходятся при жизни, голоде, останках и порче',()=>{
 const w=world({population:12});for(let i=0;i<400&&w.agents.length;i++){w.substep();if(i%50===0)checkPhysiologyInvariants(w);}checkPhysiologyInvariants(w);
 assert(w.stats.physiology.catabolized>0);assert(w.foodExposure.length===Math.floor(w.tick)+1);
});
