import {attachChild} from './child-care.js';
import {startProcess} from './physiology-actions.js';
import {preparePhysiologyBoundary,physiologyFrame,advancePhysiologyBodies,syncBody} from './physiology-world.js';
import {Evolution} from './evolution.js';
import {checkPhysiologyInvariants} from './physiology-invariants.js';
import {saveWorld,loadWorld} from './world-save.js';
import {createDigestion,ingestFood,advanceDigestion} from './digestion.js';
import {PHYSIOLOGY_DEFAULTS as R,BODY_GENE_DEFAULTS as G,foodEnergies} from './physiology-settings.js';
import {bodyPlan,createBody,bodyCapacities} from './body-physiology.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
/** Короткие доступные пользователю проверки новой физики. Не подбирают
 * успешную стратегию и не запускают длительные эволюционные опыты. */
export const PHYSIOLOGY_CHECKS=[
 {id:'postnatal-release',label:'0.59 · Освобождение ребёнка при гибели родителя',run(){const w=new Evolution({population:2,physiology:{},genomeVersion:19}),[p,c]=w.agents;w.moveAgent(c,p);attachChild(w,p,c);w.die(p,'attack');assert(c.alive&&c.carrierId===null&&p.carryingChildId===null,'Связь не разорвана');}},
 {id:'postnatal-passive',label:'0.59 · Память ребёнка без самостоятельных решений',run(){const w=new Evolution({population:2,physiology:{},genomeVersion:19}),[p,c]=w.agents;w.moveAgent(c,p);attachChild(w,p,c);w.substep();assert(c.brain.memory.size>0&&c.life.observer.brainCalls===0&&c.life.observer.attentionCalls===0&&c.brain.updates===0,'Пассивная память');}},
 {id:'postnatal-feed',label:'0.59 · Передача пищи ребёнку за подшаг',run(){const w=new Evolution({population:2,physiology:{},genomeVersion:19}),[p,c]=w.agents;w.moveAgent(c,p);attachChild(w,p,c);p.foodInventory[0]=2;w.stats.physiology.initialFoodEnergy+=2*w.foodEnergies[0];syncBody(w,p);preparePhysiologyBoundary(w);const f=physiologyFrame(w,p),choice=f.request.candidates.find(c=>c.action===12);p.process=startProcess(p,w.executableDecision(f,choice),0,w.physiology);advancePhysiologyBodies(w);assert(p.inventory===0&&c.stomach===2,'Пища не передана');checkPhysiologyInvariants(w);}},
 {id:'physiology-body',label:'0.57 · Тело основателя и ёмкости',run(){const a=createBody(bodyPlan(G),R),c=bodyCapacities(a,R);assert(Math.abs(a.L-100/3)<1e-10&&Math.abs(c.energy-16)<1e-10&&Math.abs(c.volume-3)<1e-10,'Контрольные размеры тела');}},
 {id:'physiology-digestion',label:'0.57 · Усвоение и выведение трёх видов пищи',run(){const q=foodEnergies(R),expected=[16.5,3.3,.36];for(let type=0;type<3;type++){const d=createDigestion(200,0);ingestFood(d,type,3,3,q);let energy=0;for(let step=1;step<=200;step++)energy+=advanceDigestion(d,step,3,[G.Fg,G.Ff,G.Fm],q);assert(Math.abs(energy-expected[type])<1e-9&&d.volume===0,'Последнее усвоение и выведение');}}},
 {id:'fractional-meal',label:'0.58 · Дробное поедание без потери остатка',run(){const d=createDigestion(200),q=foodEnergies(R);ingestFood(d,0,2.3,3,q);const meal=ingestFood(d,0,5,3,q);assert(Math.abs(meal.started-.7)<1e-9&&meal.discarded===0&&d.volume===3,'Списывается только проглоченная доля');}},
 {id:'physiology-balances',label:'0.57 · Реестры энергии, ткани и пищи',run(){const w=new Evolution({seed:42,population:8,physiology:{}});for(let i=0;i<3;i++)w.step();checkPhysiologyInvariants(w);}},
 {id:'physiology-resume',label:'0.57 · Сохранение и точное продолжение',run(){const a=new Evolution({seed:84,population:3,physiology:{}});a.step();const b=loadWorld(saveWorld(a));a.step();b.step();assert(JSON.stringify(saveWorld(a))===JSON.stringify(saveWorld(b)),'Расхождение полного состояния после загрузки');}},
];
