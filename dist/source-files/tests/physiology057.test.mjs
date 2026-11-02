import test from 'node:test';
import assert from 'node:assert/strict';
import {PHYSIOLOGY_DEFAULTS as R,bodyGeneValues,physiologySettings,effectiveSubsteps,BODY_GENE_FIELDS,PHYSIOLOGY_FIELDS} from '../dist/physiology-settings.js';
import {bodyPlan,bodyCapacities,createBody,basalRate,movementSteps,bodySpeed,motorRate,attackProfile,attackDamage,remainsMass,pregnancyPlan} from '../dist/body-physiology.js';
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
test('эталонное тело, оплаченный ребёнок и останки: независимые контрольные числа',()=>{
 const g=bodyPlan(),a=createBody(g),b=createBody(g,R,1),c=bodyCapacities(a);
 close(a.L,100/3);close(a.M,100/3);close(c.organs,50/3);close(c.energy,16);close(a.energy,10.88);close(c.health,100);close(c.volume,3);close(c.tissueEnergy,80);
 close(b.L,10/3);close(b.energy,.8);close(b.health,10);close(bodyCapacities(b).volume,.3);
 close(pregnancyPlan(g).cost,10.8);close(pregnancyPlan(g).cost/g.tPreg,.216);
 close(remainsMass(a),25);close(remainsMass(b),2.5);close(remainsMass(createBody(g,R,.5)),1.25);
 assert.equal(createBody(g,R,0),null);
});
test('контроль физических расходов, скорости и силы',()=>{
 const g=bodyPlan(),a=createBody(g);close(basalRate(a,g),.3);assert.equal(movementSteps(a),15);
 close((basalRate(a,g)+motorRate(a,'move'))*1.5,1.17);
 close((basalRate(a,g)+motorRate(a,'gather'))*.5,.33);
 close((basalRate(a,g)+motorRate(a,'eat'))*.2,.096);
 close((basalRate(a,g)+motorRate(a,'deposit'))*.3,.108);
 close(attackProfile(a,g).total,.39);close(attackProfile(a,g).motor,.30);close(attackDamage(a),10);
 close(bodySpeed({...a,L:a.L/2}),1/3);
 assert.ok(bodySpeed({L:1e-5,M:1e-5})<R.speedPeak*.1);
 close(attackDamage({...a,health:50}),5);
});
test('сроки и новые настройки не создают скрытого биологического потолка',()=>{
 assert.equal(effectiveSubsteps(.001),1);assert.equal(effectiveSubsteps(20.01),201);
 const p=bodyPlan({tAdult:200.01,tPreg:50.01,tau:.01});assert.equal(p.adultSteps,2001);assert.equal(p.pregnancySteps,501);assert.equal(p.retentionSteps,1);
 assert.equal(p.conceptionSteps,1001);close(p.potential,.15*200.1/.9);
 assert.ok(bodyPlan({gmax:1e10}).potential>1e10);
 for(const key of Object.keys(BODY_GENE_FIELDS))assert.ok(BODY_GENE_FIELDS[key].unit);
 for(const key of Object.keys(PHYSIOLOGY_FIELDS))assert.ok(PHYSIOLOGY_FIELDS[key].unit);
 for(const bad of [{gmax:0},{kBirth:1},{tau:NaN},{Fg:-1},{tAdult:Infinity},{gmax:Number.MAX_VALUE}])assert.throws(()=>bodyGeneValues(bad));
 for(const bad of [{grassMin:6},{organFraction:0},{attackSteps:1.2},{unknown:3},{energyPerMass:null}])assert.throws(()=>physiologySettings(bad));
 const altered=physiologySettings({healthPerMass:6});close(attackDamage(createBody(bodyPlan(),altered),altered),10);
});
