/** Целая сетка времени. Расход обычного действия — скорость за Т / 10.
 * Роды не получают второй обычный расход: 32 оплачиваются при завершении. */
export const SUBSTEPS=10,DT=1/SUBSTEPS;
export const ACTION_DURATIONS=Object.freeze([15,15,15,15,15,15,5,2,5,20,3]);
export const DECISION_COST=.10,REPEAT_COST=.03;
export const CALL_COMPLETE=0,CALL_REVIEW=1,CALL_FAILED=2;
