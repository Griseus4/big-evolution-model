import {STRUCTURAL_TYPE,structuralLayout,structuralData,STRUCTURAL_BLOCKS,FIXED_PARAMETERS,structureCounts} from './structural-brain.js';
import {DUAL_BRAIN_TYPE,unpackDualBrain} from './dual-brain-layout.js';
import {DUAL_METRICS,dualHeritable} from './dual-brain-statistics.js';
import {EVOLUTION_RULES} from './brain-evolution-rules.js';
import {TEMPORAL_BRAIN_TYPE,TEMPORAL_TRAIT_INDICES,temporalParameterLabel,GATE_OFFSET,GATE_NAMES,GATE_INPUTS,GATE_HIDDEN,GATE_PARAMETERS,GATE_HIDDEN_BIAS,GATE_OUTPUT_WEIGHTS,GATE_OUTPUT_BIAS} from './temporal-layout.js';
import {SET_BRAIN_TYPE,setParameterLabel} from './set-brain-layout.js';
/** Чистая расшифровка/сравнение экспортов. Не создаёт Evolution, не расходует RNG,
 * не меняет исходный файл. Версия определяет шаг строки и наличие общих генов.
 * Нулевое расширение для импорта используется только внутри общей формулы шкал;
 * отсутствовавшие в оригинале свойства остаются явно отсутствующими в отчёте.
 */
import {ACTIONS} from './action-catalog.js';
import {validateGenomeFile} from './genome.js';
import {STATE_COUNT} from './policy-layout.js';
import {COGNITIVE_GENES,cognitiveTraits,TRAIT_SCALE_VERSION,BODY_GENES,BODY_SENSE_VERSION} from './brain-parameters.js';
import {NEURAL_BRAIN_TYPE,NEURAL_INPUT_NAMES,INPUT_COUNT,HIDDEN_COUNT,PARAMETER_COUNT,HIDDEN_BIAS,OUTPUT_WEIGHTS,OUTPUT_BIAS,TRAIT_OFFSET,NEURAL_TRAIT_INDICES,NETWORK_SCHEMA,layoutForGenes} from './neural-layout.js';
import {neuralTraits} from './neural-brain.js';
import {mutationProfile,mutationOffset,MUTATION_SCHEMA} from './mutation-parameters.js';
export const GENOME_ANALYSIS_VERSION=3,MAX_GENOME_BYTES=EVOLUTION_RULES.maxGenomeFileBytes;
const MOTION=[
 {key:'visibleFood',label:'Видимая пища',description:'Добавка к оценке шага в соседнюю клетку с пищей.'},
 {key:'visibleRisk',label:'Видимый опасный рельеф',description:'Добавка к оценке шага в опасный рельеф; это не сама вероятность урона.'},
 {key:'repeat',label:'Повтор номера движения',description:'Добавка за повтор того же относительного действия; не проверка прямой мировой траектории.'},
];
const DERIVED={learningRate:['alpha','коэффициент'],forgetting:['forgetting','доля / обновление'],trace:['trace','коэффициент'],discount:['discount','коэффициент'],memoryAge:['memoryAge','шаги'],shortCapacity:['shortCapacity','мест'],longCapacity:['longCapacity','мест'],consolidation:['consolidationThreshold','сила'],longPersistence:['longRetention','шаги']};
const DESCRIPTIONS={
 energy:'Чувствительность к энергии: положительный знак повышает чувство при росте энергии.',
 health:'Чувствительность к здоровью: положительный знак повышает чувство при росте здоровья.',
 pain:'Чувствительность к боли: положительный знак повышает чувство от боли, отрицательный снижает. Это не доказательство поиска боли.',
 stomach:'Чувствительность к пище в желудке. Подбор пищи сам по себе не насыщает.',
 learningRate:'Скорость обновления критика. Больше не обязательно означает лучшее обучение.',
 forgetting:'Экспоненциальное ослабление приобретённых оценок при обновлениях.',
 trace:'Затухание связи с прежними решениями; совместное затухание равно след × дисконт.',
 discount:'Вес будущих оценок. Это не измеренная способность планировать.',
 memoryAge:'Экспоненциальный масштаб устаревания наблюдений; не срок автоматического удаления места.',
 foodMemory:'Вес градиента запомненной пищи. Положительный знак поддерживает приближение, отрицательный снижает его оценку.',
 riskMemory:'Вес известных повреждений в рассматриваемом месте. Положительный знак повышает его оценку.',
 unknown:'Вес лично непосещённого места; наблюдение соседней клетки не означает посещение.',
 revisit:'Вес неопределённости содержания давно замеченного пищевого места.',
 hungryFood:'Дополнительный вес приближения к памяти пищи, умноженный на нехватку энергии.',
 hungryRisk:'Дополнительный вес известных повреждений, умноженный на нехватку энергии.',
 shortCapacity:'Максимальное число кратких записей. Текущее заполнение в геноме отсутствует.',
 longCapacity:'Максимальное число закреплённых записей. Это не измеренный объём знаний.',
 consolidation:'Порог закрепления переживаний. Ниже — закрепление при меньшей значимости.',
 longPersistence:'Экспоненциальный масштаб затухания значимости долгой памяти; не гарантия хранения ровно столько шагов.',
};
const LAYOUTS=Object.freeze({
 1:{columns:9,cognitive:0},2:{columns:9,cognitive:15},3:{columns:9,cognitive:19},4:{columns:10,cognitive:19},5:{columns:11,cognitive:19},6:{columns:11,cognitive:19,body:true},
});
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const sign=value=>value===null?'отсутствует':value>0?'положительный':value<0?'отрицательный':'нейтральный';
export const formatGeneNumber=value=>value===null||value===undefined?'—':value===0?'0':Number(value).toLocaleString('ru-RU',{maximumSignificantDigits:5});

