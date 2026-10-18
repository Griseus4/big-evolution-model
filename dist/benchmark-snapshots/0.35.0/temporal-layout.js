/** v13: длительные действия и наследуемый контроллер внимания.
 * Порядок генов: основной мозг, 12 свойств, малая сеть, два регулятора.
 * Личный опыт и координаты в геном не входят. */
import {ACTIVITY_NAMES} from './activity-perception.js';
export const TEMPORAL_BRAIN_TYPE='set-duration-activity-v1';
export const OPERATION_NAMES=Object.freeze(['Переместиться','Подобрать','Съесть','Ждать','Родить','Положить']);
export const operationForAction=a=>a<6?0:a-5;
export const BODY_NAMES=Object.freeze(['Энергия / 100','Здоровье / 100','Запас / вместимость','Желудок / вместимость']);
export const CELL_NAMES=Object.freeze(['Относительное q','Относительное r','Пища / 10','Вода','Плотность других','Своя клетка','Есть запись','Прогноз пищи / 10','Уверенность','Есть источник',...ACTIVITY_NAMES]);
export const TARGET_NAMES=Object.freeze(['Направление q','Направление r','Пища цели / 10','Другие в цели','Повтор деятельности','Есть запись цели','Уверенность цели','Прогноз пищи цели / 10','Давность записи','Градиент пищи','Неопределённость','Непосещённое место','Цель — своя клетка','Источник в цели',...ACTIVITY_NAMES]);
export const PROCESS_NAMES=Object.freeze([...OPERATION_NAMES.map(s=>'Процесс: '+s),'Процесс продолжается','Прогресс','Осталось / 20','Вызов: завершение','Вызов: пересмотр','Вызов: срыв',...TARGET_NAMES.map(s=>'Процесс: '+s)]);
export const CANDIDATE_NAMES=Object.freeze([...OPERATION_NAMES.map(s=>'Операция: '+s),...TARGET_NAMES,'Продолжение попытки','Время / 20','Цена решения / 0,10']);
export const CELL_INPUTS=CELL_NAMES.length,CELL_HIDDEN=8,CONTEXT_HIDDEN=16,CANDIDATE_INPUTS=CANDIDATE_NAMES.length;
export const CONTEXT_NAMES=Object.freeze([...BODY_NAMES,...Array.from({length:8},(_,i)=>`Средняя активация ${i+1}`),...Array.from({length:8},(_,i)=>`Средний квадрат ${i+1}`),'Число клеток',...Array.from({length:7},(_,i)=>`Потенциал пищи ${i}`),...PROCESS_NAMES]);
export const CONTEXT_INPUTS=CONTEXT_NAMES.length;
export const SET_BLOCKS=Object.freeze((()=>{let offset=0;const matrix=(key,label,inputs,outputs)=>{const b={key,label,offset,inputs,outputs,weights:inputs*outputs,bias:offset+inputs*outputs};offset+=b.weights+outputs;return Object.freeze(b);};const a=[matrix('cells','Клетки',CELL_INPUTS,8),matrix('context','Ситуация и процесс',CONTEXT_INPUTS,16),matrix('target','Цель',CANDIDATE_INPUTS-6,16)];a.push(Object.freeze({key:'operation',label:'Операции',offset,inputs:6,outputs:16,weights:96,bias:null}));offset+=96;a.push(matrix('direct','Прямая оценка',CANDIDATE_INPUTS,1));return a;})());
export const SET_PARAMETER_COUNT=SET_BLOCKS.at(-1).bias+1;
export const TEMPORAL_TRAIT_INDICES=Object.freeze([0,1,3,4,5,6,7,8,15,16,17,18]);
export const GATE_INPUTS=17,GATE_HIDDEN=4,GATE_HIDDEN_BIAS=GATE_INPUTS*GATE_HIDDEN,GATE_OUTPUT_WEIGHTS=GATE_HIDDEN_BIAS+GATE_HIDDEN,GATE_OUTPUT_BIAS=GATE_OUTPUT_WEIGHTS+GATE_HIDDEN,GATE_PARAMETERS=GATE_OUTPUT_BIAS+1,GATE_OFFSET=SET_PARAMETER_COUNT+12;
export const GATE_NAMES=Object.freeze([...BODY_NAMES,...OPERATION_NAMES.filter((_,i)=>i!==4).map(s=>'Процесс: '+s),'Прогресс','Пища здесь','Пища цели','Другие здесь','Другие в обзоре','Изменилась пища/источники','Изменились другие','Изменилась деятельность других']);
export const TEMPORAL_LAYOUT=Object.freeze({version:13,brainType:TEMPORAL_BRAIN_TYPE,architecture:'set-duration-activity-gate-v1',inputs:CONTEXT_INPUTS,hidden:16,parameters:SET_PARAMETER_COUNT,traitOffset:SET_PARAMETER_COUNT,traitCount:12,gateOffset:GATE_OFFSET,genes:GATE_OFFSET+GATE_PARAMETERS,inputNames:CONTEXT_NAMES,
 network:Object.freeze({inputSchema:'body-cells-activities-process-v1',architecture:'set-duration-activity-gate-v1',cellInputs:CELL_INPUTS,cellHidden:8,contextInputs:CONTEXT_INPUTS,contextHidden:16,candidateInputs:CANDIDATE_INPUTS,targetInputs:CANDIDATE_INPUTS-6,operations:6,outputs:'variable-candidates',activation:'cells-context-tanh-target-linear',parameterOrder:'main-traits-gate-v2',policy:'operation-logmeanexp-v1',gateInputs:GATE_INPUTS,gateHidden:GATE_HIDDEN,gateParameters:GATE_PARAMETERS})});
export function temporalParameterLabel(index){const b=SET_BLOCKS.find(b=>index>=b.offset&&index<b.offset+b.weights+(b.bias===null?0:b.outputs));if(!b)return 'Неизвестный параметр';const names=b.key==='cells'?CELL_NAMES:b.key==='context'?CONTEXT_NAMES:b.key==='operation'?OPERATION_NAMES:b.key==='target'?CANDIDATE_NAMES.slice(6):CANDIDATE_NAMES;return index<b.offset+b.weights?`${b.label}: ${Math.floor((index-b.offset)/b.inputs)+1} ← ${names[(index-b.offset)%b.inputs]}`:`${b.label}: смещение ${index-b.bias+1}`;}
