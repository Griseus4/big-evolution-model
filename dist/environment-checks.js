import {Evolution} from './evolution.js';
import {spendEnergy} from './energy-budget.js';
import {advanceEnvironment,configureEnvironment} from './automatic-environment.js';
import {foodProduction,ENVIRONMENT_RULES} from './environment-settings.js';
import {saveWorld,loadWorld} from './world-save.js';
import {worldAxial} from './navigation.js';
import {translateFoodGroup} from './food-island-evolution.js';
import {aggregateLifeCohorts} from './life-cohorts.js';
import {sensitivityDistributions} from './heritable-statistics.js';
import {productionCohorts} from './food-production-history.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export const ENVIRONMENT_CHECKS=[
 {id:'v037-group-shape',label:'0.37 · Целый островок сохраняет форму переноса и запасы',run(){const w=new Evolution({population:1}),g=structuredClone(w.foodIslands.find(g=>g.kind==='island')),before=g.sources.map(worldAxial),stock=w.tiles.map(c=>c.food),used=new Set(g.sources.map(p=>`${p.x},${p.y}`)),m=translateFoodGroup(w,g,used,w.automaticEnvironment.random);if(m){const a=worldAxial(m.from),b=worldAxial(m.to);for(let i=0;i<g.sources.length;i++){const p=worldAxial(g.sources[i]);assert(p.q-before[i].q===b.q-a.q&&p.r-before[i].r===b.r-a.r,'Искажена форма');}}assert(w.tiles.every((c,i)=>c.food===stock[i]),'Перенесена пища');}},
 {id:'v037-genetic-statistics',label:'0.37 · Наследуемые значения живых и распределение чувствительностей',run(){const w=new Evolution({population:2}),r=w.lifeReport(),g=aggregateLifeCohorts(r).cohorts[0];assert(g.metrics.senseEnergy.count===2&&g.metrics.lifetime.count===0,'Неверный состав');const d=sensitivityDistributions(r.living,{start:0,end:100})[0];assert(d.count===2&&Math.abs(d.points.reduce((n,p)=>n+p.mean,0)-100)<1e-8,'Неверные доли');}},
 {id:'v037-production-integral',label:'0.37 · Выработка пищи усредняется по времени событий',run(){const p=productionCohorts([{tick:0,value:2},{tick:5,value:6}],10,10);assert(p.length===1&&p[0].mean===4,'Неверное среднее');}},
 {id:'environment-deficit',label:'0.36 · Неоплаченная энергия превращается в здоровье без второго штрафа',run(){const w=new Evolution({population:1}),a=w.agents[0];a.energy=0;spendEnergy(w,a,.36);assert(Math.abs(a.health-98.5)<1e-8&&w.stats.spent===0,'Оплата дефицита');}},
 {id:'environment-stages',label:'0.36 · Пять обеднений, сохранение пищи и нижний порог',run(){const w=new Evolution({population:1,automaticEnvironment:{preparationInterval:1,randomInterval:1}});for(let i=1;i<=12;i++){const stock=w.tiles.reduce((n,c)=>n+c.food,0);w.tick=i;w.subtick=i*10;advanceEnvironment(w);assert(w.tiles.reduce((n,c)=>n+c.food,0)===stock&&foodProduction(w)>=ENVIRONMENT_RULES.minimumRate-1e-9,'Потеря пищи/порог');}assert(w.automaticEnvironment.completedSteps===5,'Число ступеней');configureEnvironment(w,{enabled:false});configureEnvironment(w,{enabled:true});assert(w.automaticEnvironment.nextTick===w.tick+1,'Интервал');}},
 {id:'environment-save',label:'0.36 · Полный JSON-снимок точно продолжает мир и случайность среды',run(){const w=new Evolution({population:2,automaticEnvironment:{preparationInterval:1,randomInterval:2}});w.step();const r=loadWorld(JSON.parse(JSON.stringify(saveWorld(w))));w.step();r.step();assert(JSON.stringify(saveWorld(w))===JSON.stringify(saveWorld(r)),'Продолжение расходится');}},
];
