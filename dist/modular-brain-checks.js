import {Evolution} from './evolution.js';
import {dualMutationProfiles,mutateDualGenome,validateDualBrain} from './dual-brain-genome.js';
import {MODULAR_MUTATION_GROUPS} from './brain-evolution-rules.js';
import {Random} from './simulation.js';
import {saveWorld,loadWorld} from './world-save.js';
import {checkPhysiologyInvariants} from './physiology-invariants.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export const MODULAR_BRAIN_CHECKS=[
 {id:'modular-six-networks',label:'0.60 · Шесть изменяемых блоков и активные профили',run(){const w=new Evolution({population:1,physiology:{},genomeVersion:20}),g=w.agents[0].genome,d=validateDualBrain(g),p=dualMutationProfiles(g);assert(Object.keys(d.graphs).length===6&&p.cells.shape===1&&Math.abs(p.targetStructure.rate-.5)<1e-12,'Размер/профили новой схемы');}},
 {id:'modular-freeze',label:'0.60 · Отключённые мутации сохраняют весь геном',run(){const w=new Evolution({population:1,physiology:{},genomeVersion:20}),g=w.agents[0].genome,next=mutateDualGenome(g,new Random(42),{mutationEnabled:Object.fromEntries(MODULAR_MUTATION_GROUPS.map(k=>[k,false]))});assert(JSON.stringify(g)===JSON.stringify(next),'Изменился выключенный геном');}},
 {id:'modular-resume',label:'0.60 · Полный мир шести сетей продолжается точно',run(){const a=new Evolution({population:2,physiology:{},genomeVersion:20,brainModules:{cells:{initialNeurons:[2]}}});a.step();const b=loadWorld(saveWorld(a));a.step();b.step();checkPhysiologyInvariants(a);assert(JSON.stringify(saveWorld(a))===JSON.stringify(saveWorld(b)),'Не совпало продолжение');}},
];
