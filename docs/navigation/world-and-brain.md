# Мир, мозг и исполнение

[Выбор темы](README.md). Открывать нужную карточку; ссылки на историю и планы — по необходимости.

## world-time
**Задача:** подшаг, длительность, начало/продолжение/срыв действия.
**Сейчас:** [temporal-world.js](../../dist/temporal-world.js): `advanceTemporal`, `advanceTemporalBodies`, `prepareTemporalBoundary`, `acceptTemporalChoice`. Длительности/цены решения — [action-timing.js](../../dist/action-timing.js); малый контроллер — [attention-gate.js](../../dist/attention-gate.js).
**Граница:** мир меняет тело/процесс; контроллер выбирает из доступного. Физические срывы предшествуют общему снимку деятельности. При изменении порядка фаз проверить также [параллельное исполнение](#execution) и [наблюдение](#perception).
**Проверка:** [temporal.test.mjs](../../tests/temporal.test.mjs), [activity-perception.test.mjs](../../tests/activity-perception.test.mjs), [parallel-world.test.mjs](../../tests/parallel-world.test.mjs): длительность, одинаковое наблюдение границы, сохранение прогресса/траектории.
**История:** [введение времени 0.32](../updates/v032-action-time.md), [деятельность 0.34](../updates/v034-visible-activities.md).
**Дальше:** непрерывное время/разные тела — [предложения](../future-ideas.md#новые-механики); не добавлены в нынешний процесс.

## birth
**Задача:** доступность родов, зрелость, интервал, потомки, мягкий лимит.
**Сейчас:** `temporalBirthAvailability` и ветвь родов в `complete` — [temporal-world.js](../../dist/temporal-world.js); параметры мира — [reproduction.js](../../dist/reproduction.js), создание ребёнка — `addAgent` в [evolution.js](../../dist/evolution.js).
**Граница:** доступность при старте и завершение процесса различны; смерть родителя отменяет роды. Изменение наследования ведёт в [геном](#genome), цены — в [энергетику](#energy), полей опыта — в [конструктор](experiments-and-statistics.md#design).
**Проверка:** [temporal.test.mjs](../../tests/temporal.test.mjs), [parallel-world.test.mjs](../../tests/parallel-world.test.mjs), [experiment-constructor.test.mjs](../../tests/experiment-constructor.test.mjs), [environment-save.test.mjs](../../tests/environment-save.test.mjs): мягкий лимит, RNG ребёнка, индивидуальные параметры, снимок незавершённых родов.
**История:** [0.32](../updates/v032-action-time.md), [настройки опытов 0.39](../updates/v039-experiment-constructor.md).
**Дальше:** детство/два родителя — [будущие механики](../future-ideas.md#новые-механики); нынешнее размножение не предполагает их.

## energy
**Задача:** нулевая энергия, расход здоровья, усвоение пищи и стоимость действий/мышления.
**Сейчас:** `spendEnergy`/`ENERGY_DEFICIT_FACTOR` — [energy-budget.js](../../dist/energy-budget.js); физиология — `advanceTemporalBodies`/`acceptTemporalChoice` в [temporal-world.js](../../dist/temporal-world.js); `RULES`/`actionEnergyCost`/`validateDigestionTime` — [evolution.js](../../dist/evolution.js). Время усвоения задаётся отдельно для каждого мира опыта.
**Граница:** неоплаченный дефицит снижает здоровье; учёт фактически списанной энергии отдельный. При смертельной оплате решения действие не начинается. Роды имеют отдельный расчёт; не добавлять второй голодный штраф.
**Проверка:** [environment-save.test.mjs](../../tests/environment-save.test.mjs): дефицит/точный ноль/смерть при решении; [temporal.test.mjs](../../tests/temporal.test.mjs): физиология и цены. Ряды нулевой энергии относятся к [статистике](experiments-and-statistics.md#statistics).
**История:** [0.36 — дефицит вместо бесплатных действий](../updates/v036-environment-energy-save.md), [0.46 — время усвоения в опытах](../updates/v046-digestion-experiments.md), [правила](../mechanics-reference.md#энергетика).
**Дальше:** разделение базального/добавочного расхода, износ/восстановление — [предложения физиологии](../future-ideas.md#новые-механики).

## perception
**Задача:** доступные мозгу сведения, видимость деятельности, краткая/долгая память.
**Сейчас:** `sampleCells`/`localTemporalObservation` — [temporal-world.js](../../dist/temporal-world.js); `rebuildActivities`/`sampleActivities` — [activity-perception.js](../../dist/activity-perception.js); `observe`/`memoryBelief` — [cognition.js](../../dist/cognition.js). Входы — [temporal-inputs.js](../../dist/temporal-inputs.js) и [temporal-layout.js](../../dist/temporal-layout.js).
**Граница:** память личная, сведения локальные, наблюдение деятельности фиксируется на границе подшага. Расширение входов затрагивает [схему генома](#genome), Worker-транспорт и [сохранение мира](interface-and-files.md#world-save); память не наследуется.
**Проверка:** [activity-perception.test.mjs](../../tests/activity-perception.test.mjs), [parallel-world.test.mjs](../../tests/parallel-world.test.mjs): исключение себя, локальная ориентация, отсутствие RNG/социальной памяти, те же сведения у владельцев.
**История:** [общий контекст 0.28](../updates/v028-set-context-brain.md), [видимые источники 0.29](../updates/v029-visible-food-sources.md), [деятельность 0.34](../updates/v034-visible-activities.md).
**Дальше:** социальная память/сигналы и нейросетевое извлечение воспоминаний — [список](../future-ideas.md); это новые механизмы, а не описание текущей памяти.

## learning
**Задача:** почему ощущения не дают ожидаемого поведения; награда, выбор и обучение за жизнь.
**Сейчас:** `prepareTemporalDecision`, `accrueTemporalReward`, `commitTemporalBrain` — [temporal-world.js](../../dist/temporal-world.js); текущая ветвь `brain.temporal` — [brain-controller.js](../../dist/brain-controller.js); `learnSetBrain` — [temporal-brain.js](../../dist/temporal-brain.js) через [set-brain-engine.js](../../dist/set-brain-engine.js). Ощущение — `wellbeing` в [cognition.js](../../dist/cognition.js).
**Граница:** отделять наследуемые предпочтения от личных `networkDelta`/ожидающего перехода. Исторический `cognition.learn` не заменяет текущий временной путь. При смерти переход очищается; не добавлять бесполезное обучение мёртвого организма.
**Проверка:** [temporal.test.mjs](../../tests/temporal.test.mjs), [activity-perception.test.mjs](../../tests/activity-perception.test.mjs), [parallel-world.test.mjs](../../tests/parallel-world.test.mjs): обучение новых входов, переключатели, одинаковое личное состояние. Для поведенческого вывода нужен отдельный сопоставимый опыт.
**История:** [временное обучение 0.32](../updates/v032-action-time.md), [исследовательский контракт](../next-feeling-behavior.md).
**Дальше:** причина конкретной популяции с отрицательными чувствительностями не доказана; план диагностики — в том же контракте, инструменты — [опыты](experiments-and-statistics.md#design).

## genome
**Задача:** мутации, чувствительности, размер/архитектура сети, наследование.
**Сейчас:** `TEMPORAL_LAYOUT` — [temporal-layout.js](../../dist/temporal-layout.js); `genomeMetadata`/`mutateGenome`/`validateGenomeFile` — [genome.js](../../dist/genome.js); регуляторы — [mutation-parameters.js](../../dist/mutation-parameters.js). Анализ — [отдельная карточка](interface-and-files.md#genome-analysis).
**Граница:** в коде сохраняются старые схемы. Для текущего генома читать metadata/layout, а не принимать историческую `GENOME_VERSION` за единственную схему. Изменение раскладки затрагивает входы, контроллер, валидаторы, основы опытов и сохранения; личные поправки не наследуются.
**Проверка:** [activity-perception.test.mjs](../../tests/activity-perception.test.mjs), [genome-experiments044.test.mjs](../../tests/genome-experiments044.test.mjs), [environment-save.test.mjs](../../tests/environment-save.test.mjs): именованная схема, подмена только выбранных генов, точное сохранение.
**История:** [наследуемая изменчивость 0.26](../updates/v026-heritable-mutations.md), [схема деятельности 0.34](../updates/v034-visible-activities.md), [основы опытов 0.44](../updates/v044-genome-experiments.md).
**Сейчас, 0.53:** [structural-brain.js](../../dist/structural-brain.js) — геном v14, мутации DAG/план; [brain-cost.js](../../dist/brain-cost.js) — цена выбора/обучения. [Проверки](../../tests/structural-brain053.test.mjs), [протокол и инструкция](../updates/v053-structural-brain.md). Циклы отложены.

## execution
**Задача:** скорость/пауза/темп, число вычислителей, Worker-ошибка или рассогласование.
**Сейчас:** `WorldRuntime.substep` и обработка команд — [world-runtime.js](../../dist/world-runtime.js); [parallel-world.js](../../dist/parallel-world.js)/[world-substeps.js](../../dist/world-substeps.js) исполняют параллельные фазы; [world-client.js](../../dist/world-client.js)/[world-view.js](../../dist/world-view.js) доставляют команды/представление.
**Граница:** координатор владеет миром, вычислители — личными мозгами. Быстрый расчёт и медленный показ имеют разное ожидание ACK. Ошибка пула не должна продвигать неполный мир. Рабочее время, ожидание и отрисовку измерять отдельно.
**Проверка:** [parallel-world.test.mjs](../../tests/parallel-world.test.mjs), [world-worker.test.mjs](../../tests/world-worker.test.mjs), [worker-timing.test.mjs](../../tests/worker-timing.test.mjs): одинаковые RNG/траектории, смена владельцев, остановка и показ.
**История:** [Worker 0.30](../updates/v030-world-worker.md), [параллельный мир 0.33](../updates/v033-parallel-world.md), [живые настройки](../updates/v033-live-controls.md).
**Дальше:** [методика измерений](../performance-plan.md) и [обсуждение карты](../next-performance-map.md); актуальная доля времени участков неизвестна без профиля. WASM и новые кэши не реализованы этим документом.
