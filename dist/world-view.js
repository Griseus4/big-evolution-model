/** Протокол наблюдателя: без методов физики и без мозгов всей популяции.
 * Статика карты идёт только при смене мира/среды; обычный снимок содержит
 * пищу, точки жителей и подробности одной выбранной жизни. RNG не вызывается. */
import {grassAmount,meatAmount} from './food-resources.js';
import {WORLD_WIDTH} from './evolution.js';
import {foodEnvironment} from './world-edit.js';
import {environmentStatus} from './automatic-environment.js';
export const WORLD_PROTOCOL=1;
export const WORLD_UI_INTERVAL=200;
// Полный отчёт жизней нужен лишь видимой истории, не каждому кадру карты.
export const HISTORY_UI_INTERVAL=1000;
const META=['childCare','physiology','bodyGenes','genomeVersion','brainCostMultiplier','attentionMaxNeurons','attentionMaxLayers','attentionInitialNeurons','attentionInitialConnections','initialMutation','mutationEnabled','initialNeurons','initialConnections','maxNeurons','maxLayers','structuralMutations','seed','initialPopulation','initialFood','limit','scenario','geography','geographyInfo','foodSettings',
 'digestionTime','learningEnabled','memoryEnabled','mutationRate','mutations','brainType','mutationProtocol','reproduction'];
