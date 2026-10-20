/** Тот же модульный парсер V8, один процесс на весь список. Конструктор
 * SourceTextModule только разбирает исходник: link/evaluate не вызываются. */
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
const files=JSON.parse(readFileSync(0,'utf8'));
for(const path of files)new SourceTextModule(readFileSync(path,'utf8'),{identifier:path});
console.log(`JS syntax: ${files.length} modules parsed without execution.`);
