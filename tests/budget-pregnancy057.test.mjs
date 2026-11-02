import test from 'node:test';
import assert from 'node:assert/strict';
import {bodyPlan,createBody,bodyCapacities} from '../dist/body-physiology.js';
import {PHYSIOLOGY_DEFAULTS as R,BODY_GENE_DEFAULTS as G} from '../dist/physiology-settings.js';
import {budgetRecord,beginBodyInterval,payMotorInterval,finishBodyInterval} from '../dist/physiology-budget.js';
import {conceive,fundPregnancy,beginLabor,finishLabor,embryoRemains} from '../dist/pregnancy.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('обязательная оплата: нет бесплатной энергии, катаболизм ограничен и сохраняет долю H',()=>{
 const g=bodyPlan(),a=createBody(g);a.energy=0;a.health=50;const oldL=a.L,oldH=a.health,out=beginBodyInterval(a,g,0,0);
 close(out.catabolized,.03/1.68);close(a.L,oldL-out.catabolized);close(a.health,oldH*a.L/oldL);assert.equal(a.energy,0);close(out.mandatoryPaid,.03);close(out.unpaid,0);
 const b=createBody(g);b.energy=0;const record=beginBodyInterval(b,g,0,2);close(record.catabolized,.06);close(record.catabolicEnergy,.1008);assert.ok(record.hungerDamage>0);
 const c=createBody(g);c.L=c.M*.5;c.energy=0;c.health=1;beginBodyInterval(c,g,0,100);assert.equal(c.health,0);const before={...c};finishBodyInterval(c,g,10);assert.deepEqual(c,before);
});
test('добровольный мотор не создаёт дефицита; усвоение сверх Emax можно потратить',()=>{
 const g=bodyPlan(),a=createBody(g);a.energy=.04;const rec=beginBodyInterval(a,g,0,0);const L=a.L,H=a.health;
 assert.equal(payMotorInterval(a,.02,rec),false);assert.equal(a.L,L);assert.equal(a.health,H);close(a.energy,.01);
 const b=createBody(g);b.energy=16;const r=beginBodyInterval(b,g,2,0);assert.equal(payMotorInterval(b,1,r),true);finishBodyInterval(b,g,3000,R,r);close(b.energy,16);close(r.overflow,.97);
});
test('строительство сохраняет абсолютную рану; после окна только прежний M; платное лечение',()=>{
 const g=bodyPlan(),a=createBody(g,R,1);a.energy=bodyCapacities(a).energy;a.health-=2;const missing=bodyCapacities(a).health-a.health;
 const noHeal={...R,healingDeficitFraction:0,healingMinimumFraction:0};const out=finishBodyInterval(a,g,1,noHeal);close(out.growth,.015);close(bodyCapacities(a).health-a.health,missing);
 const L=a.L;finishBodyInterval(a,g,g.adultSteps,noHeal);close(a.L,L);
 a.L*=.9;a.health*=.9;a.energy=bodyCapacities(a).energy;const healed=finishBodyInterval(a,g,g.adultSteps,noHeal);assert.ok(healed.growth>0);assert.ok(a.L<=a.M);
 const b=createBody(g);b.health=99.99;b.energy=16;const rec=finishBodyInterval(b,g,3000);close(b.health,100);close(rec.healing,.005);close(b.energy,15.995);
});
test('беременность: геном один раз, 500 платежей, 20 следующих подшагов родов',()=>{
 const g=bodyPlan(),a=createBody(g),genome=[1,2,3];a.pregnancy=conceive(genome,G,g,0);genome[0]=9;assert.equal(a.pregnancy.genome[0],1);
 let paid=0;for(let step=1;step<=500;step++){a.energy=10;const r=budgetRecord();fundPregnancy(a,step,r);paid+=r.pregnancy;assert.equal(beginLabor(a,step),step===500);}
 close(paid,10.8);close(a.pregnancy.fraction,1);close(embryoRemains(a.pregnancy),2.5);
 assert.equal(finishLabor(a,519),null);const child=finishLabor(a,520);close(child.body.L,10/3);close(child.body.energy,.8);assert.equal(a.pregnancy,null);assert.equal(finishLabor(a,520),null);
});
test('пропуски не наверстываются, нулевая оплата не создаёт живого ребёнка, смерть отменяет исход',()=>{
 const g=bodyPlan();for(const fraction of [0,.5]){
  const a=createBody(g);a.pregnancy=conceive([1],G,g,0);
  for(let step=1;step<=500;step++){a.energy=step<=500*fraction?100:0;fundPregnancy(a,step,budgetRecord());}
  close(a.pregnancy.fraction,fraction);close(embryoRemains(a.pregnancy),fraction*2.5);beginLabor(a,500);
  a.health=0;assert.equal(finishLabor(a,520),null);a.health=10;
  const result=finishLabor(a,520);if(fraction===0)assert.equal(result.body,null);else close(result.body.L,5/3);
 }
});
