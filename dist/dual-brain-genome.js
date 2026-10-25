import {EVOLUTION_RULES as R,MUTATION_GROUPS} from './brain-evolution-rules.js';
import {dualBrainLayout,unpackDualBrain,packDualBrain,ATTENTION_INPUTS} from './dual-brain-layout.js';
import {FIXED_PARAMETERS,STRUCTURAL_BLOCKS} from './structural-brain.js';
import {CONTEXT_INPUTS,CONTEXT_HIDDEN} from './temporal-layout.js';
import {validateDag} from './dag-network.js';
const LOG_MIN=Math.log(R.strengthFloor),LOG_MAX=Math.log(Number.MAX_VALUE),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const DUAL_MUTATION_SCHEMA='three-heritable-log-pairs-v1';

export function encodeMutationPair(rate,strength){
 if(!Number.isFinite(rate)||!Number.isFinite(strength)||rate<R.rateFloor||rate>1||strength<R.strengthFloor)throw new Error('Неверный профиль мутации.');
 const p=clamp((rate-R.rateFloor)/(1-R.rateFloor),Number.EPSILON,1-Number.EPSILON);
 return [Math.log(p/(1-p)),Math.log(strength)];
}
export function decodeMutationPair(pair){
 const [g,s]=pair,e=Math.exp(-Math.abs(g)),sigmoid=g>=0?1/(1+e):e/(1+e);
 return {rate:R.rateFloor+(1-R.rateFloor)*sigmoid,strength:Math.max(R.strengthFloor,Math.exp(s))};
}
export function dualMutationProfiles(genes){const l=dualBrainLayout(genes);if(!l)throw new Error('Нужен геном v15.');return Object.fromEntries(MUTATION_GROUPS.map((key,j)=>[key,decodeMutationPair(genes.slice(l.regulatorOffset+j*2,l.regulatorOffset+j*2+2))]));}

export function validateDualBrain(genes){
 const d=unpackDualBrain(genes);
 if(!Array.isArray(genes)||!genes.every(Number.isFinite)||d.fixed.length!==FIXED_PARAMETERS||d.traits.length!==12||
 [...d.fixed,...d.traits].some(v=>Math.abs(v)>R.weightLimit))throw new Error('Неверные параметры двух сетей.');
 validateDag(d.main);validateDag(d.attention);
 for(let j=0;j<6;j++)if(!Number.isFinite(d.regulators[j])||j%2&&(d.regulators[j]<LOG_MIN||d.regulators[j]>LOG_MAX))throw new Error('Неверные шесть регуляторов.');
 return d;
}

/** Плотность — процент от всех связей соседних непустых уровней, не шанс
 * независимого ребра. До 100% выбираются соседние, затем пропускающие.
 * Резервуар хранит только выбранные рёбра, не матрицу всех возможных. */
export function randomDag(inputs,outputs,counts,percent,random){
 if(!Array.isArray(counts)||counts.some(v=>!Number.isSafeInteger(v)||v<0)||!Number.isFinite(percent)||percent<0)throw new Error('Неверная начальная структура.');
 counts=counts.filter(Boolean);
 if(counts.length>R.technicalLayers||counts.reduce((a,b)=>a+b,0)>R.technicalNeurons)throw new Error('Превышен предел начальной структуры.');
 const sizes=[inputs,...counts,outputs],offsets=[0];for(let j=1;j<sizes.length;j++)offsets.push(offsets[j-1]+sizes[j-1]);
 let base=0,maximum=0;for(let a=0;a<sizes.length-1;a++)for(let b=a+1;b<sizes.length;b++){maximum+=sizes[a]*sizes[b];if(b===a+1)base+=sizes[a]*sizes[b];}
 if(percent>100*maximum/base+1e-9)throw new Error('Превышен процент возможных связей.');
 const amount=Math.min(maximum,Math.round(base*percent/100)),selected=[];
 for(const adjacent of [true,false]){
  const count=adjacent?Math.min(base,amount):Math.max(0,amount-base),sample=[];let seen=0;
  if(!count)continue;
  for(let a=0;a<sizes.length-1;a++)for(let b=a+1;b<sizes.length;b++)if((b===a+1)===adjacent)
  for(let i=0;i<sizes[a];i++)for(let j=0;j<sizes[b];j++){
   seen++;const index=sample.length<count?sample.length:Math.floor(random.next()*seen);
   if(index<count)sample[index]={from:offsets[a]+i,to:offsets[b]+j,scale:Math.sqrt(6/(sizes[a]+sizes[b]))};
  }
  selected.push(...sample);
 }
 selected.sort((a,b)=>a.to-b.to||a.from-b.from);
 return {inputs,outputs,layers:counts.flatMap((n,j)=>Array(n).fill(j+1)),biases:Array(counts.reduce((a,b)=>a+b,0)+outputs).fill(0),
 edges:selected.map(({from,to,scale})=>({from,to,weight:(random.next()*2-1)*scale}))};
}

