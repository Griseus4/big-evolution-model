/** Начальные условия обычного нового мира. Контрольные фикстуры задают свои
 * условия явно; смена этих чисел не редактирует уже живущую популяцию.
 */
export const WORLD_LIMITS=Object.freeze({populationMin:1,populationMax:1000});
export const WORLD_DEFAULTS=Object.freeze({population:150,limit:WORLD_LIMITS.populationMax,mutationRate:.02});
