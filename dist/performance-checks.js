/** Пользователь запускает эти проверки в Worker. Фиктивные часы проверяют
 * учёт времени без требований к скорости компьютера; отдельный парный мир
 * проверяет отсутствие влияния наблюдателя на всю модель и генераторы RNG. */
import {PerformanceProfiler} from './performance-profiler.js';
import {LegacyEvolution as Evolution} from './evolution.js';
import {BRAIN_TYPE} from './brain-controller.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
function fixture(options={}){
 let time=0;const spend=n=>time+=n;
 const world={seed:42,tick:0,initialPopulation:1,limit:2,brainType:'fixture',foodSettings:{sourceCount:1,regrowInterval:20},agents:[{brain:{memory:new Map(),longMemory:new Map()}}],stats:{actions:[0]},observe(){spend(3);},evaluateFrame(n){spend(n);},choose(){spend(5);this.evaluateFrame(5);},learnPending(){spend(6);this.evaluateFrame(7);},record(){spend(2);},die(){},step(){spend(2);this.observe();this.choose();this.learnPending();this.record();this.tick++;this.stats.actions[0]++;}};
 const profiler=new PerformanceProfiler({clock:()=>time,...options});
 return {world,profiler,spend};
}
export const PERFORMANCE_CHECKS=[
 {id:'performance-continuation',label:'Профиль: скалярное продолжение относится к оценке, без двойного счёта',run(){
  const {world,profiler,spend}=fixture({sampleEvery:1});
  const original=world.expectedContinuation=n=>{spend(n);return 0;};world.learnPending=function(){spend(6);this.expectedContinuation(7);};
  profiler.start(world);world.step();profiler.stop();const r=profiler.report();
  assert(r.groups.evaluation.ms===12&&r.groups.learning.ms===6&&r.stepMs===30,'Неверные группы продолжения');assert(world.expectedContinuation===original,'Не восстановлен скалярный метод');
 }},
 {id:'performance-exclusive',label:'Профиль: вложенное время, выборка и число действий',run(){
  const {world,profiler}=fixture({sampleEvery:2});profiler.start(world);world.step();world.step();world.step();profiler.stop();const r=profiler.report();
  assert(r.steps===3&&r.actions===3&&r.stepMs===90&&r.sampledSteps===2,'Потеря шагов/действий/выборки');
  assert(r.groups.evaluation.ms===24&&r.groups.selection.ms===10&&r.groups.learning.ms===12,'Двойной учёт вложенной оценки');
  assert(r.breakdown.filter(g=>g.scope==='sampled-simulation').reduce((n,g)=>n+g.ms,0)===60,'Группы не сходятся с полными выбранными шагами');
 }},
 {id:'performance-pause',label:'Профиль: пауза исключается, срок записи и восстановление методов',run(){
  const {world,profiler,spend}=fixture({durationMs:100});const original=world.step;
  profiler.start(world,{running:true});spend(40);profiler.setRunning(false);spend(500);profiler.setRunning(true);spend(60);profiler.setRunning(true);
  const r=profiler.report();assert(!profiler.active&&r.activeMs===100&&r.reason==='duration','Пауза или двойной учёт срока');
  assert(world.step===original&&profiler.restores.length===0,'Не возвращены исходные методы');
  profiler.start(world);profiler.stop();assert(profiler.report().steps===0&&world.step===original,'Повтор записи сохраняет старые шаги');
 }},
 {id:'performance-invariance',label:'Профиль: нейросеть и старый мозг сохраняют состояние/RNG',run(){
  for(const options of [{},{brainType:BRAIN_TYPE},{learning:false,memory:false}]){
   const config={seed:42,population:4,limit:12,foodSources:24,...options},a=new Evolution(config),b=new Evolution(config),profiler=new PerformanceProfiler({durationMs:1e9,sampleEvery:3});
   const original=b.step;profiler.start(b);a.advance(60);b.advance(60);profiler.stop();
   assert(JSON.stringify(a.snapshot())===JSON.stringify(b.snapshot()),'Измеритель изменил модель или RNG');
   assert(b.step===original&&profiler.report().steps===b.tick,'Не восстановлен метод или потеря шагов');
  }
 }},
 {id:'performance-interface',label:'Профиль: интерфейс отдельно, исключение не ломает стек',run(){
  const {world,profiler,spend}=fixture();profiler.start(world,{running:true});
  profiler.measureUI('panel',()=>{spend(2);profiler.measureUI('resident',()=>{world.evaluateFrame(4);});});
  assert(profiler.report().groups.panel.ms===2&&profiler.report().groups.resident.ms===4&&!profiler.report().groups.evaluation,'Оценка для панели попала в симуляцию');
  let rejected=false;try{profiler.measureUI('panel',()=>{spend(1);throw new Error('fixture');});}catch{rejected=true;}
  assert(rejected&&profiler.stack.length===0,'Исключение не проброшено или стек остался открытым');
  profiler.stop();assert(profiler.report().steps===0,'Интерфейс запустил мир');
 }},
];