export function randomDualGenome(random,settings={}){
 const fixed=Array(FIXED_PARAMETERS).fill(0);
 for(const b of STRUCTURAL_BLOCKS)for(let j=0;j<b.weights;j++)fixed[b.offset+j]=(random.next()*2-1)*Math.sqrt(6/(b.inputs+b.outputs));
 const main=randomDag(CONTEXT_INPUTS,CONTEXT_HIDDEN,settings.initialNeurons??R.initialNeurons,settings.initialConnections??R.initialConnections,random),
 attention=randomDag(ATTENTION_INPUTS,1,settings.attentionInitialNeurons??R.initialNeurons,settings.attentionInitialConnections??R.initialConnections,random);
 for(const [graph,prefix]of [[main,''],[attention,'attention']]){
  const maximum=settings[prefix?prefix+'MaxNeurons':'maxNeurons']??R.maxNeurons,
   depth=settings[prefix?prefix+'MaxLayers':'maxLayers']??R.maxLayers;
  if(!Number.isSafeInteger(maximum)||maximum<0||maximum>R.technicalNeurons||!Number.isSafeInteger(depth)||depth<0||depth>R.technicalLayers||graph.layers.length>maximum||Math.max(0,...graph.layers)>depth)throw new Error('Начальная сеть превышает заданные пределы.');
 }
 const regulators=MUTATION_GROUPS.flatMap(key=>{
  const initial=settings.initialMutation?.[key],rate=random.next(),strength=random.next();
  return encodeMutationPair(initial?.rate??(R.initialRateMin+rate*(R.initialRateMax-R.initialRateMin)),
   initial?.strength??(R.initialStrengthMin+strength*(R.initialStrengthMax-R.initialStrengthMin)));
 });
 const genes=packDualBrain({fixed,main,attention,traits:Array.from({length:12},()=>(random.next()-.5)*5),regulators});
 validateDualBrain(genes);return genes;
}

/** Округление несмещённое до технического ограничения; даже при огромной
 * силе цикл ограничен числом допустимых узлов/рёбер, а не значением гена. */
export function mutationBudget(strength,size,maximum,random){
 const expectation=Math.min(maximum,strength*Math.max(1,size));
 const whole=Math.floor(expectation),fraction=expectation-whole;
 return whole+(fraction>0&&random.next()<fraction?1:0);
}

