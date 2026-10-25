/** Внутренний протокол2: Float64, без округления физиологии/координат.
 * Строка =31 число тела/процесса + до7 клеток по17 чисел. Хвост не читается.
 * Мировые координаты нужны только исполнителю для истории; вход мозга
 * строится отдельно и содержит прежние личные координаты/видимые признаки. */
import {ACTIVITY_COUNT} from './activity-perception.js';
export const COGNITION_PROTOCOL=4,HEADER=33,CELL_WIDTH=6+ACTIVITY_COUNT,INPUT_WIDTH=HEADER+7*CELL_WIDTH,RESULT_WIDTH=29;
export const RESULT={decision:0,updates:1,short:2,long:3,mask:4,probabilities:5,costs:16,learningCost:27,gateCost:28};
export function writeCognitionRow(out,offset,a,cells,mask){
 const b=a.brain,p=a.process,l=a.lastProcess;
 // Прямая запись исключает промежуточный массив из31 элемента на каждую особь.
 let at=offset;
 out[at++]=a.id;out[at++]=a.x;out[at++]=a.y;out[at++]=a.frameRotation;out[at++]=a.energy;out[at++]=a.health;out[at++]=a.inventory;out[at++]=a.stomach;out[at++]=a.lastAction??-1;out[at++]=a.callReason??0;
 out[at++]=b.position.q;out[at++]=b.position.r;out[at++]=b.facing;out[at++]=Number(Boolean(p));out[at++]=p?.action??-1;out[at++]=p?.elapsed??0;out[at++]=p?.duration??1;out[at++]=p?.localDestination.q??0;out[at++]=p?.localDestination.r??0;
 out[at++]=l?.action??-1;out[at++]=l?.elapsed??0;out[at++]=l?.duration??1;out[at++]=l?.localDestination.q??0;out[at++]=l?.localDestination.r??0;out[at++]=l?.direction?.q??NaN;out[at++]=l?.direction?.r??NaN;
 out[at++]=b.feelingTotal;out[at++]=b.feelingSamples;out[at++]=b.wellbeing;out[at++]=mask;out[at++]=cells.length;out[at++]=Number(Boolean(a.resting));out[at++]=b.lastDecisionSubtick??0;
 for(let i=0;i<cells.length;i++){const c=cells[i],at=offset+HEADER+i*CELL_WIDTH;out[at]=c.q;out[at+1]=c.r;out[at+2]=c.food;out[at+3]=Number(c.isFoodSource);out[at+4]=Number(c.terrain==='water');out[at+5]=c.neighbours;for(let k=0;k<ACTIVITY_COUNT;k++)out[at+6+k]=c.activities?.[k]??0;}
}
export function readCognitionRow(input,offset,a){
 const v=input.subarray(offset,offset+HEADER),b=a.brain;
 if(v[0]!==a.id)throw new Error('Несогласованный ID личного состояния.');
 const moved=a.x!==v[1]||a.y!==v[2]||b.position.q!==v[10]||b.position.r!==v[11];
 [a.x,a.y,a.frameRotation,a.energy,a.health,a.inventory,a.stomach]=v.subarray(1,8);a.lastAction=v[8]===-1?null:v[8];a.callReason=v[9];
 b.position={q:v[10],r:v[11]};b.facing=v[12];
 a.process=v[13]?{action:v[14],elapsed:v[15],duration:v[16],localDestination:{q:v[17],r:v[18]}}:null;
 a.lastProcess=v[19]===-1?null:{action:v[19],elapsed:v[20],duration:v[21],localDestination:{q:v[22],r:v[23]},direction:Number.isNaN(v[24])?null:{q:v[24],r:v[25]}};
 b.feelingTotal=v[26];b.feelingSamples=v[27];b.wellbeing=v[28];a.availableMask=v[29];
 if(b.dual){a.resting=Boolean(v[31]);b.lastDecisionSubtick=v[32];}
 const count=v[30];if(!Number.isInteger(count)||count<1||count>7)throw new Error('Неверный размер локального обзора.');
 if(moved||!a.cells||a.cells.length!==count)a.cells=Array.from({length:count},()=>({activities:new Float64Array(ACTIVITY_COUNT)}));
 for(let i=0;i<count;i++){const c=a.cells[i],at=offset+HEADER+i*CELL_WIDTH;c.q=input[at];c.r=input[at+1];c.food=input[at+2];c.isFoodSource=Boolean(input[at+3]);c.terrain=input[at+4]?'water':'land';c.neighbours=input[at+5];for(let k=0;k<ACTIVITY_COUNT;k++)c.activities[k]=input[at+6+k];}
 return a.cells;
}
