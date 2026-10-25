/** Возможности источника определяются по сохранённым полям, до фильтра
 * периода/происхождения. Пустая выборка не меняет схему показателей. */
export function chartFamilies(report){
 const found=new Set();
 for(const rows of [report?.dead,report?.living])for(const row of rows??[]){
  const h=row.heritable;if(!h)continue;
  if(Number.isFinite(h.mainNeurons))found.add('dual');
  if(Number.isFinite(h.mainMutationRate))found.add('v15');
  if(Number.isFinite(h.contextMutationRate))found.add('v16');
  if(Number.isFinite(h.brainNeurons))found.add('structural');
  if(Number.isFinite(h.mutationRate))found.add('legacy');
 }
 return found;
}
export function chartApplicable(def,families){
 if(!def.standard||!families.size)return true;
 const id=def.metric;
 if(/^brain(Neurons|Connections|Layers|ActiveNeurons|ActiveConnections)$/.test(id)||id==='structuralRate')return families.has('structural');
 if(id==='mutationRate'||id==='mutationStrength')return families.has('legacy');
 if(/^mainMutation/.test(id))return families.has('v15');
 if(/^(context|cells|target|operation|direct)Mutation/.test(id))return families.has('v16');
 if(/^(main|attention)(Neurons|Connections|Layers)$/.test(id)||/^(behavior|attention)Mutation/.test(id))return families.has('dual');
 return true;
}
