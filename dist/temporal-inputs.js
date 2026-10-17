/** Числовые данные одного момента выбора. Состояние процесса — сведения
 * собственного тела, цель содержит только обзор и прежнюю личную память. */
import {getMemory,memoryBelief,spatialContext,FEATURE_NAMES} from './cognition.js';
import {positionKey,localNeighbours} from './navigation.js';
import {densitySignal} from './neighbour-perception.js';
import {CELL_INPUTS,CANDIDATE_INPUTS,PROCESS_NAMES,operationForAction} from './temporal-layout.js';
import {beginComputePart,endComputePart} from './performance-probe.js';
const bound=x=>Math.max(-1,Math.min(1,x));
function target(brain,o,place,cell,potentials,out,at,repeat=false){
 const r=o.memoryEnabled?getMemory(brain,positionKey(place)):null,b=r?memoryBelief(r,o.tick,brain.traits):null;
 const dq=place.q-o.position.q,dr=place.r-o.position.r,own=dq===0&&dr===0;
 let gradient=0;if(o.memoryEnabled&&!own){const positions=localNeighbours(brain),i=positions.findIndex(p=>p.q===place.q&&p.r===place.r);if(i>=0)gradient=potentials[i+1]-potentials[0];}
 out[at]=dq;out[at+1]=dr;out[at+2]=(cell?.food??0)/10;out[at+3]=densitySignal(cell?.neighbours??0);out[at+4]=Number(repeat);out[at+5]=Number(Boolean(r));out[at+6]=b?.confidence??0;out[at+7]=(b?.food??0)/10;out[at+8]=r?Math.max(0,o.tick-r.lastSeen)/brain.traits.memoryAge:0;out[at+9]=gradient;out[at+10]=b?.uncertainty??0;out[at+11]=Number(o.memoryEnabled&&(!r||r.visits===0));out[at+12]=Number(own);out[at+13]=Number(Boolean(cell?.isFoodSource));
 for(let i=0;i<14;i++)out[at+i]=bound(out[at+i]);
}
export function prepareSetInput(brain,request){
 const o=request.observation,body=Float64Array.of(o.body.energy/100,o.body.health/100,o.body.inventory/o.capacities.inventory,o.body.stomach/o.capacities.stomach);
 const memory=o.memoryEnabled?Float64Array.from(spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick)):new Float64Array(7);
 const cells=o.cells.map(c=>{const r=o.memoryEnabled?getMemory(brain,positionKey(c)):null,b=r?memoryBelief(r,o.tick,brain.traits):null;return Float64Array.of(c.q-o.position.q,c.r-o.position.r,c.food/10,Number(c.terrain==='water'),densitySignal(c.neighbours),Number(c.q===o.position.q&&c.r===o.position.r),Number(Boolean(r)),(b?.food??0)/10,b?.confidence??0,Number(c.isFoodSource));});
 for(const c of cells)for(let i=0;i<c.length;i++)c[i]=bound(c[i]);
 const process=new Float64Array(PROCESS_NAMES.length),p=o.process;
 if(p){process[operationForAction(p.action)]=1;process[6]=Number(p.active);process[7]=p.progress;process[8]=p.remaining/20;process[9+o.callReason]=1;target(brain,o,p.localDestination,p.cell,memory,process,12);}
 return {body,cells,memory,process,senses:[body[2],body[3]],potentials:memory};
}
export function setCandidateInput(brain,o,c,prepared,reuseInput=null,reuseFeatures=null){
 const input=reuseInput??new Float64Array(CANDIDATE_INPUTS),features=reuseFeatures??Array(FEATURE_NAMES.length).fill(0),operation=operationForAction(c.action);
 input.fill(0);input[operation]=1;target(brain,o,c.localDestination,c.cell,prepared.memory,input,6,c.repeat);input[20]=Number(c.continuation);input[21]=c.duration/20;input[22]=c.decisionCost/.10;
 features.fill(0);features[0]=Number(c.action<6&&c.cell.food>0);features[2]=Number(c.repeat);features[3]=input[15];features[5]=input[17];features[6]=input[16];features[7]=(1-o.body.energy/100)*features[3];
 return {input,features,operation};
}
export function prepareSetDecisionInput(brain,request){const mark=beginComputePart('inputs');try{const prepared=prepareSetInput(brain,request);return {brain,request,prepared,rows:request.candidates.map(c=>setCandidateInput(brain,request.observation,c,prepared))};}finally{endComputePart(mark);}}
