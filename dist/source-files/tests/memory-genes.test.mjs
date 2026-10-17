import test from 'node:test';
import assert from 'node:assert/strict';
import {GENE_COUNT,COGNITIVE_GENES,cognitiveTraits,createBrain,observe} from '../dist/cognition.js';
import {validateGenomeFile,Evolution} from '../dist/evolution.js';
test('memory capacities are inherited bounded traits, not inherited locations',()=>{
 const g=Array(GENE_COUNT).fill(0),traits=cognitiveTraits(g);assert.equal(GENE_COUNT,454);
 assert.equal(traits.shortCapacity,64);assert.equal(traits.longCapacity,32);
 for(const key of ['shortCapacity','longCapacity']){
  const index=COGNITIVE_GENES.find(x=>x.key===key).index;g[index]=-8;const low=cognitiveTraits(g)[key];
  g[index]=8;assert.ok(cognitiveTraits(g)[key]>low);
 }
 const b=createBrain(g);b.traits.shortCapacity=8;
 for(let i=0;i<40;i++)observe(b,[{q:i,r:0,food:0,terrain:'land'}],{q:i,r:0},i);
 assert.equal(b.memory.size,8);assert.equal(createBrain(g).memory.size,0);
});
test('old genome files preserve their numeric prefix and receive neutral new traits',()=>{
 for(const [version,size]of [[1,435],[2,450],[3,454]]){
  const genes=Array(size).fill(.25),result=validateGenomeFile({format:'big-evolution-genome',version,genes});
  assert.equal(result.length,454);assert.deepEqual(result.slice(0,size),genes);assert.ok(result.slice(size).every(v=>v===0));
  const s=new Evolution({population:1,baseGenome:genes});assert.equal(s.genomeFile(s.agents[0]).version,3);
 }
});
