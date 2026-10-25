import test from 'node:test';
import assert from 'node:assert/strict';
import {formatStatistic,formatInterval,formatChartNumber,estimateCell} from '../dist/statistics-format.js';
import {prepareMetric} from '../dist/statistical-series.js';
import {estimateWorlds} from '../dist/statistics-estimates.js';
import {drawHistoryChart} from '../dist/history-charts.js';
import {drawAnalysis} from '../dist/analysis-builder-chart.js';
import {LIFE_OBSERVATION_SCHEMA} from '../dist/life-observations.js';
import {Evolution} from '../dist/evolution.js';
import {Evolution as Kernel0532} from '../dist/benchmark-snapshots/0.53.2/evolution.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';

function canvasFixture(){
 const labels=[],strokes=[];let path=[];
 const ctx={setTransform(){},clearRect(){},beginPath(){path=[];},moveTo(...p){path.push(p);},lineTo(...p){path.push(p);},stroke(){strokes.push({color:this.strokeStyle,path});},fill(){},fillRect(){},setLineDash(){},fillText(t){labels.push(String(t));}};
 return {canvas:{width:600,height:235,getBoundingClientRect:()=>({width:600}),getContext:()=>ctx},labels,strokes};
}

test('small values retain their sign and magnitude in values, confidence bounds and chart labels',()=>{
 for(const value of [.032,-.032,.000012,-.000012,1e-12,-1e-12]){const text=formatStatistic(value);assert.ok(!/^[-−]?0[,\.]?0*$/.test(text),text);if(value<0)assert.match(text,/-|−/);}
 assert.equal(formatStatistic(12.345),'12,3');assert.equal(formatStatistic(0),'0,0');assert.equal(formatStatistic(-0),'0,0');assert.equal(formatStatistic(null),'—');
 assert.equal(formatStatistic(.07321,3),'0,073');assert.equal(formatInterval({low:.031,high:.034},3),'[0,031; 0,034]');assert.equal(formatChartNumber(.032),'0,032');
 const root={createElement:tag=>({tag,children:[],append(...n){this.children.push(...n);}})},cell=estimateCell(root,.032,{low:.031,high:.034},{digits:3});
 assert.equal(cell.children[0].textContent,'0,032');assert.equal(cell.children[2].textContent,'[0,031; 0,034]');
});

test('brain cost stays nonzero through samples, estimates and plotted coordinates; missing costs stay absent',()=>{
 const row=(id,born,cost)=>({id,born,age:10,status:'dead',observedSteps:10,parentId:null,observations:{schema:LIFE_OBSERVATION_SCHEMA,brainCalls:10,...(cost===undefined?{}:{brainEnergyCost:cost})}}),report={tick:300,dead:[row(1,0,.32),row(2,100,.37),row(3,0)],living:[],omittedDetails:0};
 const before=JSON.stringify(report),prepared=prepareMetric([{id:'a',report}],'brainCost',{start:0,end:200,width:100}),points=prepared.points.map(p=>({...p,...estimateWorlds(p.worlds)})),summary=estimateWorlds(prepared.summary.worlds);
 assert.equal(summary.count,2);assert.ok(Math.abs(summary.mean-.0345)<1e-12);assert.equal(points[0].mean,.032);assert.equal(points[1].mean,.037);assert.equal(JSON.stringify(report),before);
 const f=canvasFixture();drawHistoryChart(f.canvas,{points,keys:['mean'],domainStart:0,domainEnd:200,width:100});
 assert.ok(new Set(f.labels.slice(0,5)).size>=4);assert.ok(f.labels.slice(0,5).some(t=>t.includes('0,0')));assert.ok(f.strokes.some(s=>s.color==='#86bf80'&&s.path.some(p=>p[1]<100)));
 const custom=canvasFixture();drawAnalysis(custom.canvas,{config:{chart:'line',axis:'born'},xs:[{key:0,x:0},{key:1,x:100}],groups:[{id:'a'}],cells:[{group:'a',x:0,value:.032},{group:'a',x:1,value:.037}]});
 assert.ok(new Set(custom.labels.slice(0,5)).size>=4);assert.ok(custom.strokes.some(s=>s.color==='#86bf80'&&s.path.some(p=>p[1]<100)));
});

test('technical display patch preserves biology and reads the preceding full world',()=>{
 const options={population:2,initialNeurons:[2,3],initialConnections:150},w=new Evolution(options),reference=new Kernel0532(options);
 for(let j=0;j<2;j++){w.step();reference.step();assert.deepEqual(w.snapshot(),reference.snapshot());}
 const file=saveWorld(w);file.modelVersion='0.53.2';const loaded=loadWorld(file);w.step();loaded.step();assert.deepEqual(w.snapshot(),loaded.snapshot());
 const cost=prepareMetric([{id:'current',report:w.lifeReport()}],'brainCost',{start:0,end:100,width:100,mode:'observed'});assert.ok(estimateWorlds(cost.summary.worlds).mean>0);
});
