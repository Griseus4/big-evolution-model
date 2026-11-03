import {INPUT_SCALES} from './brain-input-scales.js';
import {beginComputePart,endComputePart} from './performance-probe.js';
import {getMemory,memoryBelief,spatialContext,FEATURE_NAMES} from './cognition.js';
import {positionKey,localNeighbours} from './navigation.js';
import {densitySignal} from './neighbour-perception.js';
import {target as spatialTarget} from './temporal-inputs.js';
import * as legacyLayout from './physiology-brain-layout.js';
const bound=x=>Math.max(-1,Math.min(1,x));
export function createPhysiologyInputs(layout,care=false){
const {BODY_NAMES,CELL_INPUTS,CANDIDATE_INPUTS,OPERATION_NAMES,TARGET_NAMES,PROCESS_NAMES,ACTIVITY_NAMES,operationForAction}=layout,N=OPERATION_NAMES.length,A=ACTIVITY_NAMES.length;
function target(brain,o,c,memory,out,at){
 spatialTarget(brain,o,c.localDestination,c.cell,memory,out,at,c.repeat);
 for(let j=0;j<A;j++)out[at+14+j]=densitySignal(c.cell?.activities?.[j]??0);
 let i=at+14+A;
 for(let j=0;j<3;j++)out[i++]=(c.cell?.foods?.[j]??0)/INPUT_SCALES.food;
 for(let j=0;j<3;j++)out[i++]=Number(c.foodType===j);
 const v=c.visibleTarget;
 out[i++]=Number(!!v);out[i++]=v?v.size/(v.size+o.body.L):0;out[i++]=v?.health??0;
 for(let j=0;j<(care?13:12);j++)out[i++]=Number(v?.action===j);
 out[i++]=Number(v?.action==='labor');if(care)out[i++]=Number(v?.action==='carried');out[i++]=Number(Boolean(v?.attacksMe));out[i++]=Number(Boolean(v?.attacksOther));
 const record=o.memoryEnabled?getMemory(brain,positionKey(c.localDestination)):null,belief=record?memoryBelief(record,o.tick,brain.traits):null;for(let j=0;j<3;j++)out[i++]=(belief?.foods?.[j]??0)/INPUT_SCALES.food;
 for(let j=at;j<at+TARGET_NAMES.length;j++)out[j]=bound(out[j]);
}
function prepareSetInput(brain,request){const mark=beginComputePart('inputs');try{return preparePhysiologyInput(brain,request);}finally{endComputePart(mark);}}
function preparePhysiologyInput(brain,request){
 const o=request.observation,b=o.body,c=o.capacities,body=new Float64Array(BODY_NAMES.length);
 body.set([b.energy/c.energy,b.health/c.health,b.inventory/c.inventory,b.stomach/c.stomach,b.L/c.referenceMass,b.M/c.referenceMass,b.L/b.M,b.age/b.adultSteps,Number(b.pregnant),b.pregnancyPaid,b.pregnancyProgress,Number(b.labor),...b.foodInventory.map(v=>v/c.inventory)]);
 if(care)body.set([Number(!!b.child),b.child?b.child.size/(b.child.size+b.L):0,b.child?.health??0,b.child?.remaining??0],15);
 // Размеры тела допускают превышение опорной массы; сжатие монотонное,
 // не скрывает разницу между большими телами жёстким отсечением.
 body[4]/=1+body[4];body[5]/=1+body[5];body[7]/=1+body[7];
 const memory=o.memoryEnabled?Float64Array.from(spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick)):new Float64Array(7);
 const cells=o.cells.map(c=>{
  const r=o.memoryEnabled?getMemory(brain,positionKey(c)):null,b=r?memoryBelief(r,o.tick,brain.traits):null,input=new Float64Array(CELL_INPUTS);
  input.set([c.q-o.position.q,c.r-o.position.r,c.food/INPUT_SCALES.food,Number(c.terrain==='water'),densitySignal(c.neighbours),Number(c.q===o.position.q&&c.r===o.position.r),Number(!!r),(b?.food??0)/INPUT_SCALES.food,b?.confidence??0,Number(c.isFoodSource)]);
  for(let j=0;j<A;j++)input[10+j]=densitySignal(c.activities?.[j]??0);
  for(let j=0;j<3;j++)input[10+A+j]=(c.foods?.[j]??0)/INPUT_SCALES.food;
  for(let j=0;j<3;j++)input[13+A+j]=(b?.foods?.[j]??0)/INPUT_SCALES.food;
  return input.map(bound);
 });
 const process=new Float64Array(PROCESS_NAMES.length),p=o.process;
 process[N+3+o.callReason]=1;
 if(p){process[operationForAction(p.action)]=1;process[N]=Number(p.active);process[N+1]=p.progress;process[N+2]=p.remaining/INPUT_SCALES.processSubsteps;target(brain,o,p,memory,process,N+6);}
 return {body,cells,memory,process,senses:[body[2],body[3]],potentials:memory};
}
function setCandidateInput(brain,o,c,prepared,reuseInput=null,reuseFeatures=null){
 const input=reuseInput??new Float64Array(CANDIDATE_INPUTS),features=reuseFeatures??Array(FEATURE_NAMES.length).fill(0),operation=operationForAction(c.action);
 input.fill(0);input[operation]=1;target(brain,o,c,prepared.memory,input,N);
 const tail=N+TARGET_NAMES.length;input[tail]=Number(c.continuation);input[tail+1]=c.duration/INPUT_SCALES.processSubsteps;input[tail+2]=(c.computeCharge??c.decisionCost)/INPUT_SCALES.decisionEnergy;
 features.fill(0);features[0]=Number(c.action<6&&c.cell.food>0);features[2]=Number(c.repeat);features[3]=input[N+9];features[5]=input[N+11];features[6]=input[N+10];features[7]=(1-o.body.energy/o.capacities.energy)*features[3];
 return {input,features,operation};
}
function prepareSetDecisionInput(brain,request){const prepared=prepareSetInput(brain,request);return {brain,request,prepared,rows:request.candidates.map(c=>setCandidateInput(brain,request.observation,c,prepared))};}

return {prepareSetInput,setCandidateInput,prepareSetDecisionInput};
}
export const {prepareSetInput,setCandidateInput,prepareSetDecisionInput}=createPhysiologyInputs(legacyLayout);
