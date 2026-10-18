import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {ParallelWorld} from '../dist/parallel-world.js';
import {parallelSubstep} from '../dist/world-substeps.js';
import {createCognitionWorker} from './node-cognition-worker.mjs';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {installScreenTabs} from '../dist/screen-tabs.js';
import {readFoodControls,installFoodControls,installLiveFoodControls} from '../dist/food-controls.js';
import {advanceEnvironment} from '../dist/automatic-environment.js';
import {typography} from '../dist/typography.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
class Control{
 constructor(value=''){this.value=value;this.listeners={};}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 emit(k,e={}){for(const fn of this.listeners[k]??[])fn({target:this,preventDefault(){},...e});}
 setAttribute(k,v){this[k]=v;}focus(){this.focused=true;}
 setCustomValidity(message){this.validation=message;}reportValidity(){this.reported=true;}
}
test('screen tabs preserve existing input objects and support keyboard navigation',()=>{
 const elements=new Map();for(const name of ['one','two'])for(const part of ['tab','panel'])elements.set(`x-${part}-${name}`,new Control());
 const input=new Control('unchanged');elements.get('x-panel-one').input=input;
 installScreenTabs('x',['one','two'],{getElementById:id=>elements.get(id)});
 elements.get('x-tab-one').emit('keydown',{key:'ArrowRight'});assert.equal(elements.get('x-panel-one').hidden,true);assert.equal(elements.get('x-tab-two').focused,true);
 elements.get('x-tab-one').emit('click');assert.equal(elements.get('x-panel-one').input,input);assert.equal(input.value,'unchanged');
});
test('ten individual substeps equal one whole step with serial and parallel learning',async()=>{
 const a=new Evolution({population:6}),b=new Evolution({population:6}),pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});
 try{for(let round=0;round<3;round++){a.step();for(let i=0;i<10;i++)await parallelSubstep(pool);await pool.syncAll();assert.deepEqual(b.snapshot(),a.snapshot());}}finally{await pool.close();}
});
test('single-substep parallel path retains birth completion and brain-payment death semantics',async()=>{
 for(const dying of [false,true]){
  const a=new Evolution({population:1}),b=new Evolution({population:1});
  for(const w of [a,b]){const p=w.agents[0];if(dying){w.stats.spent+=p.energy;w.stats.actionSpent+=p.energy;p.energy=0;p.health=.01;}else{w._primed=true;p.born=-100;p.bornSubtick=-1000;p.age=100;p.process={action:9,elapsed:12,duration:20,localDestination:{...p.brain.position},destination:{x:p.x,y:p.y},direction:null};}}
  const pool=new ParallelWorld(b,{workers:2,createWorker:createCognitionWorker});try{a.step();for(let i=0;i<10&&b.agents.length;i++)await parallelSubstep(pool);await pool.syncAll();assert.deepEqual(b.snapshot(),a.snapshot());assert.equal(dying?a.stats.deaths:a.stats.births,1);}finally{await pool.close();}
 }
});
test('slow observation advances every 500ms; manual substep pauses and partial saves continue exactly',async()=>{
 let now=0,id=0;const runtime=new WorldRuntime({send:()=>{},clock:()=>now});
 const command=(type,payload={})=>runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});
 await command('init',{settings:{population:3}});await command('speed',{value:.2,substeps:true});await command('running',{value:true});
 now=499;await runtime.pulse();near(runtime.world.tick,0);now=500;await runtime.pulse();near(runtime.world.tick,.1);now=1000;await runtime.pulse();near(runtime.world.tick,.2);
 await command('substep');near(runtime.world.tick,.3);assert.equal(runtime.running,false);
 const saved=JSON.parse(JSON.stringify(saveWorld(runtime.world))),restored=['0.36.0','0.36.1','0.36.2'].map(modelVersion=>loadWorld({...saved,modelVersion}));
 for(let i=0;i<12;i++){runtime.world.substep();for(const world of restored)world.substep();}for(const world of restored)assert.deepEqual(world.snapshot(),runtime.world.snapshot());
});
test('automatic food controls follow actual conditions and unlock without overwriting manual drafts',()=>{
 const w=new Evolution({population:1,automaticEnvironment:{preparationInterval:1}}),elements=new Map();
 for(const [name,value]of [['sources',384],['period',20],['islands',8],['period-spread',30],['size-spread',30],['size-mean',38.5],['capacity-mean',4.5],['capacity-spread',100/3]]){elements.set('world-food-'+name,new Control(value));elements.set('world-food-'+name+'-value',new Control());if(name!=='islands'){const number=new Control(value);number.min=0;number.max=1e9;elements.set('world-food-'+name+'-number',number);}}
 for(const name of ['relocate','apply','live-note'])elements.set('world-food-'+name,new Control());
 const root={getElementById:id=>elements.get(id)??null},refresh=installFoodControls('world-',root),editor=installLiveFoodControls({element:id=>root.getElementById(id),getWorld:()=>w,refresh});
 editor.update();assert.equal(elements.get('world-food-period').disabled,true);const stock=w.tiles.map(c=>c.food);
 w.tick=1;w.subtick=10;advanceEnvironment(w);editor.update();const options=readFoodControls('world-',root);assert.equal(options.foodSources,w.foodSettings.sourceCount);assert.equal(w.changeFoodEnvironment(options),null);assert.deepEqual(w.tiles.map(c=>c.food),stock);
 const next=new Evolution({population:1,...options});assert.equal(next.foodSettings.sourceCount,options.foodSources);assert.equal(next.foodSettings.requestedIslandCount,options.foodIslandCount);
 w.automaticEnvironment.enabled=false;editor.update();elements.get('world-food-period').value=75;editor.update();assert.equal(elements.get('world-food-period').value,75);assert.equal(elements.get('world-food-period').disabled,false);
 const number=elements.get('world-food-period-number');number.value=75.25;number.emit('change');near(readFoodControls('world-',root).foodRegrowInterval,75.25);number.value=-1;number.emit('change');assert.ok(number.validation);near(readFoodControls('world-',root).foodRegrowInterval,75.25);
});
test('profiling counts model time correctly for a paused manual substep',async()=>{
 let id=0;const runtime=new WorldRuntime({send:()=>{}}),command=(type,payload={})=>runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});
 await command('init',{settings:{population:2}});await command('profile-start',{measurementMode:'light'});await command('substep');const report=runtime.profile();near(report.steps,.1);near(report.stepsWhilePaused,.1);near(report.rates.meanPopulation,2);assert.equal(runtime.running,false);
});
test('manual capacity/period ranges preserve ground food and support only scattered sources',()=>{
 const w=new Evolution({population:2}),stock=w.tiles.map(c=>c.food);
 w.changeFoodEnvironment({foodSources:30,foodIslandCount:0,foodRegrowInterval:2.5,foodPeriodSpread:20,foodSizeSpread:0,foodGeneralSettings:true,foodCapacityMin:10,foodCapacityMax:12});
 assert.equal(w.foodSettings.islandCount,0);assert.equal(w.foodSettings.bushCount,30);assert.ok(w.tiles.filter(c=>c.maxFood>0).every(c=>c.maxFood>=10&&c.maxFood<=12));assert.deepEqual(w.tiles.map(c=>c.food),stock);assert.ok(w.foodIslands.every(g=>g.period>=.1&&g.nextTick>w.tick));
});
test('Russian typography separates words/numbers and keeps units together',()=>{
 const text=typography('Геномv13: за1Т, движение0.78; 512МиБ; 25%. Версия 0.36.1.');
 assert.match(text,/Геном v13/);assert.ok(text.includes('за 1\u00a0Т'));assert.ok(text.includes('движение 0.78'));assert.ok(text.includes('512\u00a0МиБ'));assert.ok(text.includes('25\u00a0%'));assert.ok(text.includes('0.36.1'));
});
