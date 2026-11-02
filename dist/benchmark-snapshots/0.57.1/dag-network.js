/** Общая ациклическая сеть: входы, скрытые tanh по слоям, линейные выходы.
 * Структура наследуется; план и рабочие буферы принадлежат живой особи.
 * Нулевой вес — существующая связь: она выполняется и может обучаться.
 * Формат не зависит от размеров основного контекста или диспетчера. */
export const DAG_LIMITS=Object.freeze({inputs:512,outputs:64,hidden:256,layers:16,weight:8});

export function validateDag(graph,limits=DAG_LIMITS){
 if(!graph||!Number.isSafeInteger(graph.inputs)||graph.inputs<1||graph.inputs>limits.inputs||
 !Number.isSafeInteger(graph.outputs)||graph.outputs<1||graph.outputs>limits.outputs||
 !Array.isArray(graph.layers)||graph.layers.length>limits.hidden||!Array.isArray(graph.biases)||
 graph.biases.length!==graph.layers.length+graph.outputs||!Array.isArray(graph.edges))throw new Error('Неверные размеры DAG.');
 const {inputs:I,outputs:O,layers,biases,edges}=graph,H=layers.length;
 let previous=0;
 for(const layer of layers){if(!Number.isSafeInteger(layer)||layer<1||layer>limits.layers||layer<previous||layer>previous+1)throw new Error('Неверный слой DAG.');previous=layer;}
 const level=id=>id<I?0:id<I+H?layers[id-I]:previous+1,seen=new Set();
 for(const bias of biases)if(!Number.isFinite(bias)||Math.abs(bias)>limits.weight)throw new Error('Неверное смещение DAG.');
 // Простая граница до обхода запрещает чрезмерный массив повторных рёбер.
 if(edges.length>(I+H)*(H+O))throw new Error('Слишком много связей DAG.');
 for(const edge of edges){const {from,to,weight}=edge??{},key=from+':'+to;
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||from>=I+H||to<I||to>=I+H+O||
  level(from)>=level(to)||seen.has(key)||!Number.isFinite(weight)||Math.abs(weight)>limits.weight)throw new Error('Недопустимая связь DAG.');
  seen.add(key);
 }
 return graph;
}

/** Параметры: смещения скрытых/выходов, затем веса рёбер в порядке файла.
 * План компилируется при рождении/загрузке, не на подшаге мира.
 * Достижимость определяется по структуре, а не текущему значению веса. */
export function compileDag(graph,limits=DAG_LIMITS){
 validateDag(graph,limits);
 const {inputs:I,outputs:O,layers,edges}=graph,H=layers.length,total=I+H+O;
 const incoming=Array.from({length:total},()=>[]);
 edges.forEach((edge,index)=>incoming[edge.to].push({from:edge.from,index:H+O+index}));
 const active=new Uint8Array(total);active.fill(1,I+H);
 for(let id=total-1;id>=I;id--)if(active[id])for(const edge of incoming[id])active[edge.from]=1;
 const nodes=[],activeParameters=[];let activeEdges=0;
 for(let id=I;id<total;id++)if(active[id]){
  nodes.push(id);activeParameters.push(id-I);activeEdges+=incoming[id].length;
  for(const edge of incoming[id])activeParameters.push(edge.index);
 }
 return {inputs:I,outputs:O,hidden:H,layers:layers.slice(),incoming,nodes,active,activeEdges,activeParameters,
  parameters:H+O+edges.length,operations:2*activeEdges+nodes.length+nodes.filter(id=>id<I+H).length};
}

export function dagParameters(graph){return Float64Array.from([...graph.biases,...graph.edges.map(edge=>edge.weight)]);}

/** Буфер можно переиспользовать только для этого размера сети. Входы
 * полностью переписываются, неисполняемые узлы не читаются. */
export function dagForward(plan,parameters,input,values=new Float64Array(plan.inputs+plan.hidden+plan.outputs)){
 if(parameters.length!==plan.parameters||input.length!==plan.inputs||values.length!==plan.inputs+plan.hidden+plan.outputs)throw new Error('Несогласованные буферы DAG.');
 values.set(input);
 const firstOutput=plan.inputs+plan.hidden;
 for(const id of plan.nodes){let value=parameters[id-plan.inputs];for(const edge of plan.incoming[id])value+=parameters[edge.index]*values[edge.from];values[id]=id<firstOutput?Math.tanh(value):value;}
 return {values,output:values.subarray(firstOutput)};
}

/** Градиент скалярной функции по параметрам/входу. Выходной градиент может
 * быть любым вектором: один исполнитель подходит разным головам сети. */
export function dagBackward(plan,parameters,values,outputGradient,
 gradient=new Float64Array(plan.parameters),inputGradient=new Float64Array(plan.inputs),
 derivatives=new Float64Array(values.length)){
 if(parameters.length!==plan.parameters||values.length!==plan.inputs+plan.hidden+plan.outputs||outputGradient.length!==plan.outputs||
 gradient.length!==plan.parameters||inputGradient.length!==plan.inputs||derivatives.length!==values.length)throw new Error('Несогласованные градиенты DAG.');
 gradient.fill(0);inputGradient.fill(0);derivatives.fill(0);
 const firstOutput=plan.inputs+plan.hidden;derivatives.set(outputGradient,firstOutput);
 for(let k=plan.nodes.length-1;k>=0;k--){const id=plan.nodes[k],d=derivatives[id]*(id<firstOutput?1-values[id]**2:1);
  gradient[id-plan.inputs]+=d;
  for(const edge of plan.incoming[id]){gradient[edge.index]+=d*values[edge.from];derivatives[edge.from]+=d*parameters[edge.index];}
 }
 inputGradient.set(derivatives.subarray(0,plan.inputs));return {gradient,inputGradient};
}
