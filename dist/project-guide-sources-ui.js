/** Технические детали находятся внутри статьи и строятся один раз по запросу.
 * Ссылки только на собственную страницу исходников, без исполнения файлов. */
import {GUIDE_ARTICLES} from './project-guide.js';
import {guideSourcePath,guideSourceUrl,guideSourceHelpKey,guideCoverage} from './project-guide-search.js';
import {APP_VERSION} from './app-version.js';

const KIND_LABELS={app:'Рабочие исходники',tests:'Проверки',tools:'Инструменты',infrastructure:'Сборка и публикация',history:'Исторический экран'};
export function createGuideSources(article,root){
 const make=(tag,text)=>{const el=root.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const details=make('details');details.className='guide-sources';
 details.append(make('summary','Где это в коде'));
 details.append(make('p',article.reviewedVersion?`Статья содержательно сверена для версии ${article.reviewedVersion}. Это не отметка полного описания всех связанных файлов.`:'Краткая справка. Указатели на реализацию добавлены; подробная сверка статьи ещё впереди.'));
 for(const [caption,sources]of [['Реализация',article.sources],['Связанные проверки',article.checks]]){
  if(!sources.length)continue;
  details.append(make('h4',caption));const list=make('ul');
  for(const source of sources){
   const row=make('li'),link=make('a',guideSourcePath(source.file));link.href=guideSourceUrl(source.file);link.target='_blank';link.rel='noopener';link.dataset.help=guideSourceHelpKey(article.id,source.file);row.append(link);
   if(source.symbols?.length)row.append(make('code',source.symbols.join(', ')));
   if(source.purpose)row.append(make('p',source.purpose));list.append(row);
  }
  details.append(list);
 }
 return details;
}

export function installGuideCoverage({root,request=globalThis.fetch}={}){
 const details=root.getElementById('guide-coverage'),output=root.getElementById('guide-coverage-content');let pending=false,ready=false;
 const make=(tag,text)=>{const el=root.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 async function load(){
  if(!details.open||pending||ready)return;pending=true;output.textContent='Загрузка списка исходников…';
  try{
   const response=await request('./project-guide-inventory.json');if(!response.ok)throw new Error('Не удалось загрузить список.');const data=await response.json();
   if(data?.format!=='big-evolution-guide-inventory'||data.version!==1||data.modelVersion!==APP_VERSION||!Array.isArray(data.files)||data.files.some(row=>!row||typeof row.path!=='string'||!Object.hasOwn(KIND_LABELS,row.kind))||new Set(data.files.map(row=>row.path)).size!==data.files.length)throw new Error('Неизвестный или устаревший формат списка.');
   const coverage=guideCoverage(data.files),parts=[make('p',`Статей со сверенным содержанием: ${coverage.reviewedArticles} из ${coverage.articles}. Файлов в учёте: ${coverage.total}; указаны в статьях: ${coverage.referenced}.`),make('p','Ссылка на файл не означает, что все его правила уже описаны. Полнота описания механизмов пока не оценена. Производные копии и снимки версий не входят в этот список.')];
   for(const [kind,label]of Object.entries(KIND_LABELS)){
    const rows=coverage.rows.filter(row=>row.kind===kind);if(!rows.length)continue;
    const group=make('details');group.append(make('summary',`${label}: ${rows.length}`));const list=make('ul');
    for(const row of rows){const item=make('li'),link=make('a',row.path);link.href=guideSourceUrl(row.path);link.target='_blank';link.rel='noopener';item.append(link);
     if(row.articles.length){const names=row.articles.map(id=>GUIDE_ARTICLES.find(a=>a.id===id).title);item.append(make('small','Указан в статьях: '+names.join('; ')));}else item.append(make('small','Пока не связан со статьёй.'));list.append(item);
    }
    group.append(list);parts.push(group);
   }
   output.replaceChildren(...parts);ready=true;
  }catch(error){output.textContent='Список исходников недоступен. Закрой и снова открой этот раздел, чтобы повторить загрузку.';}
  finally{pending=false;}
 }
 details.addEventListener('toggle',load);return {load};
}
