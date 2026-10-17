/** Локальный анализ наблюдателя. Файлы не отправляются на сервер и не становятся
 * основой текущего мира. Два независимых слота защищены от запоздалого чтения:
 * старый Promise не может перезаписать новый файл или отменить очистку слота.
 * Все имена/данные выводятся textContent, а не исполняемым HTML из JSON.
 */
import {MAX_GENOME_BYTES,parseGenomeText,makeGenomeAnalysisReport,genomeAnalysisMarkdown,formatGeneNumber} from './genome-analysis.js';
const byId=id=>document.getElementById(id),n=formatGeneNumber;
function text(tag,value,className=''){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
function table(headers,rows){
 const wrap=document.createElement('div');wrap.className='table-scroll';
 const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),tr=document.createElement('tr');
 for(const label of headers){const th=text('th',label);th.scope='col';tr.append(th);}head.append(tr);
 for(const row of rows){const tr=document.createElement('tr');for(const value of row)tr.append(text('td',value));body.append(tr);}
 table.append(head,body);wrap.append(table);return wrap;
}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function installGenomeAnalysis(){
 const slots=[null,null],revision=[0,0];let report=null;
 const letters=['a','b'];
 function selected(){return slots[Number(byId('analysis-view').value)]??slots.find(Boolean);}
 function renderPolicy(){
  const g=selected(),view=byId('analysis-policy-view').value,energy=Number(byId('analysis-energy').value);
  if(!g){byId('analysis-policy').replaceChildren();return;}
  if(g.network||view==='difference'&&slots.some(s=>s?.network)){
   byId('analysis-policy').replaceChildren(text('p',g.network?`${g.architectureLabel??`Сеть ${g.network.inputs} → ${g.network.hidden} tanh → Q`}. Полные подписанные связи и смещения показаны в свойствах выше. Таблицы состояний у неё нет.`:'Сеть и таблица имеют разные параметры: сравниваются только общие свойства.'));
   byId('analysis-policy-note').textContent='Для вычисления вероятностей нужны тело, наблюдения, память и личные поправки; один геном их не восстанавливает.';return;
  }
  const difference=view==='difference'&&slots.every(Boolean),compare=difference?report.comparison:null;
  const rows=(difference?compare.policy:g.policy).filter(row=>energy<0||row.state?.energy===energy);
  const headers=['№','Условное состояние',...(difference?report.genomes[compare.columns===slots[0].columns?0:1].actions:g.actions)];
  const data=rows.map(row=>[row.row,row.state?.label??'Кодирование неизвестно',...(difference?row.deltas:row.scores).map(n)]);
  byId('analysis-policy').replaceChildren(table(headers,data));
  byId('analysis-policy-note').textContent=difference?(!compare.policyComparable?'Кодирование неизвестно или различается: политика не сопоставлена. ':'')+'Разности B − A. «—» означает несопоставимый или отсутствующий ген, а не нулевой вес. Положительная разность не означает улучшение.':'Это сырые базовые оценки, не вероятности: доступность действий, признаки окружения и личный TD здесь не восстановлены.';
 }
 function render(){
  const available=slots.filter(Boolean);report=available.length?makeGenomeAnalysisReport(available,{slotLabels:letters.filter((_,i)=>slots[i]).map(x=>x.toUpperCase())}):null;
  for(const id of ['analysis-export-json','analysis-export-md'])byId(id).disabled=!report;
  byId('analysis-results').hidden=!report;
  const options=letters.map((letter,i)=>{const option=text('option',`${letter.toUpperCase()} · ${slots[i]?.name??'не загружен'}`);option.value=String(i);option.disabled=!slots[i];return option;});
  const previous=Number(byId('analysis-view').value);byId('analysis-view').replaceChildren(...options);byId('analysis-view').value=String(slots[previous]?previous:slots.findIndex(Boolean));
  byId('analysis-policy-view').querySelector('option[value=difference]').disabled=!slots.every(Boolean);
  if(!slots.every(Boolean)&&byId('analysis-policy-view').value==='difference')byId('analysis-policy-view').value='genome';
  if(!report){byId('analysis-summary').textContent='Загрузи геном в A или B. Второй файл добавит сравнение.';return;}
  const g=selected(),source=g.source;
  byId('analysis-summary').textContent=slots.every(Boolean)?`Сравнение A и B · совместных генов ${report.comparison.sharedGenes} · отличий ${report.comparison.changedGenes} · только A ${report.comparison.onlyA}, только B ${report.comparison.onlyB}.`: `Загружен один геном: ${g.name}.`;
  byId('analysis-origin').textContent=`${g.name} · схема v${g.genomeVersion} · ${g.geneCount} чисел · ${g.columns} действий. Житель ${source.id??'не указан'}, поколение ${source.generation??'не указано'}, детей при экспорте ${source.children??'не указано'}. Seed ${source.seed??'не указан'}, шаг ${source.tick??'не указан'}. Модель ${g.modelVersion??'не указана'}; мозг ${g.brainType??'не указан'}; шкала ${g.traitScale}; ощущения тела ${g.bodySenseEncoding}.`;
  byId('analysis-hash').textContent=g.sha256?`SHA-256 исходного файла: ${g.sha256}`:'Отпечаток исходного файла недоступен в этом браузере.';
  byId('analysis-properties').replaceChildren(table(['Свойство','Индекс с 0','Сырое число','Пересчитано','Доля шкалы чувств'],g.properties.map(p=>[p.label,p.index??'—',p.present?n(p.raw):'Отсутствует в этой версии',p.derived===null?'—':`${n(p.derived)} ${p.unit}`,p.share===null?'—':`${n(p.share*100)}%`])));
  byId('analysis-explanations').replaceChildren(...g.properties.filter(p=>p.present).map(p=>text('p',`${p.label}: ${p.description}`)));
  byId('analysis-insights').replaceChildren(...g.insights.map(value=>text('li',value)));
  byId('analysis-limitations').replaceChildren(...g.warnings.map(value=>text('li',value)));
  byId('analysis-context').replaceChildren(table(['Контекст из файла','Значение'],[...Object.entries(g.rules),...Object.entries(g.environment)].map(([key,value])=>[key,String(value)])));
  byId('analysis-comparison').hidden=!slots.every(Boolean);
  if(slots.every(Boolean)){
   const c=report.comparison;
   byId('analysis-comparison-summary').textContent=`B − A · различаются ${c.changedPolicyRows??'не сопоставлены'}/48 строк политики. Среднее |Δ| по совместным сырым числам ${n(c.meanAbsoluteRawDifference)}. ${c.note}`;
   byId('analysis-property-differences').replaceChildren(table(['Свойство','A, сырое','B, сырое','B − A','A, пересчитано','B, пересчитано','Δ параметра'],c.properties.map(p=>[p.label,n(p.a),n(p.b),n(p.delta),p.derivedA===null?'—':`${n(p.derivedA)} ${p.unit}`,p.derivedB===null?'—':`${n(p.derivedB)} ${p.unit}`,p.derivedDelta===null?'—':`${n(p.derivedDelta)} ${p.unit}`])));
   byId('analysis-biggest-differences').replaceChildren(table(['20 наибольших различий','A','B','B − A'],c.rankedDifferences.slice(0,20).map(row=>[row.label,n(row.a),n(row.b),n(row.delta)])));
  }
  // При неизвестном кодировании фильтр энергии не должен скрывать все строки.
  const stateKnown=g.policy.some(row=>row.state);byId('analysis-energy').disabled=!stateKnown;if(!stateKnown)byId('analysis-energy').value='-1';
  renderPolicy();
 }
 for(const [index,letter]of letters.entries()){
  const fileControl=byId(`analysis-file-${letter}`),status=byId(`analysis-status-${letter}`),clear=byId(`analysis-clear-${letter}`);
  fileControl.addEventListener('change',async()=>{
   const file=fileControl.files?.[0];if(!file)return;
   const request=++revision[index];slots[index]=null;clear.disabled=false;status.className='note';status.textContent=`Читаю ${file.name}…`;render();
   try{
    if(file.size>MAX_GENOME_BYTES)throw new Error('Файл больше 100 КБ. Нужен экспорт генома, не история мира.');
    const bytes=await file.arrayBuffer();let sha256=null;
    if(globalThis.crypto?.subtle){try{const digest=await crypto.subtle.digest('SHA-256',bytes);sha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch{/* Анализ работает и без отпечатка; отсутствие отражаем явно. */}}
    const genome=parseGenomeText(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{name:file.name,sha256});
    if(request!==revision[index])return;
    slots[index]=genome;status.textContent=`${file.name}: v${genome.genomeVersion}, ${genome.geneCount} чисел. Прочитан локально.`;
   }catch(error){if(request!==revision[index])return;slots[index]=null;status.className='error';status.textContent=`Не прочитан: ${error.message}`;}
   render();
  });
  clear.addEventListener('click',()=>{revision[index]++;slots[index]=null;fileControl.value='';clear.disabled=true;status.className='note';status.textContent='Файл не загружен.';render();});
 }
 for(const id of ['analysis-view','analysis-policy-view','analysis-energy'])byId(id).addEventListener('change',render);
 byId('analysis-export-json').addEventListener('click',()=>{if(report)download('big-evolution-genome-analysis.json',JSON.stringify(report,null,2),'application/json');});
 byId('analysis-export-md').addEventListener('click',()=>{if(report)download('big-evolution-genome-analysis.md',genomeAnalysisMarkdown(report),'text/markdown;charset=utf-8');});
 render();
}
