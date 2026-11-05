/** Целая сетка времени. Расход подшага — ставка за Т, умноженная на DT.
 * Роды не получают второй обычный расход: платёж списывается при завершении. */
export const SUBSTEPS=10,DT=1/SUBSTEPS;
/** Подшаги на один завершённый процесс. Ставки энергии имеют отдельный источник. */
export const DURATION_SUBSTEPS=Object.freeze({move:15,gather:5,eat:2,wait:5,birth:20,deposit:3});
export const ACTION_DURATIONS=Object.freeze([...Array(6).fill(DURATION_SUBSTEPS.move),DURATION_SUBSTEPS.gather,DURATION_SUBSTEPS.eat,DURATION_SUBSTEPS.wait,DURATION_SUBSTEPS.birth,DURATION_SUBSTEPS.deposit]);
/** Период записи ряда наблюдателя; не период пищи и не период решений. */
export const HISTORY_SAMPLE_T=10,HISTORY_SAMPLE_SUBSTEPS=HISTORY_SAMPLE_T*SUBSTEPS;
export const DECISION_COST=.10,REPEAT_COST=.03;
export const CALL_COMPLETE=0,CALL_REVIEW=1,CALL_FAILED=2;
