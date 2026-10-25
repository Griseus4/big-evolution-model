import {STRUCTURAL_TYPE,structuralLayout,randomStructuralGenome,validateStructure,mutateStructure,structuralProbability,STRUCTURAL_DEFAULTS} from './structural-brain.js';
/** Генетическая основа нынешнего мозга, независимо от физики мира.
 * Версии фиксируют смысл чисел; личная память и обучение не наследуются.
 * Генераторы передаёт мир: здесь нет собственных бросков или доступа к карте.
 */
import {BASE_GENE_COUNT,OLD_GENE_COUNT,GENOME_SIZES,BODY_GENE_OFFSET,legacyGeneIndex,expandGenome,ACTION_COUNT,STATE_COUNT,BIRTH_ACTION,DEPOSIT_ACTION} from './policy-layout.js';
import {GENE_COUNT} from './brain-parameters.js';
import {BRAIN_TYPE} from './brain-controller.js';
import {NEURAL_BRAIN_TYPE,NEURAL_GENE_COUNT,PARAMETER_COUNT,TRAIT_OFFSET,INPUT_COUNT,HIDDEN_COUNT,OUTPUT_WEIGHTS,OUTPUT_BIAS,NETWORK_SCHEMA,NEURAL_LAYOUTS,layoutForGenes,layoutForType} from './neural-layout.js';
import {MUTATION_SCHEMA,MUTATION_RULES,mutationProfile,mutationOffset,validMutationGenes,mutateRegulator,effectiveMutationRate} from './mutation-parameters.js';
import {TEMPORAL_BRAIN_TYPE,TEMPORAL_LAYOUT,SET_BLOCKS as TIME_BLOCKS,GATE_OFFSET,GATE_INPUTS,GATE_HIDDEN,GATE_HIDDEN_BIAS,GATE_OUTPUT_WEIGHTS,GATE_OUTPUT_BIAS} from './temporal-layout.js';
import {SET_BRAIN_TYPE,SET_BLOCKS} from './set-brain-layout.js';
export const GENOME_VERSION=6;
export function genomeMetadata(genes){
 const layout=layoutForGenes(genes),inherited=mutationOffset(genes)!==null;
 const version=layout?.version>=10?layout.version:inherited?9:layout?.version??Number(Object.keys(GENOME_SIZES).find(v=>GENOME_SIZES[v]===genes.length));
 return {version,brainType:layout?.brainType??BRAIN_TYPE,...(layout?{network:{...layout.network}}:{}),
  ...(inherited?{mutationSchema:MUTATION_SCHEMA}:{})};
}
/** Симметричная Xavier-инициализация без готовых стратегий. Связи случайны,
 * смещения нулевые. Отдельный RNG не расходует случайность физики мира.
 */
export function randomNeuralGenome(random,brainType=NEURAL_BRAIN_TYPE){
 if(brainType===STRUCTURAL_TYPE)return randomStructuralGenome(random);
 const layout=layoutForType(brainType);if(!layout)throw new Error("Неизвестная схема сети.");
 if(brainType===SET_BRAIN_TYPE||brainType===TEMPORAL_BRAIN_TYPE){
  const genes=Array(layout.genes).fill(0);
  for(const block of (brainType===TEMPORAL_BRAIN_TYPE?TIME_BLOCKS:SET_BLOCKS)){const scale=Math.sqrt(6/(block.inputs+block.outputs));for(let i=block.offset;i<block.offset+block.weights;i++)genes[i]=(random.next()*2-1)*scale;}
  for(let i=layout.traitOffset;i<(layout.gateOffset??layout.genes);i++)genes[i]=(random.next()-.5)*5;
  if(layout.gateOffset!==undefined){for(let i=0;i<GATE_HIDDEN_BIAS;i++)genes[GATE_OFFSET+i]=(random.next()*2-1)*Math.sqrt(6/(GATE_INPUTS+GATE_HIDDEN));for(let i=GATE_OUTPUT_WEIGHTS;i<GATE_OUTPUT_BIAS;i++)genes[GATE_OFFSET+i]=(random.next()*2-1)*Math.sqrt(6/(GATE_HIDDEN+1));}
  return genes;
 }
 const {genes:NEURAL_GENE_COUNT,inputs:INPUT_COUNT,hidden:HIDDEN_COUNT,outputWeights:OUTPUT_WEIGHTS,outputBias:OUTPUT_BIAS,traitOffset:TRAIT_OFFSET}=layout;
 const genes=Array(NEURAL_GENE_COUNT).fill(0),hiddenScale=Math.sqrt(6/(INPUT_COUNT+HIDDEN_COUNT)),outputScale=Math.sqrt(6/(HIDDEN_COUNT+1));
 for(let i=0;i<INPUT_COUNT*HIDDEN_COUNT;i++)genes[i]=(random.next()*2-1)*hiddenScale;
 for(let i=OUTPUT_WEIGHTS;i<OUTPUT_BIAS;i++)genes[i]=(random.next()*2-1)*outputScale;
 for(let i=TRAIT_OFFSET;i<NEURAL_GENE_COUNT;i++)genes[i]=(random.next()-.5)*5;
 return genes;
}
const bound=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/** Первые геномы симметрично случайны для ВСЕХ действий.
 * Здесь принципиально нет бонуса еде, ожиданию или избеганию повреждений.
 */