export function worldPresentation(world,{selected,trail,section='birth',history=false,staticMap=false,movement=false}={}){
 const state={tick:world.tick,environmentRevision:world.environmentRevision,automaticEnvironment:environmentStatus(world),
  agents:world.agents.map(a=>{
   const point={id:a.id,x:a.x,y:a.y,founderId:a.founderId,...(world.physiology?{L:a.L,referenceMass:world.physiology.referenceMass,...(world.childCare?{carrierId:a.carrierId,carryingChildId:a.carryingChildId}:{}),pregnant:!!a.pregnancy,labor:a.pregnancy?.stage==='labor',attackTarget:a.process?.action===11?a.process.targetHandle:null}:{})},p=a.process;
   // Только наблюдателю медленной карты: физическое тело остаётся в x/y.
   // Копируем четыре числа процесса, а не мозг/полный процесс всей популяции.
   const carrierProcess=world.childCare&&a.carrierId!==null?world._physById.get(a.carrierId)?.process:null;
   if(movement&&carrierProcess?.action<6)point.movement={x:carrierProcess.destination.x,y:carrierProcess.destination.y,elapsed:carrierProcess.elapsed,duration:carrierProcess.duration};
   if(movement&&p&&p.action<6)point.movement={x:p.destination.x,y:p.destination.y,elapsed:p.elapsed,duration:p.duration};
   return point;
  }),
  ...(world.physiology?{grass:Float64Array.from(world.tiles,c=>c.looseGrass+(c.grass?grassAmount(c.grass,world.subtick,world.physiology):0)),meat:Float64Array.from(world.tiles,c=>meatAmount(c.meat))}:{}),food:Float64Array.from(world.tiles,c=>c.food),summary:world.summary(),
  stats:{physiology:world.stats.physiology,reproduction:world.stats.reproduction,deathsByCause:world.stats.deathsByCause,started:world.stats.started,completed:world.stats.completed,interrupted:world.stats.interrupted,brainCalls:world.stats.brainCalls,gateCalls:world.stats.gateCalls,brainSpent:world.stats.brainSpent},
  events:world.events.slice(0,20),history:world.history,environmentChanges:world.environmentChanges,
  nextRegrowth:world.nextFoodRegrowth(),trail:trail.points,selected:null};
 if(staticMap){
  state.metadata=Object.fromEntries(META.map(k=>[k,world[k]]));
  state.tiles=world.tiles.map(({x,y,terrain,feature,risk,maxFood,regionId})=>({x,y,terrain,feature,risk,maxFood,regionId}));
  if(world.temporal)for(const cell of state.tiles)delete cell.risk;
  state.foodIslands=world.foodIslands;state.environment=foodEnvironment(world);
 }
 if(selected){
  // Полная память только выбранного наблюдателем. Рабочие следы/градиенты и
  // pending-переход не нужны UI, их не копируем даже для выбранного мозга.
  const a=selected,b=a.brain;
  const fields=['care','physiology','dual','lastDecisionSubtick','traits','controllerType','position','facing','memory','longMemory','updates','feelingTotal',
   'costProfile','feelingSamples','lastLearning','temporal','gateBase','scale','weights','bodyGenes','bodyWeights'];
  const brain=Object.fromEntries(fields.map(k=>[k,b[k]]));
  brain.networkDelta=b.networkDelta;
  const body=['carrierId','carryingChildId','carryStarted','carryDue','L','M','energyCapacity','healthCapacity','stomachCapacity','bodyGenes','bodyPlan','foodInventory','id','x','y','frameRotation','founderId','generation','parentId','age','children','alive','energy','health','pain',
   'inventory','stomach','lastAction','process','resting','lastProcess','life','genome'];
  state.selected={agent:{...Object.fromEntries(body.map(k=>[k,a[k]])),pregnancy:a.pregnancy?{stage:a.pregnancy.stage,due:a.pregnancy.due,paid:a.pregnancy.paid,cost:a.pregnancy.cost,fraction:a.pregnancy.fraction,laborDue:a.pregnancy.laborDue}:null,brain},
   birth:world.birthAvailability(a),feeling:world.feeling(a),state:world.state(a),
   options:section==='actions'?(a.alive?world.evaluate(a):a.lastDecision?.options??[]):[],
   neighbours:world.neighbours(a),contacts:world.contacts(a),cells:world.visibleDecisionCells(a)};
  if(world.temporal)delete state.selected.agent.pain;
 }
 if(history)state.lives=world.lifeReport();
 return state;
}
/** Локальная проекция снимка. Ни один метод здесь не двигает мир/не обучает мозг. */
export class WorldView{
 constructor(){this.tick=-1;this.agents=[];this.tiles=[];this.environmentRevision=-1;this.lives=null;this.foodRevision=0;this.terrainRevision=0;}
 apply(state){
  if(state.metadata)Object.assign(this,state.metadata);
  if(state.tiles){
   if(this.tiles.length!==state.tiles.length||state.tiles.some((c,i)=>{const old=this.tiles[i];return old.x!==c.x||old.y!==c.y||old.terrain!==c.terrain||old.feature!==c.feature;}))this.terrainRevision++;
   this.tiles=state.tiles;this.foodIslands=state.foodIslands;this.environment=state.environment;
  }
  let foodChanged=Boolean(state.tiles);
  for(let i=0;i<this.tiles.length;i++){if(this.tiles[i].food!==state.food[i])foodChanged=true;this.tiles[i].food=state.food[i];if(state.grass){if(this.tiles[i].grassAmount!==state.grass[i]||this.tiles[i].meatAmount!==state.meat[i])foodChanged=true;this.tiles[i].grassAmount=state.grass[i];this.tiles[i].meatAmount=state.meat[i];}}
  if(foodChanged)this.foodRevision++;
  for(const k of ['tick','agents','stats','events','history','environmentRevision','environmentChanges'])this[k]=state[k];
  this.total=state.summary;this.nextRegrowth=state.nextRegrowth;this.detail=state.selected;
  this.execution=state.execution;this.automaticEnvironment=state.automaticEnvironment;this.motion=state.motion;
  if(state.lives)this.lives=state.lives;
 }
 tile(x,y){return x<0||y<0||x>=WORLD_WIDTH?null:this.tiles[y*WORLD_WIDTH+x]??null;}
 summary(){return this.total;}
 nextFoodRegrowth(){return this.nextRegrowth;}
 birthAvailability(){return this.detail.birth;}
 feeling(){return this.detail.feeling;}
 state(){return this.detail.state;}
 evaluate(){return this.detail.options;}
 neighbours(){return this.detail.neighbours;}
 contacts(){return this.detail.contacts;}
 visibleDecisionCells(){return this.detail.cells;}
}
