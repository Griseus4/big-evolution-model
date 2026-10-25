import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIDE_SYSTEM_TEXT} from '../dist/guide-system-text.js';
import {GUIDE_ARTICLES} from '../dist/project-guide.js';
import {searchGuideArticles} from '../dist/project-guide-search.js';
test('every system link has a real destination and every new article has its body',()=>{
 const ids=new Set(GUIDE_ARTICLES.map(a=>a.id)),html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 for(const value of Object.values(GUIDE_SYSTEM_TEXT))for(const [,id] of value.matchAll(/data-guide-article="([^"]+)"/g))assert.ok(ids.has(id),id);
 for(const id of ['runtime','performance','development']){assert.ok(GUIDE_SYSTEM_TEXT['guide-'+id+'-body']);assert.ok(html.includes('id="wiki-panel-'+id+'"'));assert.equal(GUIDE_ARTICLES.find(a=>a.id===id).reviewedVersion,'0.54.16');}
});
test('runtime, performance and developer questions are searchable',()=>{
 for(const [query,id] of [['вычислителей','runtime'],['нагрузки','performance'],['изменить','development']])assert.ok(searchGuideArticles(query).some(a=>a.id===id),query);
});
