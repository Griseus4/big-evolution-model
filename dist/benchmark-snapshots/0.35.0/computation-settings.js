/** Число исполнителей, а не закреплённых физических ядер. Сообщённое
 * браузером число CPU — подсказка; запуск проверяется ответом каждого Worker. */
export const COMPUTATION_WORKER_COUNTS=Object.freeze([1,2,4,6,8,10,12,14,16]);
export function computationLabel(count){const end=count%100,last=count%10;return `${count} ${end>=11&&end<=14?'вычислителей':last===1?'вычислитель':last>=2&&last<=4?'вычислителя':'вычислителей'}`;}
export function validateComputationWorkers(value){
 if(!COMPUTATION_WORKER_COUNTS.includes(value))throw new Error('Выбери доступное число вычислителей: '+COMPUTATION_WORKER_COUNTS.join(', ')+'.');
 return value;
}
export function computationWorkers(requested='auto',hardware=globalThis.navigator?.hardwareConcurrency??2,population=150){
 if(requested==='auto'||requested===undefined)return population<32||hardware<4?1:hardware>=8?4:2;
 return validateComputationWorkers(requested);
}
export function computationHardwareLabel(hardware=globalThis.navigator?.hardwareConcurrency){
 return Number.isInteger(hardware)&&hardware>0?`Браузер сообщает логических процессоров: ${hardware}. Это не число свободных ядер. Больше вычислителей не обязательно быстрее.`:
  'Браузер не сообщил число логических процессоров. Доступность проверяется при запуске; скорость — замерами.';
}
