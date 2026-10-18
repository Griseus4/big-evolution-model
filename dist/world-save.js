/** Ручной снимок только на согласованной границе. Личные мозги перед вызовом
 * синхронизирует Runtime; восстановление не создаёт основателей/бросков RNG. */
import {Evolution,WORLD_WIDTH,WORLD_HEIGHT,RULES} from './evolution.js';
import {MODEL_VERSION,LifeHistory} from './life-history.js';
import {Random} from './simulation.js';
import {rebuildActivities} from './activity-perception.js';
import {encodeState,decodeState} from './state-codec.js';
import {TEMPORAL_BRAIN_TYPE,SET_PARAMETER_COUNT,GATE_PARAMETERS} from './temporal-layout.js';
import {genomeMetadata,validateGenomeFile} from './genome.js';
import {validateEnvironmentSettings,ENVIRONMENT_RULES,foodProduction} from './environment-settings.js';
import {controllerProblems} from './brain-controller.js';
export const WORLD_SAVE_FORMAT='big-evolution-world',WORLD_SAVE_VERSION=1,MAX_WORLD_SAVE_BYTES=512*1024*1024;
const FIELDS=('temporal individualFood geography learningEnabled memoryEnabled reproduction seed random cognitiveRandom bodyRandom scenario heritableMutations upgradeMutationGenes mutationRandom brainType neuralRandom initialPopulation limit mutationRate mutations baseGenome tick nextId maxGeneration events history agents foodCycleStart environmentRevision environmentChanges lifeHistory lifeExposure records lineages tiles stats sourceTemplate foodIslands initialFood foodSettings initialFoodSettings initialFoodIslands mutationProtocol geographyInfo foodExposure subtick _primed _viewEpoch automaticEnvironment').split(' ');
export function saveWorld(w){
 if(!w.temporal)throw new Error('Полное сохранение поддерживает текущую модель.');
 const state=Object.fromEntries(FIELDS.filter(k=>Object.hasOwn(w,k)).map(k=>[k,w[k]]));
 return {format:WORLD_SAVE_FORMAT,version:WORLD_SAVE_VERSION,modelVersion:MODEL_VERSION,activityRevision:w._activities?.revision??0,state:encodeState(state)};
}
export function loadWorld(file){
 if(file?.format!==WORLD_SAVE_FORMAT||file.version!==WORLD_SAVE_VERSION||file.modelVersion!==MODEL_VERSION)throw new Error('Неподдерживаемый формат или версия сохранения мира.');
 const state=decodeState(file.state),w=Object.create(Evolution.prototype);
 if(!state||Object.keys(state).some(k=>!FIELDS.includes(k)))throw new Error('Недопустимые поля мира.');Object.assign(w,state);
 const valid=n=>typeof n==='number'&&Number.isFinite(n),integer=n=>Number.isSafeInteger(n)&&n>=0;
 if(w.temporal!==true||w.individualFood!==true||w.brainType!==TEMPORAL_BRAIN_TYPE||!integer(w.subtick)||w.tick!==w.subtick/10||!integer(w.nextId)||!Array.isArray(w.agents)||!Array.isArray(w.tiles)||w.tiles.length!==WORLD_WIDTH*WORLD_HEIGHT||!(w.lifeHistory instanceof LifeHistory)||!(w.records instanceof Map)||!(w.lineages instanceof Map))throw new Error('Повреждена структура мира.');
 for(const key of ['random','cognitiveRandom','bodyRandom','neuralRandom','mutationRandom'])if(!(w[key] instanceof Random)||!integer(w[key].state)||w[key].state>4294967295)throw new Error('Повреждено состояние случайности.');
 for(let i=0;i<w.tiles.length;i++){const c=w.tiles[i];if(c.x!==i%WORLD_WIDTH||c.y!==Math.floor(i/WORLD_WIDTH)||!['land','water'].includes(c.terrain)||!integer(c.food)||!valid(c.maxFood)||c.maxFood<0)throw new Error('Повреждена клетка карты.');}
 const ids=new Set();for(const a of w.agents){
  if(!integer(a.id)||a.id<1||a.id>=w.nextId||ids.has(a.id)||a.alive!==true||!integer(a.x)||!integer(a.y)||w.tile(a.x,a.y)?.terrain!=='land'||!valid(a.energy)||a.energy<0||a.energy>100||!valid(a.health)||a.health<=0||a.health>100||!valid(a.stomach)||a.stomach<0||a.stomach>RULES.stomachCapacity+1e-7||!integer(a.inventory)||a.inventory>RULES.inventoryCapacity||!valid(a.age)||a.age<0||!Array.isArray(a.genome)||genomeMetadata(a.genome).brainType!==TEMPORAL_BRAIN_TYPE||a.genome.some(n=>!valid(n))||!(a.brain?.memory instanceof Map)||!(a.brain?.longMemory instanceof Map)||a.brain.controllerType!==TEMPORAL_BRAIN_TYPE||a.brain.networkBase?.length!==SET_PARAMETER_COUNT||a.brain.networkDelta?.length!==SET_PARAMETER_COUNT)throw new Error('Повреждено состояние жителя.');
  ids.add(a.id);if(a.process&&(!integer(a.process.action)||a.process.action>10||!integer(a.process.elapsed)||!integer(a.process.duration)||a.process.duration<1||a.process.elapsed>=a.process.duration||!w.tile(a.process.destination?.x,a.process.destination?.y)))throw new Error('Повреждено текущее действие.');
 }
 if(!w.foodExposure||w.foodExposure.length!==Math.floor(w.tick)+1||!Array.isArray(w.foodExposure.blocks)||w.foodExposure.blocks.some(b=>!(b instanceof Float64Array)))throw new Error('Повреждена история пищевых условий.');
 const sourceCells=new Set();for(const g of w.foodIslands){if(!valid(g.period)||g.period<=0||!valid(g.nextTick)||g.nextTick<=w.tick||!Array.isArray(g.sources))throw new Error('Повреждено расписание пищи.');for(const p of g.sources){const c=w.tile(p.x,p.y),id=p.y*WORLD_WIDTH+p.x;if(!c||c.maxFood<=0||sourceCells.has(id))throw new Error('Повреждён источник пищи.');sourceCells.add(id);}}
 if(sourceCells.size!==w.tiles.filter(c=>c.maxFood>0).length)throw new Error('Неполное расписание источников.');
 const environment=w.automaticEnvironment;if(!environment||environment.schema!=='automatic-food-v1'||!(environment.random instanceof Random)||!integer(environment.random.state)||environment.random.state>4294967295||!integer(environment.completedSteps)||environment.completedSteps>ENVIRONMENT_RULES.preparationSteps||typeof environment.preparationCancelled!=='boolean'||environment.enabled&&(!valid(environment.nextTick)||environment.nextTick<=w.tick||foodProduction(w)+1e-9<ENVIRONMENT_RULES.minimumRate))throw new Error('Повреждена автоматическая среда.');validateEnvironmentSettings(environment);
 for(const a of w.agents){validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(a.genome),genes:a.genome});if(!(a.brain.networkBase instanceof Float64Array)||!(a.brain.networkDelta instanceof Float64Array)||a.brain.gateBase?.length!==GATE_PARAMETERS||!a.brain.gateBase.every(Number.isFinite)||controllerProblems(a.brain).length)throw new Error('Повреждены веса/память/переход мозга.');}
 if(w.lifeHistory.all?.count!==w.stats.deaths||!Array.isArray(w.lifeHistory.rows)||!integer(w.lifeHistory.offset)||w.lifeHistory.offset>w.lifeHistory.rows.length||w.agents.length+w.stats.deaths!==w.initialPopulation+w.stats.births)throw new Error('Повреждён учёт жизней.');
 w._due=[];w._touched=[];w._gatherGroups=new Map();const viewEpoch=w._viewEpoch;w.rebuildOccupancy();w._viewEpoch=viewEpoch;rebuildActivities(w);w._activities.revision=file.activityRevision;
 w._foodRevision=w.environmentRevision;w._nextGrowth=w.nextFoodRegrowth()??Infinity;
 const balance=w.balances();if(!Number.isFinite(balance.energyError)||balance.foodError!==0||Math.abs(balance.energyError)>Math.max(.1,(w.initialFood+w.stats.regrown)*RULES.foodEnergy*1e-8))throw new Error('Баланс сохранения мира не сходится.');
 return w;
}
