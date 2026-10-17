/** Одна версия расчёта, один исходный мир, разные размеры пула.
 * Отдельная методика: перед каждым повтором создаём и прогреваем только
 * активный пул. Не держим одновременно сумму всех выбранных Worker. */
import {COMPUTATION_WORKER_COUNTS,validateComputationWorkers} from './computation-settings.js';
import {BENCHMARK_CASES} from './benchmark-fixtures.js';
import {BENCHMARK_CURRENT_KERNEL,MAX_BENCHMARK_REPEATS} from './benchmark-versions.js';
export const WORKER_BENCHMARK_PROTOCOL='rotating-worker-count-v1';
export function workerBenchmarkSelection(workerCounts,caseId,repeats,kernelVersion=BENCHMARK_CURRENT_KERNEL){
 if(!Array.isArray(workerCounts)||workerCounts.length<2||new Set(workerCounts).size!==workerCounts.length)throw new Error('Выбери хотя бы два разных числа вычислителей.');
 workerCounts.forEach(validateComputationWorkers);
 if(!BENCHMARK_CASES.some(s=>s.kind==='world'&&s.id===caseId))throw new Error('Выбери одну доступную нагрузку мира.');
 if(!Number.isInteger(repeats)||repeats<1||repeats>MAX_BENCHMARK_REPEATS)throw new Error(`Повторов: целое число от1 до${MAX_BENCHMARK_REPEATS}.`);
 if(typeof kernelVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(kernelVersion))throw new Error('Неизвестная версия расчёта.');
 const ordered=COMPUTATION_WORKER_COUNTS.filter(n=>workerCounts.includes(n));
 return {mode:'workers',kernelVersion,workerCounts:ordered,versionIds:ordered.map(n=>`${kernelVersion}@${n}`),groups:['world'],repeatCounts:{world:repeats},caseIds:[caseId]};
}
