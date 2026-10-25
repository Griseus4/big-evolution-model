import {NUMERIC_RULE_GROUPS,numericRuleRows} from './numeric-rules.js';
import {p,a,table,details} from './guide-markup.js';
import {guideSourceUrl} from './project-guide-search.js';
const rows=numericRuleRows(),source=file=>`<a href="${guideSourceUrl(file)}" data-help="guide-code-index">${file}</a>`;
// Значащие цифры сохраняют видимость очень малых границ вероятности/силы.
const ruleNumber=new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:16});
export function formatRuleNumber(value){return ruleNumber.format(value);}
const render=id=>rows.filter(row=>row.group===id).map(row=>[`${row.label}<br><code>${row.name}</code>`,`<span class="guide-value">${formatRuleNumber(row.value)}</span>`,row.unit]);
export const GUIDE_NUMBERS_TEXT={
 'guide-numbers-body':p('У каждого числового правила есть имя и модуль-владелец. Таблицы ниже читают рабочие константы напрямую: число не переписывается в текст второй раз. Настройки нового мира, принятые параметры запущенного мира и масштабы входов мозга описывают разные вещи.')
 +p('Например, вместимость инвентаря задаётся RULES.inventoryCapacity, энергия порции — RULES.foodEnergy, начальная энергия основателя — RULES.initialEnergy. Длительности процессов задаются DURATION_SUBSTEPS, а перевод подшагов в Т — SUBSTEPS. После изменения источника обновлённое приложение подставит новое число в пособие.')
 +p('Этот каталог показывает базовые правила кода. Для времени усвоения и порогов родов конкретного мира выбери источник в «Числа в пособии». Изменение кода само по себе не переписывает уже сохранённые миры и результаты опытов.')
 +NUMERIC_RULE_GROUPS.map(g=>details(g.title,p(g.description)+p(g.file.includes(' / ')?g.file.split(' / ').map(source).join(' · '):source(g.file))+table(g.symbol,['Параметр','Значение','Единицы'],render(g.id)))).join('')
 +details('Шкалы наследуемых свойств',p('Свойство вычисляется как offset + span × sigmoid(ген). Смещение и размах сохранены явно; вместимости памяти округляются. Это шкалы расшифровки генома, а не индивидуальные значения каждого жителя.')+p(source('cognition-rules.js'))+table('COGNITIVE_SCALE_RULES',['Параметр','Значение','Единицы'],render('trait-scales')))
 +p(`Связанные темы: ${a('time','время')}, ${a('actions','действия')}, ${a('energy','ресурсы тела')}, ${a('brain','мозг')}, ${a('genome','наследование')}.`),
};
