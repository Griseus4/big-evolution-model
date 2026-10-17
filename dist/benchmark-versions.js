/** Доступна только текущая серия модели. Снимки — неизменяемые каталоги;
 * UI не импортирует их мозги. Новая физика/алгоритм обучения начинает серию,
 * старые серии остаются в Git, а не в обязательной загрузке страницы. */
export const BENCHMARK_MODEL_SERIES='duration-attention-v1';
export const BENCHMARK_PROTOCOL='rotating-fixed-work-v1';
// Выпуск интерфейса/диагностики может не менять расчёт. Соответствие этой
// базы нынешним модулям проверяется с учётом CRLF/LF и маркировки MODEL_VERSION.
export const BENCHMARK_CURRENT_KERNEL='0.33.0';
// Верхняя граница ограничивает размер отчёта и случайный сверхдолгий запуск.
// Правила/объём одного измерения не зависят от выбранного числа повторов.
export const MAX_BENCHMARK_REPEATS=100;
export const BENCHMARK_GROUPS=Object.freeze(['evaluator','world']);
export const DEFAULT_BENCHMARK_COUNTS=Object.freeze({evaluator:50,world:15});
export const BENCHMARK_VERSIONS=Object.freeze([
 {id:'0.32.0',label:'0.32 · последовательный мир',path:'./benchmark-snapshots/0.32.0/'},
 {id:'0.33.0',label:'0.33 · параллельный мир,4 вычислителя',path:'./benchmark-snapshots/0.33.0/',computeWorkers:4},
].map(Object.freeze));
export function benchmarkSelection(ids,repeats){
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!BENCHMARK_VERSIONS.some(v=>v.id===id)))throw new Error('Выбери доступные версии текущей серии.');
 if(!Number.isInteger(repeats)||repeats<1||repeats>MAX_BENCHMARK_REPEATS)throw new Error(`Число повторов: целое от 1 до ${MAX_BENCHMARK_REPEATS}.`);
 return {versionIds:BENCHMARK_VERSIONS.filter(v=>ids.includes(v.id)).map(v=>v.id),repeatCount:repeats};
}
/** В JSON сохраняем числа только выбранных групп. Пустое выключенное поле
 * не блокирует запуск другой группы. Старый числовой API выше остаётся для v2. */
export function groupedBenchmarkSelection(ids,{groups=BENCHMARK_GROUPS,repeatCounts=DEFAULT_BENCHMARK_COUNTS}={}){
 const {versionIds}=benchmarkSelection(ids,1);
 if(!Array.isArray(groups)||!groups.length||new Set(groups).size!==groups.length||groups.some(g=>!BENCHMARK_GROUPS.includes(g)))throw new Error('Выбери оценщики, миры или обе группы.');
 const ordered=BENCHMARK_GROUPS.filter(g=>groups.includes(g)),counts={};
 for(const group of ordered){const value=repeatCounts?.[group];
  if(!Number.isInteger(value)||value<1||value>MAX_BENCHMARK_REPEATS)throw new Error(`${group==='evaluator'?'Оценщики':'Миры'}: целое число повторов 1…${MAX_BENCHMARK_REPEATS}.`);
  counts[group]=value;
 }
 return {versionIds,groups:ordered,repeatCounts:counts};
}
/** Ротация позиции внутри каждого повтора: A B C / B C A / C A B.
 * Между нагрузками тоже сдвигаем начало. Все версии выполняются по очереди. */
export function benchmarkOrder(ids,repeatIndex,caseIndex=0){
 const shift=(repeatIndex+caseIndex)%ids.length;
 return ids.slice(shift).concat(ids.slice(0,shift));
}
