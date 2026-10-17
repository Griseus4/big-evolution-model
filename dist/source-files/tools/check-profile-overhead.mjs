/** Короткая оценка цены диагностического режима, не замер скорости браузера.
 * Одинаковое число шагов и seed; восстановление/экспорт/SHA вне таймера.
 * Цель скорости и очередь здесь обходятся явно: один pulse на физический шаг. */
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {WorldRuntime} from '../dist/world-runtime.js';
import {WORLD_PROTOCOL} from '../dist/world-view.js';
import {MODEL_VERSION} from '../dist/life-history.js';
const modes=['off','light','detailed'],repeats=3,steps=8,population=150;
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
function trial(mode){
 const runtime=new WorldRuntime({send:()=>{}});let id=0;
 const command=(type,payload={})=>runtime.handle({protocol:WORLD_PROTOCOL,epoch:1,id:++id,type,payload});
 command('init',{settings:{seed:42,population,limit:1000}});
 command('view',{visible:false,tab:'world',section:'birth'});command('speed',{value:1280});
 command('running',{value:true});if(mode!=='off')command('profile-start',{measurementMode:mode});
 const start=performance.now();
 for(let i=0;i<steps;i++){runtime.credit=1;runtime.pulse();}
 const elapsedMs=performance.now()-start;if(mode!=='off')command('profile-stop');
 const digest=createHash('sha256').update(JSON.stringify(runtime.world.snapshot())).digest('hex');
 return {elapsedMs,digest,timerCalls:runtime.profile()?.workerTiming.timerCalls??0};
}
// Один прогревочный круг; измеряемые круги меняют порядок режимов.
for(const mode of modes)trial(mode);
const rows=modes.map(mode=>({mode,repeats:[]}));let expected=null;
for(let i=0;i<repeats;i++)for(let j=0;j<modes.length;j++){
 const mode=modes[(i+j)%modes.length],result=trial(mode);expected??=result.digest;
 assert.equal(result.digest,expected,'Профиль изменил состояние/RNG');rows.find(r=>r.mode===mode).repeats.push(result);
}
for(const row of rows)row.medianMs=median(row.repeats.map(r=>r.elapsedMs));
const report={format:'big-evolution-profile-overhead',version:1,modelVersion:MODEL_VERSION,
 runtime:process.version,steps,population,repeats,warmupRounds:1,rows,
 notes:['Цена полного pulse с отключённым показом, одна задача на физический шаг; не реальная браузерная очередь.',
  'Это последовательные короткие опыты Node: JIT/GC и шум влияют на сравнение; проценты не гарантируются для Opera GX.']};
await mkdir(new URL('../.transfer/',import.meta.url),{recursive:true});
await writeFile(new URL(`../.transfer/profile-overhead-${MODEL_VERSION}.json`,import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(rows.map(({mode,medianMs})=>({mode,medianMs}))));
