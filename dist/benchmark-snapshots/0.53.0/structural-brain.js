/** Наследуемый DAG основного контекста v14. Входы и 16 выходов фиксированы.
 * Нумерация: входы, скрытые по слоям, выходы. Циклов и скрытых сведений нет.
 * Геном: обучаемые веса, свойства, gate, регуляторы, слои/рёбра, footer.
 * План строится при рождении, нулевой вес НЕ исключает обучаемую связь. */
import {SET_BLOCKS as OLD_BLOCKS,CONTEXT_INPUTS,CONTEXT_NAMES,CONTEXT_HIDDEN,TEMPORAL_LAYOUT,GATE_PARAMETERS} from './temporal-layout.js';
export const STRUCTURAL_TYPE='set-duration-dag-v1',STRUCTURAL_MAGIC=14053014;
export const STRUCTURAL_DEFAULTS=Object.freeze({maxNeurons:64,maxLayers:4,structuralMutations:true});
export const STRUCTURAL_LIMITS=Object.freeze({maxNeurons:256,maxLayers:16});
let offset=0;
export const STRUCTURAL_BLOCKS=Object.freeze(OLD_BLOCKS.map(b=>{
 const block={...b,offset,weights:b.key==='context'?0:b.weights,bias:null};
 if(b.bias!==null)block.bias=offset+block.weights;
 offset+=block.weights+(b.bias===null?0:b.outputs);return Object.freeze(block);
}));
export const FIXED_PARAMETERS=offset;
const I=CONTEXT_INPUTS,O=CONTEXT_HIDDEN;
export function structuralSettings(options={}){
 const result={};for(const key of ['maxNeurons','maxLayers']){const v=options[key]??STRUCTURAL_DEFAULTS[key];if(!Number.isSafeInteger(v)||v<(key==='maxNeurons'?6:1)||v>STRUCTURAL_LIMITS[key])throw new Error(`Предел ${key}: целое от 1 до ${STRUCTURAL_LIMITS[key]}.`);result[key]=v;}
 const enabled=options.structuralMutations??true;if(typeof enabled!=='boolean')throw new Error('Неверный переключатель структурных мутаций.');return {...result,structuralMutations:enabled};
}
export function structuralLayout(genes){
 if(genes?.at(-1)!==STRUCTURAL_MAGIC)return null;
 const n=genes.at(-3),e=genes.at(-2);
 if(!Number.isSafeInteger(n)||n<0||n>STRUCTURAL_LIMITS.maxNeurons||!Number.isSafeInteger(e)||e<0||e>(I+n+O)**2)throw new Error('Повреждены размеры структуры мозга.');
 const parameters=FIXED_PARAMETERS+n+e,traitOffset=parameters,gateOffset=traitOffset+12,mutationOffset=gateOffset+GATE_PARAMETERS,structureOffset=mutationOffset+2,topologyOffset=structureOffset+1;
 if(genes.length!==topologyOffset+n+2*e+3)throw new Error('Неполный геном структуры мозга.');
 return {version:14,brainType:STRUCTURAL_TYPE,inputs:I,hidden:n,parameters,traitOffset,traitCount:12,gateOffset,mutationOffset,structureOffset,topologyOffset,edgeCount:e,genes:genes.length,inputNames:CONTEXT_NAMES,
 network:{...TEMPORAL_LAYOUT.network,architecture:'context-dag-fixed-readout-v1',contextHidden:n,contextOutputs:O,parameterOrder:'fixed-dag-traits-gate-regulators-topology-v1',activation:'cells-tanh-dag-tanh-linear-readout'}};
}
export const STRUCTURAL_TYPE_LAYOUT=Object.freeze({...TEMPORAL_LAYOUT,version:14,brainType:STRUCTURAL_TYPE,parameters:FIXED_PARAMETERS,traitOffset:FIXED_PARAMETERS,hidden:0,network:Object.freeze({...TEMPORAL_LAYOUT.network,architecture:'context-dag-fixed-readout-v1'})});
export function structuralData(genes){
 const l=structuralLayout(genes);if(!l)return null;
 const layers=genes.slice(l.topologyOffset,l.topologyOffset+l.hidden),edges=[];
 for(let j=0;j<l.edgeCount;j++)edges.push({from:genes[l.topologyOffset+l.hidden+2*j],to:genes[l.topologyOffset+l.hidden+2*j+1],weight:genes[FIXED_PARAMETERS+l.hidden+j]});
 return {layout:l,layers,edges,biases:genes.slice(FIXED_PARAMETERS,FIXED_PARAMETERS+l.hidden)};
}
export function validateStructure(genes){
 const d=structuralData(genes);if(!d)throw new Error('Нужен геном мозга v14.');const {layout:l,layers,edges}=d,n=l.hidden;
 if(!genes.every(Number.isFinite)||!Number.isFinite(genes[l.structureOffset]))throw new Error('Неконечный ген структуры.');
 let last=0;for(const layer of layers){if(!Number.isInteger(layer)||layer<1||layer>STRUCTURAL_LIMITS.maxLayers||layer<last||layer>last+1)throw new Error('Неверные скрытые слои.');last=layer;}
 const level=id=>id<I?0:id<I+n?layers[id-I]:last+1,seen=new Set();
 for(const e of edges){const k=e.from+':'+e.to;if(!Number.isInteger(e.from)||!Number.isInteger(e.to)||e.from<0||e.from>=I+n||e.to<I||e.to>=I+n+O||level(e.from)>=level(e.to)||seen.has(k))throw new Error('Обратная, повторная или недопустимая связь мозга.');seen.add(k);}
 for(let j=0;j<l.mutationOffset;j++)if(Math.abs(genes[j])>8)throw new Error('Веса и свойства мозга должны быть от −8 до 8.');
 return d;
}
export function packStructure(fixed,layers,biases,edges,tail){
 return [...fixed,...biases,...edges.map(e=>e.weight),...tail,...layers,...edges.flatMap(e=>[e.from,e.to]),layers.length,edges.length,STRUCTURAL_MAGIC];
}
export function randomStructuralGenome(random){
 const n=4+Math.floor(random.next()*3),fixed=Array(FIXED_PARAMETERS).fill(0);
 for(const b of STRUCTURAL_BLOCKS)for(let j=0;j<b.weights;j++)fixed[b.offset+j]=(random.next()*2-1)*Math.sqrt(6/(b.inputs+b.outputs));
 const layers=Array(n).fill(1),edges=[];
 for(let h=0;h<n;h++)for(let i=0;i<I;i++)edges.push({from:i,to:I+h,weight:(random.next()*2-1)*Math.sqrt(6/(I+n))});
 for(let o=0;o<O;o++)for(let h=0;h<n;h++)edges.push({from:I+h,to:I+n+o,weight:(random.next()*2-1)*Math.sqrt(6/(n+O))});
 const traits=Array.from({length:12},()=>(random.next()-.5)*5),gate=Array(GATE_PARAMETERS).fill(0);
 for(let j=0;j<68;j++)gate[j]=(random.next()*2-1)*Math.sqrt(6/21);
 for(let j=72;j<76;j++)gate[j]=(random.next()*2-1)*Math.sqrt(6/5);
 // Регуляторы обычных мутаций добавляет вызывающий код в их именованные слоты.
 const p=.01+random.next()*.04,q=(p-.0001)/.9999,logit=Math.log(q/(1-q));
 return packStructure(fixed,layers,Array(n).fill(0),edges,[...traits,...gate,Math.log((.06-.0001)/(1-.06)),Math.log(.1),logit]);
}
export function structuralProbability(genes){const l=structuralLayout(genes);if(!l)return null;const g=genes[l.structureOffset],e=Math.exp(-Math.abs(g));return .0001+.9999*(g>=0?1/(1+e):e/(1+e));}
/** Структурная правка после мутаций чисел. Старые пути при росте сохраняются;
 * новая ветвь получает ненулевой вход и нулевой выход внутри бюджета пяти. */
