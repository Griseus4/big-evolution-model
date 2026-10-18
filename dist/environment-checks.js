import {Evolution} from './evolution.js';
import {spendEnergy} from './energy-budget.js';
import {advanceEnvironment,configureEnvironment} from './automatic-environment.js';
import {foodProduction} from './environment-settings.js';
import {saveWorld,loadWorld} from './world-save.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export const ENVIRONMENT_CHECKS=[
 {id:'environment-deficit',label:'0.36 · Неоплаченная энергия превращается в здоровье без второго штрафа',run(){const w=new Evolution({population:1}),a=w.agents[0];a.energy=0;spendEnergy(w,a,.36);assert(Math.abs(a.health-98.5)<1e-8&&w.stats.spent===0,'Оплата дефицита');}},
 {id:'environment-stages',label:'0.36 · Пять обеднений, сохранение пищи и нижний порог',run(){const w=new Evolution({population:1,automaticEnvironment:{preparationInterval:1,randomInterval:1}});for(let i=1;i<=12;i++){const stock=w.tiles.reduce((n,c)=>n+c.food,0);w.tick=i;w.subtick=i*10;advanceEnvironment(w);assert(w.tiles.reduce((n,c)=>n+c.food,0)===stock&&foodProduction(w)>=3.6-1e-9,'Потеря пищи/порог');}assert(w.automaticEnvironment.completedSteps===5,'Число ступеней');configureEnvironment(w,{enabled:false});configureEnvironment(w,{enabled:true});assert(w.automaticEnvironment.nextTick===w.tick+1,'Интервал');}},
 {id:'environment-save',label:'0.36 · Полный JSON-снимок точно продолжает мир и случайность среды',run(){const w=new Evolution({population:2,automaticEnvironment:{preparationInterval:1,randomInterval:2}});w.step();const r=loadWorld(JSON.parse(JSON.stringify(saveWorld(w))));w.step();r.step();assert(JSON.stringify(saveWorld(w))===JSON.stringify(saveWorld(r)),'Продолжение расходится');}},
];
