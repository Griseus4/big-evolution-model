import test from 'node:test';
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {brainDiagramModel,renderBrainDiagram} from '../dist/brain-diagram-ui.js';
import {diagramLayout,fitViewport,zoomViewport,panViewport,resizeViewport,diagramHit,selectedEdge,EDGE_WIDTH} from '../dist/brain-diagram-viewport.js';
import {brainFeatureExplanation,BRAIN_COMPONENTS} from '../dist/brain-diagram-help.js';
import {saveWorld,loadWorld} from '../dist/world-save.js';
import {Evolution as Kernel0530} from '../dist/benchmark-snapshots/0.53.0/evolution.js';

test('overview fits every node; zoom is bounded, anchored and permits about three rows',()=>{
 const w=new Evolution({population:1}),model=brainDiagramModel(w.agents[0]),layout=diagramLayout(model),c=fitViewport(layout,1000,640);
 for(const n of layout.nodes){assert.ok(c.x+n.x*c.scale>=0&&c.x+n.x*c.scale<=1000);assert.ok(c.y+n.y*c.scale>=0&&c.y+n.y*c.scale<=640);}
 zoomViewport(c,layout,1e8);assert.equal(c.scale,c.max);assert.ok(c.height/(c.scale*layout.pitch)<3.3);
 const point={x:500,y:300},before={x:(point.x-c.x)/c.scale,y:(point.y-c.y)/c.scale};zoomViewport(c,layout,.9,point.x,point.y);assert.ok(Math.abs((point.y-c.y)/c.scale-before.y)<1e-8);
 panViewport(c,layout,1e9,-1e9);assert.ok(c.x<=16&&c.y>=640-layout.height*c.scale-16);
 const smaller=resizeViewport(c,layout,600,420);assert.ok(smaller.scale>=smaller.min&&smaller.scale<=smaller.max);
 zoomViewport(c,layout,1e-20);assert.equal(c.scale,c.min);const resized=resizeViewport(c,layout,1200,800);assert.equal(resized.scale,resized.min);
});
test('screen hit-testing selects nodes and edges after zoom/pan, including edge zero',()=>{
 const model={nodes:[{id:0,layer:0},{id:1,layer:1},{id:2,layer:1}],edges:[{from:0,to:1,index:0},{from:0,to:2,index:1}]},layout=diagramLayout(model),c=fitViewport(layout,900,600);
 zoomViewport(c,layout,2);const n=layout.lookup.get(0);assert.deepEqual(diagramHit(model,layout,c,c.x+n.x*c.scale,c.y+n.y*c.scale),{node:0});
 const b=layout.lookup.get(1);assert.deepEqual(diagramHit(model,layout,c,c.x+(n.x+b.x)/2*c.scale,c.y+(n.y+b.y)/2*c.scale),{edge:0});
 assert.equal(selectedEdge(model.edges[0],{edge:0}),true);assert.equal(selectedEdge(model.edges[1],{node:0}),true);assert.equal(selectedEdge(model.edges[1],{edge:0}),false);
});
test('block meanings and actual feature encodings are explained without assigning goals to outputs',()=>{
 assert.equal(BRAIN_COMPONENTS.length,6);assert.match(BRAIN_COMPONENTS.find(x=>x[0]==='target')[2],/не 16 мест/);
 assert.match(brainFeatureExplanation('Относительное q'),/личной системе/);assert.match(brainFeatureExplanation('Пища / 10'),/пять порций дают 0,5/);
 assert.match(brainFeatureExplanation('Движутся: назад-вправо'),/n\/\(n\+1\)/);assert.match(brainFeatureExplanation('Средний квадрат 1'),/не дисперсия/);
 assert.match(brainFeatureExplanation('Выход контекста 1','context',false),/не означает полезную стратегию/);
});
test('UI patch preserves the frozen 0.53.0 trajectory and loads its world format',()=>{
 const current=new Evolution({population:3}),kernel=new Kernel0530({population:3});
 for(let i=0;i<2;i++){current.step();kernel.step();assert.deepEqual(current.snapshot(),kernel.snapshot());}
 const file=saveWorld(current);file.modelVersion='0.53.0';const resumed=loadWorld(file);current.step();resumed.step();assert.deepEqual(resumed.snapshot(),current.snapshot());
});

function documentFixture(){
 const strokes=[];
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.style={};this.attrs={};this.value='';this.className='';this.capture=new Set();this.classList={add:()=>{},remove:()=>{}};this.ownerDocument=doc;}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parent=this;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
  emit(k,event={}){this.events[k]?.({preventDefault(){},...event});}
  focus(){}
  showModal(){this.open=true;}
  close(){this.open=false;this.emit('close');}
  setPointerCapture(id){this.capture.add(id);}
  hasPointerCapture(id){return this.capture.has(id);}
  releasePointerCapture(id){this.capture.delete(id);}
  getBoundingClientRect(){return {left:0,top:0,width:this.className==='brain-diagram-preview'?360:900,height:this.className==='brain-diagram-stage'?640:200};}
  getContext(){return {setTransform(){},clearRect(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},arc(){},fill(){},fillText(){},stroke(){strokes.push({color:this.strokeStyle,width:this.lineWidth});}};}
 }
 const doc={defaultView:{requestAnimationFrame:fn=>fn(),addEventListener(){}},createElement:tag=>new Element(tag)};doc.body=new Element('body');
 return {doc,strokes,find(root,predicate){if(predicate(root))return root;for(const n of root.children){const found=this.find(n,predicate);if(found)return found;}return null;}};
}
test('actual renderer opens/closes dialog, pans without selecting and paints selected edges white at double width',()=>{
 const f=documentFixture(),host=f.doc.createElement('div'),w=new Evolution({population:1}),a=w.agents[0],rng=w.random.state;
 renderBrainDiagram(host,a);const preview=f.find(host,e=>e.className==='brain-diagram-preview'),dialog=f.doc.body.children[0],stage=f.find(dialog,e=>e.className==='brain-diagram-stage'),canvas=stage.children[0];assert.equal(dialog.open,undefined);
 preview.emit('click');assert.equal(dialog.open,true);
 const model=brainDiagramModel(a),layout=diagramLayout(model),c=fitViewport(layout,900,640,.94),n=layout.lookup.get(0),x=c.x+n.x*c.scale,y=c.y+n.y*c.scale;
 canvas.emit('pointerdown',{button:0,pointerId:1,clientX:x,clientY:y});f.strokes.length=0;canvas.emit('pointerup',{pointerId:1,clientX:x,clientY:y});
 const selected=f.strokes.filter(s=>s.color==='#ffffff');assert.ok(selected.length>0);assert.ok(selected.some(s=>Math.abs(s.width-EDGE_WIDTH*2/c.scale)<1e-8));
 canvas.emit('wheel',{deltaY:-200,deltaMode:0,clientX:450,clientY:320});canvas.emit('pointerdown',{button:0,pointerId:2,clientX:450,clientY:320});canvas.emit('pointermove',{pointerId:2,clientX:500,clientY:340});canvas.emit('pointerup',{pointerId:2,clientX:500,clientY:340});
 const info=f.find(dialog,e=>e.className==='brain-diagram-info');assert.equal(info.children[0].textContent,'Энергия / 100');
 const close=f.find(dialog,e=>e.tagName==='button'&&e.textContent==='Закрыть');close.emit('click');assert.equal(dialog.open,false);assert.equal(w.random.state,rng);assert.equal(w.agents[0],a);
});
