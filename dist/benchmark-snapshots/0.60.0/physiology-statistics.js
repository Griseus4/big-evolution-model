import {grassAmount,meatAmount} from './food-resources.js';
import {foodEnergies} from './physiology-settings.js';
/** Проверка только по запросу наблюдателя/контроля, не на каждый подшаг.
 * Энергия запаса тела, тканевая масса и потенциальная энергия пищи имеют
 * отдельные реестры: не смешиваем тепло катаболизма со съеденной порцией. */
export function physiologyBalances(w){
 const p=w.stats.physiology,Q=foodEnergies(w.physiology);let ground=0,pendingGrass=0,carried=0,gut=0,energy=0,mass=0;
 for(const c of w.tiles){const grass=c.grass?grassAmount(c.grass,w.subtick,w.physiology):0;ground+=(grass+c.looseGrass)*Q[0]+c.food*Q[1]+meatAmount(c.meat)*Q[2];pendingGrass+=c.grass?grass-c.grass.amount:0;}
 for(const a of w.agents){energy+=a.energy;mass+=a.L;carried+=a.foodInventory.reduce((s,v,j)=>s+v*Q[j],0);gut+=a.digestion.remaining.reduce((s,v)=>s+v,0);}
 const expectedEnergy=p.initialEnergy+p.newbornEnergy+p.absorbed.reduce((s,v)=>s+v,0)+p.catabolicEnergy-p.mandatoryPaid-p.motor-p.pregnancy-p.growthCost-p.healing-p.overflow-p.deathEnergy;
 const expectedMass=p.initialMass+p.bornMass+p.growth-p.catabolized-p.deadMass;
 const expectedFood=p.initialFoodEnergy+(p.regrown[0]+pendingGrass)*Q[0]+p.regrown[1]*Q[1]+p.createdMeat*Q[2]-p.spoiledMeat*Q[2]-p.absorbed.reduce((s,v)=>s+v,0)-p.excreted-p.discardedEnergy;
 return {schema:'physiology-balances-v1',energyError:energy-expectedEnergy,massError:mass-expectedMass,foodError:ground+carried+gut-expectedFood,energy,expectedEnergy,mass,expectedMass,foodEnergy:ground+carried+gut,expectedFoodEnergy:expectedFood};
}
export function physiologySummary(w){
 const n=w.agents.length;if(!n)return {meanBodyMass:0,meanMaximumMass:0,meanEnergyCapacity:0,meanHealthCapacity:0,meanStomachVolume:0,pregnancies:0,labors:0};
 let mass=0,maximum=0,energy=0,health=0,volume=0,pregnancies=0,labors=0;
 for(const a of w.agents){mass+=a.L;maximum+=a.M;energy+=a.energyCapacity;health+=a.healthCapacity;volume+=a.stomachCapacity;pregnancies+=Number(!!a.pregnancy);labors+=Number(a.pregnancy?.stage==='labor');}
 return {...(w.childCare?{carriedChildren:w.agents.reduce((n,a)=>n+Number(a.carrierId!==null),0)}:{}),meanBodyMass:mass/n,meanMaximumMass:maximum/n,meanEnergyCapacity:energy/n,meanHealthCapacity:health/n,meanStomachVolume:volume/n,pregnancies,labors};
}
