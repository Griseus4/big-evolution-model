import test from 'node:test';
import assert from 'node:assert/strict';
import {guideTopologyExample} from '../dist/guide-genetics-text.js';
import {guideReferenceOperations} from '../dist/guide-learning-text.js';
import {operationCounts} from '../dist/brain-cost.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN} from '../dist/temporal-layout.js';
import {Evolution} from '../dist/evolution.js';
import {parseGenomeText} from '../dist/genome-analysis.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {PAGE_TEXT} from '../dist/ui-text.js';
test('empty columns disappear and adjacent budget differs from all-forward budget',()=>{
 const e=guideTopologyExample();assert.deepEqual(e.layers,[2,1]);assert.equal(e.base,CONTEXT_INPUTS*2+2+CONTEXT_HIDDEN);
 assert.ok(e.maximum>e.base);assert.equal(e.count,e.base);assert.ok(e.maxPercent>100);
});
test('reference example uses the model operation counter',()=>{
 const e=guideReferenceOperations();assert.deepEqual(e,operationCounts(null,7,11,6));assert.ok(e.forward>0);assert.ok(e.learning>e.forward);
});
test('current genome analysis reads inherited base without a world step or RNG draw',()=>{
 const w=new Evolution({seed:42,population:1}),a=w.agents[0];a.brain.networkDelta.fill(.25);
 const tick=w.tick,rng=w.random.state,file=w.genomeFile(a),result=parseGenomeText(JSON.stringify(file));
 assert.equal(result.genomeVersion,14);assert.equal(result.geneCount,a.genome.length);assert.ok(result.properties.some(p=>p.group==='Структура мозга'));
 assert.equal(w.tick,tick);assert.equal(w.random.state,rng);assert.deepEqual(file.genes,a.genome);
});
test('evolution passports retain their review version and tiny rule values remain nonzero',()=>{
 for(const id of ['learning','brain-cost','selection','genome','structure-evolution','genome-analysis'])assert.equal(GUIDE_ARTICLES.find(a=>a.id===id).reviewedVersion,'0.54.13');
 assert.equal(GUIDE_ARTICLES.find(a=>a.id==='research').reviewedVersion,'0.54.16');
 assert.match(PAGE_TEXT['guide-genome-body'],/1e-6/);assert.match(PAGE_TEXT['guide-birth-body'],/data-guide-param="birthEnergy"/);
});
