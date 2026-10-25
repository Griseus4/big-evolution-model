/** Навигация пособия сохраняет статьи в DOM и не получает доступа к миру/RNG.
 * На переключение — обход небольшого списка статей; на шаг моделирования работы нет. */
import {GUIDE_ARTICLES,guideArticleFromHash} from './project-guide.js';
import {normalizeGuideQuery,searchGuideArticles} from './project-guide-search.js';
import {installGuideParameters} from './guide-parameters.js';
import {createGuideSources,installGuideCoverage} from './project-guide-sources-ui.js';

export function installProjectGuide({root=document,view=globalThis,onOpen=()=>{},getWorld,getVariants}={}){
 const byId=id=>root.getElementById(id),container=byId('panel-about');
 const search=byId('guide-search'),results=byId('guide-search-results'),status=byId('guide-search-status'),tree=byId('guide-tree');
 const parameters=installGuideParameters({root,getWorld,getVariants});
 const scrollPositions=new Map(),passports=new Set();let current=null;
 function markResultLinks(){for(const link of results.querySelectorAll('a[data-guide-article]')){if(link.dataset.guideArticle===current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}}
 function select(id,{open=false,remember=false,focus=false}={}){
  if(!GUIDE_ARTICLES.some(article=>article.id===id))return false;
  if(current!==id){
   if(current)scrollPositions.set(current,container.scrollTop);
   for(const article of GUIDE_ARTICLES){
    const selected=article.id===id,link=byId(`wiki-tab-${article.id}`);
    byId(`wiki-panel-${article.id}`).hidden=!selected;
    if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
   }
   current=id;
   if(!passports.has(id)){byId(`wiki-panel-${id}`).append(createGuideSources(GUIDE_ARTICLES.find(a=>a.id===id),root));passports.add(id);}
   // Ветка раскрывается и при переходе по ссылке из другой статьи или URL.
   let branch=byId(`wiki-tab-${id}`).closest('details');
   while(branch){branch.open=true;branch=branch.parentElement?.closest('details');}
   container.scrollTop=scrollPositions.get(id)??0;
  }
  markResultLinks();
  parameters.refresh();
  if(open)onOpen();
  if(remember&&view.location?.hash!==`#wiki-panel-${id}`)view.history?.pushState(null,'',`#wiki-panel-${id}`);
  if(focus)byId(`wiki-panel-${id}`).focus({preventScroll:true});
  return true;
 }
 function wireLink(link,id){
  link.dataset.guideArticle=id;link.dataset.help=`wiki-tab-${id}`;
  link.addEventListener('click',event=>{
   // Ctrl/Command, средняя кнопка и «открыть в новой вкладке» остаются браузеру.
   if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();select(id,{open:true,remember:true,focus:true});
  });
 }
 const links=new Set([...GUIDE_ARTICLES.map(article=>byId(`wiki-tab-${article.id}`)),...root.querySelectorAll('a[data-guide-article]')]);
 for(const link of links){const id=link.dataset.guideArticle??GUIDE_ARTICLES.find(article=>link.id===`wiki-tab-${article.id}`)?.id;if(id&&GUIDE_ARTICLES.some(article=>article.id===id))wireLink(link,id);}
 function renderSearch(){
  const active=Boolean(normalizeGuideQuery(search.value));tree.hidden=active;results.hidden=!active;status.hidden=!active;
  results.replaceChildren();if(!active){status.textContent='';return;}
  const matches=searchGuideArticles(search.value);status.textContent=matches.length?`Найдено статей: ${matches.length}.`:'Ничего не найдено. Попробуй другое слово.';
  for(const article of matches){
   const row=root.createElement('li'),link=root.createElement('a'),summary=root.createElement('small');link.href=`#wiki-panel-${article.id}`;link.textContent=article.title;summary.textContent=article.summary;
   wireLink(link,article.id);row.append(link,summary);results.append(row);
  }
  markResultLinks();
 }
 search.addEventListener('input',renderSearch);
 search.addEventListener('keydown',event=>{if(event.isComposing)return;if(event.key==='Escape'){search.value='';renderSearch();}else if(event.key==='Enter'){const first=results.querySelector('a[data-guide-article]');if(first){event.preventDefault();first.click();}}});
 const followHash=()=>{const hash=view.location?.hash,id=guideArticleFromHash(hash);if(id)select(id,{open:true});else if(!hash)select('intro');};
 select('intro');followHash();renderSearch();installGuideCoverage({root,request:view.fetch?.bind(view)});view.addEventListener?.('hashchange',followHash);
 byId('tab-about')?.addEventListener('click',()=>parameters.refresh());
 return {select,currentArticle:()=>current,refreshParameters:parameters.refresh};
}
