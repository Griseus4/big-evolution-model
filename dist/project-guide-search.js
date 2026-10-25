import {GUIDE_ARTICLES} from './project-guide.js';

// Без морфологии и регулярных выражений из ввода: ё/е равнозначны,
// все слова запроса должны встречаться в названии, выжимке или указателе.
export function normalizeGuideQuery(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();}
const index=GUIDE_ARTICLES.map(article=>({article,title:normalizeGuideQuery(article.title),text:normalizeGuideQuery([article.title,article.summary,...article.keywords,...article.sources.flatMap(s=>[s.file,...s.symbols])].join(' '))}));
export function searchGuideArticles(query){
 const words=normalizeGuideQuery(query).split(' ').filter(Boolean);
 if(!words.length)return GUIDE_ARTICLES;
 return index.filter(row=>words.every(word=>row.text.includes(word))).sort((a,b)=>Number(words.every(word=>b.title.includes(word)))-Number(words.every(word=>a.title.includes(word)))).map(row=>row.article);
}

export function guideSourcePath(file){return file.includes('/')?file:`dist/${file}`;}
export function guideSourceUrl(file){return './source.html?file='+encodeURIComponent(guideSourcePath(file));}

/** Только наличие указателя, не процент документированности файла.
 * Вводная статья может ссылаться на файл, не объясняя все его механизмы. */
export function guideCoverage(files){
 const references=new Map();
 for(const article of GUIDE_ARTICLES)for(const source of [...article.sources,...article.checks]){
  const path=guideSourcePath(source.file);if(!references.has(path))references.set(path,[]);references.get(path).push(article.id);
 }
 const rows=files.map(file=>({...file,articles:[...new Set(references.get(file.path)??[])]}));
 return {rows,total:rows.length,referenced:rows.filter(file=>file.articles.length).length,reviewedArticles:GUIDE_ARTICLES.filter(a=>a.reviewedVersion).length,articles:GUIDE_ARTICLES.length};
}
