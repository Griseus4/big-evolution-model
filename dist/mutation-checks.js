/** v9: исполняемые проверки запускает пользователь, не агент.
 * Проверяем контракт наследования, а не обязательное преимущество какой-либо
 * частоты мутаций. Управляемые RNG используются только в этих фикстурах. */
import {Evolution as CurrentEvolution} from './evolution.js';
import {Random} from './simulation.js';
import {BRAIN_TYPE,createControllerState} from './brain-controller.js';
import {NEURAL_LAYOUTS,NEURAL_BRAIN_TYPE,NEIGHBOUR_BRAIN_TYPE,layoutForGenes} from './neural-layout.js';
import {genomeMetadata,validateGenomeFile,mutateGenome,randomNeuralGenome} from './genome.js';
import {mutationGenes,mutationOffset,mutationProfile,withMutationGenes,MUTATION_RULES,effectiveMutationRate} from './mutation-parameters.js';
import {analyzeGenome,compareGenomes} from './genome-analysis.js';
import {validateExperimentConfig,experimentJobs,checkInvariants} from './experiment-runner.js';
import {captureBenchmarkState,restoreBenchmarkState} from './benchmark-state.js';
class Evolution extends CurrentEvolution {constructor(options={}){super({brainType:'mlp-neighbours-v1',...options});}}
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const equal=(a,b,message)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
const inherited=(rate=.02,strength=.7)=>[...Array(606).fill(0),...mutationGenes(rate,strength)];
export const MUTATION_CHECKS=[
 {id:'mutation-founder-stream',label:'Изменчивость: основатели различаются, прежние веса/позиции/RNG не сдвигаются',run(){
  const options={seed:42,population:12,limit:30},newWorld=new Evolution(options),oldWorld=new Evolution({...options,heritableMutations:false});
  const profiles=newWorld.agents.map(a=>mutationProfile(a.genome));
  assert(new Set(profiles.map(p=>p.rate)).size===12,'Основатели одинаковы');
  for(let i=0;i<12;i++){
   const a=newWorld.agents[i],b=oldWorld.agents[i],p=profiles[i];
   equal(a.genome.slice(0,606),b.genome,'Изменены веса');equal([a.x,a.y],[b.x,b.y],'Изменены позиции');
   assert(p.rate>=.001-1e-15&&p.rate<=.1+1e-15&&p.strength>=.05-1e-15&&p.strength<=1+1e-15,'Начальный диапазон');
  }
  for(const key of ['random','cognitiveRandom','bodyRandom','neuralRandom'])assert(newWorld[key].state===oldWorld[key].state,'Сдвинут поток '+key);
 }},
 {id:'mutation-positive-floor',label:'Изменчивость: ненулевой фон/сила, вероятность не превышает 1',run(){
  for(const raw of [-1e6,0,1e6]){
   const genes=inherited();genes[606]=raw;const p=mutationProfile(genes);
   assert(p.rate>=MUTATION_RULES.rateFloor&&p.rate<=1&&p.strength>0,'Границы вероятности');
   assert(effectiveMutationRate(p,true)>=MUTATION_RULES.rateFloor,'Медленная группа ниже фона');
  }
  const p=mutationProfile([...Array(606).fill(0),...mutationGenes(.0001,0)]);
  assert(p.rate>0&&p.strength>=MUTATION_RULES.strengthFloor,'Нулевая сила');
 }},
 {id:'mutation-parent-profile',label:'Изменчивость: v9 использует родителя, внешние rate/scale не переопределяют его',run(){
  const parent=inherited(.12,.5),saved=parent.slice();
  const a=mutateGenome(parent,new Random(7),0,0),b=mutateGenome(parent,new Random(7),1,7);
  equal(a,b,'Внешние параметры влияют на v9');equal(parent,saved,'Изменён родитель');
  assert(a.some((v,i)=>v!==parent[i]),'Фикстура не вызвала мутации');
  assert(a.slice(0,606).every(v=>Number.isFinite(v)&&Math.abs(v)<=8),'Повреждены параметры мозга');
 }},
 {id:'mutation-no-forced-meta',label:'Изменчивость: регуляторы не меняются гарантированно при каждом рождении',run(){
  const genes=inherited(.01,.5),child=mutateGenome(genes,{next:()=>.9},1);
  equal(child,genes,'Есть принудительная мутация');assert(child!==genes,'Нет независимой копии');
 }},
 {id:'mutation-relative-step',label:'Изменчивость: лог-шаг даёт относительное изменение силы, не прибавку процентов',run(){
  const genes=inherited(.1,.5),profile=mutationProfile(genes);let draw=0;
  const child=mutateGenome(genes,{next:()=>draw++%2? .75:0}),after=mutationProfile(child);
  assert(Math.abs(after.strength/profile.strength-Math.sqrt(1+profile.strength))<1e-12,'Неверный относительный шаг');
  assert(after.rate>profile.rate&&after.rate<1,'Неверное изменение вероятности');
  const expected=.25;assert(Math.abs(child[0]-expected)<1e-12,'Мозг использовал изменённую силу ребёнка');
 }},
 {id:'mutation-old-adapters',label:'Изменчивость: преобразование таблицы/v7/v8 сохраняет прежние гены и мозг',run(){
  for(const genes of [Array(572).fill(0),Array(558).fill(0),Array(606).fill(0)]){
   const upgraded=withMutationGenes(genes,new Random(42));equal(upgraded.slice(0,genes.length),genes,'Переписан мозг');
   assert(upgraded.length===genes.length+2&&mutationOffset(upgraded)===genes.length,'Неверный хвост');
   assert(createControllerState(upgraded).controllerType===createControllerState(genes).controllerType,'Мозг заменён');
   equal(withMutationGenes(upgraded,new Random(23)),upgraded,'Добавлен второй хвост');
   const file={format:'big-evolution-genome',...genomeMetadata(upgraded),genes:upgraded};equal(validateGenomeFile(file),upgraded,'Не читается преобразование');
  }
 }},
 {id:'mutation-explicit-upgrade',label:'Изменчивость: старый импорт не расширяется, явная галочка добавляет общую пару',run(){
  const base=randomNeuralGenome(new Random(23)),oldWorld=new Evolution({population:3,baseGenome:base}),upgraded=new Evolution({population:3,baseGenome:base,upgradeMutationGenes:true});
  assert(oldWorld.agents.every(a=>a.genome.length===558&&!mutationProfile(a.genome)),'Импорт расширен автоматически');
  assert(upgraded.agents.every(a=>a.genome.length===560&&a.brain.controllerType===NEURAL_BRAIN_TYPE),'Неверное преобразование');
  equal(upgraded.agents[0].genome,upgraded.agents[1].genome,'Основатели получили разные пары общей основы');equal(base,oldWorld.agents[0].genome,'Переписан файл основы');
 }},
 {id:'mutation-disabled-inheritance',label:'Изменчивость: выключение мутаций копирует весь v9, опыт не наследуется',run(){
  const world=new Evolution({population:1,limit:3,mutations:false}),a=world.agents[0];a.age=100;a.energy=90;
  a.brain.networkDelta.fill(.2);const child=world.reproduce(a);assert(child,'Нет рождения');equal(child.genome,a.genome,'Изменены гены при выключенных мутациях');
  assert(child.brain.networkDelta.every(v=>v===0)&&child.brain.memory.size===0&&child.brain.longMemory.size===0,'Наследован опыт');
 }},
 {id:'mutation-v9-validation',label:'Изменчивость: v9 проверяет схему/размер/конечность, не принимает повреждённые файлы',run(){
  const genes=inherited(),file={format:'big-evolution-genome',...genomeMetadata(genes),genes};equal(validateGenomeFile(file),genes,'Импорт изменён');
  for(const bad of [{...file,mutationSchema:'unknown'},{...file,version:8},{...file,brainType:BRAIN_TYPE},{...file,genes:genes.slice(0,-1)},
   {...file,genes:genes.map((v,i)=>i===607?Infinity:v)},{...file,genes:genes.map((v,i)=>i===607?-1e6:v)}]){
   let rejected=false;try{validateGenomeFile(bad);}catch{rejected=true;}assert(rejected,'Повреждение принято');
  }
 }},
 {id:'mutation-analysis',label:'Изменчивость: анализ показывает два свойства, старый и новый мозг сравниваются по тем же весам',run(){
  for(const genes of [Array(572).fill(0),Array(558).fill(0),Array(606).fill(0)]){
   const old=analyzeGenome({format:'big-evolution-genome',...genomeMetadata(genes),genes}),g=withMutationGenes(genes,new Random(42)),a=analyzeGenome({format:'big-evolution-genome',...genomeMetadata(g),genes:g});
   const rate=a.properties.find(p=>p.key==='mutationRate');assert(a.genomeVersion===9&&rate.derived>0&&a.mutation.strength>0,'Нет расшифровки');
   const pair=compareGenomes(old,a);assert(pair.changedGenes===0&&pair.onlyB===2,'Старые гены признаны изменёнными');
  }
 }},
 {id:'mutation-jobs-restore',label:'Изменчивость: испытания передают преобразование, снимок восстанавливает новый RNG',run(){
  const config=validateExperimentConfig({seeds:[42],population:3,limit:10,steps:1000,parallel:1,baseGenome:Array(606).fill(0),upgradeMutationGenes:true});
  assert(experimentJobs(config).every(j=>j.upgradeMutationGenes===true),'Потеряна галочка');
  const a=new Evolution({population:3}),b=restoreBenchmarkState(captureBenchmarkState(a));
  assert(b.mutationRandom.next()===a.mutationRandom.next(),'Потерян поток регуляторов');
  checkInvariants(b);
 }},
 {id:'mutation-world-repeatability',label:'Изменчивость: новые миры повторяются, рождения и балансы остаются корректными',run(){
  const options={seed:23,population:6,limit:20},a=new Evolution(options),b=new Evolution(options);
  for(let tick=0;tick<64&&a.agents.length;tick++){a.step();b.step();equal(a.snapshot(),b.snapshot(),'Миры расходятся');checkInvariants(a);}
  assert(a.agents.every(agent=>mutationProfile(agent.genome)),'Регуляторы потерялись');
 }},
];
