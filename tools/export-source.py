"""Создаёт страницу-папку и архив браузерного проекта без установщика.

Запуск из корня проекта: python3 tools/export-source.py.
Архив хранит исходники, тесты и README. Настройки приватного хостинга, Git,
учётные данные, старые установщики и временные артефакты в него не попадают.
Этот скрипт нужен разработчику при публикации; игра не требует Python.
"""
from pathlib import Path
import json
import hashlib
import re
import shutil
import zipfile
import sys
from guide_inventory import write_guide_inventory

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUTPUT = DIST / 'source-files'

# Отпечаток исходников нужен для разбора присланных испытаний: одна версия модели
# может иметь несколько исправленных сборок. Метаданные не дублируют правила мира.
model_version = re.search(r"MODEL_VERSION='([^']+)'", (DIST / 'life-history.js').read_text()).group(1)
write_guide_inventory(ROOT, model_version)
fingerprint_files = sorted(p for p in DIST.iterdir() if p.is_file() and p.suffix in {'.js', '.html', '.css'})
fingerprint_files += sorted(p for p in (DIST / 'benchmark-snapshots').rglob('*') if p.is_file() and p.suffix in {'.js', '.json'})
hashes = {p.relative_to(DIST).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in fingerprint_files}
fingerprint = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
(DIST / 'build-info.json').write_text(json.dumps({'modelVersion': model_version, 'sourceFingerprint': fingerprint, 'files': hashes}, indent=2) + '\n')

# Промежуточный снимок расчёта требует актуального отпечатка, но не повторной
# упаковки документации/архива. Полная генерация остаётся заключительным проходом.
if '--build-only' in sys.argv:
    print(f'Build metadata: {model_version}, {fingerprint}')
    raise SystemExit(0)
assert OUTPUT.resolve().is_relative_to(DIST.resolve()) and OUTPUT.name == 'source-files'
if OUTPUT.exists():
    shutil.rmtree(OUTPUT)
OUTPUT.mkdir()

