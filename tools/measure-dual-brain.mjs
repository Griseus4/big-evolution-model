/** Короткий замер, не эволюционный опыт и не межверсийная серия скорости.
 * Один подшаг включает первичный выбор и следующую когнитивную границу.
 * Запуск: node --expose-gc tools/measure-dual-brain.mjs [число жителей]. */
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {Evolution} from '../dist/evolution.js';
import {DUAL_BRAIN_TYPE} from '../dist/dual-brain-layout.js';
import {MODEL_VERSION} from '../dist/life-history.js';
const population=Number(process.argv[2]??1000);
if(!Number.isSafeInteger(population)||population<1||population>1000)throw new Error('От 1 до 1000 жителей.');
const samples=[];
for(const config of [{name:'direct-founders',counts:[]},{name:'default-limit-adjacent',counts:[16,16,16,16]}]){
 globalThis.gc?.();const before=process.memoryUsage().heapUsed,start=performance.now();
 const world=new Evolution({brainType:DUAL_BRAIN_TYPE,population,limit:1000,seed:42,initialNeurons:config.counts,attentionInitialNeurons:config.counts});
 const initialized=performance.now(),a=world.agents[0];world.substep();const done=performance.now();
 samples.push({preset:config.name,population,initializationMs:initialized-start,oneSubstepIncludingPrimingMs:done-initialized,
  heapGrowthBytes:process.memoryUsage().heapUsed-before,mainHidden:a.brain.structure.hidden,mainActiveEdges:a.brain.structure.activeEdges,
  gateHidden:a.brain.attentionStructure.hidden,gateActiveEdges:a.brain.attentionStructure.activeEdges,
  mainCalls:world.stats.brainCalls,gateCalls:world.stats.gateCalls,energyError:world.balances().energyError});
}
console.log(JSON.stringify({kind:'bounded-dual-brain-smoke-measurement',modelVersion:MODEL_VERSION,node:process.version,
 platform:process.platform,architecture:process.arch,cpu:os.cpus()[0]?.model,logicalProcessors:os.cpus().length,population,
 limitations:'Node CPU; один подшаг, включая прогрев/аллокации. Не браузер, не предел плотности всех разрешённых графов, не доказательство ускорения.',samples},null,2));
