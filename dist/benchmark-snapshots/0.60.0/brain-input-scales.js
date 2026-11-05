/** Масштабы входного протокола мозга, не длительности физических действий.
 * Одинаковые числа здесь и в action-timing не означают зависимость правил.
 * Смена масштаба требует проверки смысла сохранённых геномов/входов. */
export const INPUT_SCALES=Object.freeze({energy:100,health:100,pain:100,food:10,processSubsteps:20,decisionEnergy:.10});
/** Шкала субъективного ощущения и его центрирование. Это не энергия тела. */
export const FEELING_SCALES=Object.freeze({maximum:100,energyCenter:50,healthCenter:50});
/** Коэффициенты оценки и личного обучения. Ограничение ошибки/поправки
 * относится к численному обучению, а не к наследуемому базовому весу. */
export const LEARNING_RULES=Object.freeze({timeReward:.04,choiceTemperature:.35,
 tdErrorLimit:2,weightDeltaLimit:4,gradientNormFloor:1});
