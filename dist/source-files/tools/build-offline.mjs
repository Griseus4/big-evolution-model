import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const engine=read('dist/simulation.js').replace(/^export /gm,'');
const app=read('dist/app.js').replace(/^import .*;\n/,'');
const script=`(()=>{\n${engine}\n${app}\n})();`.replace(/<\/script/gi,'<\\/script');
const html=read('dist/legacy.html').replace('<link rel="stylesheet" href="./style.css">',`<style>${read('dist/style.css')}</style>`)
 .replace('<script type="module" src="./app.js"></script>',`<script>${script}</script>`);
fs.writeFileSync(new URL('game.html',root),html);
console.log('Offline game.html built; no network resources required.');
