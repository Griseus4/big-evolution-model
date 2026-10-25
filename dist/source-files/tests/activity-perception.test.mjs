import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {ACTIVITY_COUNT,rebuildActivities} from '../dist/activity-perception.js';
import {sampleCells,prepareTemporalBoundary} from '../dist/temporal-world.js';
import {ACTION_TURNS,localNeighbours,memoryWorldPosition} from '../dist/navigation.js';
import {ACTION_DURATIONS} from '../dist/action-timing.js';
import {prepareSetDecisionInput} from '../dist/temporal-inputs.js';
import {GATE_INPUTS,GATE_OUTPUT_WEIGHTS,GATE_OUTPUT_BIAS,CELL_INPUTS,TARGET_NAMES} from '../dist/temporal-layout.js';
import {rememberAttention,attentionRequest} from '../dist/attention-gate.js';
import {INPUT_WIDTH,writeCognitionRow,readCognitionRow} from '../dist/cognition-packet.js';
import {observe} from '../dist/cognition.js';
import {captureBenchmarkState,restoreBenchmarkState} from '../dist/benchmark-state.js';
import {setCommonForward,setCandidateForward,setGradient} from '../dist/temporal-brain.js';
import {cloneSetInput} from '../dist/set-brain-inputs.js';
import {validateGenomeFile} from '../dist/genome.js';

function fixture(population=14){
 // Эта проверка сверяет плотный оценщик v13, не структурный контекст v14/v15.
 const w=new Evolution({population,foodSources:0,brainType:'set-duration-activity-v1'});
 for(const c of w.tiles){c.terrain='land';c.food=0;}
 for(const a of w.agents){w.moveAgent(a,{x:20,y:16});a.frameRotation=0;a.brain.facing=0;a.process=null;a._cells=null;}
 return w;
}
function start(a,action){
 const place=action<6?localNeighbours(a.brain)[action]:a.brain.position;
 a.process={action,elapsed:1,duration:ACTION_DURATIONS[action],localDestination:{...place},destination:action<6?memoryWorldPosition(a,place):{x:a.x,y:a.y}};
}

test('all eleven activities are visible on own and neighbouring hexes, opposing streams do not cancel',()=>{
 const w=fixture(13),observer=w.agents[0],neighbour=memoryWorldPosition(observer,localNeighbours(observer.brain)[0]);
 start(observer,8);
 for(let i=0;i<ACTIVITY_COUNT;i++)start(w.agents[i+1],i);
 start(w.agents[12],0);
 rebuildActivities(w);let own=sampleCells(w,observer)[0];
 assert.deepEqual([...own.activities],[2,1,1,1,1,1,1,1,1,1,1]);assert.equal(own.neighbours,12);
 for(const a of w.agents.slice(1))w.moveAgent(a,neighbour);
 rebuildActivities(w);const cells=sampleCells(w,observer),adjacent=cells.find(c=>c.q===1&&c.r===0);
 assert.deepEqual([...cells[0].activities],Array(11).fill(0));assert.deepEqual([...adjacent.activities],[2,1,1,1,1,1,1,1,1,1,1]);
});

test('directions use the observer facing and personal frame, not the neighbour forward label',()=>{
 const w=fixture(2),[observer,other]=w.agents;
 for(let rotation=0;rotation<6;rotation++)for(let facing=0;facing<6;facing++)for(let action=0;action<6;action++){
  observer.frameRotation=rotation;observer.brain.facing=facing;other.frameRotation=2;other.brain.facing=1;start(other,action);rebuildActivities(w);
  const own=sampleCells(w,observer)[0],worldDirection=(3+ACTION_TURNS[action])%6,expected=ACTION_TURNS.indexOf((worldDirection-rotation-facing+12)%6);
  assert.equal(own.activities[expected],1);assert.equal(own.activities.reduce((s,n)=>s+n,0),1);
 }
});

test('boundary observations exclude self using frozen activity and do not reveal same-boundary decisions',()=>{
 const w=fixture(2),[observer,other]=w.agents;start(observer,8);start(other,6);rebuildActivities(w);
 assert.equal(sampleCells(w,observer)[0].activities[6],1);
 start(observer,6);start(other,8);observer._sampleEpoch=-1;
 let seen=sampleCells(w,observer)[0];assert.equal(seen.activities[6],1);assert.equal(seen.activities[8],0);
 rebuildActivities(w);seen=sampleCells(w,observer)[0];assert.equal(seen.activities[6],0);assert.equal(seen.activities[8],1);
 other.process=null;rebuildActivities(w);assert.equal(sampleCells(w,observer)[0].activities.reduce((s,n)=>s+n,0),0);
});

test('physical failures are removed for everyone before the common activity snapshot',()=>{
 const w=fixture(2),[observer,other]=w.agents;start(other,6);prepareTemporalBoundary(w);
 assert.equal(other.process,null);assert.equal(w.stats.interrupted[6],1);assert.equal(sampleCells(w,observer)[0].activities[6],0);
});

