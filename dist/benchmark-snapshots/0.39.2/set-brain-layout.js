/** Вариант Б. Константы формата, не отдельная копия правил мира.
 * Строки клеток и кандидатов имеют общие веса внутри одного организма.
 * Число строк не входит в геном; новые свойства требуют новой схемы.
 */
export const SET_BRAIN_TYPE='set-context-source-v1';
export const OPERATION_NAMES=Object.freeze(['Переместиться','Подобрать','Съесть','Ждать','Родить','Положить']);
export const operationForAction=action=>action<6?0:action-5;
export const CELL_NAMES=Object.freeze(['Относительное q','Относительное r','Видимая пища / 10','Видимая опасность','Вода','Плотность других','Текущая клетка','Есть запись','Прогноз пищи / 10','Уверенность записи','Опыт повреждений','Видимый источник пищи']);
export const BODY_NAMES=Object.freeze(['Энергия / 100','Здоровье / 100','Боль / 100','Переносимый запас / вместимость','Желудок / вместимость']);
export const CANDIDATE_NAMES=Object.freeze([...OPERATION_NAMES.map(s=>'Операция: '+s),'Направление q','Направление r','Видимая пища цели / 10','Видимая опасность цели','Плотность других в цели','Повтор действия','Есть запись цели','Уверенность записи цели','Прогноз пищи цели / 10','Давность записи / масштаб','Опыт повреждений цели','Градиент знакомой пищи','Неопределённость цели','Непосещённое место','Цель — текущая клетка','Видимый источник пищи в цели']);
export const CELL_INPUTS=CELL_NAMES.length,CELL_HIDDEN=8,CONTEXT_HIDDEN=16,CANDIDATE_INPUTS=CANDIDATE_NAMES.length;
export const CONTEXT_NAMES=Object.freeze([...BODY_NAMES,...Array.from({length:8},(_,i)=>`Средняя активация клеток ${i+1}`),...Array.from({length:8},(_,i)=>`Средний квадрат активации клеток ${i+1}`),'Число видимых клеток n/(n+1)',...Array.from({length:7},(_,i)=>`Потенциал знакомой пищи ${i}`)]);
export const CONTEXT_INPUTS=CONTEXT_NAMES.length;
export const SET_BLOCKS=Object.freeze((()=>{
 let offset=0;const matrix=(key,label,inputs,outputs)=>{const block={key,label,offset,inputs,outputs,weights:inputs*outputs,bias:offset+inputs*outputs};offset+=inputs*outputs+outputs;return Object.freeze(block);};
 const blocks=[matrix('cells','Кодировщик клеток',CELL_INPUTS,CELL_HIDDEN),matrix('context','Общая ситуация',CONTEXT_INPUTS,CONTEXT_HIDDEN),matrix('target','Признаки цели',CANDIDATE_INPUTS-6,CONTEXT_HIDDEN)];
 blocks.push(Object.freeze({key:'operation',label:'Критерии операции',offset,inputs:6,outputs:CONTEXT_HIDDEN,weights:6*CONTEXT_HIDDEN,bias:null}));offset+=6*CONTEXT_HIDDEN;
 blocks.push(matrix('direct','Прямая оценка варианта',CANDIDATE_INPUTS,1));return blocks;
})());
export const SET_PARAMETER_COUNT=SET_BLOCKS.at(-1).bias+1;
// v11 добавляет только наблюдаемый признак куста, включая пустой. Он не
// обозначает бесплатную пищу, ёмкость или время следующего восстановления.
export const SET_LAYOUT=Object.freeze({version:11,brainType:SET_BRAIN_TYPE,architecture:'set-b-source-v1',inputs:CONTEXT_INPUTS,hidden:CONTEXT_HIDDEN,parameters:SET_PARAMETER_COUNT,traitOffset:SET_PARAMETER_COUNT,genes:SET_PARAMETER_COUNT+13,inputNames:CONTEXT_NAMES,
 network:Object.freeze({inputSchema:'set-body-cells-sources-memory-candidates-v1',architecture:'set-b-source-v1',cellInputs:CELL_INPUTS,cellHidden:CELL_HIDDEN,contextInputs:CONTEXT_INPUTS,contextHidden:CONTEXT_HIDDEN,candidateInputs:CANDIDATE_INPUTS,targetInputs:CANDIDATE_INPUTS-6,operations:6,outputs:'variable-candidates',activation:'cells-context-tanh-target-linear',parameterOrder:'cells-context-target-operation-direct-v2',policy:'operation-logmeanexp-v1'})});
export function setParameterLabel(index){
 const block=SET_BLOCKS.find(b=>index>=b.offset&&index<b.offset+b.weights+(b.bias===null?0:b.outputs));
 if(!block)return 'Неизвестный параметр';
 const names=block.key==='cells'?CELL_NAMES:block.key==='context'?CONTEXT_NAMES:block.key==='operation'?OPERATION_NAMES:block.key==='target'?CANDIDATE_NAMES.slice(6):CANDIDATE_NAMES;
 return index<block.offset+block.weights?`${block.label}: ${Math.floor((index-block.offset)/block.inputs)+1} ← ${names[(index-block.offset)%block.inputs]}`:`${block.label}: смещение ${index-block.bias+1}`;
}
