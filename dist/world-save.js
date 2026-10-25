import {STRUCTURAL_TYPE,structuralLayout,structuralSettings,compileStructure} from './structural-brain.js';
import {brainCostProfile} from './brain-cost.js';
/** Ручной снимок только на согласованной границе. Личные мозги перед вызовом
 * синхронизирует Runtime; восстановление не создаёт основателей/бросков RNG. */
import {Evolution,WORLD_WIDTH,WORLD_HEIGHT,RULES,validateDigestionTime} from './evolution.js';
import {MODEL_VERSION,LifeHistory} from './life-history.js';
import {Random} from './simulation.js';
import {rebuildActivities,ACTIVITY_COUNT} from './activity-perception.js';
import {encodeState,decodeState} from './state-codec.js';
import {TEMPORAL_BRAIN_TYPE,SET_PARAMETER_COUNT,GATE_PARAMETERS} from './temporal-layout.js';
import {genomeMetadata,validateGenomeFile} from './genome.js';
import {validateEnvironmentSettings,ENVIRONMENT_DEFAULTS,ENVIRONMENT_SCHEMA,ENVIRONMENT_RULES,foodProduction} from './environment-settings.js';
import {reproductionProfile} from './reproduction.js';
import {controllerProblems} from './brain-controller.js';
export const WORLD_SAVE_FORMAT='big-evolution-world',WORLD_SAVE_VERSION=3,MAX_WORLD_SAVE_BYTES=512*1024*1024;
// Старые миры продолжают прежнее усвоение: отсутствующий параметр даёт 20 Т.
// Новые сохраняют выбранное время; номер UI сам по себе не ломает схему.
const COMPATIBLE_MODELS=new Set([MODEL_VERSION,'0.53.0','0.53.1','0.53.2','0.53.3','0.54.0','0.54.1']);
const FIELDS=('initialNeurons initialConnections maxNeurons maxLayers structuralMutations temporal digestionTime individualFood geography learningEnabled memoryEnabled reproduction seed foodSeed random cognitiveRandom bodyRandom scenario heritableMutations upgradeMutationGenes mutationRandom brainType neuralRandom initialPopulation limit mutationRate mutations baseGenome tick nextId maxGeneration events history agents foodCycleStart environmentRevision environmentChanges lifeHistory lifeExposure records lineages tiles stats sourceTemplate foodIslands initialFood foodSettings initialFoodSettings initialFoodIslands mutationProtocol geographyInfo foodExposure subtick _primed _viewEpoch automaticEnvironment _activities').split(' ');
export function saveWorld(w){
 if(!w.temporal)throw new Error('Полное сохранение поддерживает текущую модель.');
 const state=Object.fromEntries(FIELDS.filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]]));
 return {format:WORLD_SAVE_FORMAT,version:WORLD_SAVE_VERSION,modelVersion:MODEL_VERSION,activityRevision:w._activities?.revision??0,state:encodeState(state)};
}
export function loadWorld(file){
 if(file?.format!==WORLD_SAVE_FORMAT||file.version!==WORLD_SAVE_VERSION||!COMPATIBLE_MODELS.has(file.modelVersion))throw new Error('Неподдерживаемый формат или версия сохранения мира. Требуется совместимая схема целевой автоматики.');
 const state=decodeState(file.state),w=Object.create(Evolution.prototype);
 if(!state||Object.keys(state).some(k=>!FIELDS.includes(k)))throw new Error('Недопустимые поля мира.');Object.assign(w,state);w.reproduction=reproductionProfile(w.reproduction);
 if(file.modelVersion===MODEL_VERSION&&!Object.hasOwn(state,'digestionTime'))throw new Error('В сохранении отсутствует время усвоения пищи.');
 Object.assign(w,structuralSettings(w));
 w.digestionTime=validateDigestionTime(w.digestionTime);w.digestionRate=RULES.foodEnergy/w.digestionTime;
 const valid=n=>typeof n==='number'&&Number.isFinite(n),integer=n=>Number.isSafeInteger(n)&&n>=0;
 if(!integer(w.foodSeed)||w.foodSeed>4294967295)throw new Error('Повреждён seed пищи.');
 if(w.temporal!==true||w.individualFood!==true||![TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(w.brainType)||!integer(w.subtick)||w.tick!==w.subtick/10||!integer(w.nextId)||!Array.isArray(w.agents)||!Array.isArray(w.tiles)||w.tiles.length!==WORLD_WIDTH*WORLD_HEIGHT||!(w.lifeHistory instanceof LifeHistory)||!(w.records instanceof Map)||!(w.lineages instanceof Map))throw new Error('Повреждена структура мира.');
 for(const key of ['random','cognitiveRandom','bodyRandom','neuralRandom','mutationRandom'])if(!(w[key] instanceof Random)||!integer(w[key].state)||w[key].state>4294967295)throw new Error('Повреждено состояние случайности.');
 for(let i=0;i<w.tiles.length;i++){const c=w.tiles[i];if(c.x!==i%WORLD_WIDTH||c.y!==Math.floor(i/WORLD_WIDTH)||!['land','water'].includes(c.terrain)||!integer(c.food)||!valid(c.maxFood)||c.maxFood<0)throw new Error('Повреждена клетка карты.');}
 const ids=new Set();for(const a of w.agents){
  if(!integer(a.id)||a.id<1||a.id>=w.nextId||ids.has(a.id)||a.alive!==true||!integer(a.x)||!integer(a.y)||w.tile(a.x,a.y)?.terrain!=='land'||!valid(a.energy)||a.energy<0||a.energy>100||!valid(a.health)||a.health<=0||a.health>100||!valid(a.stomach)||a.stomach<0||a.stomach>RULES.stomachCapacity+1e-7||!integer(a.inventory)||a.inventory>RULES.inventoryCapacity||!valid(a.age)||a.age<0||!Array.isArray(a.genome)||![TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(genomeMetadata(a.genome).brainType)||a.genome.some(n=>!valid(n))||!(a.brain?.memory instanceof Map)||!(a.brain?.longMemory instanceof Map)||![TEMPORAL_BRAIN_TYPE,STRUCTURAL_TYPE].includes(a.brain.controllerType)||a.brain.networkBase?.length!==(structuralLayout(a.genome)?.parameters??SET_PARAMETER_COUNT)||a.brain.networkDelta?.length!==a.brain.networkBase.length)throw new Error('Повреждено состояние жителя.');
  ids.add(a.id);if(a.process&&(!integer(a.process.action)||a.process.action>10||!integer(a.process.elapsed)||!integer(a.process.duration)||a.process.duration<1||a.process.elapsed>=a.process.duration||!w.tile(a.process.destination?.x,a.process.destination?.y)))throw new Error('Повреждено текущее действие.');
 }
 if(!w.foodExposure||w.foodExposure.length!==Math.floor(w.tick)+1||!Array.isArray(w.foodExposure.blocks)||w.foodExposure.blocks.some(b=>!(b instanceof Float64Array)))throw new Error('Повреждена история пищевых условий.');
 const sourceCells=new Set();for(const g of w.foodIslands){if(!valid(g.period)||g.period<=0||!valid(g.nextTick)||g.nextTick<=w.tick||!Array.isArray(g.sources))throw new Error('Повреждено расписание пищи.');for(const p of g.sources){const c=w.tile(p.x,p.y),id=p.y*WORLD_WIDTH+p.x;if(!c||c.maxFood<=0||sourceCells.has(id))throw new Error('Повреждён источник пищи.');sourceCells.add(id);}}
 if(sourceCells.size!==w.tiles.filter(c=>c.maxFood>0).length)throw new Error('Неполное расписание источников.');
 const environment=w.automaticEnvironment;
 if(!environment||environment.schema!==ENVIRONMENT_SCHEMA||Object.keys(ENVIRONMENT_DEFAULTS).some(k=>!Object.hasOwn(environment,k))||!(environment.random instanceof Random)||!integer(environment.random.state)||environment.random.state>4294967295||!integer(environment.completedSteps)||environment.completedSteps>ENVIRONMENT_RULES.preparationSteps||typeof environment.preparationCancelled!=='boolean'||!integer(environment.events)||typeof environment.lastError!=='string'||typeof environment.blockedReason!=='string'||environment.preparationCancelled&&environment.completedSteps!==ENVIRONMENT_RULES.preparationSteps||environment.nextGroupId!==undefined&&(!integer(environment.nextGroupId)||w.foodIslands.some(g=>g.id>=environment.nextGroupId)))throw new Error('Повреждена автоматическая среда.');
 validateEnvironmentSettings(environment);
 if(environment.enabled?(!valid(environment.nextTick)||environment.nextTick<=w.tick||foodProduction(w)<environment.minimumRate*(1-1e-12)):environment.nextTick!==null)throw new Error('Повреждён календарь или нижний порог автоматической среды.');
 for(const a of w.agents){if(structuralLayout(a.genome)){a.brain.structure=compileStructure(a.genome);if(a.brain.structure.hidden>w.maxNeurons||Math.max(0,...a.brain.structure.layers)>w.maxLayers)throw new Error('Структура превышает пределы мира.');a.brain.costProfile=brainCostProfile(a.brain.structure);}
 validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(a.genome),genes:a.genome});if(!(a.brain.networkBase instanceof Float64Array)||!(a.brain.networkDelta instanceof Float64Array)||a.brain.gateBase?.length!==GATE_PARAMETERS||!a.brain.gateBase.every(Number.isFinite)||controllerProblems(a.brain).length)throw new Error('Повреждены веса/память/переход мозга.');}
 if(w.lifeHistory.all?.count!==w.stats.deaths||!Array.isArray(w.lifeHistory.rows)||!integer(w.lifeHistory.offset)||w.lifeHistory.offset>w.lifeHistory.rows.length||w.agents.length+w.stats.deaths!==w.initialPopulation+w.stats.births)throw new Error('Повреждён учёт жизней.');
 w._due=[];w._touched=[];w._gatherGroups=new Map();const viewEpoch=w._viewEpoch;w.rebuildOccupancy();w._viewEpoch=viewEpoch;
 // Снимок деятельности относится к началу подшага: завершение движения уже
 // могло изменить process. Пересборка по текущему process меняла бы наблюдение
 // после загрузки. Новые файлы хранят этот небольшой кэш вместе с его фазой.
 if(!w._activities){rebuildActivities(w);w._activities.revision=file.activityRevision;}
 else if(!(w._activities.counts instanceof Int32Array)||w._activities.counts.length!==w.tiles.length*ACTIVITY_COUNT||!(w._activities.marked instanceof Uint8Array)||w._activities.marked.length!==w.tiles.length||w._activities.width!==WORLD_WIDTH||!Array.isArray(w._activities.touched)||!integer(w._activities.revision)||w._activities.counts.some(n=>n<0))throw new Error('Повреждён снимок видимой деятельности.');
 w._foodRevision=w.environmentRevision;w._nextGrowth=w.nextFoodRegrowth()??Infinity;
 const balance=w.balances();if(!Number.isFinite(balance.energyError)||balance.foodError!==0||Math.abs(balance.energyError)>Math.max(.1,(w.initialFood+w.stats.regrown)*RULES.foodEnergy*1e-8))throw new Error('Баланс сохранения мира не сходится.');
 return w;
}