/** Порядок строки известен табличному мозгу. Подписи — описание соглашения,
 * не наблюдаемое состояние сохранённой особи: файл не хранит её тело.
 */
function stateDescription(row){
 const stomach=row%2,pain=Math.floor(row/2)%2,food=Math.floor(row/4)%2,inventory=Math.floor(row/8)%2,energy=Math.floor(row/16);
 return {energy,inventory,food,pain,stomach,label:`${['низкая','средняя','высокая'][energy]} энергия · ${inventory?'есть':'нет'} еды при себе · ${food?'есть':'нет'} еды здесь · ${pain?'есть':'нет'} боль · ${stomach?'есть':'нет'} пища в желудке`};
}
/** Конверсия текста ограничена размером ещё до JSON.parse. Ошибка не становится
 * частично импортированным геномом и не запускает новый опыт.
 */
export function parseGenomeText(text,metadata={}){
 if(typeof text!=='string')throw new Error('Нужен текст JSON генома.');
 if(new TextEncoder().encode(text).byteLength>MAX_GENOME_BYTES)throw new Error('Геном превышает допустимый размер файла.');
 let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('Файл не является корректным JSON.');}
 return analyzeGenome(data,metadata);
}
export function analyzeGenome(data,{name='Геном',sha256=null}={}){
 // Валидатор общий с игрой, включая диапазон чисел и точные размеры v1…v6.
 const canonical=validateGenomeFile(data);
 if(data.version===9||(data.version===11||data.version===13||data.version===14)&&mutationOffset(data.genes)!==null){
  const offset=mutationOffset(data.genes),layout=layoutForGenes(data.genes);
  const result=layout?analyzeNeuralGenome(data,{name,sha256}):analyzeGenome({...data,version:6,genes:data.genes.slice(0,offset)},{name,sha256});
  const profile=mutationProfile(data.genes);
  result.genomeVersion=data.version;result.geneCount=data.genes.length;result.mutation=profile;
  result.properties.push(
   {key:'mutationRate',label:'Вероятность мутации',group:'Наследуемая изменчивость',description:'Лог-координата вероятности с ненулевым фоном; применяется к потомству, не к личному обучению.',present:true,index:offset,raw:data.genes[offset],derived:profile.rate*100,unit:'% / ген',share:null},
   {key:'mutationStrength',label:'Сила мутации',group:'Наследуемая изменчивость',description:'Логарифм максимальной прибавки к параметру мозга; общие свойства меняются меньшими шагами, регуляторы — относительно величины.',present:true,index:offset+1,raw:data.genes[offset+1],derived:profile.strength,unit:'максимум ±',share:null});
  result.insights.push(`Наследуемая вероятность ${(profile.rate*100).toPrecision(4)}% на ген; сила ±${profile.strength.toPrecision(4)}. Это свойства будущего потомства, не качество мозга.`);
  return result;
 }
 if(data.version>=7)return analyzeNeuralGenome(data,{name,sha256});
 const layout=LAYOUTS[data.version];
 if(!layout)throw new Error('Неизвестная схема генома.');
 const traits=cognitiveTraits(canonical),normalizer=traits.values.reduce((sum,v)=>sum+Math.abs(v),0);
 const properties=MOTION.map((gene,i)=>({
  ...gene,group:'Движение',present:true,index:STATE_COUNT*layout.columns+i,raw:data.genes[STATE_COUNT*layout.columns+i],derived:null,unit:'вес',share:null,
 }));
 for(const [i,gene]of COGNITIVE_GENES.entries()){
  const present=i<layout.cognitive,index=present?STATE_COUNT*layout.columns+3+i:null,raw=present?data.genes[index]:null,conversion=DERIVED[gene.key];
  properties.push({key:gene.key,label:gene.label,group:i<4?'Ощущения':conversion?'Память и обучение':'Пространственные склонности',description:DESCRIPTIONS[gene.key],present,index,raw,
   derived:present&&conversion?traits[conversion[0]]:null,unit:conversion?.[1]??'вес',share:present&&i<4?(normalizer?raw/normalizer:0):null});
 }
 // Старый геном не получал этих весов: показываем отсутствие, а не нуль,
 // которым игра нейтрально расширит его при импорте для НОВОЙ жизни.
 for(const gene of BODY_GENES){
  const present=Boolean(layout.body);
  properties.push({key:gene.key,label:`${ACTIONS[gene.action]} · ${gene.label}`,group:'Ощущения тела по действиям',
   description:`Добавка к оценке «${ACTIONS[gene.action]}»: вес × ${gene.feature===0?'переносимые порции / вместимость':'содержимое желудка / вместимость'}. Положительный знак повышает оценку при большем заполнении, отрицательный снижает; это не вероятность и не награда.`,
   present,index:present?gene.index:null,raw:present?data.genes[gene.index]:null,derived:null,unit:'вес',share:null});
 }
 const warnings=[
  'Геном содержит наследуемые склонности, но не личные TD-поправки, воспоминания, маршрут, возраст или текущее тело.',
  'Веса не являются вероятностями действий. Физическая доступность, наблюдения и опыт могут изменить итоговый выбор.',
  'Поколение и число детей при экспорте не доказывают универсальную выживаемость; для неё нужны сопоставимые испытания.',
 ];
 const context=data.policyContext&&typeof data.policyContext==='object'?data.policyContext:{};
 const bodySenseKnown=!context.bodySenses||context.bodySenses===BODY_SENSE_VERSION;
 if(layout.body&&!context.bodySenses)warnings.push(`Шкала ощущений тела не указана: предполагается ${BODY_SENSE_VERSION}.`);
 if(layout.body&&!bodySenseKnown)warnings.push('Шкала ощущений тела неизвестна: сырые веса сохранены, их интерпретация и сравнение отключены.');
 if(!bodySenseKnown)for(const p of properties)if(p.key.startsWith('body-'))p.description='Неизвестная шкала ощущений тела; смысл числового множителя не восстановлен.';
 if(context.traitScale&&context.traitScale!==TRAIT_SCALE_VERSION){
  for(const property of properties){property.derived=null;property.share=null;}
  warnings.push('Файл указывает неизвестную шкалу параметров. Сырые числа показаны, пересчёт скоростей/вместимости и долей ощущений отключён.');
 }else if(!context.traitScale)warnings.push(`Файл не указывает шкалу параметров: пересчёт по поддерживаемой ${TRAIT_SCALE_VERSION}. Это не восстановление всех исторических правил мира.`);
 const stateKnown=!context.stateEncoding||context.stateEncoding==='energy-inventory-food-pain-stomach-v1';
 if(!context.directions)warnings.push('Система направлений в файле не указана: названия колонок по поддерживаемой схеме. В старых реализациях направления могли быть мировыми; оригинальная навигация не восстановлена.');
 if(!context.stateEncoding)warnings.push('Файл не указывает кодирование состояния: подписи строк по известному соглашению табличного мозга. Пороги действующей модели — энергия <30, <70, ≥70; историческое тело не восстановлено.');
 if(!stateKnown)warnings.push('Неизвестное кодирование состояний: строки и веса сохранены, описания состояния отключены.');
 const policy=Array.from({length:STATE_COUNT},(_,row)=>({row,state:stateKnown?stateDescription(row):null,scores:data.genes.slice(row*layout.columns,(row+1)*layout.columns)}));
 const source={};for(const key of ['seed','tick','id','generation','children'])source[key]=finite(data.source?.[key])?data.source[key]:null;
 const rules={};for(const [key,value]of Object.entries(data.rules??{}))if(finite(value))rules[key]=value;
 const environment={};for(const key of ['scenario','generation','sourceCount','regrowInterval','initialFood','islandCount','synchronized','capacityMin','capacityMax']){
  const value=data.environment?.[key];if(typeof value==='string'||typeof value==='boolean'||finite(value))environment[key]=value;
 }
 const insights=[];
 const property=key=>properties.find(p=>p.key===key);
 for(const key of ['visibleFood','visibleRisk','repeat','foodMemory','riskMemory','unknown','pain']){
  const p=property(key);if(p.present)insights.push(`${p.label}: ${formatGeneNumber(p.raw)} (${sign(p.raw)} вес). ${p.description}`);
 }
 if(property('shortCapacity').derived!==null)insights.push(`Лимиты памяти: краткая ${traits.shortCapacity}, долгая ${traits.longCapacity} мест. Текущее заполнение не сохранено.`);
 return {name:String(name).slice(0,200),sha256:typeof sha256==='string'&&/^[a-f0-9]{64}$/i.test(sha256)?sha256:null,genomeVersion:data.version,geneCount:data.genes.length,columns:layout.columns,stateEncoding:context.stateEncoding??'energy-inventory-food-pain-stomach-v1',stateKnown,
  bodySenseKnown,bodySenseEncoding:context.bodySenses??BODY_SENSE_VERSION,
  modelVersion:typeof data.modelVersion==='string'?data.modelVersion.slice(0,40):null,brainType:data.brainType??null,traitScale:context.traitScale??TRAIT_SCALE_VERSION,actions:ACTIONS.slice(0,layout.columns),source,rules,environment,properties,policy,insights,warnings};
}
/** Сравниваем по смысловым ключам и номеру строки/действия, не по одинаковому
 * абсолютному индексу: он изменился при добавлении рождения и выкладывания.
 * Отсутствующий ген — null, не нуль. Разность всегда B − A; это не оценка качества.
 */
