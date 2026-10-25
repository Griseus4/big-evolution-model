/** Небольшие общие средства оформления авторского текста пособия.
 * Строки приходят из исходников проекта, не из пользовательских формул. */
const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4});
export const v=(n,unit='')=>`<span class="guide-value">${number.format(n)}${unit?' '+unit:''}</span>`;
export const p=text=>`<p>${text}</p>`;
export const a=(id,text)=>`<a href="#wiki-panel-${id}" data-guide-article="${id}">${text}</a>`;
export const table=(caption,columns,rows)=>`<div class="guide-table-wrap"><table class="guide-reference-table"><caption>${caption}</caption><thead><tr>${columns.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,...cells])=>`<tr><th scope="row">${label}</th>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const details=(title,text)=>`<details><summary>${title}</summary>${text}</details>`;
