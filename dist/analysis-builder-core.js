import {compileExpression} from './analysis-expression.js';
import {createWorldEstimator,bootstrapDraws,quantile,MIN_CONFIDENCE_WORLDS} from './statistics-estimates.js';
export const ANALYSIS_TEMPLATE_VERSION=1;
export const ANALYSIS_FIELDS=Object.freeze([
 ...[['brainNeurons','Скрытые нейроны'],['brainConnections','Связи контекста'],['brainLayers','Скрытые слои'],['brainActiveNeurons','Действующие нейроны'],['brainActiveConnections','Действующие связи'],['structuralRate','Вероятность структурной мутации, %']].map(([key,label])=>['heritable.'+key,label]),
 ['age','Возраст, Т'],['children','Прямые дети'],['born','Время рождения, Т'],['generation','Поколение'],['firstBirthAge','Возраст первого рождения, Т'],
 ['meanEnergy','Средняя энергия'],['meanHealth','Среднее здоровье'],['meanFeeling','Среднее самочувствие'],['eaten','Съеденные порции'],['moved','Перемещения'],['gathered','Подобранные порции'],['deposited','Выложенные порции'],['emptyEnergySteps','Подшаги с нулевой энергией'],['observedSteps','Подшаги наблюдения'],['learningUpdates','Обновления обучения'],['shortPlaces','Места в краткой памяти'],['longPlaces','Места в долгой памяти'],['maxStepsWithoutEating','Максимальный перерыв в еде, Т'],['observations.meanInventory','Средний переносимый запас'],['observations.brainEnergyCost','Стоимость мышления, энергии'],['observations.brainCalls','Вызовы основного мозга']
 ,['observations.reviews','Пересмотры'],['observations.interruptions.voluntary','Добровольные отмены'],['observations.interruptions.physical','Физические срывы'],['heritable.senseEnergy','Чувствительность к энергии, %'],['heritable.senseHealth','Чувствительность к здоровью, %'],['heritable.senseStomach','Чувствительность к желудку, %'],['heritable.shortCapacity','Ёмкость краткой памяти'],['heritable.longCapacity','Ёмкость долгой памяти'],['heritable.mutationRate','Вероятность мутации, %'],['heritable.mutationStrength','Сила мутации']
]);
export const ANALYSIS_DEFAULT=Object.freeze({name:'Продолжительность жизни',expression:'age',filter:'true',aggregate:'mean',group:'learning',split:'',axis:'born',start:0,end:20000,width:500,maxChild:4,mode:'dead',origin:'all',weight:'worlds',chart:'line',confidence:true,variantFilters:[]});
export function validateAnalysis(input){
 if(!input||typeof input!=='object')throw new Error('Нужен шаблон анализа.');
 const c={};for(const key of Object.keys(ANALYSIS_DEFAULT))c[key]=input[key]===undefined?ANALYSIS_DEFAULT[key]:input[key];
 for(const key of ['name','expression','filter','group','split','axis'])if(typeof c[key]!=='string'||c[key].length>600)throw new Error('Некорректное текстовое поле.');
 if(!c.name.trim()||c.name.length>100)throw new Error('Название — от 1 до 100 символов.');
 for(const [key,values]of Object.entries({aggregate:['mean','median','sum','count','percent'],mode:['dead','all'],origin:['all','founders','descendants'],weight:['worlds','individuals'],chart:['line','bar','table']}))if(!values.includes(c[key]))throw new Error('Неизвестная настройка '+key);
 for(const key of ['start','end','width','maxChild'])if(!Number.isFinite(c[key]))throw new Error('Времена должны быть конечными числами.');
 if(c.start<0||c.end<=c.start||c.width<=0||!Number.isInteger(c.maxChild)||c.maxChild<1||c.maxChild>20)throw new Error('Проверь период, ширину интервала и число детей (1–20).');
 if(typeof c.confidence!=='boolean'||!Array.isArray(c.variantFilters)||c.variantFilters.length>64)throw new Error('Некорректные фильтры.');
 c.variantFilters=c.variantFilters.map(f=>{if(typeof f?.key!=='string'||!Array.isArray(f.values)||f.values.length>64||f.values.some(v=>!['string','number','boolean'].includes(typeof v)))throw new Error('Некорректный фильтр вариантов.');return {key:f.key,values:f.values.slice()};});
 const value=compileExpression(c.expression),filter=compileExpression(c.filter);const fields=new Set([...value.fields,...filter.fields]);
 for(const field of fields)if(field!=='N'&&!ANALYSIS_FIELDS.some(f=>f[0]===field))throw new Error('Неизвестное поле: '+field);
 if(c.axis!=='child'&&fields.has('N'))throw new Error('N доступно только на оси «Номер ребёнка».');
 return c;
}
export const analysisSetting=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
const planViews=new WeakMap();
/** Тысячи генов заменяются именем категории один раз перед передачей плана. */
export function analysisPlan(plan){
 if(plan.analysisView)return plan;if(planViews.has(plan))return planViews.get(plan);
 const factors=(plan.factors??[]).map(f=>({key:f.key,values:f.key==='baseGenome'?f.values.map((v,i)=>`${i+1} · ${v.name}`):f.values.slice()}));
 const variants=plan.variants.map(v=>{const settings={};for(const f of factors){let value=analysisSetting(v.settings,f.key);
   if(f.key==='baseGenome'){const choices=plan.factors.find(p=>p.key===f.key).values,index=choices.findIndex(g=>g.genes?.length===value?.length&&g.genes.every((gene,i)=>gene===value[i]));if(index<0)throw new Error('Геном варианта отсутствует в описании факторов.');value=f.values[index];}
   const keys=f.key.split('.');let at=settings;for(const key of keys.slice(0,-1))at=at[key]??={};at[keys.at(-1)]=value;
  }settings.variant=v.id;return {id:v.id,name:v.name,settings};});
 factors.push({key:'variant',values:variants.map(v=>v.id)});const view={analysisView:true,worlds:plan.worlds,factors,variants};planViews.set(plan,view);return view;
}
export function analysisVariants(plan,c){return plan.variants.filter(v=>c.variantFilters.every(f=>f.values.includes(analysisSetting(v.settings,f.key))));}
const label=v=>v===undefined?'Не задано':typeof v==='boolean'?(v?'вкл':'выкл'):String(v);
export function analysisLayout(plan,c){
 const variants=analysisVariants(plan,c);if(!variants.length)throw new Error('Фильтры исключили все варианты.');
 const keys=new Set((plan.factors??[]).map(f=>f.key));
 for(const key of [c.group,c.split,...c.variantFilters.map(f=>f.key),...(['born','child'].includes(c.axis)?[]:[c.axis])])if(key&&!keys.has(key))throw new Error('Параметр отсутствует среди отличий этого опыта: '+key);
 const groupMap=new Map(),variantGroups=new Map();
 for(const v of variants){const parts=[c.group,c.split].filter(Boolean).map(k=>[k,analysisSetting(v.settings,k)]),id=JSON.stringify(parts);if(!groupMap.has(id))groupMap.set(id,{id,label:parts.length?parts.map(([k,val])=>`${k}: ${label(val)}`).join(' · '):'Все выбранные варианты',variants:[]});groupMap.get(id).variants.push(v.id);variantGroups.set(v.id,id);}
 let xs;if(c.axis==='born'){const count=Math.ceil((c.end-c.start)/c.width);if(count>400)throw new Error('Слишком много точек: увеличь ширину интервала.');xs=Array.from({length:count},(_,i)=>({key:i,x:(c.start+i*c.width+Math.min(c.end,c.start+(i+1)*c.width))/2,label:`[${c.start+i*c.width}; ${Math.min(c.end,c.start+(i+1)*c.width)}) Т`}));}
 else if(c.axis==='child')xs=Array.from({length:c.maxChild},(_,i)=>({key:i+1,x:i+1,label:String(i+1)}));
 else xs=[...new Set(variants.map(v=>analysisSetting(v.settings,c.axis)))].sort((a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b))).map((v,i)=>({key:JSON.stringify(v),x:typeof v==='number'?v:i,label:label(v)}));
 if(xs.length*groupMap.size>600)throw new Error('Больше 600 ячеек анализа: сузь период, укрупни интервалы или сократи группы.');
 return {variants,groups:[...groupMap.values()],variantGroups,xs};
}
function birthIndex(timeline,ids){
 const children=new Map(),parents=new Map(),seen=new Set(),wanted=new Set(ids);if(!timeline)return ()=>null;
 for(let i=0;i<timeline.id.length;i++){const id=timeline.id[i];if(!Number.isSafeInteger(id)||seen.has(id))throw new Error('Некорректные или повторные ID жизней.');seen.add(id);if(wanted.has(id))parents.set(id,{born:timeline.born[i],count:timeline.children[i]});const parent=timeline.parent[i];if(wanted.has(parent)){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(timeline.born[i]);}}
 for(const values of children.values())values.sort((a,b)=>a-b);
 return (id,n)=>{const p=parents.get(id),values=children.get(id)??[];if(!p||values.length!==p.count||values.length<n)return null;const age=values[n-1]-p.born;return Number.isFinite(age)&&age>=0?age:null;};
}
function groupEstimator(worlds,mode,stat){
 if(stat==='median')return createWorldEstimator(worlds,mode);if(!worlds.length)return null;
 // Среднему не нужны сортировка, копия объединённой выборки и CDF медианы.
 const summaries=worlds.map(w=>{let sum=0;for(const value of w.values)sum+=value;if(!Number.isFinite(sum))throw new Error('Слишком большие числа для агрегирования.');return {sum,n:w.values.length};});
 const summarize=counts=>{let sum=0,mass=0;for(let i=0;i<summaries.length;i++){const w=summaries[i],weight=mode==='worlds'?counts[i]/w.n:counts[i];sum+=weight*w.sum;mass+=weight*w.n;}return {mean:sum/mass};};return {summarize,center:summarize(new Uint16Array(worlds.length).fill(1))};
}
/** Одна серия наблюдателя. Все варианты одного исходного повтора всегда
 * перевыбираются совместно; число уровней фактора не увеличивает n. */
