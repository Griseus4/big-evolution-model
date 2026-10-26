/** Единственная граница между нынешней памятью и новым числовым мозгом.
 * Хранилища/закрепление не меняем. Мозг видит наблюдённое и личные гипотезы,
 * не истинные скрытые таймеры. Нейросетевого поиска воспоминаний здесь нет.
 */
import {getMemory,memoryBelief,spatialContext,fillActionFeatures,FEATURE_NAMES} from './cognition.js';
import {positionKey,localNeighbours} from './navigation.js';
import {bodySenses} from './brain-parameters.js';
import {densitySignal} from './neighbour-perception.js';
import {CELL_INPUTS,CANDIDATE_INPUTS,operationForAction} from './set-brain-layout.js';
import {CELL_INPUTS as TIME_CELLS,CANDIDATE_INPUTS as TIME_CANDIDATES,PROCESS_NAMES} from './temporal-layout.js';
import {beginComputePart,endComputePart} from './performance-probe.js';
const bound=x=>Math.max(-1,Math.min(1,x));
function memoryAt(brain,o,place){
 const record=o.memoryEnabled?getMemory(brain,positionKey(place)):null;
 return {record,belief:record?memoryBelief(record,o.tick,brain.traits):null};
}
export function prepareSetInput(brain,request){
 const mark=beginComputePart('inputs');try{
  const o=request.observation;
  if(!Array.isArray(o.cells))throw new Error('Новому мозгу нужны строки видимых клеток.');
  const senses=bodySenses(o.body,o.capacities.inventory,o.capacities.stomach);
  // Заполняем конечный f64-буфер напрямую: промежуточный обычный массив
  // не несёт сведений. Сам буфер по-прежнему принадлежит этой оценке.
  const body=new Float64Array(3+senses.length);
  body[0]=o.body.energy/100;body[1]=o.body.health/100;body[2]=o.body.pain/100;
  for(let i=0;i<senses.length;i++)body[i+3]=senses[i];
  for(let i=0;i<body.length;i++)body[i]=bound(body[i]);
  const memory=o.memoryEnabled?Float64Array.from(spatialContext(brain,[o.position,...localNeighbours(brain)],o.tick)):new Float64Array(7);
  const records=new Map(),cells=o.cells.map(cell=>{
   const item=memoryAt(brain,o,cell);records.set(positionKey(cell),item);
   const {record,belief}=item;
   const input=new Float64Array(CELL_INPUTS);
   input[0]=cell.q-o.position.q;input[1]=cell.r-o.position.r;input[2]=cell.food/10;
   input[3]=Number(cell.hazard);input[4]=Number(cell.terrain==='water');input[5]=densitySignal(cell.neighbours??0);
   input[6]=Number(cell.q===o.position.q&&cell.r===o.position.r);input[7]=Number(Boolean(record));
   input[8]=(belief?.food??0)/10;input[9]=belief?.confidence??0;input[10]=belief?.risk??0;
   input[11]=Number(Boolean(cell.isFoodSource));
   for(let i=0;i<input.length;i++)input[i]=bound(input[i]);
   return input;
  });
  return {body,cells,memory,senses,potentials:memory,records};
 }finally{endComputePart(mark);}
}
export function setCandidateInput(brain,o,candidate,prepared,reuseInput=null,reuseFeatures=null){
 const mark=beginComputePart('inputs');try{
  const {action,localDestination:place,cell}=candidate,operation=operationForAction(action);
  if(!Number.isInteger(action)||action<0||action>10)throw new Error('Неизвестное исполняемое действие.');
  const {record,belief}=prepared.records.get(positionKey(place))??memoryAt(brain,o,place);
  const features=reuseFeatures??Array(FEATURE_NAMES.length);
  fillActionFeatures(brain,{action,destination:place,cell,previousAction:o.previousAction,energy:o.body.energy,tick:o.tick,potentials:prepared.potentials},features,record??null,belief??null);
  if(!o.memoryEnabled)features.fill(0,3);
  const input=reuseInput??new Float64Array(CANDIDATE_INPUTS);input.fill(0,0,6);input[operation]=1;
  // Первые шесть позиций — операция; далее прежние 16 признаков цели
  // в прежнем порядке. Исторические снимки ниже не переиспользуем.
  input[6]=place.q-o.position.q;input[7]=place.r-o.position.r;input[8]=cell.food/10;
  input[9]=Number(cell.hazard);input[10]=densitySignal(cell.neighbours??0);
  input[11]=Number(o.previousAction===action);input[12]=Number(Boolean(record));input[13]=belief?.confidence??0;
  input[14]=(belief?.food??0)/10;input[15]=record?Math.max(0,o.tick-record.lastSeen)/brain.traits.memoryAge:0;
  input[16]=belief?.risk??0;input[17]=features[3];input[18]=features[6];
  input[19]=o.memoryEnabled?Number(!record||record.visits===0):0;
  input[20]=Number(place.q===o.position.q&&place.r===o.position.r);input[21]=Number(Boolean(cell.isFoodSource));
  for(let i=0;i<input.length;i++)input[i]=bound(input[i]);
  return {input,features,operation};
 }finally{endComputePart(mark);}
}
/** Данные одного момента решения: не содержат весов, Q или активаций сети.
 * Их можно прочитать до и после TD-обновления, пока тело/наблюдение/память
 * неизменны. Пакет принадлежит одному вызову мира, не хранится между шагами
 * или будущими подшагами. Строки самостоятельны: выбор сохраняет их в истории. */
export function prepareSetDecisionInput(brain,request){
 const prepared=prepareSetInput(brain,request);
 const rows=request.candidates.map(candidate=>setCandidateInput(brain,request.observation,candidate,prepared));
 return {brain,request,prepared,rows};
}
/** Исторический переход владеет снимком, а не ссылкой на нынешнюю память.
 * Обучение прошлого решения не подменяет входы новыми наблюдениями. */
export function cloneSetInput(frame){return {body:frame.body.slice(),cells:frame.cells.map(row=>row.slice()),memory:frame.memory.slice(),candidate:frame.candidate.slice(),...(frame.process?{process:frame.process.slice()}:{})};}
export function validSetInput(frame){const temporal=Boolean(frame?.process);return Boolean(frame&&frame.body?.length===(temporal?4:5)&&(!temporal||frame.process.length===PROCESS_NAMES.length&&frame.process.every(Number.isFinite))&&frame.memory?.length===7&&frame.candidate?.length===(temporal?TIME_CANDIDATES:CANDIDATE_INPUTS)&&Array.isArray(frame.cells)&&[frame.body,frame.memory,frame.candidate,...frame.cells].every(row=>row.every(Number.isFinite))&&frame.cells.every(row=>row.length===(temporal?TIME_CELLS:CELL_INPUTS)));}
