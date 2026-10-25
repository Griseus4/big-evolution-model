import test from 'node:test';
import assert from 'node:assert/strict';
import {compileDag,dagParameters,dagForward,dagBackward,validateDag} from '../dist/dag-network.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const sample=()=>({inputs:2,outputs:2,layers:[1,2],biases:[.1,-.2,.3,-.1],edges:[
 {from:0,to:2,weight:.4},{from:1,to:2,weight:-.5},{from:2,to:3,weight:.7},
 {from:3,to:4,weight:.2},{from:2,to:5,weight:-.6},{from:0,to:5,weight:.8}]});

test('DAG gradients of all parameters and inputs agree with finite differences',()=>{
 const graph=sample(),plan=compileDag(graph),p=dagParameters(graph),x=Float64Array.of(.2,-.3),dy=Float64Array.of(.7,-.4),eps=1e-5;
 const result=dagForward(plan,p,x),back=dagBackward(plan,p,result.values,dy);
 const value=()=>dagForward(plan,p,x).output.reduce((sum,v,i)=>sum+v*dy[i],0);
 for(let i=0;i<p.length;i++){const old=p[i];p[i]=old+eps;const hi=value();p[i]=old-eps;const lo=value();p[i]=old;close(back.gradient[i],(hi-lo)/(2*eps));}
 for(let i=0;i<x.length;i++){const old=x[i];x[i]=old+eps;const hi=value();x[i]=old-eps;const lo=value();x[i]=old;close(back.inputGradient[i],(hi-lo)/(2*eps));}
});

test('zero hidden, no edges, skip edges and arbitrary I/O are valid',()=>{
 for(const graph of [{inputs:3,outputs:1,layers:[],biases:[.2],edges:[]},
 {inputs:1,outputs:2,layers:[],biases:[0,1],edges:[{from:0,to:2,weight:2}]}]){
  const plan=compileDag(graph);const out=dagForward(plan,dagParameters(graph),new Float64Array(graph.inputs).fill(.5)).output;
  assert.equal(out.length,graph.outputs);assert.ok([...out].every(Number.isFinite));
 }
});

test('neutral insertion preserves outputs and zero outgoing edge can learn',()=>{
 const before={inputs:1,outputs:1,layers:[],biases:[.3],edges:[{from:0,to:1,weight:.7}]};
 const after={inputs:1,outputs:1,layers:[1],biases:[0,.3],edges:[{from:0,to:2,weight:.7},{from:0,to:1,weight:.8},{from:1,to:2,weight:0}]};
 const a=compileDag(before),b=compileDag(after),pa=dagParameters(before),pb=dagParameters(after),input=[.4],out=dagForward(b,pb,input);
 close(dagForward(a,pa,input).output[0],out.output[0]);
 assert.notEqual(dagBackward(b,pb,out.values,[1]).gradient.at(-1),0);
 assert.ok(b.operations>a.operations);
});

test('disconnected biased neurons are skipped, existing zero edges stay active',()=>{
 const graph={inputs:1,outputs:1,layers:[1,1],biases:[2,3,0],edges:[{from:1,to:3,weight:0}]};
 const plan=compileDag(graph);assert.deepEqual(plan.nodes,[1,3]);assert.equal(plan.activeEdges,1);
 const p=dagParameters(graph),out=dagForward(plan,p,[.5]);
 close(dagBackward(plan,p,out.values,[1]).gradient.at(-1),Math.tanh(2));
});

test('malformed topology and nonfinite data are rejected',()=>{
 for(const mutate of [g=>g.layers=[2,2],g=>g.layers=[1,17],g=>g.biases[0]=NaN,
 g=>g.edges.push({...g.edges[0]}),g=>g.edges[0].from=3,g=>g.edges[0].to=0,
 g=>g.edges[0].weight=Infinity,g=>g.edges[0].from=.5]){
  const graph=sample();mutate(graph);assert.throws(()=>validateDag(graph));
 }
});

test('compiled plan and reused buffers yield the same values without RNG',()=>{
 const graph=sample(),a=compileDag(graph),b=compileDag(structuredClone(graph)),p=dagParameters(graph),buffer=new Float64Array(6);
 assert.deepEqual(a,b);
 for(const input of [[.2,.3],[-.4,.8],[0,0]])assert.deepEqual(dagForward(a,p,input,buffer).output,dagForward(b,p,input).output);
});