export function randomGenome(random,extraRandom=random,senseRandom=extraRandom){
 // Прежние 450 бросков физического RNG сохраняются; добавленные свойства и
 // 48 предпочтений рождения и 48 выкладывания расходуют отдельный поток. Прежние гены переносим.
 const old=Array.from({length:454},(_,i)=>((i<OLD_GENE_COUNT?random:extraRandom).next()-.5)*5);
 const genes=expandGenome(old);
 for(let row=0;row<STATE_COUNT;row++)genes[row*ACTION_COUNT+BIRTH_ACTION]=(extraRandom.next()-.5)*5;
 // Выкладывание имеет такие же случайные исходные знаки, как другие действия.
 // Его 48 бросков идут после прежних новых колонок, отдельно от RNG физики.
 for(let row=0;row<STATE_COUNT;row++)genes[row*ACTION_COUNT+DEPOSIT_ACTION]=(extraRandom.next()-.5)*5;
 // Отдельный поток сохраняет прежние 550 генов последующих основателей.
 for(let i=BODY_GENE_OFFSET;i<GENE_COUNT;i++)genes[i]=(senseRandom.next()-.5)*5;
 return genes;
}
/** Наследование копирует геном, затем независимо меняет некоторые числа.
 * rate — вероятность мутации каждого гена, scale — максимальное изменение.
 * Ограничение чисел не даёт экспонентам в выборе переполниться.
 * Личный опыт или координаты родителя не наследуются.
 */
export function mutateGenome(parent,random,rate=.06,scale=.7,extraRandom=random,senseRandom=extraRandom,neuralRandom=senseRandom,structureSettings=STRUCTURAL_DEFAULTS){
 const layout=layoutForGenes(parent),profile=mutationProfile(parent),offset=mutationOffset(parent);
 // Внешние rate/scale относятся только к старым файлам без регуляторов.
 if(profile){rate=profile.rate;scale=profile.strength;}
 if(layout?.version===14){
  const child=parent.slice();
  for(let index=0;index<layout.topologyOffset;index++){
   const value=parent[index];
   if(index>=offset){child[index]=mutateRegulator(value,index===layout.structureOffset?offset:index,offset,profile,neuralRandom);continue;}
   const slow=index>=layout.parameters&&index<layout.gateOffset;
   if(neuralRandom.next()<effectiveMutationRate(profile,slow))child[index]=bound(value+(neuralRandom.next()*2-1)*profile.strength*(slow?.2:1),-8,8);
  }
  return structureSettings.structuralMutations&&neuralRandom.next()<structuralProbability(parent)?mutateStructure(child,neuralRandom,structureSettings):child;
 }
 if(layout)return parent.map((value,index)=>{
  if(profile&&index>=offset)return mutateRegulator(value,index,offset,profile,neuralRandom);
  const slow=index>=layout.parameters&&index<(layout.gateOffset??Infinity);
  const chance=profile?effectiveMutationRate(profile,slow):rate*(slow?.25:1);
  return neuralRandom.next()<chance?bound(value+(neuralRandom.next()*2-1)*scale*(slow?.2:1),-8,8):value;
 });
 // Новые общие свойства мозга меняются реже и меньшими шагами, чем отдельные
 // предпочтения действий. Это явное модельное допущение, не перевод в годы.
 return parent.map((value,index)=>{
  if(profile&&index>=offset)return mutateRegulator(value,index,offset,profile,neuralRandom);
  const slow=index>=BASE_GENE_COUNT&&index<BODY_GENE_OFFSET;
  const old=legacyGeneIndex(index),rng=index>=BODY_GENE_OFFSET?senseRandom:old>=0&&old<OLD_GENE_COUNT?random:extraRandom;
  return rng.next()<(profile?effectiveMutationRate(profile,slow):rate*(slow?.25:1))?bound(value+(rng.next()*2-1)*scale*(slow?.2:1),-8,8):value;
 });
}
/** Экспорт — только данные, не исполняемый код. Версия фиксирует смысл генов.
 * Импорт проверяет размер, тип и диапазон чисел, чтобы чужой файл не менял правила.
 */