export function compareGenomes(a,b){
 if(a.network||b.network)return compareNeuralGenomes(a,b);
 const policyComparable=a.stateKnown&&b.stateKnown&&a.stateEncoding===b.stateEncoding;
 const differences=[];let shared=0,changed=0,absoluteTotal=0;
 const add=(id,label,rawA,rawB,extra={})=>{
  const comparable=rawA!==null&&rawB!==null&&extra.comparable!==false,delta=comparable?rawB-rawA:null;
  if(comparable){shared++;absoluteTotal+=Math.abs(delta);if(delta!==0)changed++;}
  differences.push({id,label,a:rawA,b:rawB,delta,...extra});
 };
 const columns=Math.max(a.columns,b.columns),policy=[];
 for(let row=0;row<STATE_COUNT;row++){
  const cells=[];
  for(let action=0;action<columns;action++){
   const rawA=a.policy[row].scores[action]??null,rawB=b.policy[row].scores[action]??null;
   add(`policy-${row}-${action}`,`Строка ${row} · ${ACTIONS[action]}`,rawA,rawB,{group:'Политика',row,action,comparable:policyComparable});
   cells.push(!policyComparable||rawA===null||rawB===null?null:rawB-rawA);
  }
  policy.push({row,state:a.policy[row].state??b.policy[row].state,deltas:cells});
 }
 const propertyKeys=[...new Set([...a.properties.map(p=>p.key),...b.properties.map(p=>p.key)])];
 const properties=propertyKeys.map(key=>{
  const known=a.properties.find(p=>p.key===key)??b.properties.find(p=>p.key===key);
  const absent={...known,raw:null,derived:null,present:false};
  const p=a.properties.find(p=>p.key===key)??absent,other=b.properties.find(p=>p.key===key)??absent;
  const comparable=!p.key.startsWith('body-')||(a.bodySenseKnown&&b.bodySenseKnown&&a.bodySenseEncoding===b.bodySenseEncoding);
  add(p.key,p.label,p.raw,other.raw,{group:p.group,comparable});
  const derivedComparable=p.present&&other.present&&p.derived!==null&&other.derived!==null&&a.traitScale===b.traitScale;
  return {key:p.key,label:p.label,a:p.raw,b:other.raw,delta:!comparable||p.raw===null||other.raw===null?null:other.raw-p.raw,
   derivedA:p.derived,derivedB:other.derived,derivedDelta:derivedComparable?other.derived-p.derived:null,unit:p.unit};
 });
 const changedRows=policy.filter(row=>row.deltas.some(delta=>delta!==null&&delta!==0)).length;
 const ranked=differences.filter(row=>row.delta!==null&&row.delta!==0).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
 return {direction:'B − A',sharedGenes:shared,changedGenes:changed,onlyA:differences.filter(row=>row.a!==null&&row.b===null).length,onlyB:differences.filter(row=>row.b!==null&&row.a===null).length,
  meanAbsoluteRawDifference:shared?absoluteTotal/shared:null,policyComparable,changedPolicyRows:policyComparable?changedRows:null,columns,policy,properties,differences,rankedDifferences:ranked,
  note:(policyComparable?'При неполном контексте сравнение выполнено по поддерживаемой структуре схемы, не по восстановленному историческому поведению. ':'Кодирование состояний неизвестно или различается: политика не сопоставлена. ')+'Различия сырых генов показывают различия параметров, не преимущество одного генома и не причинный эффект мутаций.'};
}
export function makeGenomeAnalysisReport(genomes,{createdAt=new Date().toISOString(),slotLabels=null}={}){
 if(!Array.isArray(genomes)||!genomes.length||genomes.length>2)throw new Error('Нужен один или два разобранных генома.');
 return {format:'big-evolution-genome-analysis',version:GENOME_ANALYSIS_VERSION,createdAt,kind:genomes.length===2?'comparison':'single',slotLabels:slotLabels??genomes.map((_,i)=>i===0?'A':'B'),genomes,
  comparison:genomes.length===2?compareGenomes(genomes[0],genomes[1]):null};
}
const md=value=>String(value??'—').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
/** Markdown — компактный отчёт для обсуждения. JSON сохраняет все состояния,
 * подписанные числа и разности; полная матрица не дублируется в коротком тексте.
 */
