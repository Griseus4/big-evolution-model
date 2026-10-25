import test from 'node:test';
import assert from 'node:assert/strict';
import {restProbabilities} from '../dist/rest-policy.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12);
test('equality and no eligible action choose rest, negative Q can beat rest',()=>{
 assert.deepEqual([...restProbabilities([0,0],[0,8],[0,3],1)],[0,1]);
 assert.deepEqual([...restProbabilities([-2,-1],[0,8],[0,3],1)],[0,1]);
 assert.deepEqual([...restProbabilities([-1,-2],[0,8],[0,3],1)],[1,0]);
});
test('common shifts and permutations preserve the policy',()=>{
 const values=[2,3,-1,0],actions=[0,1,6,8],ops=[0,0,1,3],p=restProbabilities(values,actions,ops,.7);
 const shifted=restProbabilities(values.map(v=>v+10),actions,ops,.7);
 for(let i=0;i<p.length;i++)close(p[i],shifted[i]);
 const order=[3,1,0,2],q=restProbabilities(order.map(i=>values[i]),order.map(i=>actions[i]),order.map(i=>ops[i]),.7);
 order.forEach((i,j)=>close(p[i],q[j]));close(p.reduce((a,b)=>a+b,0),1);
});
test('operation correction counts only eligible targets; rest is not drawn if actions pass',()=>{
 const p=restProbabilities([1,-2,1,0],[0,1,6,8],[0,0,1,3],1);
 close(p[0],.5);close(p[1],0);close(p[2],.5);close(p[3],0);
});
test('missing rest and nonfinite values are rejected',()=>{
 assert.throws(()=>restProbabilities([0],[0],[0],1));assert.throws(()=>restProbabilities([NaN],[8],[3],1));
});