export function validateGenomeFile(data){
 if(!data||data.format!=='big-evolution-genome'||!Number.isInteger(data.version)||!Array.isArray(data.genes))throw new Error(`Нужен JSON генома Big Evolution. Текущая схема — v${TEMPORAL_LAYOUT.version}.`);
 if(data.version===14){const l=structuralLayout(data.genes);validateStructure(data.genes);if(!l||data.brainType!==STRUCTURAL_TYPE||data.mutationSchema!==MUTATION_SCHEMA||!validMutationGenes(data.genes)||Object.entries(l.network).some(([k,v])=>data.network?.[k]!==v))throw new Error('Неверная схема генома v14.');return data.genes.slice();}
 if(data.version===TEMPORAL_LAYOUT.version){const l=layoutForGenes(data.genes),off=mutationOffset(data.genes);if(l?.version!==TEMPORAL_LAYOUT.version||data.brainType!==TEMPORAL_BRAIN_TYPE||Object.entries(l.network).some(([k,v])=>data.network?.[k]!==v)||!data.genes.every((v,i)=>Number.isFinite(v)&&(off!==null&&i>=off||Math.abs(v)<=8))||off!==null&&(data.mutationSchema!==MUTATION_SCHEMA||!validMutationGenes(data.genes)))throw new Error('Неверный текущий геном или схема сети.');return data.genes.slice();}
 if(data.version===12)throw new Error('Геном v12 не содержит нового восприятия действий. Нужен новый геном v13; преобразование не поддерживается.');
 if(data.version===10)throw new Error('Геном v10 относится к прежней схеме мозга 0.28. В 0.29 нужен новый геном v11; преобразование v10 не поддерживается.');
 const resolved=layoutForGenes(data.genes);
 const inherited=data.version===9||data.version===11&&mutationOffset(data.genes)!==null,layout=data.version>=9?resolved:NEURAL_LAYOUTS.find(l=>l.version===data.version);
 if(data.version===11&&layout?.version!==11||data.version===9&&resolved?.version>=10)throw new Error('Версия не соответствует архитектуре мозга.');
 const offset=inherited?mutationOffset(data.genes):null;
 const size=inherited?(layout?.mutationOffset!==undefined?layout.genes:data.genes.length===GENOME_SIZES[6]+2?GENOME_SIZES[6]+2:null):data.version===11?layout?.genes:GENOME_SIZES[data.version];
 if(!size||data.genes.length!==size||inherited&&(offset===null||data.mutationSchema!==MUTATION_SCHEMA||!validMutationGenes(data.genes)))throw new Error('Неверная версия, размер или схема наследуемой изменчивости.');
 if(data.brainType!==undefined&&data.brainType!==(layout?layout.brainType:BRAIN_TYPE))throw new Error('Тип мозга не соответствует геному.');
 if(layout&&(data.brainType!==layout.brainType||Object.entries(layout.network).some(([k,v])=>data.network?.[k]!==v)))throw new Error('Нужна точная схема сети '+layout.brainType+'.');
 if(inherited&&data.brainType===undefined)throw new Error('Геном v9 должен указывать тип мозга.');
 if(!data.genes.every((v,i)=>typeof v==='number'&&Number.isFinite(v)&&(inherited&&i>=offset||Math.abs(v)<=8)))throw new Error('Параметры мозга должны быть конечными числами от −8 до 8, регуляторы — в своей логарифмической шкале.');
 // Импорт версии 1 сохраняет старые числа дословно. Новые предпочтения нейтральны.
 // В интерфейсе можно явно выбрать случайное расширение для нового опыта.
 return expandGenome(data.genes);
}

/** Историческая опция случайного расширения общих свойств старой основы.
 * Это явно выбранное преобразование, не нейтральный импорт. Оставлено отдельно
 * от мира: конкретный диапазон генов относится к текущему генетическому формату.
 */
export function randomizeLegacyProperties(genes,random){
 if(layoutForGenes(genes))return genes.slice();
 const extension=randomGenome(random),copy=genes.slice();
 for(let i=BASE_GENE_COUNT;i<GENE_COUNT;i++)copy[i]=extension[i];
 return copy;
}

