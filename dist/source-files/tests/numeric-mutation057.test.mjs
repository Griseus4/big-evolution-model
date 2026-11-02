import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../dist/simulation.js';
import {mutateNumeric,reflectMutation,numericMutationProfile} from '../dist/numeric-mutation.js';
import {randomDualGenome,mutateDualGenome,dualMutationProfiles,validateDualBrain} from '../dist/dual-brain-genome.js';
import {packDualBrain,dualBrainLayout} from '../dist/dual-brain-layout.js';
import {MUTATION_GROUPS} from '../dist/brain-evolution-rules.js';
import {genomeMetadata,validateGenomeFile} from '../dist/genome.js';
const rng=(u,sign)=>{let i=0;return {next:()=>i++%2?sign:u};};
test('нулевой вес мутирует обязательно; распределение имеет минимум и относительный потолок',()=>{
 const p=numericMutationProfile();
 assert.ok(Math.abs(mutateNumeric(0,.1,p,rng(0,1))-.01)<1e-16);
 const small=mutateNumeric(0,.1,p,rng(1-Number.EPSILON,1));assert.ok(small>=.001&&small<.0010000001);
 assert.ok(mutateNumeric(100,.1,p,rng(0,1))===110);
 assert.ok(Math.abs(mutateNumeric(0,.1,p,rng(0,0))+.01)<1e-16);
 assert.ok(Number.isFinite(mutateNumeric(.5,.1,{shape:Number.MAX_VALUE,ceiling:.1},rng(.5,1))));
});
test('отражение многих ширин, открытые границы и недопустимые числа',()=>{
 assert.ok(Math.abs(reflectMutation(100.2,{min:0,max:1})-.2)<1e-12);
 assert.equal(reflectMutation(-.25,{min:0}),.25);
 assert.equal(reflectMutation(0,{min:0,exclusiveMin:true}),Number.MIN_VALUE);
 assert.ok(reflectMutation(1,{min:0,max:1,exclusiveMax:true})<1);
 assert.throws(()=>reflectMutation(Infinity));assert.throws(()=>numericMutationProfile(0,.1));
});
test('v18: тело, новые регуляторы, экспорт и сохранность родителя',()=>{
 const parent=randomDualGenome(new Random(42),{genomeVersion:18}),before=parent.slice();
 assert.equal(dualBrainLayout(parent).version,18);assert.equal(validateDualBrain(parent).body.tAdult,200);
 const profile=dualMutationProfiles(parent);assert.deepEqual(profile.behavior,{shape:.05,ceiling:.1});
 const child=mutateDualGenome(parent,new Random(13),{structuralMutations:false});
 assert.deepEqual(parent,before);assert.notDeepEqual(child,parent);
 assert.deepEqual(validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(child),genes:child}),child);
 const d=validateDualBrain(child);assert.equal(d.regulators.length,18);
 assert.notEqual(d.body.gmax,.15);assert.notEqual(d.fixed[0],before[0]);
});
test('выключенные группы замораживают параметры и регуляторы независимо от behavior',()=>{
 const parent=randomDualGenome(new Random(42),{genomeVersion:18}),p=validateDualBrain(parent),off=Object.fromEntries(MUTATION_GROUPS.map(key=>[key,false]));
 assert.deepEqual(mutateDualGenome(parent,new Random(2),{mutationEnabled:off}),parent);
 assert.deepEqual(mutateDualGenome(parent,new Random(2),{mutations:false}),parent);
 const child=validateDualBrain(mutateDualGenome(parent,new Random(2),{mutationEnabled:{...off,cells:true}}));
 assert.deepEqual(child.body,p.body);assert.deepEqual(child.traits,p.traits);assert.deepEqual(child.regulators.slice(0,2),p.regulators.slice(0,2));
 assert.notDeepEqual(child.regulators.slice(6,8),p.regulators.slice(6,8));assert.notDeepEqual(child.fixed,p.fixed);
});
test('унаследованные нулевые веса не застревают; v17 по-прежнему имеет p/s',()=>{
 const d=validateDualBrain(randomDualGenome(new Random(1),{genomeVersion:18}));
 for(const e of d.main.edges)e.weight=0;for(const e of d.attention.edges)e.weight=0;
 const next=validateDualBrain(mutateDualGenome(packDualBrain(d),new Random(3),{structuralMutations:false}));
 assert.ok(next.main.edges.every(e=>e.weight!==0));assert.ok(next.attention.edges.every(e=>e.weight!==0));
 const old=randomDualGenome(new Random(1));assert.equal(dualBrainLayout(old).version,17);assert.ok(dualMutationProfiles(old).behavior.rate>0);
});
