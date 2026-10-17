/** Пользовательские проверки контейнера: отчёты разных сборок остаются
 * отдельными, общий JSON пригоден для извлечения прежнего замера. */
import {createLabReportBundle,extractBenchmarkReport,interruptedLabReport} from './lab-reports.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export const LAB_REPORT_CHECKS=[
 {id:'lab-bundle-preservation',label:'Отчёты: общий JSON сохраняет независимые разделы, ошибки и версии',run(){
  const mechanisms={format:'big-evolution-tests',kind:'checks',modelVersion:'old',status:'completed-with-errors',checks:[{id:'example',status:'failed'}]},benchmark={format:'big-evolution-benchmark',version:1,status:'stopped',cases:[]};
  const reports={mechanisms,benchmark,long:null},before=JSON.stringify(reports),bundle=createLabReportBundle(reports,'new','2026-10-13T00:00:00Z');
  assert(bundle.sections.mechanisms===mechanisms&&bundle.sections.benchmark===benchmark,'Лишнее копирование или замена раздела');
  assert(!Object.hasOwn(bundle.sections,'long'),'Добавлен незапущенный раздел');
  const parsed=JSON.parse(JSON.stringify(bundle));assert(parsed.sections.mechanisms.modelVersion==='old'&&parsed.sections.mechanisms.checks[0].status==='failed','Потеря версии или ошибки');
  assert(extractBenchmarkReport(parsed).status==='stopped','Замер не извлечён из общего файла');assert(extractBenchmarkReport(benchmark)===benchmark,'Сломан прежний отдельный формат');
  createLabReportBundle({...reports,benchmark:{...benchmark,status:'completed'}},'new');assert(JSON.stringify(reports)===before,'Новый раздел изменил прежние отчёты');
  let rejected=false;try{extractBenchmarkReport(createLabReportBundle({mechanisms},'new'));}catch{rejected=true;}assert(rejected,'Отсутствующий замер принят');
 }},
 {id:'lab-reload-interruption',label:'Отчёты: перезагрузка сохраняет частичные результаты без ложного завершения',run(){
  const running={format:'big-evolution-tests',status:'running',jobs:[{status:'completed'},{status:'running'},{status:'pending'}],checks:[{status:'passed'}]},restored=interruptedLabReport(running);
  assert(restored.status==='interrupted'&&restored.jobs[0].status==='completed'&&restored.jobs[1].status==='interrupted'&&restored.jobs[2].status==='interrupted','Неверный статус после перезагрузки');
  assert(restored.checks.length===1&&running.status==='running'&&running.jobs[1].status==='running','Потеря данных или изменение исходника');
  const benchmark=interruptedLabReport({format:'big-evolution-benchmark',status:'running',cases:[{repeats:[{}]}]});assert(benchmark.status==='stopped'&&benchmark.cases[0].repeats.length===1,'Частичный замер потерян');
  const completed={status:'completed'};assert(interruptedLabReport(completed)===completed,'Изменён завершённый результат');
 }},
];
