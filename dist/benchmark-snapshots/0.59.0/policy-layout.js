/** Раскладка генома v6: прежний блок v5 сохраняется на индексах 0…549,
 * за ним 22 веса ощущений тела: запас/желудок для каждого из 11 действий.
 * Число строк и действий не увеличивается. В v5 добавлено действие «Положить».
 * Старые номера 0…9 остаются прежними, но шаг строки теперь 11, а не 10.
 * Общие свойства мозга переносим отдельно: дополнение массива нулями в конце
 * сдвинуло бы смысл большинства чисел. Опыт новорождённого всегда пустой.
 */
export const ACTION_COUNT=11,STATE_COUNT=48,BIRTH_ACTION=9,DEPOSIT_ACTION=10;
export const EXPERIENCE_SIZE=STATE_COUNT*ACTION_COUNT;
export const BASE_GENE_COUNT=EXPERIENCE_SIZE+3;
export const LEGACY_BASE_GENE_COUNT=435,OLD_GENE_COUNT=450,LEGACY_GENE_COUNT=454;
export const BODY_FEATURE_COUNT=2,BODY_WEIGHT_COUNT=ACTION_COUNT*BODY_FEATURE_COUNT;
export const BODY_GENE_OFFSET=550;
import {NEURAL_GENE_COUNT,NEURAL_LAYOUTS} from './neural-layout.js';
export const GENOME_SIZES=Object.freeze({1:435,2:450,3:454,4:502,5:550,6:BODY_GENE_OFFSET+BODY_WEIGHT_COUNT,7:NEURAL_GENE_COUNT,8:NEURAL_LAYOUTS[1].genes,10:NEURAL_LAYOUTS[2].genes});
/** Индекс того же смысла в выбранной прежней версии; -1 — действие отсутствовало.
 * Размеры 1…3 используют девять действий, v4 — десять, v5 — одиннадцать.
 * Оставшиеся 22 позиции — три движения и до 19 свойств чувств/памяти/обучения.
 */
export function geneIndexFromVersion(index,version){
 if(version>=7)throw new Error('Параметры сети не имеют табличных индексов.');
 if(index>=BODY_GENE_OFFSET)return version>=6?index:-1;
 const columns=version>=5?11:version===4?10:9;
 if(index<EXPERIENCE_SIZE){
  const action=index%ACTION_COUNT;
  return action>=columns?-1:Math.floor(index/ACTION_COUNT)*columns+action;
 }
 return STATE_COUNT*columns+index-EXPERIENCE_SIZE;
}
/** Старый индекс нужен только для выбора исторического потока мутаций/генов. */
export function legacyGeneIndex(index){return geneIndexFromVersion(index,3);}
/** Нейтральное расширение сохраняет все прежние числа на соответствующих местах.
 * Новая колонка равна нулю: это нейтральная оценка, не запрет действия.
 */
export function expandGenome(genes){
 if(genes.length===GENOME_SIZES[6]+2||NEURAL_LAYOUTS.some(l=>genes.length===l.genes||genes.length===l.genes+2))return genes.slice();
 const version=Number(Object.keys(GENOME_SIZES).find(v=>GENOME_SIZES[v]===genes.length));
 if(!version)throw new Error('Неизвестный размер генома.');
 if(version===6||version===7||version===8)return genes.slice();
 return Array.from({length:GENOME_SIZES[6]},(_,i)=>{const old=geneIndexFromVersion(i,version);return old<0?0:genes[old]??0;});
}
