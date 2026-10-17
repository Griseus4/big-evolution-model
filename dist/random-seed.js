/** Свежая энтропия браузера, не генератор Evolution. Нет фиксированного seed
 * или последовательности, сохраняемой при перезагрузке. Исключаем 0 и номер
 * из поля, но глобальную уникальность всех номеров не обещаем. Передача fill
 * нужна только для проверки границ; в UI используется crypto.getRandomValues. */
export function randomExperienceSeed(previous,fill=values=>globalThis.crypto.getRandomValues(values)){
 const values=new Uint32Array(1);
 for(let attempt=0;attempt<32;attempt++){
  fill(values);const seed=values[0];
  if(seed!==0&&seed!==previous)return seed;
 }
 throw new Error('Не удалось выбрать новый номер опыта. Повтори нажатие.');
}
