/** Необязательные метки синхронного расчёта. Активны только внутри выбранного
 * шага профилируемого мира; UI, обычные шаги и остальные задачи их не включают.
 * Состояние не принадлежит мозгу/геному. При выключенной записи нет таймеров
 * и объектов меток; swap обязательно восстанавливается через finally. */
let current=null;
export function swapComputeProbe(next){const previous=current;current=next;return previous;}
export function beginComputePart(phase){return current?current.beginDetail(phase):null;}
export function endComputePart(mark){if(mark)mark.profiler.endDetail(mark);}
export function beginComputeGroup(group){return current?current.beginGroup(group):null;}
export function endComputeGroup(mark){if(mark)mark.profiler.endGroup(mark);}