export function mutateStructure(genes,random,settings){
 const d=structuralData(genes),{layout:l}=d;
 let {layers,biases,edges}=d;const tail=genes.slice(l.traitOffset,l.topologyOffset),fixed=genes.slice(0,FIXED_PARAMETERS);
 const pick=a=>a[Math.floor(random.next()*a.length)],chance=()=>random.next();
 const op=Math.floor(chance()*3);let added=-1,used=0,protectedEdges=new Set();
 if(op===2&&layers.length){
  const id=I+Math.floor(chance()*layers.length);layers.splice(id-I,1);biases.splice(id-I,1);
  edges=edges.filter(e=>e.from!==id&&e.to!==id).map(e=>({...e,from:e.from>id?e.from-1:e.from,to:e.to>id?e.to-1:e.to}));
 }else if(op===1&&layers.length<settings.maxNeurons){
  const depth=Math.max(0,...layers),newLayer=depth<settings.maxLayers&&(depth===0||chance()<.5);
  let level=newLayer?1+Math.floor(chance()*(depth+1)):pick([...new Set(layers)]);
  if(newLayer)layers=layers.map(v=>v>=level?v+1:v);
  const index=layers.findIndex(v=>v>level),at=index<0?layers.length:index;added=I+at;
  edges=edges.map(e=>({...e,from:e.from>=added?e.from+1:e.from,to:e.to>=added?e.to+1:e.to}));layers.splice(at,0,level);biases.splice(at,0,0);
  const from=Math.floor(chance()*I),to=I+layers.length+Math.floor(chance()*O);
  let weight=(chance()*2-1)*Math.sqrt(6/(I+layers.length));if(weight===0)weight=.01;
  edges.push({from,to:added,weight},{from:added,to,weight:0});used=2;protectedEdges=new Set([from+':'+added,added+':'+to]);
 }
 // Сжимаем только пустые уровни; нейроны сверх разрешённого одного не удаляем.
 const levels=[...new Set(layers)].sort((a,b)=>a-b);layers=layers.map(v=>levels.indexOf(v)+1);
 const total=used+Math.floor(chance()*(6-used)),n=layers.length,level=id=>id<I?0:id<I+n?layers[id-I]:levels.length+1;
 for(;used<total;used++){
  if(chance()<.5){const removable=edges.filter(e=>!protectedEdges.has(e.from+':'+e.to));if(removable.length){const e=pick(removable);edges.splice(edges.indexOf(e),1);}}
  else{
   const existing=new Set(edges.map(e=>e.from+':'+e.to));let selected=null,count=0;
   // Резервуарный выбор без выделения матрицы всех возможных рёбер.
   for(let from=0;from<I+n;from++)for(let to=I;to<I+n+O;to++)if(level(from)<level(to)&&!existing.has(from+':'+to)){count++;if(chance()<1/count)selected={from,to,weight:0};}
   if(selected)edges.push(selected);
  }
 }
 return packStructure(fixed,layers,biases,edges,tail);
}
/** План и структурная достижимость неизменны за жизнь; нулевые веса активны. */
export function compileStructure(genes){
 const d=validateStructure(genes),{layout:l,layers,edges}=d,n=l.hidden,total=I+n+O;
 const incoming=Array.from({length:total},()=>[]);
 edges.forEach((e,j)=>incoming[e.to].push({from:e.from,index:FIXED_PARAMETERS+n+j}));
 const active=new Uint8Array(total);active.fill(1,I+n);
 for(let id=total-1;id>=I;id--)if(active[id])for(const e of incoming[id])active[e.from]=1;
 const nodes=[];let activeEdges=0;for(let id=I;id<total;id++)if(active[id]){nodes.push(id);activeEdges+=incoming[id].length;}
 const activeParameters=[];for(const b of STRUCTURAL_BLOCKS)for(let j=0;j<b.weights+(b.bias===null?0:b.outputs);j++)activeParameters.push(b.offset+j);
 for(const id of nodes){if(id<I+n)activeParameters.push(FIXED_PARAMETERS+id-I);for(const e of incoming[id])activeParameters.push(e.index);}
 return {activeParameters,inputs:I,outputs:O,hidden:n,layers,incoming,nodes,active,activeEdges,parameters:l.parameters,outputBias:STRUCTURAL_BLOCKS[1].bias};
}
export function structureCounts(genes,plan=null){const p=plan??compileStructure(genes);return {brainNeurons:p.hidden,brainConnections:structuralLayout(genes).edgeCount,brainLayers:Math.max(0,...p.layers),brainActiveNeurons:p.nodes.filter(id=>id<I+p.hidden).length,brainActiveConnections:p.activeEdges,structuralRate:100*structuralProbability(genes)};}
export function contextForward(p,input,plan){
 const values=new Float64Array(I+plan.hidden+O);values.set(input);
 for(const id of plan.nodes){let v=id<I+plan.hidden?p[FIXED_PARAMETERS+id-I]:p[plan.outputBias+id-I-plan.hidden];for(const e of plan.incoming[id])v+=p[e.index]*values[e.from];values[id]=id<I+plan.hidden?Math.tanh(v):v;}
 return {z:values.subarray(I+plan.hidden),values};
}
export function contextBackward(p,common,dz,gradient,back,plan){
 const derivatives=new Float64Array(common.values.length);derivatives.set(dz,I+plan.hidden);
 for(let k=plan.nodes.length-1;k>=0;k--){const id=plan.nodes[k],hidden=id<I+plan.hidden,d=derivatives[id]*(hidden?1-common.values[id]**2:1),index=hidden?FIXED_PARAMETERS+id-I:plan.outputBias+id-I-plan.hidden;gradient[index]+=d;for(const e of plan.incoming[id]){gradient[e.index]+=d*common.values[e.from];derivatives[e.from]+=d*p[e.index];}}
 for(let i=0;i<I;i++)back[i]+=derivatives[i];
}
