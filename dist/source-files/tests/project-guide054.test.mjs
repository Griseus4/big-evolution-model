/** Навигация настоящего установщика в малом DOM, без имитации физики мира.
 * Размеры и положение всплывающих окон эти проверки не измеряют. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_ARTICLES,GUIDE_INTRO_TEXT,guideArticleFromHash} from '../dist/project-guide.js';
import {installProjectGuide} from '../dist/project-guide-ui.js';
import {HELP,PAGE_TEXT} from '../dist/ui-text.js';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function fixture(hash=''){
 const nodes=new Map(),events={},opened=[];
 const make=id=>{const element={id,dataset:{},attributes:{},listeners:{},scrollTop:0,hidden:false,branch:{open:false},
  setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
  addEventListener(name,fn){this.listeners[name]=fn;},closest(){return this.branch;},focus(){this.focused=true;}};nodes.set(id,element);return element;};
 make('panel-about');
 for(const article of GUIDE_ARTICLES){make(`wiki-tab-${article.id}`);make(`wiki-panel-${article.id}`);}
 const cross=make('cross-link');cross.dataset.guideArticle='genome';
 const root={getElementById:id=>{assert.ok(nodes.has(id),id);return nodes.get(id);},querySelectorAll:()=>[cross]};
 const location={hash},pushed=[],view={location,history:{pushState(state,title,url){pushed.push(url);location.hash=url;}},addEventListener(name,fn){events[name]=fn;}};
 const ui=installProjectGuide({root,view,onOpen:()=>opened.push(ui?.currentArticle?.()??'initial')});
 return {ui,nodes,events,opened,location,pushed,cross,click(id,extra={}){let prevented=false;const link=id==='cross-link'?cross:nodes.get(`wiki-tab-${id}`);link.listeners.click({button:0,preventDefault(){prevented=true;},...extra});return prevented;}};
}

test('all retained articles and new introduction have stable links and one summary',()=>{
 assert.equal(GUIDE_ARTICLES.length,15);assert.equal(new Set(GUIDE_ARTICLES.map(a=>a.id)).size,15);
 assert.match(html,/aria-controls="panel-about">О проекте<\/button>/);
 for(const article of GUIDE_ARTICLES){
  assert.ok(article.summary.length>40);
  assert.match(html,new RegExp(`id="wiki-tab-${article.id}"[^>]*href="#wiki-panel-${article.id}"`));
  assert.match(html,new RegExp(`id="wiki-panel-${article.id}"`));
  assert.ok(html.includes(`data-guide-article="${article.id}"${article.id==='intro'?' aria-current="page"':''}>${article.title}</a>`));
  assert.equal(guideArticleFromHash(`#wiki-panel-${article.id}`),article.id);
  assert.deepEqual(HELP[`wiki-tab-${article.id}`],[article.title,article.summary]);
 }
 assert.equal(guideArticleFromHash('#unknown'),null);assert.equal(guideArticleFromHash('#wiki-panel-%'),null);
 for(const [key,text]of Object.entries(GUIDE_INTRO_TEXT)){assert.ok(text.length>40);assert.ok(PAGE_TEXT[key]);assert.match(html,new RegExp(`data-ui-text="${key}"`));}
});

test('new introduction records specific implementation sources; legacy articles are not falsely re-reviewed',()=>{
 const intro=GUIDE_ARTICLES.find(a=>a.id==='intro');assert.equal(intro.reviewedVersion,'0.54.0');
 for(const source of intro.sources){const code=readFileSync(new URL('../dist/'+source.file,import.meta.url),'utf8');for(const symbol of source.symbols)assert.match(code,new RegExp(`\\b${symbol}\\s*\\(`));}
 for(const article of GUIDE_ARTICLES.slice(1))assert.equal(article.reviewedVersion,null);
});

test('article links open their branch, keep DOM state, restore reading position and respect modified clicks',()=>{
 const f=fixture();assert.equal(f.ui.currentArticle(),'intro');assert.equal(f.nodes.get('wiki-panel-intro').hidden,false);
 f.nodes.get('panel-about').scrollTop=123;f.nodes.get('wiki-panel-intro').preciseRulesOpen=true;
 assert.equal(f.click('brain'),true);assert.equal(f.ui.currentArticle(),'brain');assert.equal(f.nodes.get('wiki-tab-brain').branch.open,true);
 assert.equal(f.nodes.get('wiki-panel-intro').hidden,true);assert.equal(f.nodes.get('wiki-panel-brain').focused,true);
 assert.equal(f.location.hash,'#wiki-panel-brain');assert.deepEqual(f.opened,['brain']);
 f.nodes.get('panel-about').scrollTop=42;f.click('intro');assert.equal(f.nodes.get('panel-about').scrollTop,123);assert.equal(f.nodes.get('wiki-panel-intro').preciseRulesOpen,true);
 assert.equal(f.nodes.get('wiki-tab-intro').attributes['aria-current'],'page');assert.equal(f.nodes.get('wiki-tab-brain').attributes['aria-current'],undefined);
 assert.equal(f.click('world',{ctrlKey:true}),false);assert.equal(f.click('world',{button:1}),false);assert.equal(f.ui.currentArticle(),'intro');
 assert.equal(f.click('cross-link'),true);assert.equal(f.ui.currentArticle(),'genome');assert.equal(f.cross.dataset.help,'wiki-tab-genome');
 assert.equal(f.ui.select('unknown'),false);assert.equal(f.ui.currentArticle(),'genome');
 f.location.hash='#wiki-panel-brain';f.events.hashchange();assert.equal(f.ui.currentArticle(),'brain');assert.equal(f.nodes.get('panel-about').scrollTop,42);
 f.location.hash='';f.events.hashchange();assert.equal(f.ui.currentArticle(),'intro');assert.equal(f.nodes.get('panel-about').scrollTop,123);
});

test('recognized initial deep link opens the guide; unrelated hashes do not switch sections',()=>{
 // Начальный callback не должен зависеть от возвращаемого ещё установщика.
 const nodes=new Map(),make=id=>nodes.set(id,{id,dataset:{},setAttribute(){},removeAttribute(){},addEventListener(){},closest(){return null;},scrollTop:0});
 make('panel-about');for(const a of GUIDE_ARTICLES){make(`wiki-tab-${a.id}`);make(`wiki-panel-${a.id}`);}
 let opens=0;const events={},view={location:{hash:'#wiki-panel-memory'},addEventListener:(key,fn)=>events[key]=fn};
 const ui=installProjectGuide({root:{getElementById:id=>nodes.get(id),querySelectorAll:()=>[]},view,onOpen:()=>opens++});
 assert.equal(ui.currentArticle(),'memory');assert.equal(opens,1);view.location.hash='#other';events.hashchange();assert.equal(opens,1);assert.equal(ui.currentArticle(),'memory');
});
