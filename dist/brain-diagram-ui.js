import {BRAIN_COMPONENTS,BRAIN_LEGEND,brainFeatureExplanation} from './brain-diagram-help.js';
import {diagramLayout,fitViewport,resizeViewport,zoomViewport,panViewport,diagramHit,selectedEdge,EDGE_WIDTH} from './brain-diagram-viewport.js';
/** Только представление выбранного мозга. Клик читает существующие веса;
 * ни активаций, ни выбора, ни обучения, ни RNG просмотр не выполняет. */
import {structuralData,STRUCTURAL_BLOCKS,FIXED_PARAMETERS} from './structural-brain.js';
import {CONTEXT_NAMES,CELL_NAMES,CANDIDATE_NAMES,OPERATION_NAMES,GATE_NAMES,GATE_HIDDEN_BIAS,GATE_OUTPUT_WEIGHTS,GATE_OUTPUT_BIAS} from './temporal-layout.js';
const views=new WeakMap();
export function brainDiagramModel(agent,component='context',learningEnabled=true){
 const d=structuralData(agent.genome);if(!d)return null;const b=agent.brain,l=d.layout;
 const nodes=[],edges=[],base=agent.genome,delta=b.networkDelta;
 const node=(id,layer,label,index=null)=>nodes.push({id,layer,label,index});
 const edge=(from,to,index,gate=false)=>edges.push({from,to,index,base:gate?b.gateBase[index]:base[index],delta:gate?0:delta?.[index]??0,enabled:gate||learningEnabled});
 if(component==='context'){
  const I=l.inputs,n=l.hidden,depth=Math.max(0,...d.layers);
  for(let i=0;i<I;i++)node(i,0,CONTEXT_NAMES[i]);
  d.layers.forEach((v,j)=>node(I+j,v,`Скрытый ${j+1}`,FIXED_PARAMETERS+j));
  for(let j=0;j<16;j++)node(I+n+j,depth+1,`Выход контекста ${j+1}`,STRUCTURAL_BLOCKS[1].bias+j);
  d.edges.forEach((e,j)=>edge(e.from,e.to,FIXED_PARAMETERS+n+j));
 }else if(component==='gate'){
  GATE_NAMES.forEach((name,j)=>node(j,0,name));
  for(let h=0;h<4;h++){node(17+h,1,`Контроллер ${h+1}`,l.gateOffset+GATE_HIDDEN_BIAS+h);for(let i=0;i<17;i++)edge(i,17+h,h*17+i,true);edge(17+h,21,GATE_OUTPUT_WEIGHTS+h,true);}
  node(21,2,'Запросить основной мозг',l.gateOffset+GATE_OUTPUT_BIAS);
 }else{
  const block=STRUCTURAL_BLOCKS.find(b=>b.key===component);if(!block)return null;
  const names=component==='cells'?CELL_NAMES:component==='target'?CANDIDATE_NAMES.slice(6):component==='operation'?OPERATION_NAMES:CANDIDATE_NAMES;
  for(let i=0;i<block.inputs;i++)node(i,0,names[i]);
  for(let h=0;h<block.outputs;h++){node(block.inputs+h,1,`${block.label} ${h+1}`,block.bias===null?null:block.bias+h);for(let i=0;i<block.inputs;i++)edge(i,block.inputs+h,block.offset+h*block.inputs+i);}
 }
 return {nodes,edges,component};
}
/** Единственный DOM на вкладку: меняются данные и Canvas, камера сохраняется. */
export function renderBrainDiagram(host,agent,learningEnabled=true){
 let view=views.get(host);if(!view){view=createDiagramView(host);views.set(host,view);}
 const changed=!view.agent||view.agent.id!==agent.id||view.agent.genome.length!==agent.genome.length||view.agent.genome.some((v,i)=>v!==agent.genome[i]);
 view.agent=agent;view.learningEnabled=learningEnabled;
 refreshModel(view,changed);
}
function createDiagramView(host){
 const doc=host.ownerDocument,make=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const componentSelect=()=>{const select=make('select');select.setAttribute('aria-label','Блок схемы мозга');for(const [key,name]of BRAIN_COMPONENTS){const o=make('option',name);o.value=key;select.append(o);}select.value='context';return select;};
 const select=componentSelect(),preview=make('button');preview.type='button';preview.className='brain-diagram-preview';preview.setAttribute('aria-label','Открыть схему мозга на весь экран');
 const thumbnail=make('canvas');thumbnail.setAttribute('aria-hidden','true');preview.append(thumbnail,make('span','Открыть и исследовать схему ↗'));
 const description=make('p');description.className='note';host.replaceChildren(select,preview,description);
 const dialog=make('dialog');dialog.className='brain-diagram-dialog';dialog.setAttribute('aria-label','Схема мозга: масштаб, навигация и пояснения');
 const header=make('div');header.className='brain-diagram-toolbar';const title=make('h2','Схема мозга'),modalSelect=componentSelect(),fit=make('button','Вся схема'),minus=make('button','−'),plus=make('button','+'),close=make('button','Закрыть'),scale=make('output');
 minus.setAttribute('aria-label','Отдалить схему');plus.setAttribute('aria-label','Приблизить схему');header.append(title,modalSelect,minus,plus,fit,scale,close);
 const instructions=make('p','Левая кнопка: перетаскивать. Колесо: масштаб под указателем. Короткое нажатие: выбрать. Esc: закрыть.');instructions.className='note brain-diagram-instructions';
 const content=make('div');content.className='brain-diagram-content';const stage=make('div');stage.className='brain-diagram-stage';const canvas=make('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Интерактивная схема. Стрелки перемещают, плюс и минус меняют масштаб, Home показывает всю схему.');stage.append(canvas);
 const notes=make('section');notes.className='brain-diagram-notes';notes.setAttribute('aria-label','Пояснения схемы');const componentHelp=make('p'),element=make('select');element.setAttribute('aria-label','Выбрать нейрон для просмотра');
 const info=make('div');info.className='brain-diagram-info';info.setAttribute('aria-live','polite');const legend=make('details');legend.append(make('summary','Цвета, нейроны и связи'),make('p',BRAIN_LEGEND));const glossary=make('details'),glossaryBody=make('dl');glossary.append(make('summary','Все входы и выходы этого блока'),glossaryBody);notes.append(componentHelp,element,info,legend,glossary);content.append(stage,notes);dialog.append(header,instructions,content);doc.body.append(dialog);
 const view={host,doc,select,preview,thumbnail,description,dialog,modalSelect,componentHelp,canvas,stage,element,info,glossaryBody,scale,minus,plus,component:'context',selection:null,camera:null,pending:false,make};
 const change=source=>{view.component=source.value;select.value=modalSelect.value=view.component;view.selection=null;view.camera=null;refreshModel(view,true);};
 select.addEventListener('change',()=>change(select));modalSelect.addEventListener('change',()=>change(modalSelect));
 preview.addEventListener('click',()=>{view.camera=null;dialog.showModal();schedulePaint(view);});close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{const drag=view.drag;view.drag=null;canvas.classList.remove('dragging');if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);preview.focus({preventScroll:true});});
 fit.addEventListener('click',()=>{view.camera=null;schedulePaint(view);});
 for(const [button,factor]of [[plus,1.5],[minus,1/1.5]])button.addEventListener('click',()=>{if(view.camera)zoomViewport(view.camera,view.layout,factor);schedulePaint(view);});
 element.addEventListener('change',()=>{view.selection=element.value===''?null:{node:Number(element.value)};describeSelection(view);schedulePaint(view);});
 canvas.addEventListener('wheel',event=>{event.preventDefault();if(!view.camera)return;const p=pointerPoint(canvas,event),units=event.deltaMode===1?16:event.deltaMode===2?view.camera.height:1;zoomViewport(view.camera,view.layout,Math.exp(-Math.max(-250,Math.min(250,event.deltaY*units))*.006),p.x,p.y);schedulePaint(view);},{passive:false});
 canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();canvas.focus({preventScroll:true});const p=pointerPoint(canvas,event);view.drag={id:event.pointerId,start:p,last:p,moved:false};canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{const drag=view.drag;if(!drag||drag.id!==event.pointerId||!view.camera)return;const p=pointerPoint(canvas,event);if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>4)drag.moved=true;if(drag.moved){panViewport(view.camera,view.layout,p.x-drag.last.x,p.y-drag.last.y);canvas.classList.add('dragging');schedulePaint(view);}drag.last=p;});
 canvas.addEventListener('pointerup',event=>{const drag=view.drag;if(!drag||drag.id!==event.pointerId)return;const p=pointerPoint(canvas,event);drag.moved||=Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>4;if(drag.moved&&view.camera){panViewport(view.camera,view.layout,p.x-drag.last.x,p.y-drag.last.y);schedulePaint(view);}if(!drag.moved&&view.camera){view.selection=diagramHit(view.model,view.layout,view.camera,p.x,p.y);view.element.value=view.selection?.node??'';describeSelection(view);schedulePaint(view);}view.drag=null;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);});
 for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{view.drag=null;canvas.classList.remove('dragging');});
 canvas.addEventListener('keydown',event=>{if(!view.camera)return;const move={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]}[event.key];if(move)panViewport(view.camera,view.layout,...move);else if(['+','=','-'].includes(event.key))zoomViewport(view.camera,view.layout,event.key==='-'?1/1.5:1.5);else if(event.key==='Home')view.camera=null;else return;event.preventDefault();schedulePaint(view);});
 if(globalThis.ResizeObserver){view.observer=new ResizeObserver(()=>schedulePaint(view));view.observer.observe(preview);view.observer.observe(stage);}else doc.defaultView?.addEventListener('resize',()=>schedulePaint(view));
 return view;
}
function pointerPoint(canvas,event){const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
function refreshModel(view,changed){
 const model=brainDiagramModel(view.agent,view.component,view.learningEnabled);view.model=model;view.previewDirty=true;view.preview.disabled=!model;if(!model){view.description.textContent='Схема доступна для мозга v14.';return;}
 const info=BRAIN_COMPONENTS.find(row=>row[0]===view.component);view.description.textContent=info[2];view.componentHelp.textContent=info[2];
 if(changed||!view.layout){view.layout=diagramLayout(model);view.camera=null;view.selection=null;const empty=view.make('option','Выберите нейрон или нажмите на связь');empty.value='';view.element.replaceChildren(empty,...model.nodes.map(node=>{const o=view.make('option',node.label);o.value=node.id;return o;}));view.glossaryBody.replaceChildren(...model.nodes.flatMap(node=>[view.make('dt',node.label),view.make('dd',brainFeatureExplanation(node.label,model.component,node.index===null&&node.layer===0))]));}
 describeSelection(view);schedulePaint(view);
}
function describeSelection(view){
 const s=view.selection,model=view.model;if(!model)return;
 if(s?.edge!==undefined){const e=model.edges.find(e=>e.index===s.edge);if(!e){view.selection=null;return describeSelection(view);}const from=view.layout.lookup.get(e.from),to=view.layout.lookup.get(e.to);view.info.replaceChildren(view.make('h3',`${from.label} → ${to.label}`),view.make('p',`Наследуемый вес ${e.base.toFixed(4)}; личная поправка ${e.delta.toFixed(4)}; действующий вес ${(e.base+(e.enabled?e.delta:0)).toFixed(4)}.${e.enabled?'':' Личное обучение отключено, поправка сохранена, но не применяется.'}`),view.make('p','Связь умножает сигнал исходного нейрона на действующий вес и добавляет его к входной сумме следующего. Знак веса не определяет поведение всей сети.'));}
 else if(s?.node!==undefined){const node=model.nodes.find(n=>n.id===s.node);if(!node){view.selection=null;return describeSelection(view);}const text=brainFeatureExplanation(node.label,model.component,node.index===null&&node.layer===0);view.info.replaceChildren(view.make('h3',node.label),view.make('p',text));if(node.index!==null){const base=view.agent.genome[node.index],delta=view.agent.brain.networkDelta?.[node.index]??0;view.info.append(view.make('p',`Смещение: ген ${base.toFixed(4)}, личная поправка ${delta.toFixed(4)}. Уровень ${node.layer}.`));}else view.info.append(view.make('p',`Уровень ${node.layer}. У этого элемента нет собственного обучаемого смещения.`));}
 else view.info.replaceChildren(view.make('p','Выберите нейрон или связь. Для выбранного нейрона белым выделяются все его входящие и исходящие связи.'));
}
function schedulePaint(view){if(view.pending)return;view.pending=true;const frame=view.doc.defaultView?.requestAnimationFrame?.bind(view.doc.defaultView)??(fn=>setTimeout(fn,0));frame(()=>{view.pending=false;paintView(view);});}
function canvasSize(canvas,width,height){const ratio=Math.min(2,globalThis.devicePixelRatio??1);const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;return ratio;}
function paintView(view){
 if(!view.model||!view.layout)return;const rect=view.preview.getBoundingClientRect();if(rect.width>0&&(view.previewDirty||view.previewWidth!==rect.width)){view.previewWidth=rect.width;view.previewDirty=false;const width=Math.max(1,rect.width-4),height=180,ratio=canvasSize(view.thumbnail,width,height);drawDiagram(view.thumbnail,view.model,view.layout,fitViewport(view.layout,width,height),null,ratio);}
 if(!view.dialog.open)return;const area=view.stage.getBoundingClientRect();if(area.width<=0||area.height<=0)return;view.camera=resizeViewport(view.camera,view.layout,area.width,area.height);const ratio=canvasSize(view.canvas,area.width,area.height);drawDiagram(view.canvas,view.model,view.layout,view.camera,view.selection,ratio);view.scale.textContent=`×${(view.camera.scale/view.camera.min).toFixed(1)}`;view.minus.disabled=view.camera.scale<=view.camera.min+1e-8;view.plus.disabled=view.camera.scale>=view.camera.max-1e-8;
}
function drawDiagram(canvas,model,layout,camera,selection,ratio){
 const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,camera.width,camera.height);ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);
 const line=(edge,highlight)=>{const a=layout.lookup.get(edge.from),b=layout.lookup.get(edge.to),weight=edge.base+(edge.enabled?edge.delta:0);ctx.lineWidth=EDGE_WIDTH*(highlight?2:1)/camera.scale;ctx.strokeStyle=highlight?'#ffffff':weight>0?'#7fbd7780':weight<0?'#e3c66d80':'#77847a50';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
 for(const edge of model.edges)if(!selectedEdge(edge,selection))line(edge,false);for(const edge of model.edges)if(selectedEdge(edge,selection))line(edge,true);
 const font=Math.max(11,Math.min(22,13*Math.sqrt(camera.scale)))/camera.scale;ctx.font=`${font}px Segoe UI, sans-serif`;
 for(const node of layout.nodes){const chosen=selection?.node===node.id;ctx.fillStyle=chosen?'#ffffff':node.layer===0?'#91b8d0':'#dfca89';ctx.beginPath();ctx.arc(node.x,node.y,5,0,Math.PI*2);ctx.fill();if(chosen){ctx.strokeStyle='#ffffff';ctx.lineWidth=2*EDGE_WIDTH/camera.scale;ctx.stroke();}
  if(camera.scale*layout.pitch>=20){ctx.fillStyle=chosen?'#ffffff':'#d8dfd4';ctx.textAlign=node.layer===0?'right':'left';ctx.textBaseline='middle';ctx.fillText(node.label,node.x+(node.layer===0?-10:10),node.y,205);}
 }
}