export function createAnalysisEngine(plan,input){
 const c=validateAnalysis(input),layout=analysisLayout(plan,c),expr=compileExpression(c.expression),filter=compileExpression(c.filter),cells=new Map();
 const cellKey=(group,x)=>JSON.stringify([group,x]),childKeys=layout.xs.map(x=>x.key);
 for(const group of layout.groups)for(const x of layout.xs){const expected=group.variants.filter(id=>c.axis==='born'||c.axis==='child'||JSON.stringify(analysisSetting(layout.variants.find(v=>v.id===id).settings,c.axis))===x.key);if(expected.length)cells.set(cellKey(group.id,x.key),{group:group.id,x:x.key,expected,worlds:[]});}
 function add(meta,p){
  const group=layout.variantGroups.get(meta.variantId);if(!group)return;
  const variant=layout.variants.find(v=>v.id===meta.variantId),target=c.axis==='born'?null:c.axis==='child'?null:JSON.stringify(analysisSetting(variant.settings,c.axis));
  const buckets=new Map();for(const x of layout.xs)if(target===null||target===x.key)buckets.set(x.key,{values:[],eligible:0,living:0});
  const birth=p?.timeline?birthIndex(p.timeline,p.columns.id):()=>null,n=p?.eligible??0;
  for(let i=0;i<n;i++){
   const born=p.columns.born[i],id=p.columns.id[i];
   const xs=c.axis==='born'?[Math.floor((born-c.start)/c.width)]:c.axis==='child'?childKeys:[target];
   for(const x of xs){const bucket=buckets.get(x);if(!bucket)continue;const get=k=>k==='N'?x:Number.isFinite(p.columns[k]?.[i])?p.columns[k][i]:null,getBirth=num=>birth(id,num);if(!filter.evaluate(get,getBirth))continue;bucket.eligible++;bucket.living+=Number(p.columns.alive?.[i]===1);const value=expr.evaluate(get,getBirth);if(value!==null)bucket.values.push(c.aggregate==='percent'?Number(Boolean(value))*100:value);}
  }
  for(const [x,bucket]of buckets){const count=bucket.values.length;let values=bucket.values;
   if(c.aggregate==='count')values=p?[bucket.eligible]:[];
   if(c.aggregate==='sum')values=p&&(!bucket.eligible||count)?[values.reduce((a,b)=>a+b,0)]:[];
   cells.get(cellKey(group,x))?.worlds.push({...meta,values,count,eligible:bucket.eligible,living:bucket.living,missing:bucket.eligible-count,incomplete:!p||Boolean(p.omitted)});
  }
 }
 function finish(){
  const results=[];for(const cell of cells.values()){
   const byRepeat=new Map();for(const w of cell.worlds){if(!byRepeat.has(w.pairId))byRepeat.set(w.pairId,[]);byRepeat.get(w.pairId).push(w);}
   const included=[],excluded=[];for(let pairId=0;pairId<plan.worlds;pairId++){const ws=byRepeat.get(pairId)??[];const missing=cell.expected.filter(id=>!ws.some(w=>w.variantId===id&&!w.incomplete&&w.values.length));if(missing.length)excluded.push({pairId,variants:missing});else included.push({pairId,worlds:ws});}
   const worlds=included.flatMap(p=>p.worlds),mode=['sum','count'].includes(c.aggregate)?'worlds':c.weight,stat=c.aggregate==='median'?'median':'mean',estimator=groupEstimator(worlds,mode,stat);
   let interval=null,reason=estimator?null:'Нет полного исходного повтора с данными всех включённых вариантов.';
   if(estimator&&c.confidence&&included.length>=MIN_CONFIDENCE_WORLDS){const indices=new Map(included.map((p,i)=>[p.pairId,i])),sample=[];const memo=new Map();for(const counts of bootstrapDraws(included.length)){const key=counts.join(',');let value=memo.get(key);if(value===undefined){value=estimator.summarize(Uint16Array.from(worlds.map(w=>counts[indices.get(w.pairId)])))[stat];memo.set(key,value);}sample.push(value);}sample.sort((a,b)=>a-b);interval={low:quantile(sample,.025),high:quantile(sample,.975)};}
   if(estimator&&included.length<MIN_CONFIDENCE_WORLDS)reason=`ДИ недоступен: ${included.length} повторов, требуется ${MIN_CONFIDENCE_WORLDS}.`;
   else if(estimator&&included.length<10)reason='Мало независимых повторов: доверительный интервал приблизителен.';
   if(interval&&interval.low===interval.high)reason='Нулевой наблюдаемый разброс не доказывает точность оценки.';
   const details=cell.worlds.map(w=>({id:w.id,variantId:w.variantId,pairId:w.pairId,seed:w.seed,number:w.number,extinctions:w.extinctions,eligible:w.eligible,count:w.count,missing:w.missing,living:w.living,included:included.some(p=>p.pairId===w.pairId)}));
   results.push({group:cell.group,x:cell.x,value:estimator?.center[stat]??null,interval,reason,repeats:included.length,worlds:worlds.length,count:worlds.reduce((n,w)=>n+w.count,0),eligible:worlds.reduce((n,w)=>n+w.eligible,0),excluded,details});
  }return {config:c,groups:layout.groups,xs:layout.xs,cells:results};
 }
 return {add,finish};
}
