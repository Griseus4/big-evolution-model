/** Навигация настоящего установщика в малом DOM, без имитации физики мира.
 * Размеры и положение всплывающих окон эти проверки не измеряют. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_ARTICLES,GUIDE_INTRO_TEXT,guideArticleFromHash} from '../dist/project-guide.js';
import {installProjectGuide} from '../dist/project-guide-ui.js';
import {HELP,PAGE_TEXT} from '../dist/ui-text.js';
import {searchGuideArticles,guideSourcePath,guideSourceUrl,guideCoverage} from '../dist/project-guide-search.js';
import {createGuideSources,installGuideCoverage} from '../dist/project-guide-sources-ui.js';
import {APP_VERSION} from '../dist/app-version.js';
import vm from 'node:vm';

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
function fixture(hash=''){
 const nodes=new Map(),events={},opened=[];let serial=0;
 const make=id=>{const element={id,dataset:{},attributes:{},listeners:{},children:[],value:'',scrollTop:0,hidden:false,branch:{open:false},
  setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
  append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;this.textContent='';},
  querySelectorAll(){return this.children.flatMap(child=>[...(child.dataset.guideArticle?[child]:[]),...child.querySelectorAll()]);},querySelector(){return this.querySelectorAll()[0]??null;},
  click(){this.listeners.click?.({button:0,preventDefault(){}});},
  addEventListener(name,fn){this.listeners[name]=fn;},closest(){return this.branch;},focus(){this.focused=true;}};nodes.set(id,element);return element;};
 for(const id of ['panel-about','guide-search','guide-search-results','guide-search-status','guide-tree','guide-coverage','guide-coverage-content'])make(id);
 for(const article of GUIDE_ARTICLES){make(`wiki-tab-${article.id}`);make(`wiki-panel-${article.id}`);}
 const cross=make('cross-link');cross.dataset.guideArticle='genome';
 const root={getElementById:id=>{assert.ok(nodes.has(id),id);return nodes.get(id);},querySelectorAll:()=>[cross],createElement:tag=>{const node=make('dynamic-'+ ++serial);node.tagName=tag;return node;}};
 const location={hash},pushed=[],view={location,history:{pushState(state,title,url){pushed.push(url);location.hash=url;}},addEventListener(name,fn){events[name]=fn;}};
 const ui=installProjectGuide({root,view,onOpen:()=>opened.push(GUIDE_ARTICLES.find(a=>nodes.get(`wiki-panel-${a.id}`).hidden===false).id)});
 return {ui,root,nodes,events,opened,location,pushed,cross,click(id,extra={}){let prevented=false;const link=id==='cross-link'?cross:nodes.get(`wiki-tab-${id}`);link.listeners.click({button:0,preventDefault(){prevented=true;},...extra});return prevented;}};
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
 const intro=GUIDE_ARTICLES.find(a=>a.id==='intro');assert.equal(intro.reviewedVersion,'0.54.1');
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
 const f=fixture('#wiki-panel-memory');assert.equal(f.ui.currentArticle(),'memory');assert.deepEqual(f.opened,['memory']);f.location.hash='#other';f.events.hashchange();assert.equal(f.opened.length,1);assert.equal(f.ui.currentArticle(),'memory');
});

test('search handles aliases, mixed case, ё/е, multiword queries, filenames and literal input',()=>{
 const ids=query=>searchGuideArticles(query).map(a=>a.id);
 assert.ok(ids('ГОЛОД').includes('food'));assert.ok(ids('ребёнок').includes('selection'));assert.deepEqual(ids('ребенок'),ids('ребёнок'));
 assert.ok(ids('цена мышления').includes('brain'));assert.ok(ids('learnSetBrain').includes('brain'));assert.ok(ids('world-save.js').includes('saves'));
 assert.ok(ids('поиск').includes('intro'));
 assert.equal(ids('неизвестноеслово').length,0);assert.equal(ids('<img src=x onerror=alert(1)>').length,0);assert.equal(ids('.*').length,0);
 assert.equal(ids('  ').length,GUIDE_ARTICLES.length);assert.ok(ids('голод память неизвестноеслово').length===0);
});

test('typing only filters navigation, Enter opens a result, Escape restores the tree and passports are retained',()=>{
 const f=fixture(),input=f.nodes.get('guide-search'),tree=f.nodes.get('guide-tree'),results=f.nodes.get('guide-search-results'),article=f.nodes.get('wiki-panel-intro');
 const initialChildren=article.children.length;input.value='усвоение';input.listeners.input();assert.equal(tree.hidden,true);assert.ok(results.children.length);assert.equal(f.ui.currentArticle(),'intro');
 input.listeners.keydown({key:'Enter',preventDefault(){}});assert.equal(f.ui.currentArticle(),'food');assert.ok(results.querySelectorAll().some(link=>link.attributes['aria-current']==='page'));
 input.value='неизвестное';input.listeners.input();assert.equal(results.children.length,0);assert.match(f.nodes.get('guide-search-status').textContent,/Ничего не найдено/);
 input.listeners.keydown({key:'Escape'});assert.equal(tree.hidden,false);assert.equal(results.hidden,true);assert.equal(f.ui.currentArticle(),'food');
 f.ui.select('intro');assert.equal(article.children.length,initialChildren,'source details are appended once');
});

test('source pointers link only through the local source viewer and do not mark a whole file documented',()=>{
 assert.equal(guideSourcePath('world-save.js'),'dist/world-save.js');assert.equal(guideSourcePath('tests/world-ui.test.mjs'),'tests/world-ui.test.mjs');
 assert.equal(guideSourceUrl('world-save.js'),'./source.html?file=dist%2Fworld-save.js');
 const data=guideCoverage([{path:'dist/evolution.js',kind:'app'},{path:'tools/not-yet-described.py',kind:'tools'}]);
 assert.equal(data.total,2);assert.equal(data.referenced,1);assert.equal(data.reviewedArticles,1);assert.equal(data.rows[1].articles.length,0);assert.equal(data.covered,undefined);
 const f=fixture(),legacy=createGuideSources(GUIDE_ARTICLES.find(a=>a.id==='food'),f.root);
 assert.match(legacy.children[1].textContent,/подробная сверка.*впереди/);
});

test('inventory loads lazily, coalesces pending requests, retries errors and caches a valid result',async()=>{
 const f=fixture(),details=f.nodes.get('guide-coverage'),output=f.nodes.get('guide-coverage-content');let calls=0,finish;
 const request=()=>{calls++;return new Promise(resolve=>finish=resolve);};const coverage=installGuideCoverage({root:f.root,request});
 await coverage.load();assert.equal(calls,0);details.open=true;const first=coverage.load();await coverage.load();assert.equal(calls,1);
 finish({ok:false});await first;assert.match(output.textContent,/повторить загрузку/);
 const second=coverage.load();finish({ok:true,json:async()=>({format:'big-evolution-guide-inventory',version:1,modelVersion:'old',files:[]})});await second;assert.match(output.textContent,/недоступен/);
 const third=coverage.load();finish({ok:true,json:async()=>({format:'big-evolution-guide-inventory',version:1,modelVersion:APP_VERSION,files:[{path:'dist/evolution.js',kind:'app'},{path:'tools/x.py',kind:'tools'}]})});await third;
 assert.match(output.children[0].textContent,/Файлов в учёте: 2/);await coverage.load();assert.equal(calls,3);
});

test('source viewer displays the current version, honors safe file links and never fetches a supplied external URL',async()=>{
 const sourceHtml=readFileSync(new URL('../dist/source.html',import.meta.url),'utf8');assert.match(sourceHtml,/id="source-version"/);assert.doesNotMatch(sourceHtml,/версия 0\.5\.1|Это табличный мозг/);
 const script=readFileSync(new URL('../dist/source-viewer.js',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');
 const files=[{name:'docs/START_HERE.md',url:'./source-files/docs/START_HERE.md',purpose:'Вход',lines:1,bytes:12},{name:'dist/evolution.js',url:'./evolution.js',purpose:'Мир',lines:2,bytes:20,aliases:['old-world.js']}];
 for(const [query,expected]of [['?file=https://example.invalid/steal','docs/START_HERE.md'],['?file=dist%2Fevolution.js','dist/evolution.js'],['?file=old-world.js','dist/evolution.js']]){
  const f=fixture(),requested=[];for(const id of ['source-version','file-title','file-purpose','file-size','code','source-error','total-size','files'])f.nodes.set(id,f.root.createElement('div'));
  const fetch=async url=>{requested.push(url);return {ok:true,json:async()=>files,text:async()=>'<script>not executed</script>'};};
  await vm.runInNewContext('(async()=>{'+script+'})()',{APP_VERSION,document:f.root,fetch,URLSearchParams,location:{search:query}});
  assert.equal(f.nodes.get('source-version').textContent,`Версия ${APP_VERSION}`);assert.equal(f.nodes.get('file-title').textContent,expected);
  assert.equal(f.nodes.get('code').textContent,'<script>not executed</script>');assert.equal(f.nodes.get('code').innerHTML,undefined);
  assert.ok(requested.every(url=>url.startsWith('./')));assert.equal(requested.length,2);
 }
});