export function genomeAnalysisMarkdown(report){
 const lines=['# Расшифровка геномов Big Evolution',`Создано: ${report.createdAt}`,''];
 for(const [i,g]of report.genomes.entries()){
  lines.push(`## ${report.slotLabels?.[i]??(i===0?'A':'B')} — ${md(g.name)}`,`Схема v${g.genomeVersion}, ${g.geneCount} чисел, ${g.columns} действий. Модель: ${md(g.modelVersion)}. Тип мозга: ${md(g.brainType)}.`,
   `Житель ${md(g.source.id)}, поколение ${md(g.source.generation)}, детей при экспорте ${md(g.source.children)}. Seed ${md(g.source.seed)}, шаг ${md(g.source.tick)}.`,
   `SHA-256 исходного файла: ${md(g.sha256)}`,'','| Свойство | Индекс (с 0) | Сырое число | Пересчитано |','| --- | ---: | ---: | --- |');
  for(const p of g.properties)lines.push(`| ${md(p.label)} | ${p.index??'—'} | ${p.present?formatGeneNumber(p.raw):'Отсутствует'} | ${p.derived===null?'—':formatGeneNumber(p.derived)+' '+md(p.unit)} |`);
  lines.push('','### Интерпретация',...g.insights.map(s=>'- '+md(s)),'','### Ограничения',...g.warnings.map(s=>'- '+md(s)),'');
 }
 if(report.comparison){const c=report.comparison;
  lines.push('## Сравнение B − A',`Совместных генов: ${c.sharedGenes}; изменённых: ${c.changedGenes}; только A: ${c.onlyA}; только B: ${c.onlyB}.`,
   `Строк политики с отличиями: ${c.changedPolicyRows??'не сопоставлены'}/48. Среднее |Δ| сырых чисел: ${formatGeneNumber(c.meanAbsoluteRawDifference)}.`,c.note,'',
   '| Наибольшие различия | A | B | B − A |','| --- | ---: | ---: | ---: |');
  for(const row of c.rankedDifferences.slice(0,20))lines.push(`| ${md(row.label)} | ${formatGeneNumber(row.a)} | ${formatGeneNumber(row.b)} | ${formatGeneNumber(row.delta)} |`);
 }
 lines.push('','Полные подписанные матрицы и разности находятся в JSON анализа. Личный опыт и фактическая жизнь геномом не восстановлены.');
 return lines.join('\n')+'\n';
}