PURPOSES = {
    'dist/project-guide-topics.js': 'Термины поиска и указатели на код/проверки прежних статей.',
    'dist/project-guide-search.js': 'Поиск без регулярных выражений из ввода и учёт навигационных ссылок.',
    'dist/project-guide-sources-ui.js': 'Блок «Где это в коде» и ленивый список полноты описания.',
    'dist/project-guide-inventory.json': 'Производный инвентарь канонического кода; не процент полноты пособия.',
    'tools/guide_inventory.py': 'Список рабочих исходников без производных копий и снимков.',
    'dist/project-guide.js': 'Пособие: выжимки, вводная статья и ссылки сверки с реализацией.',
    'dist/project-guide-ui.js': 'Дерево ссылок, статьи и глубокие адреса без управления миром.',
    'tests/project-guide054.test.mjs': 'Реестр, навигация, переходы по URL и сохранение состояния статей0.54.',
    'dist/food-island-evolution.js': 'Редкая перестройка пищевых групп: целый перенос, рост по краям, создание/удаление.',
    'dist/heritable-statistics.js': 'Семь врождённых показателей и распределения чувствительностей наблюдателя.',
    'dist/food-production-history.js': 'Временной интеграл потенциальной выработки по журналу среды.',
    'dist/app-version.js': 'Общий номер выпуска для заголовка и подвала.',
    'dist/layout.css': 'Адаптивная широкая панель, экраны настроек и оглавление справочника.',
    'dist/screen-tabs.js': 'Клавиатурные экраны без потери введённых значений и изменения мира.',
    'dist/typography.js': 'Пробелы русских текстов и неразрывные числовые единицы.',
    'dist/world-substeps.js': 'Один подшаг существующих параллельных фаз для медленного наблюдения.',
    'dist/food-distribution.js': 'Текущие общие параметры групп для автоматики и редактора.',
    'tests/interface0361.test.mjs': 'Подшаги/профиль, общие поля, клавиатура и типографика0.36.1.',
    'docs/updates/v036-interface-screens.md': 'Контракт и результаты интерфейсного патча0.36.1.',
    'dist/energy-budget.js': 'Единая оплата энергии и перевод неоплаченного остатка в потерю здоровья.',
    'dist/environment-settings.js': 'Общие интервалы, пищевой минимум и правила автоматической среды.',
    'dist/automatic-environment.js': 'Пять обеднений, случайные изменения и локальные переносы без удаления пищи.',
    'dist/environment-ui.js': 'Настройки автоматики и состояние календаря в панели источников.',
    'dist/environment-checks.js': 'Три проверки энергетики, стадий среды и точного сохранения.',
    'dist/state-codec.js': 'Именованный кодек графа данных с общими ссылками и числовыми буферами.',
    'dist/world-save.js': 'Полный ручной снимок, проверка и восстановление текущей модели.',
    'dist/world-files-ui.js': 'Скачивание и загрузка мира с сохранением текущего мира при отказе.',
    'tests/environment-save.test.mjs': 'Энергетика, среда, точное продолжение и атомарный отказ загрузки.',
    'docs/updates/v036-environment-energy-save.md': 'Контракт, реализация и результаты проверок0.36.0.',
    'dist/life-observations.js': 'Счётчики времени запасов, вызовов мозга и причин прерываний.',
    'dist/food-exposure.js': 'Точный интеграл пищи на карте без повторных обходов.',
    'dist/life-cohorts.js': 'Четыре статистики по интервалам рождения и корректное дожитие.',
    'dist/history-charts.js': 'Canvas-графики истории с едиными временными интервалами.',
    'dist/history-ui.js': 'Кешируемые сводки и таблица с ограничением высоты и50 строками.',
    'dist/history-window.js': 'Общий период: переиспользование групп, точные края и средние пищи.',
    'dist/survival-curve.js': 'Возрастная кривая с точными границами неизвестных исходов живых.',
    'dist/ui-numbers.js': 'Единое округление подписей и числовых полей без изменения точности мира.',
    'dist/history-drawers.js': 'Выдвижные панели статистики: наведение, фокус и клавиатура без работы на прокрутке.',
    'tests/history-window.test.mjs': 'Точные границы, масштабы, префикс пищи и возрастная кривая.',
    'docs/updates/v035-history-window.md': 'Исправление графиков0.35.1 без изменения модели.',
    'tests/life-cohorts.test.mjs': 'Статистика, дожитие, запасы, прерывания, интеграл пищи и эквивалентность.',
    'tests/history-ui.test.mjs': 'Настоящий UI историй в управляемом DOM: выбор, страницы, ошибки и кеш.',
    'docs/updates/v035-life-history-charts.md': 'Контракт, стоимость и проверка историй0.35.',
    'dist/activity-perception.js': 'Единый снимок11 видов текущей деятельности по видимым клеткам.',
    'tests/activity-perception.test.mjs': 'Направления, единая граница, локальность, Worker и численные входы деятельности.',
    'docs/updates/v034-visible-activities.md': 'Контракт, стоимость и проверка видимости деятельности0.34.',
    'dist/ui-text.js': 'Единый каталог подсказок/статических описаний, версия и числовые пояснения из модели.',
    'dist/performance-tabs.js': 'Подвкладки вычислителей и профиля без влияния на мир.',
    'dist/benchmark-configurations.js': 'Версии, поддерживаемые размеры, оценщики один раз и план измерений.',
    'dist/configuration-benchmark-runner.js': 'Очередьv5, единый исходный мир версии, прогрев и один активный пул.',
    'dist/configuration-benchmark-report.js': 'Валидацияv5 и ускорение/эффективность относительно базы своей версии.',
    'dist/configuration-benchmark-ui.js': 'Групповые заголовки версий, размеры пула и объединённые оценщики.',
    'dist/controls.css': 'Круглые крупные бегунки и оформление новых элементов.',
    'tests/live-computations.test.mjs': 'Траектории и отказ переноса живого опыта с продолжением старого пула.',
    'tests/configuration-benchmark.test.mjs': 'Настоящие Workerv5, очередь, метрики и ограничения снимков.',
    'tests/ui-text-controls.test.mjs': 'Полнота текстов/версии, центральный предел300 и разброс, клавиатура.',
    'docs/updates/v033-live-controls.md': 'Контракт, реализация и границы проверки0.33.2.',
    'dist/computation-settings.js': 'Единые числа вычислителей, валидация, консервативный Авто и сведения CPU.',
    'dist/worker-benchmark-settings.js': 'Одна нагрузка, размеры пула и отдельная методика сравнения режимов.',
    'tests/worker-count-benchmark.test.mjs': 'Одинаковый мир, ротация, прогрев, освобождение и настоящие Worker разных размеров.',
    'tests/worker-count-ui.test.mjs': 'Панель выбора, отправка настроек, рекомендация, экспорт и восстановление v4 в минимальном DOM.',
    'docs/updates/v033-worker-counts.md': 'Выбор до16 вычислителей и сравнение режимов одного стандартного мира0.33.1.',
    'dist/parallel-world.js': 'Координатор постоянных владельцев личного опыта, барьеры, порядок RNG и возврат буферов.',
    'dist/cognition-owner.js': 'Владелец памяти, внимания, TD и оценок; подтверждение личного перехода.',
    'dist/cognition-worker.js': 'Модульный вычислитель с версионным протоколом, без мирового RNG.',
    'dist/cognition-packet.js': 'Числовой пакет локальных наблюдений без округления Float64.',
    'dist/cognition-summary.js': 'Численность удалённой памяти для наблюдателя, без подмены её содержимого.',
    'docs/updates/v033-parallel-world.md': 'Параллельный мир0.33, эквивалентность, измеренные результаты и ограничения.',
    'tests/parallel-world.test.mjs': 'Полные траектории1/2/4, RNG, роды/смерти, конкуренция, сбои и интерфейс.',
    'tests/parallel-benchmark.test.mjs': 'Настоящие снимки, сброс опыта и освобождение владельцев при замерах.',
    'tools/measure-parallel-033.mjs': 'Короткое парное сравнение замороженных0.32/0.33, вне стандартного набора.',
    'dist/temporal-world.js': 'Фазы подшагов, процессы, расходы, конкуренция, роды и обучение по времени.',
    'dist/action-timing.js': 'Единые длительности действий и стоимость основного выбора.',
    'dist/temporal-layout.js': 'Схема v12, основной мозг1376, внимание73, подписанные входы.',
    'dist/temporal-inputs.js': 'Только локальные сведения, текущий процесс, прогресс, причина и кандидаты.',
    'dist/attention-gate.js': 'Наследуемая сеть16→4→1 и переиспользуемый буфер наблюдений.',
    'dist/temporal-brain.js': 'Математика текущего мозга через общий движок.',
    'dist/set-brain-engine.js': 'Общие числовые проходы, скалярное ожидание и градиент текущей и прежней схем.',
    'dist/temporal-checks.js': '33 проверки текущих механик, генома, градиента и инвариантов.',
    'docs/action-time-spec.md': 'Точная реализованная спецификация времени0.32.',
    'docs/updates/v032-action-time.md': 'Контракт, стоимость, исполненные проверки и публикация0.32.0.',
    'docs/updates/v031-shared-decision-inputs.md': 'Контракт общих входов одного решения0.31.3, эквивалентность и ограниченный замер.',
    'tests/shared-decision-input.test.mjs': 'Точные входы/Q до и после обучения, владение пакетами, миры/RNG и рождение против0.31.1.',
    'dist/worker-timing.js': 'Границы задач Worker, задержки запуска, невложенные фазы и ограниченные гистограммы профиляv3.',
    'tests/worker-timing.test.mjs': 'Границы/пауза/отмена/срок записи и точное совпадение модели/RNG в обоих режимах.',
    'tools/check-profile-overhead.mjs': 'Короткая оценка цены режимов записи на одинаковой работе с контролем SHA.',
    'docs/updates/v031-worker-diagnostics.md': 'Контракт0.31.2, профильv3, проверки и пределы диагностики CPU.',
    'tests/scalar-continuation.test.mjs': 'Точное скалярное Expected Q, общая политика, история и целые миры против0.31.0.',
    'docs/updates/v031-input-allocations.md': 'Оптимизация упаковки входов, точная база сравнения, проверки и ограниченный Node-замер.',
    'tests/input-allocation.test.mjs': 'Побитные входы, оценки, история и полные миры против снимка до оптимизации.',
    'tools/check-input-performance.mjs': 'Короткое парное сравнение входов/мира без профиля, с контролем полного результата.',
    'dist/performance-probe.js': 'Необязательные метки только выбранного синхронного шага, без таймеров при выключенной записи.',
    'tests/performance-detail.test.mjs': 'Вложенное время, выборка, исключения, эквивалентность числовой модели и профильv2.',
    'docs/updates/v030-profile-detail.md': 'Разрешённая детализация профиляv2, поля, границы измерений и стоимость.',

    'dist/world-worker.js': 'Вход основного расчётного Worker и очередь между целыми шагами.',
    'dist/world-runtime.js': 'Единственный владелец мира, команды, целевая частота и снимки.',
    'dist/world-view.js': 'Версия протокола и компактная проекция наблюдателя без физики.',
    'dist/world-client.js': 'Асинхронные запросы, эпоха мира и подтверждения снимков.',
    'dist/world-profiler.js': 'Разделение времени UI и профиля расчётного Worker.',
    'tests/world-worker.test.mjs': 'Эквивалентность мира, протокол, фон и настоящий Worker в Node.',
    'tests/world-ui.test.mjs': 'Исполнение UI со снимками Worker в минимальном DOM.',
    'docs/updates/v030-world-worker.md': 'Контракт Worker, стоимость и пределы локальных проверок.',
    'dist/mutation-parameters.js': 'Единая шкала, инициализация и наследование регуляторов изменчивости.',
    'dist/set-brain-layout.js': 'Схема мозга Б: 975 параметров, видимость источников, операции и подписанные входы.',
    'dist/set-brain-inputs.js': 'Адаптер видимых клеток и существующей личной памяти; снимок входа обучения.',
    'dist/set-brain.js': 'Общая ситуация, пакет Q, иерархические вероятности и градиент Expected SARSA.',
    'dist/set-brain-checks.js': '18 исполняемых пользователем проверок нового мозга.',
    'docs/updates/v028-set-context-brain.md': 'Контракт мозга Б, формулы, совместимость, стоимость и порядок проверок.',
    'dist/mutation-checks.js': '12 пользовательских проверок v9, родительского профиля и адаптеров.',
    'docs/updates/v026-heritable-mutations.md': 'Утверждённый контракт, формулы, совместимость и проверки изменчивости.',

    'dist/neighbour-perception.js': 'Текущий локальный обзор и индекс занятости; ID только при контакте.',
    'dist/neighbour-checks.js': '15 проверок восприятия, совместимости и сети v8.',
    'docs/updates/v025-neighbour-perception.md': 'Восприятие соседей, геном v8 и новая серия замеров.',
    'docs/updates/v024-inputs-groups-and-seed.md': 'Входы без предварительных нулей, снимок/группы/JSON v3/seed и 143 проверки.',
    'dist/random-seed.js': 'Свежая энтропия браузера для поля нового опыта; не RNG мира.',
    'docs/updates/v023-repeat-limit.md': 'До 100 повторов, разбор парных данных, отложенные настройки и случайный seed.',
    'docs/next-neighbours.md': 'Контракт текущего восприятия 0.25: количества, ID своей клетки, совместимость v7/v8.',
    'docs/optimization-options.md': 'Предварительная аналитика направлений, измеренные основания, оговорки и условия выбора.',
    'docs/updates/v024-shared-repeats-and-results.md': 'Общее раскрытие повторов, 585 замеров и проверка чувствительности к выбросам.',
    'docs/updates/v023-version-benchmarks-and-panel.md': 'Снимки/серии, чередование, JSON v2, панель и протокол 138 проверок.',
    'dist/benchmark-versions.js': 'Реестр текущей серии, выбор повторов и ротация порядка версий.',
    'dist/benchmark-snapshot-runtime.js': 'Ленивый импорт неизменяемых расчётных модулей и прежние таймеры.',
    'dist/benchmark-comparison-runner.js': 'Последовательная очередь нагрузка/повтор/версия, контроль результатов.',
    'dist/benchmark-version-checks.js': 'Пять пользовательских проверок очереди, отчётов, остановки и SHA снимков.',
    'tools/freeze-benchmark.py': 'Неизменяемый снимок графа расчётных модулей из Git без запуска миров.',
    'tools/check-benchmark-snapshots.py': 'Статический контроль побайтного совпадения снимков с Git/SHA.',

    'docs/updates/v022-continuation-optimization.md': 'Скалярное Expected Q, буферы/контракты, профиль и протокол 133 проверок.',
    'dist/continuation-checks.js': 'Независимые входы 0.21, скалярная оценка, изоляция и полные миры прежнего пути.',

    'docs/updates/v021-test-tabs.md': 'Три подвкладки, общий JSON, отдельное хранение отчётов и ручная проверка.',
    'dist/lab-reports.js': 'Контейнер трёх отчётов, извлечение замера и статус прерванных запусков.',
    'dist/lab-report-checks.js': 'Две пользовательские проверки сохранности разделов и восстановления отчётов.',

    'docs/updates/v020-fixed-benchmarks.md': 'Постоянные нагрузки, снимки/повторы, сравнение и протокол 125 пользовательских проверок.',
    'dist/benchmark-fixtures.js': 'Единственный версионный набор шести постоянных нагрузок скорости.',
    'dist/benchmark-state.js': 'Внутренний полный снимок, сохранение общих ссылок, восстановление прототипов и SHA-256.',
    'dist/benchmark-runner.js': 'Прогрев, фиксированная работа, три повтора, таймеры и контроль одинаковых итогов.',
    'dist/benchmark-worker.js': 'Один последовательный Worker замеров с остановкой и редким прогрессом.',
    'dist/benchmark-report.js': 'Проверка отчётов, медианы и отклонение несопоставимых нагрузок.',
    'dist/benchmark-ui.js': 'Кнопки замеров, загрузка прежнего JSON, сводки и сравнение времени.',
    'dist/benchmark-checks.js': 'Пять пользовательских проверок снимков, фикстур, сравнения, остановки и входов памяти.',

    'docs/updates/v019-buffer-check-fix.md': 'Пользовательские 119/120 и исправление уровня world/brain в проверке буферов.',
    'docs/updates/v019-neural-optimization.md': 'Два профиля A53, первая оптимизация, ресурсный компромисс и пользовательские проверки.',
    'dist/neural-optimization-checks.js': 'Шесть регрессионных проверок чисел/буферов/миров против 0.18.',
    'dist/neural-v018-reference.js': 'Замороженная математика 0.18 только для пользовательских проверок.',
    'docs/updates/v018-performance.md': 'Измерения основного мира/UI, экспорт, прокрутка и пользовательский протокол 0.18.',
    'dist/performance-profiler.js': 'Невложенные времена, выборка шагов, нагрузка и восстановление методов мира.',
    'dist/performance-ui.js': '30 активных секунд, панель результатов и компактный JSON профиля.',
    'dist/performance-checks.js': 'Четыре пользовательские проверки учёта/паузы/RNG/исключений.',
    'dist/stable-text-list.js': 'Сохранение DOM/строк/scrollTop фиксированного списка признаков.',
    'docs/updates/v017-observation-results.md': 'Сообщение 110/110, проверенный JSON seed42/55 234, поведение/среда и причина прокрутки.',
    'docs/performance-plan.md': 'Предложенный порядок измерений/ускорения 0.17 с сохранением правил и будущим индексом соседей.',
    'docs/updates/v017-neural-brain.md': 'Сеть 32→16→Q, v7/558, личное TD, стартовые условия и 110 проверок пользователя.',
    'dist/neural-layout.js': 'Фиксированная схема сети, именованные входы, порядок параметров и свойства v7.',
    'dist/neural-brain.js': 'Локальные входы, прямой проход/градиент и личное Expected SARSA с одним следом.',
    'dist/neural-checks.js': '14 сетевых проверок, запускаемых только пользователем.',
    'dist/world-defaults.js': 'Начальные условия нового мира без редактирования уже живущего.',

    'docs/updates/v016-check-results.md': 'Пользовательский отчёт 0.16.1: 95/96, исправление фикстуры body-modes в 0.16.2.',
    'docs/updates/v016-startup-fix.md': 'Исправление запуска 0.16.1: импорты действий и границы проверки инициализации.',
    'tools/check-startup.mjs': 'Узкая диагностика создания мира и начальных оценок без шагов симуляции или браузера.',
    'tools/verify-local.py': 'Одна команда коротких локальных проверок, повтор выбранной части и отчёт времени/ошибок.',
    'docs/updates/README.md': 'Индекс обновлений по версиям: физика, мир, география, рождение и результаты.',
    'docs/updates/v014-genome-analysis.md': 'Постоянная расшифровка геномов/пары: версии, ограничения, CLI и пользовательская проверка.',
    'dist/brain-controller.js': 'Контракт локальных наблюдений/вариантов, сеть и старый табличный адаптер, обучение и диагностика.',
    'dist/genome.js': 'Случайная основа, мутации и совместимость геномов независимо от физики мира.',
    'dist/action-catalog.js': 'Стабильные подписи действий без импорта мира.',
    'docs/updates/v016-brain-interface.md': 'Первый блок перехода: границы мира/мозга, исправление senses, совместимость и проверки.',
    'dist/brain-parameters.js': 'Общая именованная шкала cognition-v1, одинаковая для мозга и расшифровки.',
    'dist/genome-analysis.js': 'Чистый разбор v1–v6, сравнение по смыслу и экспорт пояснений, без симуляции.',
    'dist/genome-analysis-ui.js': 'Локальные два слота анализа, таблицы/разности и скачивание, без изменения мира.',
    'tools/analyze-genomes.mjs': 'Тот же расшифровщик для агента: чтение файлов в JSON/Markdown, без миров.',
    'docs/updates/v015-body-senses.md': 'Простое объяснение запасов/желудка, схема v6/572, TD по действиям, совместимость и протокол пользователя.',
    'docs/updates/v013-deposit-and-sidebar.md': 'Выкладывание одной порции, цена 0.36, предел 10; компактные разделы, схема генома v5 и пользовательские проверки.',
    'dist/sidebar.js': 'Вкладки компактной правой панели: видимость и клавиатурный фокус, без действий мира.',
    'docs/updates/v012-reproduction-results.md': 'Анализ четырёх пользовательских отчётов 0.12 на общем горизонте: проверки, рождение и пределы выводов.',
    'docs/updates/v012-reproduction.md': 'Добровольное рождение: цена, пороги, совместимость геномов, показатели и пользовательский протокол.',
    'docs/START_HERE.md': 'Начни здесь после потери контекста: короткий статус, маршруты чтения и ближайший блок.',
    'docs/work/current.md': 'Контрольная запись: разрешённый объём, состояние этапа, проверки и следующий шаг.',
    'docs/workflows/context.md': 'Как обсуждать контракты и передавать контекст без повторения всей истории.',
    'docs/workflows/local.md': 'Локальный запуск, выбор коротких проверок и заключительная упаковка.',
    'docs/templates/contract.md': 'Шаблон одного тематического контракта с явным статусом разрешения.',
    'docs/updates/v038-agent-context.md': 'Уборка контекста после 0.38.0: архив, маршруты и проверки документации.',
    'docs/roadmap.md': 'Цель, ближайшие приоритеты, равномерный старт и лес/равнины; реализованное отделено от планов.',
    'AGENTS.md': 'Постоянные инструкции агенту: договорённости, ограничения и завершение работы.',
    'docs/architecture.md': 'Какие модули отвечают за мир, мозг, интерфейс и проверки.',
    'docs/current-model.md': 'Только реализованные факты модели 0.17, с явными ограничениями.',
    'docs/decisions.md': 'Почему выбраны правила и что действительно согласовано.',
    'docs/next-memory.md': 'Принятые и реализованные требования личной навигации и памяти; будущие вопросы.',
    'docs/verification.md': 'Выбор проверок, пределы выводов и сохранение проекта.',
    'docs/ideas-archive.md': 'Историческое обсуждение; старые статусы и параметры не являются действующим ТЗ.',
    'docs/brain-and-predators-notes.md': 'Пояснения прогнозов, числовых признаков, ручного обучения и будущей экосистемы; не реализация.',
    'docs/neural-brain-design.md': 'Предложенный проект сети: интерфейсы, входы, обучение, геномы и проверки; не реализация.',
    'docs/future-ideas.md': 'Обсуждённые идеи: пищевые циклы, износ и долголетие, личное развитие; статусы и границы разрешения.',
    'docs/updates/v009-physiology.md': 'Точные настройки пользовательских испытаний физиологии 0.9, метрики и трактовка исходов.',
    'docs/updates/v010-world-changes.md': 'Правила изменения живущего мира, пользовательские проверки и наблюдения без перезапуска.',
    'docs/experiments-browser.md': 'Как пользователю запускать проверки и длинные миры, читать результаты и отправлять JSON.',
    'dist/life-history.js': 'Компактные итоги жизней и накопительные сводки без влияния на мозг.',
    'dist/lab-tabs.js': 'Вкладки историй/испытаний, пул Workers, сохранение последнего отчёта и загрузки JSON.',
    'dist/browser-checks.js': 'Изолированные браузерные проверки механизмов, запускаемые пользователем.',
    'dist/experiment-runner.js': 'Длинный опыт одного мира: контрольные точки, инварианты и образцы геномов.',
    'dist/experiment-worker.js': 'Фоновый исполнитель проверки или мира без DOM и отрисовки.',
    'dist/build-info.json': 'Отпечаток этой сборки для точного анализа отчёта.',
    'docs/updates/v006-experiments.md': 'Четыре сравнения до 30 000 шагов: память включена, TD включён/выключен; ограничения выводов.',
    'tools/compare-learning.mjs': 'Воспроизводимый длинный опыт без отрисовки; вывод контрольных точек JSONL.',
    'tools/check-browser-wiring.py': 'Статическая проверка синтаксиса, импортов, ресурсов и ID без запуска игры.',
    'tools/check-project-docs.py': 'Проверка ссылок документов и согласованности с экспортами модели.',
    'tools/check-agent-context.py': 'Ограничение размера входных документов и проверка полноты контрольной записи.',
    'dist/navigation.js': 'Личные осевые координаты, повороты и шаги; проекция в мир только для физики и отображения.',
    'dist/food-settings.js': 'Пищевой бюджет, число островков, центральный период и разбросы; границы и независимые ёмкости.',
    'dist/help.js': 'Подсказки и доступный диалог наблюдателя без изменения мира.',
    'docs/updates/v011-geography.md': 'Первый патч: реки/озёра/броды, пространственный старт, профили и пользовательские проверки.',
    'dist/geography.js': 'Независимая география, связность суши, броды и равномерное размещение основателей.',
    'dist/food-islands.js': 'Индивидуальные группы пищи: бюджет, размещение, периоды/фазы и восстановление.',
    'dist/food-controls.js': 'Общие поля пищевых условий игры, вмешательства и испытаний.',
    'dist/resident-trail.js': 'След только выбранного жителя за 20 перемещений, вне мозга.',
    'docs/updates/v027-food-islands-and-trail.md': 'Правила индивидуальных островков/следа и маршрут 183 проверок.',
    'dist/food-layout.js': 'Распределение выбранных источников компактными островками без изменения запасов.',
    'dist/world-edit.js': 'Проверка и атомарная подготовка изменения источников в существующем мире, независимая от мозгов.',
    'dist/cognition.js': 'Общая память наблюдений/самочувствие и старый табличный TD; сеть — neural-brain.js.',
    'dist/evolution.js': 'Физика мира, пакет доступных вариантов и исполнение; вызывает отдельный brain-controller.js.',
    'dist/evolution-app.js': 'Управление игрой, панель жителя, отображение воспоминаний, карта, график и импорт/экспорт.',
    'dist/index.html': 'Разметка лаборатории и доступные пользователю настройки.',
    'dist/evolution.css': 'Оформление лаборатории и адаптация к ширине экрана.',
    'dist/simulation.js': 'Предыдущая модель с готовыми целями. Новый опыт использует только её геометрию и генератор случайных чисел.',
    'README.md': 'Устройство проекта, ограничения, запуск исходников и проверки.',
    'tests/cognition.test.mjs': 'Проверки личного обучения, памяти, скрытых клеток и отсутствия наследования опыта.',
}
# Старые ссылки source?file=... остаются рабочими после переименования.
SOURCE_ALIASES = {'docs/experiments-v06.md': 'docs/updates/v006-experiments.md', 'docs/physiology-v09.md': 'docs/updates/v009-physiology.md', 'docs/world-changes-v010.md': 'docs/updates/v010-world-changes.md', 'docs/geography-v011.md': 'docs/updates/v011-geography.md', 'docs/reproduction-v012.md': 'docs/updates/v012-reproduction.md', 'docs/reproduction-results-v012.md': 'docs/updates/v012-reproduction-results.md'}

