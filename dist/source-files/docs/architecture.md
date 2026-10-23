# Навигация по архитектуре

[Темы](navigation/README.md) · [История](archive/context-2026-10-18/architecture.md).

## Исполнение

| Модуль | Владелец/граница |
| --- | --- |
| [evolution.js](../dist/evolution.js) | Мир: клетки, жители, доступность действий, физика, балансы, вызов сценария среды |
| [temporal-world.js](../dist/temporal-world.js) | Подшаг, длительности, завершение/прерывание процессов, физиология |
| [world-runtime.js](../dist/world-runtime.js), [world-worker.js](../dist/world-worker.js) | Единственный координатор мира, очередь команд, темп, пауза, представление и сохранение |
| [parallel-world.js](../dist/parallel-world.js), [world-substeps.js](../dist/world-substeps.js) | Постоянные владельцы личных мозгов; общие границы подшага, синхронизация, смена пула |
| [world-view.js](../dist/world-view.js), [world-client.js](../dist/world-client.js) | Проекция UI и доставка команд/ACK; UI не владеет физикой |

Быстрый расчёт не ждёт отрисовки. Только медленная видимая карта подтверждает каждый кадр подшага. Скрытие/другие разделы снимают это ожидание; явная пауза действует на границе вычисления. Испытания отдельно приостанавливают основной мир.

## Мозг и сведения

| Модуль | Ответственность |
| --- | --- |
| [temporal-layout.js](../dist/temporal-layout.js), [temporal-inputs.js](../dist/temporal-inputs.js) | Именованная схема текущих генов/входов, сведения о текущем процессе |
| [temporal-brain.js](../dist/temporal-brain.js), [brain-controller.js](../dist/brain-controller.js) | Оценки, выбор, временное обучение; наследуемый малый контроллер пересмотра |
| [cognition.js](../dist/cognition.js), [navigation.js](../dist/navigation.js) | Личная память, ощущения и локальные координаты; скрытые клетки не обновляются |
| [activity-perception.js](../dist/activity-perception.js) | Снимок видимой деятельности на границе подшага, без социальной памяти |
| [genome.js](../dist/genome.js), [mutation-parameters.js](../dist/mutation-parameters.js) | Наследование/мутация; приобретённые знания не переносятся |
| [action-timing.js](../dist/action-timing.js), [energy-budget.js](../dist/energy-budget.js) | Длительности/цены и общая оплата дефицита здоровьем |

## Пищевая среда

| Модуль | Ответственность |
| --- | --- |
| [food-settings.js](../dist/food-settings.js), [food-islands.js](../dist/food-islands.js), [food-layout.js](../dist/food-layout.js) | Начальные группы, ёмкости и расписание |
| [world-edit.js](../dist/world-edit.js) | Проверенный план ручного вмешательства, применяется без сброса мира |
| [environment-settings.js](../dist/environment-settings.js) | Одна схема целей/границ и постоянных правил автоматики |
| [environment-plan.js](../dist/environment-plan.js) | Черновик редкого события и проверка выработки до применения |
| [food-island-evolution.js](../dist/food-island-evolution.js) | Целый перенос, компактный рост/обрезка, коррекция числа источников |
| [automatic-environment.js](../dist/automatic-environment.js) | Календарь/RNG сценария, атомарное применение и журнал; не читает мозги |

## Интерфейс

| Модуль | Ответственность |
| --- | --- |
| [evolution-app.js](../dist/evolution-app.js), [index.html](../dist/index.html), [layout.css](../dist/layout.css) | Управление, карта и связка существующих элементов; игровая механика остаётся в модели |
| [ui-text.js](../dist/ui-text.js), [help.js](../dist/help.js) | Общие тексты/подсказки; числа по возможности из кода, справка без автопаузы |
| [sidebar.js](../dist/sidebar.js), [screen-tabs.js](../dist/screen-tabs.js), [lab-tabs.js](../dist/lab-tabs.js) | Навигация без пересоздания мира/полей |
| [history-ui.js](../dist/history-ui.js), [history-drawers.js](../dist/history-drawers.js) | Статистика, диапазоны/линии и панели; вычисления сводок в [life-cohorts.js](../dist/life-cohorts.js) |
| [environment-ui.js](../dist/environment-ui.js), [food-controls.js](../dist/food-controls.js) | Черновик целевых настроек отдельно от фактических условий |

## Данные и анализ

[world-save.js](../dist/world-save.js) валидирует сохранения; [state-codec.js](../dist/state-codec.js) сохраняет типы/ссылки. Runtime синхронизирует владельцев; ошибка загрузки не заменяет мир. [life-history.js](../dist/life-history.js), [heritable-statistics.js](../dist/heritable-statistics.js), [food-production-history.js](../dist/food-production-history.js) владеют отчётами. [genome-analysis.js](../dist/genome-analysis.js) и [tools/analyze-genomes.mjs](../tools/analyze-genomes.mjs) — разбор геномов без симуляции.

[population-statistics.js](../dist/population-statistics.js): N(t). [statistical-series.js](../dist/statistical-series.js): выборки; [statistics-client.js](../dist/statistics-client.js): кэш/отмена Worker. [statistics-worker.js](../dist/statistics-worker.js)/[statistics-estimates.js](../dist/statistics-estimates.js): оценки/ДИ без RNG мира. [history-estimates-ui.js](../dist/history-estimates-ui.js): сводки; [json-export.js](../dist/json-export.js): порционный JSON.

[experiment-archive.js](../dist/experiment-archive.js): .beexp. [Каталог](navigation/experiments-and-statistics.md#statistics): определения → группы/Worker; без копий историй.

Пара: [pair-statistics.js](../dist/pair-statistics.js) — общий оценщик; [pair-series.js](../dist/pair-series.js) — корзины; [pair-statistics-client.js](../dist/pair-statistics-client.js) — Worker/отмена; [pair-comparison-ui.js](../dist/pair-comparison-ui.js) — таблица/общая A/B; [history-differences-ui.js](../dist/history-differences-ui.js) — режимы карточек. [Протокол](updates/v043-difference-charts.md).

## Конструктор опытов

[experiment-fields.js](../dist/experiment-fields.js) — поля; [experiment-design-ui.js](../dist/experiment-design-ui.js) — редактор/дерево; [experiment-genomes.js](../dist/experiment-genomes.js) — проверка наборов файлов; [founder-senses.js](../dist/founder-senses.js) — гены основателей. [experiment-plan.js](../dist/experiment-plan.js) — сочетания. [experiment-series.js](../dist/experiment-series.js) — очередь/повторы; [experiment-execution.js](../dist/experiment-execution.js) — владельцы. [experiment-ui.js](../dist/experiment-ui.js) — управление, [experiment-runs-ui.js](../dist/experiment-runs-ui.js) — DOM, [experiment-store.js](../dist/experiment-store.js) — сохранение. [experiment-statistics.js](../dist/experiment-statistics.js) — проекции; [weighted-statistics.js](../dist/weighted-statistics.js) — веса; [comparison-charts.js](../dist/comparison-charts.js) — графики.

## Проверки и релиз

[verify-local.py](../tools/verify-local.py) запускает выбранные короткие группы; [verification.md](verification.md) хранит методику/ссылки на результаты. Текущие версии расчёта — [benchmark-versions.js](../dist/benchmark-versions.js), нагрузки — [benchmark-fixtures.js](../dist/benchmark-fixtures.js). Замораживание — [freeze-benchmark.py](../tools/freeze-benchmark.py), производные исходники/ZIP — [export-source.py](../tools/export-source.py), упаковка GitHub — [package-github.py](../tools/package-github.py).
