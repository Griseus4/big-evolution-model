import test from 'node:test';
import assert from 'node:assert/strict';
import {Random} from '../dist/simulation.js';
import {sampleBinomial,createMeat,meatAmount,decayMeat,addMeat,takeMeat,createGrass,grassAmount,takeGrass} from '../dist/food-resources.js';
test('биномиальная порча: детерминированные края, малое распределение и крупный объём',()=>{
 const rng=new Random(71);assert.equal(sampleBinomial(0,.5,rng),0);assert.equal(sampleBinomial(10,0,rng),0);assert.equal(sampleBinomial(10,1,rng),10);
 const counts=[0,0,0];for(let i=0;i<20000;i++)counts[sampleBinomial(2,.5,rng)]++;
 for(const [i,p]of [[0,.25],[1,.5],[2,.25]])assert.ok(Math.abs(counts[i]/20000-p)<.02);
 let total=0,square=0;const n=1000,p=.3;
 for(let i=0;i<5000;i++){const x=sampleBinomial(n,p,rng);total+=x;square+=x*x;}
 const mean=total/5000,variance=square/5000-mean*mean;assert.ok(Math.abs(mean-300)<1);assert.ok(Math.abs(variance-210)<20);
 let calls=0;const random={next:()=>{calls++;return rng.next();}};const huge=sampleBinomial(1e12,.5,random);assert.ok(huge>4.99e11&&huge<5.01e11);assert.ok(calls<2000);
});
test('мясо: полураспад, дробь, перенос без омоложения и точное продолжение',()=>{
 const a=createMeat(1000000.5),r=new Random(42);decayMeat(a,10,r);assert.ok(Math.abs(a.whole-500000)<3000);assert.ok(a.fraction===0||a.fraction===.5);
 assert.equal(decayMeat(a,10,r),0);assert.throws(()=>addMeat(a,1,11));
 const copy=structuredClone(a),r2=new Random(1);Object.assign(r2,r);
 assert.equal(decayMeat(a,20,r),decayMeat(copy,20,r2));assert.deepEqual(a,copy);
 const b=createMeat(.75,20);addMeat(b,.75,20);assert.equal(b.whole,1);assert.equal(b.fraction,.5);assert.equal(takeMeat(b,1),1);assert.equal(meatAmount(b),.5);
 assert.throws(()=>decayMeat(b,19,r));
});
test('трава: seed, дробные запасы и ленивое восстановление без изменения от чтения',()=>{
 const a=createGrass(42,5),b=createGrass(42,5);assert.deepEqual(a,b);assert.ok(a.maximum>=3&&a.maximum<=5);
 const whole=takeGrass(a,10,0);assert.equal(whole.amount,a.maximum);assert.equal(a.amount,0);
 assert.equal(grassAmount(a,10),.1);assert.equal(a.amount,0);
 const portion=takeGrass(a,1,10);assert.equal(portion.amount,.1);assert.equal(a.amount,0);
 assert.equal(grassAmount(a,100000),a.maximum);assert.equal(a.subtick,10);
});
