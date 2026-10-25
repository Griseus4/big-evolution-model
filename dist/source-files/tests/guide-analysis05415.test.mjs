import test from 'node:test';
import assert from 'node:assert/strict';
import {guideWeightsExample,GUIDE_ANALYSIS_TEXT} from '../dist/guide-analysis-text.js';
import {ANALYSIS_DEFAULT,validateAnalysis,ANALYSIS_FIELDS} from '../dist/analysis-builder-core.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
test('guide example distinguishes weighted individuals from median of world medians',()=>{
 const e=guideWeightsExample();assert.equal(e.individuals.mean,4.25);assert.equal(e.individuals.median,3.5);assert.equal(e.worlds.mean,3.5);assert.equal(e.worlds.median,3);assert.equal(e.worldMedians,3.5);
});
test('documented second-child and child-axis recipes validate',()=>{
 assert.equal(validateAnalysis({...ANALYSIS_DEFAULT,expression:'birthAge(2)'}).expression,'birthAge(2)');
 assert.equal(validateAnalysis({...ANALYSIS_DEFAULT,expression:'birthAge(N)',axis:'child'}).axis,'child');
});
test('current temporal duration fields are labelled in T',()=>{
 for(const key of ['observedSteps','emptyEnergySteps'])assert.match(ANALYSIS_FIELDS.find(x=>x[0]===key)[1],/, Т$/);
});
test('analysis chapters and their internal destinations exist',()=>{
 const ids=new Set(GUIDE_ARTICLES.map(a=>a.id));for(const text of Object.values(GUIDE_ANALYSIS_TEXT))for(const [,id] of text.matchAll(/data-guide-article="([^"]+)"/g))assert.ok(ids.has(id),id);
});
