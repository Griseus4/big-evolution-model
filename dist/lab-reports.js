/** Контейнер лаборатории не меняет вложенные форматы/сборки. Не копируем
 * тяжёлые отчёты при обновлении UI: сериализация нужна только при скачивании.
 * Ошибки и остановленные запуски — результаты; пропускаем лишь отсутствие. */
export function createLabReportBundle(reports,exporterVersion,exportedAt=new Date().toISOString()){
 const sections={};
 for(const key of ['mechanisms','benchmark','long'])if(reports[key])sections[key]=reports[key];
 return {format:'big-evolution-lab-bundle',version:1,exporterVersion,exportedAt,sections};
}
export function extractBenchmarkReport(data){
 if(data?.format!=='big-evolution-lab-bundle')return data;
 if(data.version!==1)throw new Error('Неизвестная версия общего отчёта лаборатории.');
 if(!data.sections?.benchmark)throw new Error('В общем отчёте нет замеров скорости.');
 return data.sections.benchmark;
}
/** Перезагрузка прекращает Workers, но не превращает частичный результат в
 * завершённый. Копия нужна только при восстановлении, не на каждом прогрессе. */
export function interruptedLabReport(report){
 if(!report||!['running','stopping'].includes(report.status))return report;
 const copy=structuredClone(report);copy.finishedAt=new Date().toISOString();copy.interruptedByReload=true;
 copy.status=copy.format==='big-evolution-benchmark'?'stopped':'interrupted';
 for(const job of copy.jobs??[])if(['running','pending'].includes(job.status))job.status='interrupted';
 return copy;
}
