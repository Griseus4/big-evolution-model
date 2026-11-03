import {careGeneValues} from './care-settings.js';
import {validateCareLinks} from './child-care.js';
import {encodeState,decodeState} from './state-codec.js';
import {Evolution,WORLD_WIDTH,WORLD_HEIGHT} from './evolution.js';
import {Random} from './simulation.js';
import {LifeHistory,MODEL_VERSION} from './life-history.js';
import {PHYSIOLOGY_SCHEMA,physiologySettings,bodyGeneValues,foodEnergies} from './physiology-settings.js';
import {bodyPlan,validateBody,bodyCapacities,pregnancyPlan} from './body-physiology.js';
import {validateDualBrain} from './dual-brain-genome.js';
import {compileDualState} from './dual-brain-state.js';
import {controllerProblems} from './brain-controller.js';
import {createDigestion} from './digestion.js';
import {meatAmount} from './food-resources.js';
import {dualStructureSettings} from './dual-brain-settings.js';
import {validateBrainCostMultiplier} from './brain-economy.js';
import {validateEnvironmentSettings} from './environment-settings.js';
import {SUBSTEPS} from './action-timing.js';
import {checkPhysiologyInvariants} from './physiology-invariants.js';
import {grassAmount} from './food-resources.js';
export const PHYSIOLOGY_SAVE_VERSION=5;
const EXTRA=['physiology','childCare','genomeVersion','bodyGenes','_physNextFruit','_physEnvironment','_groundFood','_growingGrass'];
const number=n=>typeof n==='number'&&Number.isFinite(n),positive=n=>number(n)&&n>=0,integer=n=>Number.isSafeInteger(n)&&n>=0;
const check=(condition,message)=>{if(!condition)throw new Error('Повреждено сохранение: '+message);};
const near=(a,b)=>Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
export function savePhysiologyWorld(w,commonFields){
 const fields=[...commonFields,...EXTRA].filter(k=>k!=='_activities');
 const state=Object.fromEntries(fields.filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]]));
 // Исполняемые планы DAG восстанавливаются из генома. Их тысячи объектов
 // на жителя не являются личным опытом и не должны раздувать файл мира.
 state.agents=w.agents.map(a=>{
  const {structure,costProfile,attentionStructure,...brain}=a.brain;
  // В v6 врождённая основа уже целиком есть в геноме; личные поправки и следы сохраняются.
  if(w.childCare)delete brain.networkBase;
  return {...a,brain};
 });
 return {format:'big-evolution-world',version:w.childCare?6:PHYSIOLOGY_SAVE_VERSION,modelVersion:MODEL_VERSION,physiologySchema:PHYSIOLOGY_SCHEMA,...(w.childCare?{careSchema:'postnatal-care-v1'}:{}),state:encodeState(state)};
}
function validateMeat(c,tick){check(c&&integer(c.whole)&&number(c.fraction)&&c.fraction>=0&&c.fraction<1&&integer(c.subtick)&&c.subtick<=tick,'контейнер мяса');}
function validateDigestion(d,plan,tick,capacity){
 const reference=createDigestion(plan.retentionSteps,tick),n=reference.starts.length;
 check(d&&d.subtick===tick&&d.retentionSteps===plan.retentionSteps&&d.width===reference.width,'сетка пищеварения');
 for(const [key,length]of [['starts',n],['volumes',n],['remaining',n*3],['totals',3],['absorbed',3]])check(d[key] instanceof Float64Array&&d[key].length===length&&d[key].every(number),'кольцо '+key);
 check(d.volumes.every(positive)&&d.remaining.every(positive)&&positive(d.volume)&&d.volume<=capacity+1e-9&&near(d.volume,d.volumes.reduce((s,v)=>s+v,0)),'объём желудка');
 for(let j=0;j<n;j++){const start=d.starts[j];check(start===-1||integer(start)&&start%d.width===0&&start<=tick&&start+d.retentionSteps>tick&&Math.floor(start/d.width)%n===j,'возраст пищевой группы');if(start===-1)check(d.volumes[j]===0&&d.remaining.slice(j*3,j*3+3).every(v=>v===0),'пустая пищевая группа');}
}
function validatePregnancy(p,a,w){
 if(!p)return;const genes=validateDualBrain(p.genome);check(genes.layout.version===w.genomeVersion,'геном плода');
 const plan=bodyPlan(genes.body),budget=pregnancyPlan(plan,w.physiology);
 for(const [key,value]of Object.entries(plan))check(p.plan?.[key]===value,'план тела плода');
 for(const [key,value]of Object.entries(budget))check(p[key]===value,'стоимость плода');
 check(['gestation','labor'].includes(p.stage)&&integer(p.conceivedAt)&&p.conceivedAt<=w.subtick&&Number.isSafeInteger(p.steps)&&p.steps>0&&p.due===p.conceivedAt+p.steps&&positive(p.paid)&&p.paid<=p.cost*(1+1e-12),'беременность');
 check(p.steps===a.bodyPlan.pregnancySteps&&p.lastPayment===Math.min(w.subtick,p.due),'платежи беременности');
 if(p.stage==='gestation')check(w.subtick<p.due&&p.fraction===null&&p.laborStarted===null&&p.laborDue===null,'срок беременности');
 else check(p.laborStarted===p.due&&p.laborDue===p.due+w.physiology.birthSteps&&w.subtick<p.laborDue&&positive(p.fraction)&&p.fraction<=1&&near(p.fraction,p.paid/p.cost)&&a.process===null,'срок/доля родов');
}
export function loadPhysiologyWorld(file,commonFields){
 check(file.format==='big-evolution-world'&&[5,6].includes(file.version)&&file.physiologySchema===PHYSIOLOGY_SCHEMA,'версия физики');
 if(file.version===6)check(file.careSchema==='postnatal-care-v1','схема ношения');
 const state=decodeState(file.state),fields=new Set([...commonFields,...EXTRA]);check(state&&Object.keys(state).every(k=>fields.has(k)),'поля мира');
 const w=Object.assign(Object.create(Evolution.prototype),state);
 check(w.physiology&&w.genomeVersion===(file.version===6?19:18)&&Boolean(w.childCare)===(file.version===6),'настройки тела');w.physiology=physiologySettings(w.physiology);w.bodyGenes=(w.childCare?careGeneValues:bodyGeneValues)(w.bodyGenes);w.foodEnergies=foodEnergies(w.physiology);
 Object.assign(w,dualStructureSettings(w));w.brainCostMultiplier=validateBrainCostMultiplier(w.brainCostMultiplier);
 check(w.temporal===true&&integer(w.subtick)&&w.tick===w.subtick/SUBSTEPS&&integer(w.nextId)&&Array.isArray(w.agents)&&Array.isArray(w.tiles)&&w.tiles.length===WORLD_WIDTH*WORLD_HEIGHT&&w.records instanceof Map&&w.lineages instanceof Map&&w.lifeHistory instanceof LifeHistory,'основные поля');
 for(const key of ['random','cognitiveRandom','bodyRandom','neuralRandom','mutationRandom'])check(w[key] instanceof Random&&integer(w[key].state)&&w[key].state<=4294967295,'RNG '+key);
 w._meatTiles=new Set();
 for(let i=0;i<w.tiles.length;i++){
  const c=w.tiles[i];check(c.x===i%WORLD_WIDTH&&c.y===Math.floor(i/WORLD_WIDTH)&&['land','water'].includes(c.terrain)&&positive(c.food)&&positive(c.maxFood)&&positive(c.looseGrass),'клетка');validateMeat(c.meat,w.subtick);if(meatAmount(c.meat))w._meatTiles.add(i);
  check(c.terrain==='water'?c.grass===null:c.grass&&positive(c.grass.maximum)&&positive(c.grass.amount)&&c.grass.amount<=c.grass.maximum&&integer(c.grass.subtick)&&c.grass.subtick<=w.subtick,'трава');
 }
 const ids=new Set();
 for(const a of w.agents){
  check(integer(a.id)&&a.id>0&&a.id<w.nextId&&!ids.has(a.id)&&a.alive===true&&integer(a.x)&&integer(a.y)&&w.tile(a.x,a.y)?.terrain==='land','житель/адрес');ids.add(a.id);
  const genes=validateDualBrain(a.genome);check(genes.layout.version===w.genomeVersion,'версия генома');const plan=bodyPlan(genes.body);
  for(const [key,value]of Object.entries(plan))check(a.bodyPlan?.[key]===value,'план тела');for(const [key,value]of Object.entries(genes.body))check(a.bodyGenes?.[key]===value,'гены тела');
  validateBody(a,w.physiology);check(a.health>0&&integer(a.bornSubtick)&&a.bornSubtick<=w.subtick&&a.ageSteps===w.subtick-a.bornSubtick&&a.age===a.ageSteps/SUBSTEPS,'возраст/жизнь');
  const capacity=bodyCapacities(a,w.physiology);check(a.energyCapacity===capacity.energy&&a.healthCapacity===capacity.health&&a.stomachCapacity===capacity.volume,'ёмкости тела');
  validateDigestion(a.digestion,plan,w.subtick,capacity.volume);validateMeat(a.carriedMeat,w.subtick);
  check(Array.isArray(a.foodInventory)&&a.foodInventory.length===3&&a.foodInventory.every(positive)&&a.inventory===a.foodInventory.reduce((s,v)=>s+v,0)&&a.inventory<=w.physiology.inventoryCapacity+1e-9&&a.foodInventory[2]===meatAmount(a.carriedMeat)&&a.stomach===a.digestion.volume,'запас/желудок');
  validatePregnancy(a.pregnancy,a,w);
  if(a.process){const p=a.process;check(integer(p.action)&&p.action<(w.childCare?13:12)&&p.action!==8&&integer(p.duration)&&p.duration>0&&integer(p.elapsed)&&p.elapsed<p.duration&&positive(p.motor)&&integer(p.startedAt)&&p.startedAt<=w.subtick&&w.tile(p.destination?.x,p.destination?.y)&&number(p.localDestination?.q)&&number(p.localDestination?.r),'процесс');if([6,7,10,12].includes(p.action))check(integer(p.foodType)&&p.foodType<3,'тип пищи');if(p.action===11)check(integer(p.targetHandle)&&p.targetHandle!==a.id,'цель удара');}
  if(w.childCare){check(a.brain&&!Object.hasOwn(a.brain,'networkBase'),'дублирующая основа мозга');a.brain.networkBase=Float64Array.from(a.genome.slice(0,genes.layout.parameters));}
  check(a.brain?.memory instanceof Map&&a.brain.longMemory instanceof Map&&a.brain.networkBase?.length===genes.layout.parameters&&a.brain.networkBase.every((v,j)=>v===a.genome[j]),'основа мозга');
  const state=compileDualState(a.genome);a.brain.structure=state.structure;a.brain.costProfile=state.costProfile;a.brain.attentionStructure=state.attentionStructure;
  check(a.brain.physiology===true&&Boolean(a.brain.care)===Boolean(w.childCare)&&a.brain.gateBase?.length===state.gateBase.length&&a.brain.gateBase.every((v,j)=>v===state.gateBase[j])&&controllerProblems(a.brain).length===0,'мозг/обучение');
  check(a.brain.outcomeExpectation?.length===(w.childCare?13:12)&&a.brain.outcomeExpectation.every(number)&&integer(a.brain.lastDecisionSubtick)&&a.brain.lastDecisionSubtick<=w.subtick&&a.brainDue===0,'состояние решения');
 }
 check(w.automaticEnvironment?.random instanceof Random,'среда');validateEnvironmentSettings(w.automaticEnvironment);
 check(Array.isArray(w.foodIslands)&&w.foodIslands.every(g=>positive(g.period)&&g.period>0&&number(g.nextTick)&&g.nextTick>w.tick&&Array.isArray(g.sources)&&g.sources.every(p=>w.tile(p.x,p.y)?.maxFood>0)),'календарь плодов');
 check(positive(w._groundFood)&&w._growingGrass instanceof Set&&[...w._growingGrass].every(i=>integer(i)&&w.tiles[i]?.grass),'реестр пищи');
 const epoch=w._viewEpoch;w.rebuildOccupancy();w._viewEpoch=epoch;w._physById=new Map(w.agents.map(a=>[a.id,a]));w._physActivities=new Map();w._physActivityEpoch=-1;
 validateCareLinks(w);
 check(w.stats?.physiology&&Object.values(w.stats.physiology).every(v=>typeof v==='string'||(Array.isArray(v)?v.every(positive):positive(v))),'реестры балансов');
 const ground=w.tiles.reduce((sum,c)=>sum+c.food+c.looseGrass+meatAmount(c.meat)+(c.grass?grassAmount(c.grass,w.subtick,w.physiology):0),0);
 check(near(ground,w._groundFood),'суммарная пища');
 check(w._physNextFruit===Infinity||number(w._physNextFruit)&&w._physNextFruit>w.tick,'ближайшее восстановление плодов');
 try{checkPhysiologyInvariants(w);}catch(e){throw new Error('Повреждено сохранение: '+e.message);}
 w._due=[];w._touched=[];w._gatherGroups=new Map();return w;
}
