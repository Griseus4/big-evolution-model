/** Просмотр исходников не исполняет выбранный файл: он выводит его как текст.
 * Файлы и подписи берутся из созданного при сборке манифеста. Ни геном,
 * ни результаты игры не меняются от открытия страницы исходников.
 */
import {APP_VERSION} from './app-version.js';
const element=id=>document.getElementById(id);
element('source-version').textContent=`Версия ${APP_VERSION}`;
let requestNumber=0;
async function showFile(file,buttons){
 const request=++requestNumber;
 buttons.forEach(({button,entry})=>button.setAttribute('aria-pressed',String(entry===file)));
 element('file-title').textContent=file.name;element('file-purpose').textContent=file.purpose;
 element('file-size').textContent=`${file.lines} строк · ${file.bytes.toLocaleString('ru-RU')} байт`;
 element('code').textContent='Загрузка…';element('source-error').textContent='';
 try{
  const response=await fetch(file.url);if(!response.ok)throw new Error(`Не удалось открыть файл (${response.status}).`);
  const code=await response.text();if(request!==requestNumber)return;
  element('code').textContent=code;
 }catch(error){if(request===requestNumber){element('code').textContent='';element('source-error').textContent=error.message;}}
}
try{
 const response=await fetch('./source-manifest.json');if(!response.ok)throw new Error('Не удалось получить список исходников.');
 const files=await response.json();
 element('total-size').textContent=`${files.length} файлов · ${files.reduce((n,f)=>n+f.lines,0)} строк. Вход в проект: docs/START_HERE.md.`;
 const buttons=files.map(entry=>{
  const button=document.createElement('button');button.textContent=`${entry.name} · ${entry.lines} строк`;
  button.setAttribute('aria-pressed','false');return {button,entry};
 });
 buttons.forEach(({button,entry})=>button.addEventListener('click',()=>showFile(entry,buttons)));
 element('files').replaceChildren(...buttons.map(b=>b.button));
 // Query выбирает только файл из нашего манифеста или его прежнее имя.
 // aliases создаёт сборщик; произвольный URL из параметра никогда не загружаем.
 // Это позволяет дать прямую ссылку на входной документ или нужный модуль.
 const requested=new URLSearchParams(location.search).get('file');
 await showFile(files.find(f=>f.name===requested||f.aliases?.includes(requested))??files.find(f=>f.name==='docs/START_HERE.md')??files[0],buttons);
}catch(error){element('source-error').textContent=error.message;element('code').textContent='';}
