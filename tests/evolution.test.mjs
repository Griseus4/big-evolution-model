/** Проверки проверяют последствия и инварианты, а не наличие строк кода.
 * Управляемые геномы используются только в фикстурах; реальные основатели случайны.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Evolution,RULES,GENE_COUNT,BASE_GENE_COUNT,STATE_COUNT,randomGenome,mutateGenome,validateGenomeFile,neighbourPositions,worldHexAt,hexCenter} from '../dist/evolution.js';
import {createBrain} from '../dist/cognition.js';
import {Random,distance} from '../dist/simulation.js';

function prefer(a,action){a.genome.fill(-8);for(let state=0;state<STATE_COUNT;state++)a.genome[state*9+action]=8;a.genome.fill(0,STATE_COUNT*9);a.brain=createBrain(a.genome);}
function safe(s,a){const p=s.tiles.find(c=>c.terrain==='land'&&c.risk===0);a.x=p.x;a.y=p.y;return p;}

test('same seed, settings and number of steps reproduce the whole world',()=>{
 const a=new Evolution({seed:71}),b=new Evolution({seed:71});a.advance(700);
 for(let i=0;i<70;i++)b.advance(10);
 assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));
});
test('food and energy remain accounted for through births, saturation and deaths',()=>{
 let births=0,deaths=0;
 for(let seed=1;seed<=8;seed++){
  const s=new Evolution({seed,population:24,limit:100,scenario:seed%2?'balanced':'scarce'});
  for(let t=0;t<2200&&s.agents.length;t++){
   const before=new Map(s.agents.map(a=>[a.id,{x:a.x,y:a.y}]));s.step();
   const balance=s.balances();assert.equal(balance.foodError,0);assert.ok(Math.abs(balance.energyError)<1e-5);
   assert.ok(s.agents.length<=s.limit);
   for(const a of s.agents){
    assert.ok(a.energy>=0&&a.energy<=100&&a.health>0&&a.health<=100);
    assert.ok(a.inventory>=0&&a.inventory<=RULES.inventoryCapacity);
    assert.ok(a.stomach>=0&&a.stomach<=RULES.stomachCapacity+1e-9);
    assert.equal(s.tile(a.x,a.y).terrain,'land');
    const p=before.get(a.id);if(p)assert.ok(distance(a,p)<=1);
   }
  }
  births+=s.stats.births;deaths+=s.stats.deaths;
 }
 assert.ok(births>0&&deaths>0);
});
test('neutral genes give equal chances to physically available actions',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];a.genome.fill(0);a.brain=createBrain(a.genome);safe(s,a);
 const options=s.evaluate(a);
 for(const option of options)assert.ok(Math.abs(option.probability-1/options.length)<1e-12);
 assert.ok(Math.abs(options.reduce((n,o)=>n+o.probability,0)-1)<1e-12);
});
test('random founder genes and mutation treat all action columns symmetrically',()=>{
 const genes=randomGenome(new Random(9));assert.equal(genes.length,GENE_COUNT);
 assert.ok(genes.some(v=>v<0)&&genes.some(v=>v>0));
 const original=genes.slice(),changed=mutateGenome(genes,new Random(13),1,.7);
 assert.deepEqual(genes,original);assert.ok(changed.some((v,i)=>v!==genes[i]));
 assert.deepEqual(mutateGenome(genes,new Random(13),0),genes);
});
test('distant unobserved properties cannot change a local decision',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];a.x=2;a.y=2;
 const before=s.evaluate(a);Object.assign(s.tile(20,14),{food:999,risk:1,terrain:'water'});
 assert.deepEqual(s.evaluate(a),before);
});
test('eating starts digestion next tick; instinct table never learns during life',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];safe(s,a);prefer(a,7);a.inventory=1;a.energy=20;
 const original=a.genome.slice();s.step();assert.equal(a.inventory,0);assert.equal(a.stomach,22);
 assert.ok(a.energy<20);const before=a.energy;prefer(a,8);const waitGenes=a.genome.slice();s.step();
 assert.ok(a.energy>before&&a.energy<before+RULES.digestionRate);
 s.advance(10);assert.deepEqual(a.genome,waitGenes);assert.notDeepEqual(original,waitGenes);
});
test('injury creates pain and reduced health; pain fades without healing',()=>{
 const s=new Evolution({population:1}),a=s.agents[0],p=safe(s,a);prefer(a,8);p.risk=1;
 s.step();assert.ok(a.pain>=5);assert.ok(a.health<100);const health=a.health,pain=a.pain;
 p.risk=0;s.step();assert.equal(a.health,health);assert.ok(a.pain<pain);
});
test('a child gets a separate mutated genome and energy transferred from one parent',()=>{
 const s=new Evolution({population:1,limit:5}),a=s.agents[0];a.age=100;a.energy=90;
 const before=a.genome.slice(),child=s.reproduce(a);assert.ok(child);
 assert.equal(a.energy,90-RULES.birthCost);assert.equal(child.energy,RULES.newbornEnergy);
 assert.equal(child.parentId,a.id);assert.equal(child.generation,1);assert.equal(child.age,0);
 assert.equal(child.lastAction,null);assert.equal(child.lastDecision,null);
 assert.notEqual(child.genome,a.genome);assert.deepEqual(a.genome,before);
 child.genome[0]=999;assert.equal(a.genome[0],before[0]);
});
test('offspring requires adulthood, energy, health, interval and a population slot',()=>{
 const s=new Evolution({population:1,limit:2}),a=s.agents[0];
 a.age=10;a.energy=100;assert.equal(s.reproduce(a),null);
 a.age=100;a.energy=50;assert.equal(s.reproduce(a),null);
 a.energy=100;a.health=20;assert.equal(s.reproduce(a),null);
 a.health=100;assert.ok(s.reproduce(a));a.energy=100;a.age=101;assert.equal(s.reproduce(a),null);
 a.age=300;assert.equal(s.reproduce(a),null);
});
test('frozen baseline is inherited exactly, and zero mutations produce clones',()=>{
 const base=randomGenome(new Random(5));
 const s=new Evolution({population:1,limit:3,baseGenome:base,mutations:false}),a=s.agents[0];
 assert.deepEqual(a.genome,base);a.age=100;a.energy=100;const child=s.reproduce(a);
 assert.deepEqual(child.genome,base);assert.notEqual(child.genome,base);
 assert.deepEqual(validateGenomeFile(s.genomeFile(a)),base);
});
test('malformed genome files cannot inject values or alter the controller shape',()=>{
 for(const value of [null,{}, {format:'big-evolution-genome',version:99,genes:Array(GENE_COUNT).fill(0)},
  {format:'big-evolution-genome',version:1,genes:Array(GENE_COUNT).fill('0')},
  {format:'big-evolution-genome',version:1,genes:Array(GENE_COUNT).fill(Infinity)}]){
  assert.throws(()=>validateGenomeFile(value));
 }
});
test('extinction ends the world instead of secretly reseeding or restoring survivors',()=>{
 const s=new Evolution({population:1}),a=s.agents[0];safe(s,a);a.energy=0;a.health=1;prefer(a,8);
 s.step();assert.equal(s.agents.length,0);const before=JSON.stringify(s.snapshot());s.advance(100);
 assert.equal(JSON.stringify(s.snapshot()),before);assert.equal(s.stats.births,0);
});
test('hex neighbours and rendered positions use the same legal geometry',()=>{
 for(const p of [{x:4,y:4},{x:4,y:5}]){
  const neighbours=neighbourPositions(p);assert.equal(neighbours.length,6);
  for(const n of neighbours)assert.equal(distance(n,p),1);
  const c=hexCenter(p);assert.deepEqual(worldHexAt(c.x,c.y),p);
 }
 assert.equal(worldHexAt(-100,-100),null);
});
test('long default experience shows generations without making survival universal',()=>{
 const s=new Evolution();s.advance(3000);
 assert.ok(s.stats.births>0&&s.stats.deaths>0);assert.ok(s.summary().maxGeneration>1);
 assert.ok(s.summary().survivingFounders<s.initialPopulation);
});
