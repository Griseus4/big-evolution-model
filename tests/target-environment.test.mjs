import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution,worldDistance} from '../dist/evolution.js';
import {ENVIRONMENT_DEFAULTS,ENVIRONMENT_RULES,validateEnvironmentSettings,foodProduction} from '../dist/environment-settings.js';
import {advanceEnvironment,configureEnvironment,environmentStatus} from '../dist/automatic-environment.js';
import {proposedEnvironmentValue} from '../dist/environment-plan.js';
import {installEnvironmentUI} from '../dist/environment-ui.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function event(w){w.tick=w.automaticEnvironment.nextTick;w.subtick=Math.round(w.tick*10);return advanceEnvironment(w);}

test('target settings validate positive configurable bounds and physical limits atomically',()=>{
 assert.deepEqual(validateEnvironmentSettings(),ENVIRONMENT_DEFAULTS);
 assert.equal(validateEnvironmentSettings({minimumRate:.05}).minimumRate,.05);
 for(const input of [{minimumRate:0},{minimumRate:-1},{minimumRate:NaN},{maximumRate:2},{targetSources:385},{targetSources:1.5},{targetPeriod:0},{targetPeriod:Infinity},{minimumRate:4000,maximumRate:5000}])assert.throws(()=>validateEnvironmentSettings(input));
 const w=new Evolution({population:1}),before=structuredClone(w.automaticEnvironment);
 assert.throws(()=>configureEnvironment(w,{minimumRate:0}));assert.deepEqual(structuredClone(w.automaticEnvironment),before);
});

test('five stages reach both targets without noise and allow initial production above the ceiling',()=>{
 const w=new Evolution({population:2,automaticEnvironment:{preparationInterval:1,randomInterval:1}}),food=w.tiles.map(c=>c.food);
 const rng=[w.random,w.cognitiveRandom,w.bodyRandom,w.neuralRandom,w.mutationRandom].map(r=>r.state);
 for(const [index,[count,period]]of [[367,36],[350,52],[333,68],[317,84],[300,100]].entries()){
  assert.equal(event(w),true);assert.equal(w.foodSettings.sourceCount,count);near(w.foodSettings.regrowInterval,period);
  assert.equal(w.automaticEnvironment.completedSteps,index+1);assert.equal(w.environmentChanges.at(-1).periodsAdjusted,false);
  assert.deepEqual(w.tiles.map(c=>c.food),food);
  if(index<2)assert.ok(foodProduction(w)>6);else assert.ok(foodProduction(w)>=2&&foodProduction(w)<=6);
 }
 assert.deepEqual([w.random,w.cognitiveRandom,w.bodyRandom,w.neuralRandom,w.mutationRandom].map(r=>r.state),rng);
 for(const e of w.environmentChanges)for(const g of e.movedGroups){const distance=worldDistance(g.from,g.to);assert.ok(g.kind==='island'?distance>=5&&distance<=20:distance>0&&distance<=5);}
});

test('goal changes use remaining preparation stages without resetting the next event',()=>{
 const w=new Evolution({population:1,automaticEnvironment:{preparationInterval:10,minimumRate:.5,maximumRate:20}});
 event(w);event(w);const due=w.automaticEnvironment.nextTick;
 configureEnvironment(w,{targetSources:250,targetPeriod:130});assert.equal(w.automaticEnvironment.nextTick,due);assert.equal(w.automaticEnvironment.completedSteps,2);
 for(let i=0;i<3;i++)assert.equal(event(w),true);assert.equal(w.foodSettings.sourceCount,250);near(w.foodSettings.regrowInterval,130);
 assert.equal(w.automaticEnvironment.nextTick,w.tick+1000);
});

test('source count is corrected first; exhausted count is followed by period correction in both directions',()=>{
 for(const config of [
  {targetSources:300,targetPeriod:100,minimumRate:1,maximumRate:2.5,extreme:null},
  {targetSources:10,targetPeriod:10000,minimumRate:2,maximumRate:4,extreme:384},
  {targetSources:300,targetPeriod:.1,minimumRate:.001,maximumRate:.002,extreme:1},
 ]){
  const {extreme,...settings}=config,w=new Evolution({population:1,automaticEnvironment:settings});w.automaticEnvironment.completedSteps=4;
  assert.equal(event(w),true,w.automaticEnvironment.lastError);const change=w.environmentChanges.at(-1),rate=foodProduction(w);
  assert.ok(rate>=settings.minimumRate*(1-1e-10)&&rate<=settings.maximumRate*(1+1e-10));assert.equal(change.countAdjusted,true);
  if(extreme===null)assert.equal(change.periodsAdjusted,false);else{assert.equal(w.foodSettings.sourceCount,extreme);assert.equal(change.periodsAdjusted,true);}
 }
});

test('selected minimum below two enables manual poverty and disable/re-enable restarts the timer',()=>{
 const w=new Evolution({population:1,automaticEnvironment:{enabled:false,minimumRate:.05,maximumRate:1}});
 w.changeFoodEnvironment({foodSources:10,foodRegrowInterval:100,foodIslandCount:2,foodPeriodSpread:0,foodSizeSpread:0});near(foodProduction(w),.1);
 configureEnvironment(w,{enabled:true});assert.equal(w.automaticEnvironment.enabled,true);assert.equal(w.automaticEnvironment.preparationCancelled,true);
 const oldDue=w.automaticEnvironment.nextTick;w.tick=5;w.subtick=50;configureEnvironment(w,{enabled:false});configureEnvironment(w,{enabled:true});assert.equal(w.automaticEnvironment.nextTick,oldDue+5);
});

