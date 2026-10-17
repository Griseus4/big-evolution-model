/** Локальный запуск тех же механизмов, что доступны во вкладке испытаний.
 * Node.js не проверяет браузерную отрисовку или настоящие Worker. Внутри
 * механизмов есть короткие контрольные миры; длинные опыты не запускаются.
 * Необязательный аргумент — путь JSON отчёта, например .transfer/checks.json.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {runBrowserChecks} from '../dist/browser-checks.js';
import {MODEL_VERSION} from '../dist/life-history.js';
// Браузер читает манифесты снимков по HTTP. Node не поддерживает fetch(file:),
// поэтому локальный исполнитель читает те же реальные байты только внутри dist.
// Проверки SHA и содержания не подменяются; сетевой fetch остаётся штатным.
const nativeFetch=globalThis.fetch,distURL=new URL('../dist/',import.meta.url);
globalThis.fetch=async (input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.protocol!=='file:')return nativeFetch(input,init);
 if(!url.href.startsWith(distURL.href))throw new Error('Локальная проверка читает только dist');
 try{return new Response(await readFile(url));}
 catch(error){if(error.code==='ENOENT')return new Response(null,{status:404});throw error;}
};
const start=performance.now();
const checks=await runBrowserChecks();
const report={format:'big-evolution-local-checks',version:1,modelVersion:MODEL_VERSION,
 runtime:process.version,finishedAt:new Date().toISOString(),durationMs:performance.now()-start,checks};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n','utf8');
const failed=checks.filter(check=>check.status==='failed');
console.log(JSON.stringify({modelVersion:MODEL_VERSION,passed:checks.length-failed.length,total:checks.length,
 durationMs:report.durationMs,failures:failed.map(({id,error})=>({id,...error}))},null,2));
if(failed.length)process.exitCode=1;
