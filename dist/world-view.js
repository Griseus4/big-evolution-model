/** Протокол наблюдателя: без методов физики и без мозгов всей популяции.
 * Статика карты идёт только при смене мира/среды; обычный снимок содержит
 * пищу, точки жителей и подробности одной выбранной жизни. RNG не вызывается. */
import {WORLD_WIDTH} from './evolution.js';
import {foodEnvironment} from './world-edit.js';
import {environmentStatus} from './automatic-environment.js';
export const WORLD_PROTOCOL=1;
export const WORLD_UI_INTERVAL=200;
// Полный отчёт жизней нужен лишь видимой истории, не каждому кадру карты.
export const HISTORY_UI_INTERVAL=1000;
const META=['attentionMaxNeurons','attentionMaxLayers','attentionInitialNeurons','attentionInitialConnections','initialMutation','mutationEnabled','initialNeurons','initialConnections','maxNeurons','maxLayers','structuralMutations','seed','initialPopulation','initialFood','limit','scenario','geography','geographyInfo','foodSettings',
 'digestionTime','learningEnabled','memoryEnabled','mutationRate','mutations','brainType','mutationProtocol','reproduction'];
export function worldPresentation(world,{selected,trail,section='birth',history=false,staticMap=false}={}){
 const state={tick:world.tick,environmentRevision:world.environmentRevision,automaticEnvironment:environmentStatus(world),
  agents:world.agents.map(a=>({id:a.id,x:a.x,y:a.y,founderId:a.founderId})),
  food:Float64Array.from(world.tiles,c=>c.food),summary:world.summary(),
  stats:{reproduction:world.stats.reproduction,deathsByCause:world.stats.deathsByCause,started:world.stats.started,completed:world.stats.completed,interrupted:world.stats.interrupted,brainCalls:world.stats.brainCalls,gateCalls:world.stats.gateCalls,brainSpent:world.stats.brainSpent},
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
  const fields=['dual','lastDecisionSubtick','traits','controllerType','position','facing','memory','longMemory','updates','feelingTotal',
   'costProfile','feelingSamples','lastLearning','temporal','gateBase','scale','weights','bodyGenes','bodyWeights'];
  const brain=Object.fromEntries(fields.map(k=>[k,b[k]]));
  brain.networkDelta=b.networkDelta;
  const body=['id','x','y','frameRotation','founderId','generation','parentId','age','children','alive','energy','health','pain',
   'inventory','stomach','lastAction','process','resting','lastProcess','life','genome'];
  state.selected={agent:{...Object.fromEntries(body.map(k=>[k,a[k]])),brain},
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
 constructor(){this.tick=-1;this.agents=[];this.tiles=[];this.environmentRevision=-1;this.lives=null;}
 apply(state){
  if(state.metadata)Object.assign(this,state.metadata);
  if(state.tiles){this.tiles=state.tiles;this.foodIslands=state.foodIslands;this.environment=state.environment;}
  for(let i=0;i<this.tiles.length;i++)this.tiles[i].food=state.food[i];
  for(const k of ['tick','agents','stats','events','history','environmentRevision','environmentChanges'])this[k]=state[k];
  this.total=state.summary;this.nextRegrowth=state.nextRegrowth;this.detail=state.selected;
  this.execution=state.execution;this.automaticEnvironment=state.automaticEnvironment;
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
