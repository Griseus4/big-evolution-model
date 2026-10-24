/** Счётчики исходов, не оценка поведения: попытка и итоговый мир различны.
 * Знаменатель попыток содержит только известный нормальный исход; ошибки,
 * ручная остановка, очередь и незавершённые попытки показаны отдельно. */
export function experimentOutcomes(report){
 return (report?.plan?.variants??[]).map(v=>{
  const groups=report.groups.filter(g=>g.variantId===v.id);let attempts=0,extinctAttempts=0,worlds=0,extinctWorlds=0,unknownAttempts=0,unknownWorlds=0;
  for(const g of groups){for(const a of g.attempts){if(a.status==='completed'&&typeof a.extinct==='boolean'){attempts++;if(a.extinct)extinctAttempts++;}else unknownAttempts++;}
   const selected=g.attempts.find(a=>a.id===g.selectedId);if(g.status==='completed'&&selected?.status==='completed'&&typeof selected.extinct==='boolean'){worlds++;if(selected.extinct)extinctWorlds++;}else unknownWorlds++;
  }return {id:v.id,name:v.name,attempts,extinctAttempts,worlds,extinctWorlds,unknownAttempts,unknownWorlds};
 });
}
