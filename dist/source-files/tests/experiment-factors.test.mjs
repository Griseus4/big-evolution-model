import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,EXPERIMENT_PROTOCOL,EXPERIMENT_TERRAIN_SEED,EXPERIMENT_FOOD_SEED,EXPERIMENT_TEMPLATES} from '../dist/experiment-plan.js';
import {factorDesign} from '../dist/experiment-fields.js';
import {validateExperimentReport} from '../dist/experiment-ui.js';
import {Evolution} from '../dist/evolution.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {runWorld} from '../dist/experiment-runner.js';
const design=(factors=[],extra={})=>validatePlan({factors,worlds:2,steps:2,common:{population:6,limit:20},...extra});
test('all explicit combinations are stable, independent and exactly roundtrip',()=>{
 const p=design([{key:'learning',values:[true,false]},{key:'reproduction.maturity',values:[90,120]},{key:'reproduction.birthInterval',values:[100,200,300]}]);
 assert.equal(p.protocolId,EXPERIMENT_PROTOCOL);assert.equal(p.variants.length,12);assert.deepEqual(p.variants.map(v=>[v.settings.learning,v.settings.reproduction.maturity,v.settings.reproduction.birthInterval]),[true,false].flatMap(learning=>[90,120].flatMap(age=>[100,200,300].map(interval=>[learning,age,interval]))));
 assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);p.variants[0].settings.reproduction.energy=1;assert.equal(p.variants[1].settings.reproduction.energy,50);assert.equal(p.common.reproduction.energy,50);
 assert.equal(design().variants.length,1);assert.equal(design([{key:'memory',values:[false]}]).variants[0].settings.memory,false);
});
test('factor values reject missing, duplicate, nonfinite, wrong-type and unknown inputs',()=>{
 for(const factors of [[{key:'memory',values:[]}],[{key:'memory',values:[true,true]}],[{key:'memory',values:[1]}],[{key:'population',values:[1.5]}],[{key:'reproduction.maturity',values:[NaN]}],[{key:'constructor',values:[2]}],[{key:'memory',values:[true]},{key:'memory',values:[false]}]])assert.throws(()=>design(factors));
 assert.throws(()=>design([{key:'population',values:[2,30]}]),/Вариант 2/);assert.throws(()=>design([{key:'foodCapacityMin',values:[8]}]),/Вместимость/);
});
test('64 is accepted; a larger product is counted before creating world configurations',()=>{
 const factors=[{key:'memory',values:[true,false]},{key:'learning',values:[true,false]},{key:'mutations',values:[true,false]},{key:'reproduction.maturity',values:[10,20,30,40,50,60,70,80]}];
 assert.equal(design(factors).variants.length,64);factors.at(-1).values.push(90);assert.equal(factorDesign(factors).count,72);assert.throws(()=>design(factors),/72.*64/);
 const huge=Array.from({length:6},(_,i)=>({key:['reproduction.energy','reproduction.health','reproduction.maturity','reproduction.birthInterval','foodSources','limit'][i],values:Array.from({length:50},(_,n)=>n+1)}));assert.equal(factorDesign(huge).count,50**6);assert.throws(()=>design(huge),/64/);
});
test('every built-in template generates factors with the shared terrain and all four memory/learning modes',()=>{
 for(const t of EXPERIMENT_TEMPLATES){const p=design(t.factors);assert.ok(p.variants.every(v=>v.settings.terrainSeed===EXPERIMENT_TERRAIN_SEED&&v.settings.foodSeed===EXPERIMENT_FOOD_SEED));}
 const p=design(EXPERIMENT_TEMPLATES.find(t=>t.id==='factorial').factors);assert.deepEqual(p.variants.map(v=>[v.settings.memory,v.settings.learning]),[[true,true],[true,false],[false,true],[false,false]]);
 assert.throws(()=>design([],{common:{terrainSeed:99}}),/42/);assert.throws(()=>design([],{common:{foodSeed:99}}),/42/);
});
test('geography and initial food remain identical across worlds and retries while founders, genes and RNG differ',()=>{
 const p=design(),seeds=[...p.seeds,...p.seedMatrix[0].slice(1)],worlds=seeds.map(seed=>new Evolution({...p.variants[0].settings,seed})),terrain=w=>w.tiles.map(c=>[c.terrain,c.feature,c.regionId]);
 for(const w of worlds){assert.equal(w.geographyInfo.terrainSeed,42);assert.equal(w.geographyInfo.foodSeed,42);assert.deepEqual(terrain(w),terrain(worlds[0]));assert.deepEqual(w.foodIslands,worlds[0].foodIslands);assert.deepEqual(w.tiles.map(c=>[c.food,c.maxFood]),worlds[0].tiles.map(c=>[c.food,c.maxFood]));}
 const a=worlds[0],b=worlds[1];assert.notDeepEqual(a.agents.map(x=>[x.x,x.y]),b.agents.map(x=>[x.x,x.y]));assert.notDeepEqual(a.agents.map(x=>x.genome),b.agents.map(x=>x.genome));for(const rng of ['random','bodyRandom','cognitiveRandom','neuralRandom','mutationRandom'])assert.notEqual(a[rng].state,b[rng].state);
 const paired=new Evolution({...p.variants[0].settings,seed:seeds[0],learning:false});assert.deepEqual(paired.agents.map(x=>[x.x,x.y,x.genome]),a.agents.map(x=>[x.x,x.y,x.genome]));assert.deepEqual(paired.foodIslands,a.foodIslands);
 const normal=new Evolution({seed:77,population:6,limit:20}),explicit=new Evolution({seed:77,population:6,limit:20,terrainSeed:77,foodSeed:77});assert.deepEqual(terrain(normal),terrain(explicit));assert.deepEqual(normal.agents,explicit.agents);assert.equal(normal.random.state,explicit.random.state);assert.deepEqual(normal.foodIslands,explicit.foodIslands);assert.deepEqual(normal.automaticEnvironment,explicit.automaticEnvironment);
 a.step();const restored=loadWorld(saveWorld(a));assert.equal(restored.geographyInfo.terrainSeed,42);restored.step();a.step();assert.deepEqual(restored.snapshot(),a.snapshot());
});
test('food changes do not perturb founders or their random streams and invalid food seeds are rejected',()=>{
 const options={seed:77,terrainSeed:42,population:3},a=new Evolution(options),b=new Evolution({...options,foodSeed:42});
 const residents=w=>w.agents.map(({_cells,_tiles,...resident})=>resident);assert.deepEqual(residents(a),residents(b));for(const rng of ['random','bodyRandom','cognitiveRandom','neuralRandom','mutationRandom'])assert.equal(a[rng].state,b[rng].state);
 assert.notDeepEqual(a.foodIslands,b.foodIslands);
 for(const foodSeed of [0,-1,1.5,NaN,Infinity,'42',4294967296])assert.throws(()=>new Evolution({...options,foodSeed}),/seed пищи/);
});