test('activity is local, transient and does not consume RNG or enter spatial memory',()=>{
 const w=fixture(2),[observer,other]=w.agents;w.moveAgent(other,{x:35,y:25});start(other,9);
 const before=[w.random,w.neuralRandom,w.cognitiveRandom,w.bodyRandom].map(r=>structuredClone(r));
 rebuildActivities(w);const cells=sampleCells(w,observer);
 assert.ok(cells.every(c=>c.activities.every(n=>n===0)));assert.deepEqual([w.random,w.neuralRandom,w.cognitiveRandom,w.bodyRandom].map(r=>structuredClone(r)),before);
 observe(observer.brain,cells,observer.brain.position,0,true,0);
 for(const r of [...observer.brain.memory.values(),...observer.brain.longMemory.values()])assert.ok(!('activities'in r));
 for(const c of cells)assert.deepEqual(Object.keys(c).sort(),['q','r','food','isFoodSource','terrain','neighbours','activities'].sort());
});

test('worker transport keeps exact activity counts and owns reusable buffers',()=>{
 const w=fixture(2),[a,b]=w.agents;start(b,10);rebuildActivities(w);const cells=sampleCells(w,a),packet=new Float64Array(INPUT_WIDTH),copy=structuredClone(a);
 copy.cells=undefined;writeCognitionRow(packet,0,a,cells,256);const decoded=readCognitionRow(packet,0,copy);
 assert.deepEqual(decoded,cells);const activities=decoded[0].activities;readCognitionRow(packet,0,copy);assert.equal(copy.cells[0].activities,activities);
 cells[0].activities[10]=999;assert.equal(decoded[0].activities[10],1);
});

test('main brain receives activity in cells, target and own process; gate reacts only through inherited weights',()=>{
 const w=fixture(2),[a,b]=w.agents;start(a,8);start(b,8);rebuildActivities(w);
 const input=prepareSetDecisionInput(a.brain,w.decisionFrame(a).request);assert.equal(input.prepared.cells[0].length,CELL_INPUTS);assert.equal(input.prepared.cells[0][10+8],.5);
 const wait=input.rows.find(r=>r.operation===3);assert.equal(wait.input[6+14+8],.5);assert.equal(input.prepared.process[12+14+8],.5);assert.equal(wait.input.length,6+TARGET_NAMES.length+3);
 const cells=sampleCells(w,a);rememberAttention(a,cells);a.brain.gateBase.fill(0);assert.equal(attentionRequest(a,cells,3,66),false);
 a.brain.gateBase[16]=1;a.brain.gateBase[GATE_OUTPUT_WEIGHTS]=1;a.brain.gateBase[GATE_OUTPUT_BIAS]=-.2;
 assert.equal(GATE_INPUTS,17);assert.equal(attentionRequest(a,cells,3,66),false);
 start(b,10);rebuildActivities(w);assert.equal(attentionRequest(a,sampleCells(w,a),3,66),true);
 a.brain.gateBase.fill(0);assert.equal(attentionRequest(a,sampleCells(w,a),3,66),false);
});

test('reversed agent order and restored snapshots retain identical observations',()=>{
 const w=fixture(5);for(let i=0;i<w.agents.length;i++)start(w.agents[i],i+6);rebuildActivities(w);
 const original=structuredClone(sampleCells(w,w.agents[0])),restored=restoreBenchmarkState(captureBenchmarkState(w));restored.agents.reverse();rebuildActivities(restored);
 assert.deepEqual(sampleCells(restored,restored.agents.find(a=>a.id===1)),original);
});

test('new activity weights train correctly, and v12 is never reinterpreted as v13',()=>{
 const w=fixture(3),[a,b,c]=w.agents;start(a,8);start(b,8);start(c,0);rebuildActivities(w);
 const prepared=prepareSetDecisionInput(a.brain,w.decisionFrame(a).request),row=prepared.rows.find(r=>r.operation===3),frame=cloneSetInput({...prepared.prepared,candidate:row.input});
 const weights=a.brain.networkBase.slice(),gradient=setGradient(weights,frame).gradient,epsilon=1e-6;
 for(let i=0;i<weights.length;i++){
  const original=weights[i];weights[i]=original+epsilon;const hi=setCandidateForward(weights,setCommonForward(weights,frame),frame.candidate).value;
  weights[i]=original-epsilon;const lo=setCandidateForward(weights,setCommonForward(weights,frame),frame.candidate).value;weights[i]=original;
  assert.ok(Math.abs((hi-lo)/(2*epsilon)-gradient[i])<1e-5,String(i));
 }
 const genome=w.genomeFile(a);assert.deepEqual(validateGenomeFile(genome),a.genome);assert.equal(genome.version,13);
 assert.throws(()=>validateGenomeFile({...genome,version:12}),/v12/);
});