test('return removes a quarter of deviation before noise and long target periods are retained',()=>{
 near(proposedEnvironmentValue(140,100,{next:()=>0}),130);
 const w=new Evolution({population:1,automaticEnvironment:{targetSources:300,targetPeriod:130,minimumRate:1,maximumRate:6}});
 for(let i=0;i<5;i++)event(w);near(w.foodSettings.regrowInterval,130);assert.equal(w.foodSettings.sourceCount,300);
 let varied=false;for(let i=0;i<20;i++){assert.equal(event(w),true);varied||=Math.abs(w.foodSettings.regrowInterval-130)>1;assert.ok(foodProduction(w)>=1&&foodProduction(w)<=6);}
 assert.equal(varied,true);
});

test('failed planning leaves source state, RNG and revision untouched and schedules a bounded retry',()=>{
 const w=new Evolution({population:1});for(const c of w.tiles)c.terrain='water';
 const groups=structuredClone(w.foodIslands),stocks=w.tiles.map(c=>[c.food,c.maxFood]),rng=w.automaticEnvironment.random.state,revision=w.environmentRevision;
 assert.equal(event(w),false);assert.ok(w.automaticEnvironment.lastError);assert.deepEqual(w.foodIslands,groups);assert.deepEqual(w.tiles.map(c=>[c.food,c.maxFood]),stocks);
 assert.equal(w.automaticEnvironment.random.state,rng);assert.equal(w.environmentRevision,revision);assert.equal(w.automaticEnvironment.completedSteps,0);assert.ok(w.automaticEnvironment.nextTick>w.tick);
});

test('an unrepresentable narrow corridor rejects the whole plan after both corrections',()=>{
 const w=new Evolution({population:1,automaticEnvironment:{minimumRate:2.5000001,maximumRate:2.5000002}});w.automaticEnvironment.completedSteps=4;
 const groups=structuredClone(w.foodIslands),rng=w.automaticEnvironment.random.state,settings={...w.foodSettings};
 assert.equal(event(w),false);assert.match(w.automaticEnvironment.lastError,/0,1/);assert.deepEqual(w.foodIslands,groups);assert.deepEqual(w.foodSettings,settings);assert.equal(w.automaticEnvironment.random.state,rng);assert.equal(w.automaticEnvironment.completedSteps,4);
});

test('new saves resume edited targets and preparation exactly; old and damaged environment schemas are rejected',()=>{
 const w=new Evolution({population:2,automaticEnvironment:{preparationInterval:1,randomInterval:1}});w.step();w.step();
 configureEnvironment(w,{targetSources:280,targetPeriod:125,minimumRate:.25,maximumRate:5});
 const saved=JSON.parse(JSON.stringify(saveWorld(w))),restored=loadWorld(saved);for(let i=0;i<6;i++){w.step();restored.step();assert.deepEqual(saveWorld(w),saveWorld(restored));}
 for(const old of [{...saved,version:1},{...saved,modelVersion:'0.37.3'}])assert.throws(()=>loadWorld(old),/версия/);
 const invalid=new Evolution({population:1});invalid.automaticEnvironment.minimumRate=0;assert.throws(()=>loadWorld(JSON.parse(JSON.stringify(saveWorld(invalid)))),/границы|Границы/);
});

class Control{
 constructor(){this.value='';this.checked=false;this.listeners={};this.style={setProperty(k,v){this[k]=v;}};}
 addEventListener(k,fn){this.listeners[k]=fn;}emit(k){return this.listeners[k]?.();}
}
test('automation UI preserves unapplied drafts, synchronizes both handles and reports rejection without checking enabled',async()=>{
 const world=new Evolution({population:1}),elements=new Map(),view={tick:0,foodSettings:world.foodSettings,automaticEnvironment:environmentStatus(world)};
 const element=id=>{if(!elements.has(id))elements.set(id,new Control());return elements.get(id);};
 let calls=0;const ui=installEnvironmentUI({element,getWorld:()=>view,command:async(type,payload)=>{calls++;const status=configureEnvironment(world,payload);view.automaticEnvironment=status;return status;}});ui.update();
 const field=element('environment-target-sources');field.value='350';field.emit('input');ui.update();assert.equal(field.value,'350');assert.equal(world.automaticEnvironment.targetSources,300);
 await element('environment-apply').emit('click');assert.equal(world.automaticEnvironment.targetSources,350);assert.equal(world.automaticEnvironment.nextTick,500);
 const lower=element('environment-rate-start');lower.value='.5';lower.emit('input');near(Number(element('environment-minimum-rate').value),.5);await element('environment-apply').emit('click');near(world.automaticEnvironment.minimumRate,.5);
 element('environment-minimum-rate').value='0';element('environment-minimum-rate').emit('input');const before=calls;await element('environment-apply').emit('click');assert.equal(calls,before);assert.ok(element('environment-error').textContent);ui.update();assert.equal(element('environment-minimum-rate').value,'0');
 configureEnvironment(world,{enabled:false});view.automaticEnvironment=environmentStatus(world);ui.update();element('environment-minimum-rate').value='500';element('environment-maximum-rate').value='1000';element('environment-enabled').checked=true;await element('environment-enabled').emit('change');assert.equal(element('environment-enabled').checked,false);assert.equal(world.automaticEnvironment.enabled,false);
 ui.reset();assert.equal(Number(element('environment-minimum-rate').value),.5);
});
