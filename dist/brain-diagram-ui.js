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
export function renderBrainDiagram(host,agent,learningEnabled=true){
 let view=views.get(host);
 if(!view){
  const document=host.ownerDocument,select=document.createElement('select');select.setAttribute('aria-label','Блок схемы мозга');
  for(const [value,label]of [['context','Главный контекст — изменяемая структура'],['cells','Кодировщик клеток'],['target','Проекция цели'],['operation','Проекция операции'],['direct','Прямая оценка'],['gate','Контроллер вызова']]){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
  const scroll=document.createElement('div');scroll.className='brain-diagram-scroll';const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Схема нейронов и связей; подробности по нажатию');canvas.tabIndex=0;scroll.append(canvas);
  const info=document.createElement('p');info.className='note';info.setAttribute('aria-live','polite');
  const element=document.createElement('select');element.setAttribute('aria-label','Выбрать нейрон для просмотра');host.replaceChildren(select,scroll,element,info);
  view={select,canvas,info,element,agent,selected:null};views.set(host,view);
  select.addEventListener('change',()=>{view.selected=null;paint(view);});
  element.addEventListener('change',()=>{view.selected={node:Number(element.value)};describe(view);});
  canvas.addEventListener('click',event=>{
   const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height;
   let selected=view.nodes.find(n=>Math.hypot(x-n.x,y-n.y)<10);
   if(selected)view.selected={node:selected.id};else{
    let best=7,edge=null;for(const e of view.model.edges){const a=view.lookup.get(e.from),b=view.lookup.get(e.to),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy))),distance=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(distance<best){best=distance;edge=e;}}
    view.selected=edge?{edge}:null;
   }describe(view);
  });
 }
 view.agent=agent;view.learningEnabled=learningEnabled;paint(view);
}
function describe(view){
 const s=view.selected,b=view.agent.brain;
 if(s?.edge){const e=view.model.edges.find(e=>e.index===s.edge.index);if(!e){view.selected=null;describe(view);return;}view.info.textContent=`${view.lookup.get(e.from).label} → ${view.lookup.get(e.to).label}: наследуемый вес ${e.base.toFixed(4)}, личная поправка ${e.delta.toFixed(4)}, действующий вес ${(e.base+(e.enabled?e.delta:0)).toFixed(4)}${e.enabled?'':' (личное обучение отключено)'}.`;}
 else if(s){const n=view.lookup.get(s.node);view.info.textContent=n?`${n.label}. Уровень ${n.layer}.${n.index!==null?` Смещение: ген ${view.agent.genome[n.index].toFixed(4)}, поправка ${(b.networkDelta?.[n.index]??0).toFixed(4)}.`:''}`:'';}
 else view.info.textContent='Слева входы, справа выходы. Зелёные связи — положительные, жёлтые — отрицательные, серые — нулевые. Нажмите на нейрон или связь. Личные поправки показаны отдельно от наследуемых весов.';
}
function paint(view){
 const model=brainDiagramModel(view.agent,view.select.value,view.learningEnabled);view.model=model;if(!model){view.info.textContent='Схема доступна для мозга v14.';return;}
 const groups=new Map();for(const n of model.nodes){if(!groups.has(n.layer))groups.set(n.layer,[]);groups.get(n.layer).push(n);}
 const levels=[...groups.keys()].sort((a,b)=>a-b),height=Math.max(280,...[...groups.values()].map(g=>g.length*19+40)),width=Math.max(640,levels.length*180);
 const canvas=view.canvas;canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');view.lookup=new Map();view.nodes=[];
 levels.forEach((level,col)=>groups.get(level).forEach((n,row)=>{const p={...n,x:30+col*(width-60)/Math.max(1,levels.length-1),y:25+row*(height-50)/Math.max(1,groups.get(level).length-1)};view.lookup.set(n.id,p);view.nodes.push(p);}));
 ctx.clearRect(0,0,width,height);ctx.lineWidth=.7;for(const e of model.edges){const a=view.lookup.get(e.from),b=view.lookup.get(e.to),w=e.base+(e.enabled?e.delta:0);ctx.strokeStyle=w>0?'#7fbd7790':w<0?'#e3c66d90':'#77847a60';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 for(const n of view.nodes){ctx.fillStyle=n.layer===0?'#83acc2':'#dfca89';ctx.beginPath();ctx.arc(n.x,n.y,5,0,Math.PI*2);ctx.fill();}
 const old=view.element.value;view.element.replaceChildren(...view.nodes.map(n=>{const o=canvas.ownerDocument.createElement('option');o.value=n.id;o.textContent=n.label;return o;}));if([...view.element.options].some(o=>o.value===old))view.element.value=old;describe(view);
}
