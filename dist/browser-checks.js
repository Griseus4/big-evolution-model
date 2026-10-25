import {STRUCTURAL_CHECKS} from './structural-checks.js';
/** Механизмы текущей0.32, исторические проверки сохранены отдельно. */
import {TEMPORAL_CHECKS} from './temporal-checks.js';
import {ENVIRONMENT_CHECKS} from './environment-checks.js';
export const BROWSER_CHECKS=[...STRUCTURAL_CHECKS,...TEMPORAL_CHECKS,...ENVIRONMENT_CHECKS];
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export async function runBrowserChecks(ids,onResult){
 const selected=ids?.length?BROWSER_CHECKS.filter(c=>ids.includes(c.id)):BROWSER_CHECKS;
 assert(selected.length>0,'Не найдены запрошенные проверки');
 const results=[];
 for(const check of selected){const start=performance.now();let result;
  try{await check.run();result={id:check.id,label:check.label,status:'passed',durationMs:performance.now()-start};}
  catch(error){result={id:check.id,label:check.label,status:'failed',durationMs:performance.now()-start,error:{message:error.message,stack:error.stack??null}};}
  results.push(result);onResult?.(result);await new Promise(resolve=>setTimeout(resolve,0));
 }
 return results;
}
