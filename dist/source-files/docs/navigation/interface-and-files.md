# Интерфейс, файлы и служебные операции

[Выбор темы](README.md). Выбирать формат по назначению: мир продолжает расчёт, геном задаёт основу, отчёт содержит наблюдения, план задаёт опыты.

Параметры пособия: [guide-parameters.js](../../dist/guide-parameters.js), проверки [guide-parameters0543.test.mjs](../../tests/guide-parameters0543.test.mjs). Принятые варианты читаются из отчёта через experiment-ui/lab-tabs, основной мир — из протокола наблюдателя world-view; черновик редактора не используется.

Числовой каталог пособия: [numeric-rules.js](../../dist/numeric-rules.js) → [guide-numbers-text.js](../../dist/guide-numbers-text.js); источник и единицы проверяются в [numeric-rules0548.test.mjs](../../tests/numeric-rules0548.test.mjs).

## interface
**Задача:** кнопка/панель/подсказка, выбранный житель, карта, медленный показ, подпись версии.
**Сейчас:** разметка — [index.html](../../dist/index.html), связка мира/Canvas — [evolution-app.js](../../dist/evolution-app.js); тексты/справка — [ui-text.js](../../dist/ui-text.js)/[help.js](../../dist/help.js); вкладки — [lab-tabs.js](../../dist/lab-tabs.js)/[screen-tabs.js](../../dist/screen-tabs.js). Статистика — [history-ui.js](../../dist/history-ui.js)/[history-drawers.js](../../dist/history-drawers.js), уведомления опытов — [experiment-ui.js](../../dist/experiment-ui.js). Версия — [app-version.js](../../dist/app-version.js).
**Схема жителя:** [brain-diagram-ui.js](../../dist/brain-diagram-ui.js), камера — [brain-diagram-viewport.js](../../dist/brain-diagram-viewport.js), пояснения — [brain-diagram-help.js](../../dist/brain-diagram-help.js). [Контракт 0.53.1](../updates/v053-brain-viewer.md), [проверки](../../tests/brain-diagram0531.test.mjs).
**Пособие «О проекте»:** [реестр/выжимки/вводная статья](../../dist/project-guide.js), [дерево/ссылки](../../dist/project-guide-ui.js); старые тексты — ui-text. Для содержательной правки читать только sources/related нужной статьи. [Первый микропатч](../updates/v054-project-guide.md), [проверки](../../tests/project-guide054.test.mjs).
**Поиск и полнота 0.54.1:** [термины/источники](../../dist/project-guide-topics.js), [поиск/учёт ссылок](../../dist/project-guide-search.js), [технические блоки/инвентарь](../../dist/project-guide-sources-ui.js). Генерация списка — [guide_inventory.py](../../tools/guide_inventory.py) через экспортёр; текущий список не означает полной сверки. [Протокол](../updates/v054-guide-navigation.md).
**Читаемость 0.54.2:** [текст/таблицы](../../dist/guide-reference-text.js), оформление layout.css; ссылки/выжимки — общий HELP. [Стандарт](../workflows/guide-authoring.md), [проверки](../../tests/guide-reader0542.test.mjs). Базовые значения не выдавать за выбранные настройки мира.
**Граница:** DOM показывает проекцию, физикой владеет [исполнитель](world-and-brain.md#execution). Справка/внутренние вкладки не включают программную паузу; опыты имеют отдельную аренду мира. Общий стиль проверить в layout.css/evolution.css, не добавлять повторную кнопку подсказки к уже оформленному полю.
**Проверка:** [локальные графики 0.52](../../tests/ui052.test.mjs), [UI/кэш 0.51](../../tests/ui051.test.mjs), [world-ui.test.mjs](../../tests/world-ui.test.mjs), [help-ui.test.mjs](../../tests/help-ui.test.mjs), [experiment-ui.test.mjs](../../tests/experiment-ui.test.mjs), [history-ui.test.mjs](../../tests/history-ui.test.mjs); настоящая раскладка/прокрутка/попадание мышью требуют отдельной проверки браузера.
**История:** [экраны 0.36.1](../updates/v036-interface-screens.md), [живая статистика 0.36.3](../updates/v036-live-history.md), [баннер/модальное окно](../updates/v045-notifications-and-documentation.md).
**Дальше:** [контракт рабочего окна](../ui-redesign.md), [0.52.2: компактные сводки](../updates/v052-summary-without-notes.md). Оболочка — [workspace.css](../../dist/workspace.css), вкладки — [workspace-ui.js](../../dist/workspace-ui.js), черновик/стандартный набор — [experiment-preferences.js](../../dist/experiment-preferences.js).

## world-save

0.53: формат полного мира v3; старые полные миры не преобразуются. Для прежних результатов опытов сохранён отдельный режим чтения исторического плана.
**Задача:** сохранить/загрузить мир, точно продолжить текущие действия и случайность.
**Сейчас:** `saveWorld`/`loadWorld` — [world-save.js](../../dist/world-save.js); типы и общие ссылки — [state-codec.js](../../dist/state-codec.js); перед снимком runtime синхронизирует владельцев; UI — [world-files-ui.js](../../dist/world-files-ui.js).
**Граница:** полный мир содержит состояния RNG, память/обучение, процессы, наблюдателя и календарь среды. Загрузка проверяется до замены действующего мира; ошибка подготовки Workers тоже должна сохранить прежний мир. Смена числа владельцев не меняет научное состояние. Совместимость определяется кодом схемы/модели, не одним номером UI.
**Проверка:** [environment-save.test.mjs](../../tests/environment-save.test.mjs): цикл save/load, незавершённые роды, вымирание, смена владельцев, повреждение и отказ подготовки пула; [world-worker.test.mjs](../../tests/world-worker.test.mjs): доставка команд.
**История:** [полный мир 0.36](../updates/v036-environment-energy-save.md), [новая целевая среда 0.38](../updates/v038-target-food-environment.md), [общая пища 0.39.2](../updates/v039-shared-food-seed.md).
**Дальше:** автосохранения/новая совместимость требуют отдельного договора. При добавлении состояния в [мозг](world-and-brain.md#learning), [среду](food.md#environment) или [исполнение](world-and-brain.md#execution) проверить снимок и точное продолжение до объявления готовности.

## genome-analysis
**Задача:** разобрать геном, сравнить чувствительности, понять отрицательные проценты, загрузить основу.
**Сейчас:** `parseGenomeText`/`analyzeGenome` — [genome-analysis.js](../../dist/genome-analysis.js); CLI — [analyze-genomes.mjs](../../tools/analyze-genomes.mjs). Схему/параметры брать из [генома](world-and-brain.md#genome); основы опытов — [experiment-genomes.js](../../dist/experiment-genomes.js)/[founder-senses.js](../../dist/founder-senses.js).
**Граница:** коэффициент ощущения не вероятность действия и не доля распределения, сумма процентов не обязана описывать выбор. Геном не содержит приобретённый опыт; неизвестную схему/шкалу не интерпретировать под нынешним смыслом. Для пользовательского файла сначала формат/версия/полнота, без запуска симуляции.
**Проверка:** [genome-experiments044.test.mjs](../../tests/genome-experiments044.test.mjs): коэффициенты, валидация основ и наследование. Саму выдачу `analyzeGenome` отдельно сверять на файле известной схемы; тесты основ не доказывают верность всех пояснений анализатора. Поведенческий вывод требует [контролируемого опыта](experiments-and-statistics.md#design).
**История:** [общий анализ 0.14](../updates/v014-genome-analysis.md), [регуляторы 0.26](../updates/v026-heritable-mutations.md), [геномы-факторы 0.44](../updates/v044-genome-experiments.md).
**Структура:** v14 реализована в [0.53](../updates/v053-structural-brain.md); [таблица старта и связность 0.53.2](../updates/v053-initial-structure.md). Геометрия просмотра не меняет геном.

## delivery
**Задача:** локальный запуск, проверки, исходники, архив, старые ссылки, публикация.
**Сейчас:** [README.ru.md](../../README.ru.md) — запуск; [verify-local.py](../../tools/verify-local.py) — части короткого набора; [check-project-docs.py](../../tools/check-project-docs.py)/[check-agent-context.py](../../tools/check-agent-context.py) — документы/вход; [export-source.py](../../tools/export-source.py) — каталог/отпечаток/исходники; [package-github.py](../../tools/package-github.py) — GitHub-пакет.
**Граница:** корень и рабочие dist-модули канонические, source-files/манифест/ZIP производные. benchmark-snapshots неизменяемы; локальные логи и переносной файл не входят в пакет. Старую ссылку при переименовании поддерживает SOURCE_ALIASES. Публикация: D:/GitHub/big-evolution-model, сверка Git → commit/push без дополнительных тестов/проверки сайта; другой хостинг — отдельно.
**Проверка:** [границы исторических/нынешних эталонов](../updates/v054-test-baselines.md), [действующий порядок](../verification.md), [команды/упаковка/доступ](../workflows/local.md). Проверять подходящую часть, не повторять миры из-за текста. Архив исходников не является экспортом наблюдений опыта.
**История:** [локальная передача/README](../updates/v031-github-package.md), [короткий вход](../updates/v038-agent-context.md), [правила документации](../updates/v045-notifications-and-documentation.md).
**Дальше:** автоматический индекс символов/контроль устаревания — [следующий возможный блок карты](../next-performance-map.md); он пока не входит в существующие проверки.


## guide-audit

Серия справочника P00–P28 завершила тематический проход в 0.54.17: [результат](../guide-plan/audit.md), [точечный поиск файлов](../guide-plan/current-routes.md). Рабочие главы разнесены по guide-*-text/topics; служебные назначения — guide-audit-topics. Новую тему добавлять с выжимкой и источником, не расширяя AGENTS. Проверка guide-audit05417 удерживает семь пользовательских маршрутов и назначение каждого поставляемого JS/CSS/HTML. Это не автоматический смысловой аудит файла.
