/** Возможности источника определяются по сохранённым полям, до фильтра
 * периода/происхождения. Пустая выборка не меняет схему показателей. */
import {PHYSIOLOGY_METRICS,BODY_HERITABLE_METRICS} from './physiology-metrics.js';
const physiologyIds=new Set([...PHYSIOLOGY_METRICS,...BODY_HERITABLE_METRICS].map(m=>m.id));
export function chartFamilies(report){
 const found=new Set();
 for(const rows of [report?.dead,report?.living])for(const row of rows??[]){
  found.add('recorded');
  if(row.care?.schema==='postnatal-care-v1')found.add('care');
  if(row.physiology?.schema==='physiology-life-v1')found.add('physiology');
  const h=row.heritable;if(!h)continue;
  if(Number.isFinite(h.mainNeurons))found.add('dual');
  if(Number.isFinite(h.mainMutationRate))found.add('v15');
  if(Number.isFinite(h.contextMutationRate))found.add('v16');
  if(Number.isFinite(h.contextWeightsMutationRate))found.add('v17');
  if(Number.isFinite(h.brainNeurons))found.add('structural');
  if(Number.isFinite(h.mutationRate))found.add('legacy');
 }
 return found;
}
export function chartApplicable(def,families){
 if(!def.standard||!families.size)return true;
 const id=def.metric;
 if(PHYSIOLOGY_METRICS.some(m=>m.id===id&&m.care)||id==='bodyGene_tCarry')return families.has('care');
 if(physiologyIds.has(id))return families.has('physiology');
 if(/^brain(Neurons|Connections|Layers|ActiveNeurons|ActiveConnections)$/.test(id)||id==='structuralRate')return families.has('structural');
 if(id==='mutationRate'||id==='mutationStrength')return families.has('legacy');
 if(/^mainMutation/.test(id))return families.has('v15');
 if(/^(contextWeights|attentionWeights|contextStructure|attentionStructure)Mutation/.test(id))return families.has('v17');
 if(/^contextMutation/.test(id))return families.has('v16');
 if(/^attentionMutation/.test(id))return families.has('v15')||families.has('v16');
 if(/^(cells|target|operation|direct)Mutation/.test(id))return families.has('v16')||families.has('v17');
 if(/^(main|attention)(Neurons|Connections|Layers)$/.test(id)||/^behaviorMutation/.test(id))return families.has('dual');
 return true;
}