function mutateTopology(graph,strength,random,maxNeurons,maxLayers){
 const I=graph.inputs,O=graph.outputs,H=graph.layers.length,E=graph.edges.length;
 let nodes=mutationBudget(strength*R.neuronScale,H,R.technicalNeurons,random),edges=mutationBudget(strength*R.edgeScale,E,(I+R.technicalNeurons)*(R.technicalNeurons+O),random);
 const pick=n=>Math.floor(random.next()*n);const protectedNodes=new Set();
 // ID переносится при вставке/удалении, поскольку узлы хранятся по слоям.
 for(let k=0;k<nodes;k++){
  const h=graph.layers.length,remove=random.next()<.5;
  if(remove&&h){const at=pick(h),id=I+at;
   graph.layers.splice(at,1);graph.biases.splice(at,1);
   graph.edges=graph.edges.filter(e=>e.from!==id&&e.to!==id).map(e=>({...e,from:e.from>id?e.from-1:e.from,to:e.to>id?e.to-1:e.to}));
   const update=[...protectedNodes].filter(v=>v!==id).map(v=>v>id?v-1:v);protectedNodes.clear();for(const v of update)protectedNodes.add(v);
  }else if(!remove&&h<maxNeurons&&maxLayers>0){
   const depth=Math.max(0,...graph.layers),newLayer=depth<maxLayers&&(depth===0||random.next()<.5),level=newLayer?1+pick(depth+1):graph.layers[pick(h)];
   if(newLayer)graph.layers=graph.layers.map(v=>v>=level?v+1:v);
   const index=graph.layers.findIndex(v=>v>level),at=index<0?h:index,id=I+at;
   graph.edges=graph.edges.map(e=>({...e,from:e.from>=id?e.from+1:e.from,to:e.to>=id?e.to+1:e.to}));
   const update=[...protectedNodes].map(v=>v>=id?v+1:v);protectedNodes.clear();for(const v of update)protectedNodes.add(v);protectedNodes.add(id);
   graph.layers.splice(at,0,level);graph.biases.splice(at,0,0);
   // Обязательная пара относится к атомарному добавлению, а не подавляет
   // рост из нуля из-за округлённого нулевого бюджета отдельных рёбер.
   let weight=(random.next()*2-1)*Math.sqrt(6/(I+h+1));if(weight===0)weight=R.newInputWeight;
   graph.edges.push({from:pick(I),to:id,weight},{from:id,to:I+h+1+pick(O),weight:0});
  }
  const levels=[...new Set(graph.layers)].sort((a,b)=>a-b);graph.layers=graph.layers.map(v=>levels.indexOf(v)+1);
 }
 const h=graph.layers.length,depth=Math.max(0,...graph.layers),level=id=>id<I?0:id<I+h?graph.layers[id-I]:depth+1;
 // Построить кандидатов один раз на рождение, не заново для каждого ребра.
 // Их число ограничено форматом; при заполненном графе цикл конечен.
 const existing=new Set(graph.edges.map(e=>e.from+':'+e.to)),available=[];
 if(edges)for(let from=0;from<I+h;from++)for(let to=I;to<I+h+O;to++)if(level(from)<level(to)&&!existing.has(from+':'+to))available.push({from,to});
 const removable=graph.edges.filter(e=>!protectedNodes.has(e.from)&&!protectedNodes.has(e.to)),removed=new Set(),added=[];
 for(let k=0;k<edges;k++){
  if(!removable.length&&!available.length)break;
  const pool=random.next()<.5?removable:available;
  if(!pool.length)continue;
  const at=pick(pool.length),edge=pool[at];pool[at]=pool.at(-1);pool.pop();
  if(pool===removable)removed.add(edge);else added.push({...edge,weight:0});
 }
 graph.edges=graph.edges.filter(edge=>!removed.has(edge));graph.edges.push(...added);
 return graph;
}

export function mutateDualGenome(parent,random,settings={}){
 const d=validateDualBrain(parent),profiles=dualMutationProfiles(parent);
 const mutate=(value,profile)=>random.next()<profile.rate?clamp(value+(random.next()*2-1)*profile.strength,-R.weightLimit,R.weightLimit):value;
 d.fixed=d.fixed.map(v=>mutate(v,profiles.main));d.traits=d.traits.map(v=>mutate(v,profiles.behavior));
 // Выходные смещения контекста живут в fixed: не мутировать их вторично.
 for(let j=0;j<d.main.layers.length;j++)d.main.biases[j]=mutate(d.main.biases[j],profiles.main);
 d.main.biases.splice(d.main.layers.length,CONTEXT_HIDDEN,...d.fixed.slice(STRUCTURAL_BLOCKS[1].bias,STRUCTURAL_BLOCKS[1].bias+CONTEXT_HIDDEN));
 for(const edge of d.main.edges)edge.weight=mutate(edge.weight,profiles.main);
 d.attention.biases=d.attention.biases.map(v=>mutate(v,profiles.attention));for(const edge of d.attention.edges)edge.weight=mutate(edge.weight,profiles.attention);
 for(let group=0;group<3;group++)for(let j=0;j<2;j++){
  const index=2*group+j,profile=profiles[MUTATION_GROUPS[group]];
  if(random.next()<profile.rate){const delta=(random.next()*2-1)*Math.log1p(profile.strength);d.regulators[index]=clamp(d.regulators[index]+delta,j?LOG_MIN:-Number.MAX_VALUE,j?LOG_MAX:Number.MAX_VALUE);}
 }
 const limits=(key,fallback)=>{const value=settings[key]??fallback;if(!Number.isSafeInteger(value)||value<0||value>(key.endsWith('Layers')?R.technicalLayers:R.technicalNeurons))throw new Error('Неверный предел структуры.');return value;};
 if(settings.structuralMutations!==false){
  if(random.next()<profiles.main.rate)mutateTopology(d.main,profiles.main.strength,random,limits('maxNeurons',R.maxNeurons),limits('maxLayers',R.maxLayers));
  if(random.next()<profiles.attention.rate)mutateTopology(d.attention,profiles.attention.strength,random,limits('attentionMaxNeurons',R.maxNeurons),limits('attentionMaxLayers',R.maxLayers));
 }
 const genes=packDualBrain(d);validateDualBrain(genes);return genes;
}
