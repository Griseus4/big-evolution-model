import {configurationMatrix} from './configuration-benchmark-report.js';
import {UI_TEXT} from './ui-text.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const ms=n=>n.toFixed(1)+' мс';
export function renderConfigurationTable(host,report,open=new Set()){
 const matrix=configurationMatrix(report),table=node('table');table.className='benchmark-table';
 const widths=new Map(report.selections.map(s=>[s.versionId,report.groups.includes('world')?s.workerCounts.length:1]));
 const head=node('thead'),top=node('tr'),bottom=node('tr'),name=node('th','Нагрузка');name.rowSpan=2;top.append(name);
 for(const s of report.selections){const group=node('th',s.versionId);group.colSpan=widths.get(s.versionId);group.scope='colgroup';top.append(group);
  for(const n of report.groups.includes('world')?s.workerCounts:[null])bottom.append(node('th',n===null?'Оценщик':UI_TEXT.computations(n)));}
 const status=node('th','Совпадение итогов');status.rowSpan=2;top.append(status);head.append(top,bottom);table.append(head);
 for(const row of matrix.rows){
  const body=node('tbody'),line=node('tr'),label=node('th',row.label);line.append(label);
  for(const cell of row.cells){const td=node('td');if(row.kind==='evaluator')td.colSpan=widths.get(cell.snapshotId);
   if(!cell.timing)td.textContent='Ожидает запуска';
   else{
    td.append(node('strong',ms(cell.timing.medianMs)));
    if(cell.stepsPerSecond!==null)td.append(node('small',`${cell.stepsPerSecond.toFixed(2)} шагов/с`));
    td.append(node('small',`Разброс ${cell.timing.spreadPercent.toFixed(1)}% · ${ms(cell.timing.minMs)}…${ms(cell.timing.maxMs)}`));
    if(row.kind==='world'){
     td.append(node('small',cell.speedup===null?cell.reasons.join('; '):`×${cell.speedup.toFixed(2)} · ${cell.speedPercent>=0?'+':''}${cell.speedPercent.toFixed(1)}% скорости`));
     if(cell.efficiency!==null)td.append(node('small',`Эффективность ${cell.efficiency.toFixed(1)}% · база: ${cell.baseWorkers}`));
    }else td.append(node('small',UI_TEXT.evaluatorOnce));
   }line.append(td);
  }
  const reasons=[...new Set(row.cells.flatMap(c=>c.reasons))];
  if(!reasons.length&&new Set(row.cells.flatMap(c=>c.row.repeats.map(r=>r.resultDigest+':'+r.actions+':'+r.steps))).size>1)reasons.push('разные итоги между версиями');
  line.append(node('td',reasons.length?reasons.join('; '):'Совпадают'));body.append(line);table.append(body);
  const count=Math.max(0,...row.cells.map(c=>c.row?.repeats.length??0));if(!count)continue;
  const button=node('button','Показать повторы'),details=node('tbody');button.type='button';button.dataset.repeatKey=row.id;details.hidden=true;let built=false;
  function expand(value){
   if(value&&!built){for(let i=0;i<count;i++){
    const tr=node('tr');tr.append(node('th',`Повтор ${i+1}`));
    for(const cell of row.cells){const td=node('td'),sample=cell.row?.repeats[i];if(row.kind==='evaluator')td.colSpan=widths.get(cell.snapshotId);td.textContent=sample?`${ms(sample.computeMs)} · ${ms(sample.wallMs)} с уступками`:'Ещё не завершён';tr.append(td);}tr.append(node('td',''));details.append(tr);
   }built=true;}
   details.hidden=!value;button.setAttribute('aria-expanded',String(value));button.textContent=value?'Скрыть повторы':'Показать повторы';
  }
  button.addEventListener('click',()=>expand(details.hidden));label.append(button);table.append(details);expand(open.has(row.id));
 }
 const scroll=node('div');scroll.className='table-scroll';scroll.append(table);host.replaceChildren(scroll,node('p',UI_TEXT.scalingMetrics));
}