test('shared food seed does not erase explicitly compared food parameters',()=>{
 const p=design([{key:'foodRegrowInterval',values:[20,100]}]);
 const a=new Evolution({...p.variants[0].settings,seed:77}),b=new Evolution({...p.variants[1].settings,seed:77});
 assert.equal(a.foodSeed,b.foodSeed);assert.deepEqual(a.agents.map(x=>[x.x,x.y,x.genome]),b.agents.map(x=>[x.x,x.y,x.genome]));
 assert.deepEqual(a.foodIslands.map(g=>g.sources),b.foodIslands.map(g=>g.sources));assert.notDeepEqual(a.foodIslands.map(g=>g.period),b.foodIslands.map(g=>g.period));
});

test('shared food automation and manual changes stay equal despite different residents; saves continue exactly',()=>{
 const options=design([],{common:{population:3,limit:20,automaticEnvironment:{preparationInterval:1,randomInterval:1}}}).common;
 const a=new Evolution({...options,seed:77}),b=new Evolution({...options,seed:123,learning:false,population:1});
 for(let t=0;t<8;t++){a.step();b.step();assert.deepEqual(a.foodIslands,b.foodIslands);assert.deepEqual(a.tiles.map(c=>c.maxFood),b.tiles.map(c=>c.maxFood));assert.deepEqual(a.automaticEnvironment,b.automaticEnvironment);}
 const restored=loadWorld(JSON.parse(JSON.stringify(saveWorld(a))));assert.equal(restored.foodSeed,42);
 for(let i=0;i<3;i++){a.step();restored.step();assert.deepEqual(saveWorld(a),saveWorld(restored));b.step();}
 const input={foodSources:100,foodRegrowInterval:50,foodIslandCount:4,foodPeriodSpread:30,foodSizeSpread:30,relocate:true};
 a.changeFoodEnvironment(input);b.changeFoodEnvironment(input);assert.deepEqual(a.foodIslands,b.foodIslands);
});

test('factor world runner records the shared map while historical completed reports remain readable',async()=>{
 const p=design([{key:'learning',values:[true,false]}]),r=await runWorld({id:'v1-0-1',seed:p.seeds[0],steps:2,worldOptions:p.variants[0].settings,fullHistory:true});assert.equal(r.status,'completed');assert.equal(r.geography.terrainSeed,42);assert.equal(r.geography.foodSeed,42);
 const legacy=validatePlan({worlds:1,steps:2,variants:[{name:'Старый результат'}]});legacy.protocolId='world-constructor-v1';const report={format:'big-evolution-experiment',version:1,plan:legacy,groups:[{id:'v1-0',variantId:'v1',index:0,selectedId:null,attempts:[]}]};assert.equal(validateExperimentReport(report),report);
});