# Версионные документы группируются и сортируются по нулевому префиксу.
# Точка входа остаётся первой, затем индекс обновлений и версии по возрастанию.
def source_order(path):
    name = path.relative_to(ROOT).as_posix()
    if name == 'docs/START_HERE.md':
        return (0, 0, name)
    if name.startswith('docs/updates/'):
        return (1, 0 if name.endswith('/README.md') else 1, path.name)
    return (2, list(PURPOSES).index(name) if name in PURPOSES else 100, name)

files = [ROOT / 'AGENTS.md', ROOT / 'README.md', ROOT / 'README.ru.md', ROOT / '.gitignore', ROOT / '.gitattributes', ROOT / 'package.json']
files += sorted((ROOT / '.github' / 'workflows').glob('*.yml'))
files += sorted((ROOT / 'docs').rglob('*.md'))
files += sorted(p for p in DIST.iterdir() if p.is_file() and (p.suffix in {'.js', '.html', '.css'} or p.name in {'build-info.json', 'project-guide-inventory.json'}))
files += sorted(p for p in (DIST / 'benchmark-snapshots').rglob('*') if p.is_file() and p.suffix in {'.js', '.json'})
files += sorted((ROOT / 'tests').rglob('*.mjs'))
files += sorted(p for p in (ROOT / 'tools').rglob('*') if p.is_file() and p.suffix in {'.py', '.mjs'})
files.sort(key=source_order)
manifest = []
for path in files:
    name = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding='utf-8')
    if name.startswith('dist/'):
        url = './' + path.relative_to(DIST).as_posix()
    else:
        target = OUTPUT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        url = './source-files/' + name
    manifest.append({'name': name, 'url': url, 'lines': len(text.splitlines()), 'bytes': path.stat().st_size,
                     'aliases': [old for old, new in SOURCE_ALIASES.items() if new == name],
                     'purpose': PURPOSES.get(name, 'Неизменяемый снимок расчётной версии для бенчмарка.' if '/benchmark-snapshots/' in name else 'Исходник или проверка браузерного проекта. Старый опыт находится в legacy.html.')})
(DIST / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
with zipfile.ZipFile(DIST / 'Big-Evolution-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, 'Big-Evolution/' + path.relative_to(ROOT).as_posix())
    archive.write(DIST / 'source-manifest.json', 'Big-Evolution/dist/source-manifest.json')
    for path in sorted(OUTPUT.rglob('*')):
        if path.is_file():
            archive.write(path, 'Big-Evolution/' + path.relative_to(ROOT).as_posix())
print(json.dumps({'files': len(files), 'lines': sum(f['lines'] for f in manifest),
                  'brain_lines': sum(f['lines'] for f in manifest if f['name'] in {'dist/cognition.js','dist/brain-controller.js','dist/neural-brain.js','dist/neural-layout.js','dist/set-brain.js','dist/set-brain-layout.js','dist/set-brain-inputs.js'}),
                  'archive_bytes': (DIST / 'Big-Evolution-source.zip').stat().st_size}))
