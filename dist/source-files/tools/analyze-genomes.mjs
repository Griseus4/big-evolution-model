/** Тот же чистый расшифровщик для повторяемого разбора агентом/разработчиком.
 * Node уже есть в рабочей среде проекта; пользователю достаточно вкладки игры.
 * Читает один/два файла, выводит JSON либо --markdown, файлов/миров не изменяет.
 * Пример: node tools/analyze-genomes.mjs --markdown genome-A.json genome-B.json
 */
import {readFile,stat} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import {MAX_GENOME_BYTES,parseGenomeText,makeGenomeAnalysisReport,genomeAnalysisMarkdown} from '../dist/genome-analysis.js';
const args=process.argv.slice(2),markdown=args.includes('--markdown'),files=args.filter(x=>x!=='--markdown');
try{
 if(!files.length||files.length>2||files.some(x=>x.startsWith('--')))throw new Error('Укажи один или два JSON: node tools/analyze-genomes.mjs [--markdown] file-A.json [file-B.json]');
 const genomes=[];
 for(const file of files){
  if((await stat(file)).size>MAX_GENOME_BYTES)throw new Error(`${basename(file)}: файл больше 100 КБ.`);
  const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex');
  genomes.push(parseGenomeText(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{name:basename(file),sha256}));
 }
 const report=makeGenomeAnalysisReport(genomes);process.stdout.write(markdown?genomeAnalysisMarkdown(report):JSON.stringify(report,null,2)+'\n');
}catch(error){process.stderr.write('Анализ не выполнен: '+error.message+'\n');process.exitCode=1;}
