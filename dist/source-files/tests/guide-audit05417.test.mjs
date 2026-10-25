import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {searchGuideArticles,guideSourcePath} from '../dist/project-guide-search.js';
test('common questions lead to an explanatory chapter, including a final question mark',()=>{
 const routes=[['Почему житель голодает?','food'],['Как появляется новая связь?','structure-evolution'],['Что наследуется?','genome'],['Почему сводка отсутствует?','periods'],['Как сравнить группы?','groups'],['Как продолжить мир?','files'],['Где изменить длительность действия?','numbers']];
 for(const [query,id] of routes)assert.ok(searchGuideArticles(query).some(a=>a.id===id),query);
 assert.equal(searchGuideArticles('.*').length,0);
});
test('every shipped application module has an explicit topical route, without claiming a whole file reviewed',()=>{
 const references=new Set(GUIDE_ARTICLES.flatMap(a=>a.sources.map(s=>guideSourcePath(s.file))));
 for(const name of readdirSync(new URL('../dist/',import.meta.url)))if(/\.(js|css|html)$/.test(name))assert.ok(references.has('dist/'+name),name);
 for(const a of GUIDE_ARTICLES){assert.ok(a.summary.trim());assert.ok(a.sources.length);assert.ok(a.reviewedVersion);for(const id of a.related)assert.ok(GUIDE_ARTICLES.some(a=>a.id===id),id);}
 const ui=readFileSync(new URL('../dist/project-guide-sources-ui.js',import.meta.url),'utf8');assert.match(ui,/не отметка полного описания/);
});