/** Нейронная связь не имеет самостоятельного смысла «любит пищу».
 * Сохраняем подписанный порядок всей сети и шкалы 13 общих свойств отдельно.
 */
function analyzeNeuralGenome(data,{name,sha256}){
 const layout=layoutForGenes(data.genes);
 const {inputs:INPUT_COUNT,hidden:HIDDEN_COUNT,parameters:PARAMETER_COUNT,hiddenBias:HIDDEN_BIAS,outputWeights:OUTPUT_WEIGHTS,outputBias:OUTPUT_BIAS,traitOffset:TRAIT_OFFSET,inputNames:NEURAL_INPUT_NAMES,network:NETWORK_SCHEMA,brainType:NEURAL_BRAIN_TYPE}=layout;
 const traits=neuralTraits(data.genes),context=data.policyContext??{},known=!context.traitScale||context.traitScale===TRAIT_SCALE_VERSION;
 const normalizer=traits.values.reduce((n,v)=>n+Math.abs(v),0);
 const properties=([TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE,DUAL_BRAIN_TYPE].includes(layout.brainType)?TEMPORAL_TRAIT_INDICES:NEURAL_TRAIT_INDICES).map((old,i)=>{
  const gene=COGNITIVE_GENES[old],conversion=DERIVED[gene.key],raw=data.genes[TRAIT_OFFSET+i];
  return {key:gene.key,label:gene.label,group:old<4?'Ощущения':'Память и обучение',description:DESCRIPTIONS[gene.key],present:true,index:TRAIT_OFFSET+i,raw,
   derived:known&&conversion?traits[conversion[0]]:null,unit:conversion?.[1]??'вес',share:known&&old<4?(normalizer?raw/normalizer:0):null};
 });
 if([TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(layout.brainType))for(let i=0;i<GATE_PARAMETERS;i++)properties.push({key:`gate-${i}`,label:i<GATE_HIDDEN_BIAS?`Малый мозг: ${Math.floor(i/GATE_INPUTS)+1} ← ${GATE_NAMES[i%GATE_INPUTS]}`:i<GATE_OUTPUT_WEIGHTS?`Малый мозг: смещение ${i-GATE_HIDDEN_BIAS+1}`:i<GATE_OUTPUT_BIAS?`Запрос ← скрытый ${i-GATE_OUTPUT_WEIGHTS+1}`:'Смещение запроса',group:'Малый мозг',description:'Наследуемый параметр, без обучения за жизнь',present:true,index:layout.gateOffset+i,raw:data.genes[layout.gateOffset+i],derived:null,unit:'вес',share:null});
 if(layout.version===14)for(const [key,value]of Object.entries(structureCounts(data.genes)))properties.push({key,label:key,group:'Структура мозга',description:'Наследуемая структура главного контекста',present:true,index:null,raw:value,derived:value,unit:key==='structuralRate'?'% / рождение':'элементов',share:null});
 if(layout.version===15){
  const d=unpackDualBrain(data.genes),stats=dualHeritable(data.genes);
  const gateTopology=[...d.attention.layers,...d.attention.edges.flatMap(e=>[e.from,e.to])].reduce((h,v)=>Math.imul(h^v,16777619)>>>0,2166136261).toString(16);
  for(const m of DUAL_METRICS)properties.push({key:m.id,label:m.label,group:m.id.includes('Mutation')?'Мутации':'Структура мозга',description:'Наследуемое свойство схемы v15',present:true,index:null,raw:stats[m.id],derived:stats[m.id],unit:m.unit,share:null});
  for(let i=0;i<layout.gateParameters;i++){
   const H=d.attention.layers.length,edge=d.attention.edges[i-H-1];
   properties.push({key:`attention-${gateTopology}-${i}`,label:i<=H?`Диспетчер: смещение ${i+1}`:`Диспетчер: ${edge.to} ← ${edge.from}`,group:'Малый мозг',description:'Наследуемый вес, без обучения за жизнь',present:true,index:layout.gateOffset+i,raw:data.genes[layout.gateOffset+i],derived:null,unit:'вес',share:null});
  }
 }
 const structureData=layout.version===15?{layout,...unpackDualBrain(data.genes).main}:layout.version===14?structuralData(data.genes):null;
 const topologyKey=layout.version>=14?data.genes.slice(layout.topologyOffset).reduce((h,v)=>Math.imul(h^v,16777619)>>>0,2166136261).toString(16):layout.network.inputSchema;
 for(let i=0;i<PARAMETER_COUNT;i++){
  const label=layout.version>=14?structuralParameterLabel(structureData,i):layout.brainType===TEMPORAL_BRAIN_TYPE?temporalParameterLabel(i):layout.brainType===SET_BRAIN_TYPE?setParameterLabel(i):i<HIDDEN_BIAS?`Скрытый ${Math.floor(i/INPUT_COUNT)+1} ← ${NEURAL_INPUT_NAMES[i%INPUT_COUNT]}`:
   i<OUTPUT_WEIGHTS?`Смещение скрытого ${i-HIDDEN_BIAS+1}`:i<OUTPUT_BIAS?`Q ← скрытый ${i-OUTPUT_WEIGHTS+1}`:'Смещение Q';
  properties.push({key:`network-${topologyKey}-${i}`,label,group:'Сеть',description:'Параметр совместной нелинейной функции. Его знак не является отдельным предпочтением или вероятностью действия.',present:true,index:i,raw:data.genes[i],derived:null,unit:'вес',share:null});
 }
 const source={};for(const key of ['seed','tick','id','generation','children'])source[key]=finite(data.source?.[key])?data.source[key]:null;
 const rules={};for(const [key,value]of Object.entries(data.rules??{}))if(finite(value))rules[key]=value;
 const environment={};for(const [key,value]of Object.entries(data.environment??{}))if(typeof value==='string'||typeof value==='boolean'||finite(value))environment[key]=value;
 return {name:String(name).slice(0,200),sha256:typeof sha256==='string'&&/^[a-f0-9]{64}$/i.test(sha256)?sha256:null,genomeVersion:layout.version,geneCount:data.genes.length,columns:11,
  stateEncoding:data.network.inputSchema,stateKnown:false,bodySenseKnown:true,bodySenseEncoding:'network-input-v1',modelVersion:data.modelVersion??null,brainType:layout.brainType,
  traitScale:context.traitScale??TRAIT_SCALE_VERSION,actions:ACTIONS.slice(),source,rules,environment,properties,policy:[],network:{...NETWORK_SCHEMA},inputNames:NEURAL_INPUT_NAMES.slice(),
  architectureLabel:layout.version===15?`Контекст DAG (${layout.hidden} скрытых), диспетчер DAG (${layout.gateHidden} скрытых); покой без процесса`:[TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(layout.brainType)?`Клетки, деятельность и процесс → все Q; наследуемое внимание ${GATE_INPUTS} → ${GATE_HIDDEN} → 1`:layout.brainType===SET_BRAIN_TYPE?'Общие клетки → ситуация → все Q; 6 операций, направления внутри движения':`Сеть ${INPUT_COUNT} → ${HIDDEN_COUNT} tanh → Q`,
  insights:[layout.version===15?`${PARAMETER_COUNT} параметров основного оценщика; ${layout.gateParameters} параметров диспетчера; шесть регуляторов. Начальные диапазоны не ограничивают эволюцию. Диспетчер не обучается за жизнь.`:[TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(layout.brainType)?`${PARAMETER_COUNT} параметров основного мозга, 12 свойств, ${GATE_PARAMETERS} параметра малого мозга. Основной мозг учитывает текущий процесс, его прогресс, причину вызова и цену решения. Малый мозг не обучается за жизнь.`:layout.brainType===SET_BRAIN_TYPE?`Вариант Б: кодировщик клеток ${layout.network.cellInputs} → ${layout.network.cellHidden}, ситуация ${layout.network.contextInputs} → ${layout.network.contextHidden}, цели ${layout.network.targetInputs} → ${layout.network.contextHidden}, критерии 6 операций; ${PARAMETER_COUNT} параметров и 13 общих свойств. Все Q за один прямой вызов; видимость источника независима от порций.`:`Сеть ${INPUT_COUNT} → ${HIDDEN_COUNT} tanh → Q; ${PARAMETER_COUNT} параметров и 13 свойств ощущений/памяти/обучения.`,
   `Память: краткая ${known?traits.shortCapacity:'неизвестна'}, долгая ${known?traits.longCapacity:'неизвестна'}. Личный опыт не сохранён.`,
   'Сеть оценивает варианты по локальным признакам. Значения Q и вероятности требуют конкретных наблюдений.'],
  warnings:['Начальные веса и смещения наследуются; личные поправки, память и градиентный след отсутствуют в геноме.',
   'По знаку одной скрытой связи нельзя установить стратегию или качество поведения.',
   'У нейросети нет таблицы из 48 состояний. Табличные и нейросетевые параметры не сопоставляются как одни и те же гены.',
   'В этой версии совпадают только смысловые свойства ощущений/обучения/памяти. Преимущество генома требует сопоставимых испытаний.',
   ...(!known?['Неизвестная шкала свойств: пересчёт отключён.']:[]) ]};
}
/** Сеть сравниваем с сетью по фиксированным индексам, с таблицей — только по
 * общим свойствам. Новые/отсутствующие параметры остаются null, не нулём.
 */
function compareNeuralGenomes(a,b){
 const keys=[...new Set([...a.properties.map(p=>p.key),...b.properties.map(p=>p.key)])],differences=[],properties=[];
 let shared=0,changed=0,total=0;
 for(const key of keys){
  const pa=a.properties.find(p=>p.key===key),pb=b.properties.find(p=>p.key===key),rawA=pa?.raw??null,rawB=pb?.raw??null;
  const label=pa?.label??pb.label,unit=pa?.unit??pb.unit;
  const delta=rawA!==null&&rawB!==null?rawB-rawA:null;
  if(delta!==null){shared++;total+=Math.abs(delta);if(delta!==0)changed++;}
  const derivedA=pa?.derived??null,derivedB=pb?.derived??null;
  const p={key,label,a:rawA,b:rawB,delta,derivedA,derivedB,derivedDelta:derivedA!==null&&derivedB!==null&&a.traitScale===b.traitScale?derivedB-derivedA:null,unit};
  properties.push(p);differences.push({...p,id:key,group:pa?.group??pb.group});
 }
 // Несопоставимая таблица тоже присутствует в перечне как «только A/B».
 for(const [g,side]of [[a,'a'],[b,'b']])if(!g.network)for(const row of g.policy)row.scores.forEach((raw,action)=>differences.push({id:`${side}-policy-${row.row}-${action}`,label:`Таблица ${side.toUpperCase()}, строка ${row.row} · ${ACTIONS[action]}`,a:side==='a'?raw:null,b:side==='b'?raw:null,delta:null,group:'Политика'}));
 return {direction:'B − A',sharedGenes:shared,changedGenes:changed,onlyA:differences.filter(p=>p.a!==null&&p.b===null).length,onlyB:differences.filter(p=>p.b!==null&&p.a===null).length,
  meanAbsoluteRawDifference:shared?total/shared:null,policyComparable:false,changedPolicyRows:null,columns:11,policy:[],properties,differences,
  rankedDifferences:differences.filter(p=>p.delta!==null&&p.delta!==0).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta)),
  note:'Параметры сетей сравниваются только при совпадении схемы; между v7/v8 — общие свойства; с таблицей — только по общим свойствам. Разности параметров не доказывают улучшения поведения.'};
}

function structuralParameterLabel(d,index){
 const l=d.layout;
 if(index>=FIXED_PARAMETERS+l.hidden){const e=d.edges[index-FIXED_PARAMETERS-l.hidden];return `DAG: ${e.to} ← ${e.from}`;}
 if(index>=FIXED_PARAMETERS)return `DAG: смещение скрытого ${index-FIXED_PARAMETERS+1}`;
 const b=STRUCTURAL_BLOCKS.find(b=>index>=b.offset&&index<b.offset+b.weights+(b.bias===null?0:b.outputs));
 return `${b.label}: ${index<b.offset+b.weights?'связь '+(index-b.offset+1):'смещение '+(index-b.bias+1)}`;
}
