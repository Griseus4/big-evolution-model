import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_TIME_TEXT} from '../dist/guide-time-text.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {ACTION_DURATIONS,SUBSTEPS} from '../dist/action-timing.js';
import {Evolution} from '../dist/evolution.js';

test('time article example follows the live process clock without advancing a body at decision start',()=>{
 const w=new Evolution({population:1,seed:42,learning:false,memory:false});
 // Фиксируем только выбор ожидания; остальная физика — настоящая.
 w.choose=(agent,decision)=>{const {frame,options}=w.evaluateFrame(agent,decision);return w.executableDecision(frame,options.find(c=>c.action===8));};
 const a=w.agents[0];let first=true;
 const choose=w.choose;w.choose=(agent,decision)=>{const result=choose(agent,decision);if(first){assert.equal(w.tick,0);first=false;}return result;};
 for(let i=0;i<ACTION_DURATIONS[8]-1;i++)w.substep();
 assert.equal(a.life.actions[8],0);w.substep();assert.equal(a.life.actions[8],1);
 assert.equal(w.tick,ACTION_DURATIONS[8]/SUBSTEPS);
 const text=GUIDE_TIME_TEXT['guide-time-body'];assert.match(text,/1,5/);assert.match(text,/следующего подшага/);
 const meta=GUIDE_ARTICLES.find(a=>a.id==='time');assert.equal(meta.reviewedVersion,'0.54.4');assert.ok(meta.sources.some(s=>s.symbols.includes('advanceTemporalBodies')));
});
