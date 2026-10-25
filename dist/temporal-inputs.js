import {INPUT_SCALES} from './brain-input-scales.js';
/** Числовые данные одного момента выбора. Состояние процесса — сведения
 * собственного тела, цель содержит только обзор и прежнюю личную память. */
import {getMemory,memoryBelief,spatialContext,FEATURE_NAMES} from './cognition.js';
import {positionKey,localNeighbours} from './navigation.js';
import {densitySignal} from './neighbour-perception.js';
import {CELL_INPUTS,CANDIDATE_INPUTS,TARGET_NAMES,PROCESS_NAMES,operationForAction} from './temporal-layout.js';
import {ACTIVITY_COUNT} from './activity-perception.js';
import {beginComputePart,endComputePart} from './performance-probe.js';
const bound=x=>Math.max(-1,Math.min(1,x));
function target(brain,o,place,cell,potentials,out,at,repeat=false){
 const r=o.memoryEnabled?getMemory(brain,positionKey(place)):null,b=r?memoryBelief(r,o.tick,brain.traits):null;
 const dq=place.q-o.position.q,dr=place.r-o.position.r,own=dq===0&&dr===0;
 let gradient=0;if(o.memoryEnabled&&!own){const positions=localNeighbours(brain),i=positions.findIndex(p=>p.q===place.q&&p.r===place.r);if(i>=0)gradient=potentials[i+1]-potentials[0];}
 out[at]=dq;out[at+1]=dr;out[at+2]=(cell?.food??0)/INPUT_SCALES.food;out[at+3]=densitySignal(cell?.neighbours??0);out[at+4]=Number(repeat);out[at+5]=Number(Boolean(r));out[at+6]=b?.confidence??0;out[at+7]=(b?.food??0)/INPUT_SCALES.food;out[at+8]=r?Math.max(0,o.tick-r.lastSeen)/brain.traits.memoryAge:0;out[at+9]=gradient;out[at+10]=b?.uncertainty??0;out[at+11]=Number(o.memoryEnabled&&(!r||r.visits===0));out[at+12]=Number(own);out[at+13]=Number(Boolean(cell?.isFoodSource));
 for(let i=0;i<14;i++)out[at+i]=bound(out[at+i]);
 for(let i=0;i<ACTIVITY_COUNT;i++)out[at+14+i]=densitySignal(cell?.activities?.[i]??0);
}
export function prepareSetInput(brain,request){
 const o=request.observation,body=Float64Array.of(o.body.energy/INPUT_SCALES.energy,o.body.health/INPUT_SCALES.health,o.body.inventory/o.capacities.inventory,o.body.stomach/o.capacities.stomach);
 const memory=o.memoryEnabled?Float64Array.from(spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick)):new Float64Array(7);
 const cells=o.cells.map(c=>{const r=o.memoryEnabled?getMemory(brain,positionKey(c)):null,b=r?memoryBelief(r,o.tick,brain.traits):null,input=new Float64Array(CELL_INPUTS);
  input[0]=c.q-o.position.q;input[1]=c.r-o.position.r;input[2]=c.food/INPUT_SCALES.food;input[3]=Number(c.terrain==='water');input[4]=densitySignal(c.neighbours);input[5]=Number(c.q===o.position.q&&c.r===o.position.r);input[6]=Number(Boolean(r));input[7]=(b?.food??0)/INPUT_SCALES.food;input[8]=b?.confidence??0;input[9]=Number(c.isFoodSource);
  for(let i=0;i<ACTIVITY_COUNT;i++)input[10+i]=densitySignal(c.activities?.[i]??0);return input;});
 for(const c of cells)for(let i=0;i<c.length;i++)c[i]=bound(c[i]);
 const process=new Float64Array(PROCESS_NAMES.length),p=o.process;
 if(p){process[operationForAction(p.action)]=1;process[6]=Number(p.active);process[7]=p.progress;process[8]=p.remaining/INPUT_SCALES.processSubsteps;process[9+o.callReason]=1;target(brain,o,p.localDestination,p.cell,memory,process,12);}
 return {body,cells,memory,process,senses:[body[2],body[3]],potentials:memory};
}
export function setCandidateInput(brain,o,c,prepared,reuseInput=null,reuseFeatures=null){
 const input=reuseInput??new Float64Array(CANDIDATE_INPUTS),features=reuseFeatures??Array(FEATURE_NAMES.length).fill(0),operation=operationForAction(c.action);
 input.fill(0);input[operation]=1;target(brain,o,c.localDestination,c.cell,prepared.memory,input,6,c.repeat);const tail=6+TARGET_NAMES.length;input[tail]=Number(c.continuation);input[tail+1]=c.duration/INPUT_SCALES.processSubsteps;input[tail+2]=(c.computeCharge??c.decisionCost)/INPUT_SCALES.decisionEnergy;
 features.fill(0);features[0]=Number(c.action<6&&c.cell.food>0);features[2]=Number(c.repeat);features[3]=input[15];features[5]=input[17];features[6]=input[16];features[7]=(1-o.body.energy/INPUT_SCALES.energy)*features[3];
 return {input,features,operation};
}
export function prepareSetDecisionInput(brain,request){const mark=beginComputePart('inputs');try{const prepared=prepareSetInput(brain,request);return {brain,request,prepared,rows:request.candidates.map(c=>setCandidateInput(brain,request.observation,c,prepared))};}finally{endComputePart(mark);}}
