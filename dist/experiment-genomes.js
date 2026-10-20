import {genomeMetadata,validateGenomeFile} from './genome.js';
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
export const MAX_GENOME_FILE_BYTES=100000;
export function genomeChoice(value){
 if(!value||typeof value.name!=='string'||!value.name.trim()||!Array.isArray(value.genes))throw new Error('Геном варианта: нужны имя и проверенные гены.');
 const genes=validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(value.genes),genes:value.genes});
 if(genomeMetadata(genes).brainType!==TEMPORAL_BRAIN_TYPE)throw new Error('Для новых опытов нужен текущий геном v13; старые типы мозга не преобразуются.');
 return {name:value.name.trim().slice(0,120),genes};
}
export function uniqueGenomeChoices(values){
 if(values.length>64)throw new Error('Не более 64 геномов в наборе.');
 const seen=new Set();return values.map(v=>{const choice=genomeChoice(v),key=JSON.stringify(choice.genes);if(seen.has(key))throw new Error('В наборе повторяется один и тот же геном.');seen.add(key);return choice;});
}
/** Пакет загружается целиком: отмена/ошибка не удаляет прежние значения. */
export async function readGenomeChoices(files,existing=[]){
 const selected=Array.from(files??[]);if(!selected.length)return existing;
 if(selected.length+existing.length>64)throw new Error('Не более 64 геномов в наборе.');
 for(const file of selected)if(file.size>MAX_GENOME_FILE_BYTES)throw new Error('Слишком большой файл генома: '+file.name);
 const added=[];for(const file of selected)added.push({name:file.name,genes:validateGenomeFile(JSON.parse(await file.text()))});
 return uniqueGenomeChoices([...existing,...added]);
}
