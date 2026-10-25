/** Навигация пособия сохраняет статьи в DOM и не получает доступа к миру/RNG.
 * На переключение — обход небольшого списка статей; на шаг моделирования работы нет. */
import {GUIDE_ARTICLES,guideArticleFromHash} from './project-guide.js';

export function installProjectGuide({root=document,view=globalThis,onOpen=()=>{}}={}){
 const byId=id=>root.getElementById(id),container=byId('panel-about');
 const scrollPositions=new Map();let current=null;
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
   // Ветка раскрывается и при переходе по ссылке из другой статьи или URL.
   const branch=byId(`wiki-tab-${id}`).closest('details');if(branch)branch.open=true;
   container.scrollTop=scrollPositions.get(id)??0;
  }
  if(open)onOpen();
  if(remember&&view.location?.hash!==`#wiki-panel-${id}`)view.history?.pushState(null,'',`#wiki-panel-${id}`);
  if(focus)byId(`wiki-panel-${id}`).focus({preventScroll:true});
  return true;
 }
 const links=new Set([...GUIDE_ARTICLES.map(article=>byId(`wiki-tab-${article.id}`)),...root.querySelectorAll('a[data-guide-article]')]);
 for(const link of links){
  const id=link.dataset.guideArticle??GUIDE_ARTICLES.find(article=>link.id===`wiki-tab-${article.id}`)?.id;
  if(!id||!GUIDE_ARTICLES.some(article=>article.id===id))continue;
  link.dataset.guideArticle=id;link.dataset.help=`wiki-tab-${id}`;
  link.addEventListener('click',event=>{
   // Ctrl/Command, средняя кнопка и «открыть в новой вкладке» остаются браузеру.
   if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();select(id,{open:true,remember:true,focus:true});
  });
 }
 const followHash=()=>{const hash=view.location?.hash,id=guideArticleFromHash(hash);if(id)select(id,{open:true});else if(!hash)select('intro');};
 select('intro');followHash();view.addEventListener?.('hashchange',followHash);
 return {select,currentArticle:()=>current};
}
