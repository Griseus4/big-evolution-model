/** Короткие проверки новой модели; не опыт на появление полезной стратегии. */
import {Evolution} from './evolution.js';
import {structuralLayout,validateStructure,compileStructure,contextForward,contextBackward,FIXED_PARAMETERS} from './structural-brain.js';
import {operationCounts} from './brain-cost.js';
import {saveWorld,loadWorld} from './world-save.js';
const assert=(v,m)=>{if(!v)throw new Error(m);};
export const STRUCTURAL_CHECKS=[
 {id:'structure-founder',label:'0.53 · Структура основателей и геном',run(){const w=new Evolution({population:8});for(const a of w.agents){const d=validateStructure(a.genome);assert(d.layout.hidden>=4&&d.layout.hidden<=6,'Размер скрытого блока');assert(d.edges.length===d.layout.hidden*(d.layout.inputs+16),'Полнота соседних связей');}}},
 {id:'structure-gradient',label:'0.53 · Градиент DAG и нулевой выход',run(){const w=new Evolution({population:1}),a=w.agents[0],plan=a.brain.structure,p=a.brain.networkBase.slice(),input=Float64Array.from({length:plan.inputs},(_,j)=>Math.sin(j)),dz=new Float64Array(16).fill(.5),g=new Float64Array(p.length);p[p.length-1]=0;contextBackward(p,contextForward(p,input,plan),dz,g,new Float64Array(input.length),plan);assert(Math.abs(g.at(-1))>1e-10,'Нулевой выход не обучается');for(const index of [FIXED_PARAMETERS,p.length-1]){const old=p[index],score=()=>contextForward(p,input,plan).z.reduce((s,v,j)=>s+v*dz[j],0);p[index]=old+1e-6;const high=score();p[index]=old-1e-6;const low=score();p[index]=old;assert(Math.abs((high-low)/2e-6-g[index])<1e-6,'Градиент DAG');}}},
 {id:'structure-save',label:'0.53 · Сохранение структуры и опыта',run(){const a=new Evolution({population:3});a.step();const b=loadWorld(saveWorld(a));a.step();b.step();assert(JSON.stringify(a.snapshot())===JSON.stringify(b.snapshot()),'Продолжение DAG');}},
 {id:'structure-cost',label:'0.53 · Цена зависит от выполняемой структуры',run(){const small=operationCounts({context:100,parameters:100},7,11),large=operationCounts({context:200,parameters:200},7,11);assert(large.forward>small.forward&&large.learning>small.learning,'Цена не растёт с работой');}},
];
