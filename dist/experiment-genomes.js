import {STRUCTURAL_TYPE} from './structural-brain.js';
import {DUAL_BRAIN_TYPE,DUAL_VERSION} from './dual-brain-layout.js';
import {EVOLUTION_RULES} from './brain-evolution-rules.js';
import {genomeMetadata,validateGenomeFile} from './genome.js';
import {TEMPORAL_BRAIN_TYPE} from './temporal-layout.js';
export const MAX_GENOME_FILE_BYTES=EVOLUTION_RULES.maxGenomeFileBytes;
export function genomeChoice(value,{historical=false}={}){
 if(!value||typeof value.name!=='string'||!value.name.trim()||!Array.isArray(value.genes))throw new Error('Геном варианта: нужны имя и проверенные гены.');
 const genes=validateGenomeFile({format:'big-evolution-genome',...genomeMetadata(value.genes),genes:value.genes});
 if(!historical&&genomeMetadata(genes).version!==DUAL_VERSION)throw new Error('Для новых опытов нужен геном v16 с отдельными регуляторами; старые результаты доступны для анализа.');
 return {name:value.name.trim().slice(0,120),genes};
}
export function uniqueGenomeChoices(values,options){
 if(values.length>64)throw new Error('Не более 64 геномов в наборе.');
 const seen=new Set();return values.map(v=>{const choice=genomeChoice(v,options),key=JSON.stringify(choice.genes);if(seen.has(key))throw new Error('В наборе повторяется один и тот же геном.');seen.add(key);return choice;});
}
/** Пакет загружается целиком: отмена/ошибка не удаляет прежние значения. */
export async function readGenomeChoices(files,existing=[]){
 const selected=Array.from(files??[]);if(!selected.length)return existing;
 if(selected.length+existing.length>64)throw new Error('Не более 64 геномов в наборе.');
 for(const file of selected)if(file.size>MAX_GENOME_FILE_BYTES)throw new Error('Слишком большой файл генома: '+file.name);
 const added=[];for(const file of selected)added.push({name:file.name,genes:validateGenomeFile(JSON.parse(await file.text()))});
 return uniqueGenomeChoices([...existing,...added]);
}
