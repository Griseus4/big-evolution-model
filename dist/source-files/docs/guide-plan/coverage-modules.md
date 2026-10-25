# P00: Рабочие модули и разметка

[Индекс и правила чтения](coverage.md).

Общие поля всех строк: **статус — не проверено**; новая содержательная сверка — отсутствует. SHA-256 ниже фиксирует исходный файл (первые 12 знаков), а не качество описания. Ответственность и статьи — маршрут проверки, не заключение о полноте. Строки без sources в реестре требуют сначала установить рабочую точку вызова; служебные файлы — назначение и потребителей.

| Источник | Следующие этапы / ответственность по карточке | Статья-вход | Основание маршрута / символы | SHA-256 |
| --- | --- | --- | --- | --- |
| [dist/action-catalog.js](../../dist/action-catalog.js) | P08: оценка, выбор и пересмотр действия | brain, actions | предварительно по семейству; подтвердить владельца | `2da88983f5fb` |
| [dist/action-timing.js](../../dist/action-timing.js) | P01: путь порции до энергии; P10: вычисления и энергетическая цена мозга | actions, numbers, time | карточка этапа; реестр sources/checks | `070a8d31a2c3` |
| [dist/activity-perception.js](../../dist/activity-perception.js) | P04: наблюдения и доступные сведения | geography, memory | карточка этапа | `545586dbcb2c` |
| [dist/analysis-builder-chart.js](../../dist/analysis-builder-chart.js) | P22: шаблоны, формулы и локальные настройки графика | research | предварительно по семейству; подтвердить владельца | `740cf0312e37` |
| [dist/analysis-builder-core.js](../../dist/analysis-builder-core.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `abe71b4e12af` |
| [dist/analysis-builder-ui.js](../../dist/analysis-builder-ui.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `be182d794566` |
| [dist/analysis-builder-worker.js](../../dist/analysis-builder-worker.js) | P22: шаблоны, формулы и локальные настройки графика | research | предварительно по семейству; подтвердить владельца | `f009bf831970` |
| [dist/analysis-expression.js](../../dist/analysis-expression.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `ca872352aafe` |
| [dist/analysis-projection.js](../../dist/analysis-projection.js) | P22: шаблоны, формулы и локальные настройки графика; P23: сохранения, архивы и загрузка частями | research | карточка этапа | `3665a7f1c480` |
| [dist/app-version.js](../../dist/app-version.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `8444d9d2e1fe` |
| [dist/app.js](../../dist/app.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | карточка этапа | `7791fe2f4c70` |
| [dist/attention-gate.js](../../dist/attention-gate.js) | P08: оценка, выбор и пересмотр действия | actions | карточка этапа; реестр sources/checks: attentionRequest, rememberAttention | `e166897d259c` |
| [dist/automatic-environment.js](../../dist/automatic-environment.js) | P03: автоматическое изменение среды | environment | карточка этапа; реестр sources/checks: advanceEnvironment, configureEnvironment | `552ed7d75018` |
| [dist/benchmark-checks.js](../../dist/benchmark-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `df64a95d6984` |
| [dist/benchmark-comparison-runner.js](../../dist/benchmark-comparison-runner.js) | P21: группы и сравнение выбранной пары | research | предварительно по семейству; подтвердить владельца | `02ef2b701f12` |
| [dist/benchmark-configurations.js](../../dist/benchmark-configurations.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `89005b266876` |
| [dist/benchmark-fixtures.js](../../dist/benchmark-fixtures.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `97ac12adcc75` |
| [dist/benchmark-report.js](../../dist/benchmark-report.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `5c7050bcdbc7` |
| [dist/benchmark-runner.js](../../dist/benchmark-runner.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `fad2346d1cf6` |
| [dist/benchmark-snapshot-runtime.js](../../dist/benchmark-snapshot-runtime.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `29b9fb0a7c78` |
| [dist/benchmark-state.js](../../dist/benchmark-state.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `ca94a2fe5098` |
| [dist/benchmark-ui.js](../../dist/benchmark-ui.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `a6146a0c180a` |
| [dist/benchmark-version-checks.js](../../dist/benchmark-version-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `451fc08ffdb1` |
| [dist/benchmark-versions.js](../../dist/benchmark-versions.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `6b53026956b2` |
| [dist/benchmark-worker.js](../../dist/benchmark-worker.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `ba54932a16b0` |
| [dist/brain-controller.js](../../dist/brain-controller.js) | P08: оценка, выбор и пересмотр действия; P09: личное обучение | intro | карточка этапа; реестр sources/checks: controllerFeeling | `65b39a954027` |
| [dist/brain-cost.js](../../dist/brain-cost.js) | P10: вычисления и энергетическая цена мозга | brain, energy | карточка этапа; реестр sources/checks: decisionCharge, learningCharge | `b1bf52678fcd` |
| [dist/brain-diagram-help.js](../../dist/brain-diagram-help.js) | P07: устройство мозга и числовые входы; P14: чтение генома и схемы жителя | brain | карточка этапа | `83caf65bfc7d` |
| [dist/brain-diagram-ui.js](../../dist/brain-diagram-ui.js) | P14: чтение генома и схемы жителя | brain, genome | карточка этапа | `661b252c4e35` |
| [dist/brain-diagram-viewport.js](../../dist/brain-diagram-viewport.js) | P14: чтение генома и схемы жителя | brain, genome | карточка этапа | `bfc200cdf219` |
| [dist/brain-initialization-ui.js](../../dist/brain-initialization-ui.js) | P13: начальная структура и структурная эволюция | genome | карточка этапа | `a8039991ba2f` |
| [dist/brain-initialization.js](../../dist/brain-initialization.js) | P12: геном, числовые мутации и основатели; P13: начальная структура и структурная эволюция | genome | карточка этапа | `622327f5a8e2` |
| [dist/brain-input-scales.js](../../dist/brain-input-scales.js) | P06: ощущения и знаки предпочтений; P07: устройство мозга и числовые входы; P09: личное обучение | numbers | карточка этапа; реестр sources/checks | `91c3e63097c6` |
| [dist/brain-parameters.js](../../dist/brain-parameters.js) | P05: память мест и её изменение; P06: ощущения и знаки предпочтений; P09: личное обучение; P12: геном, числовые мутации и основатели | memory | карточка этапа | `518bb75a5ff0` |
| [dist/brain-structure-rules.js](../../dist/brain-structure-rules.js) | P13: начальная структура и структурная эволюция | numbers | карточка этапа; реестр sources/checks | `9c78dbec0c0a` |
| [dist/browser-checks.js](../../dist/browser-checks.js) | P25: измерения и проверки механизмов | checks | карточка этапа; реестр sources/checks | `a05a9297a441` |
| [dist/catalogue-expression-client.js](../../dist/catalogue-expression-client.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `448632d5bcdc` |
| [dist/chart-catalogue-ui.js](../../dist/chart-catalogue-ui.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `06003aa80c38` |
| [dist/chart-catalogue.js](../../dist/chart-catalogue.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `1e7fbe4ca4a9` |
| [dist/chart-context.js](../../dist/chart-context.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `1902633cfaa2` |
| [dist/chart-local-renderer.js](../../dist/chart-local-renderer.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `a1bed8dd3d90` |
| [dist/chart-pins-ui.js](../../dist/chart-pins-ui.js) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `2084d4735f87` |
| [dist/chart-update-state.js](../../dist/chart-update-state.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `3ecbadffe821` |
| [dist/cognition-owner.js](../../dist/cognition-owner.js) | P24: исполнители и границы состояния | world | карточка этапа | `247d23eefe68` |
| [dist/cognition-packet.js](../../dist/cognition-packet.js) | P24: исполнители и границы состояния | world | карточка этапа | `94e84361e793` |
| [dist/cognition-rules.js](../../dist/cognition-rules.js) | P05: память мест и её изменение | numbers | карточка этапа; реестр sources/checks | `d4c328c3512c` |
| [dist/cognition-summary.js](../../dist/cognition-summary.js) | P05: память мест и её изменение; P14: чтение генома и схемы жителя | memory | карточка этапа | `7cb2418f84bf` |
| [dist/cognition-worker.js](../../dist/cognition-worker.js) | P24: исполнители и границы состояния | world | карточка этапа | `e25f0dd79dcb` |
| [dist/cognition.js](../../dist/cognition.js) | P05: память мест и её изменение; P06: ощущения и знаки предпочтений | intro, memory | карточка этапа; реестр sources/checks: createBrain, observe | `cc74b0e679e3` |
| [dist/comparison-charts.js](../../dist/comparison-charts.js) | P21: группы и сравнение выбранной пары | research | предварительно по семейству; подтвердить владельца | `17d141a88b7c` |
| [dist/computation-settings.js](../../dist/computation-settings.js) | P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `a48f7216cdb9` |
| [dist/configuration-benchmark-report.js](../../dist/configuration-benchmark-report.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `caafb7804b18` |
| [dist/configuration-benchmark-runner.js](../../dist/configuration-benchmark-runner.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `da6abbcb3028` |
| [dist/configuration-benchmark-ui.js](../../dist/configuration-benchmark-ui.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `117e2d1ef640` |
| [dist/continuation-checks.js](../../dist/continuation-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `e41f31d34047` |
| [dist/controls.css](../../dist/controls.css) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `e54d09190214` |
| [dist/deferred-control.js](../../dist/deferred-control.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `f9e206560547` |
| [dist/energy-budget.js](../../dist/energy-budget.js) | P10: вычисления и энергетическая цена мозга | energy | карточка этапа; реестр sources/checks: spendEnergy | `989895d71140` |
| [dist/environment-checks.js](../../dist/environment-checks.js) | P03: автоматическое изменение среды | environment | карточка этапа | `46662562ea61` |
| [dist/environment-plan.js](../../dist/environment-plan.js) | P03: автоматическое изменение среды | environment | карточка этапа | `85785d2241a4` |
| [dist/environment-settings.js](../../dist/environment-settings.js) | P03: автоматическое изменение среды | environment | карточка этапа | `99f63f4df320` |
| [dist/environment-ui.js](../../dist/environment-ui.js) | P03: автоматическое изменение среды | environment | карточка этапа | `20f146fb9824` |
| [dist/evolution-app.js](../../dist/evolution-app.js) | P06: ощущения и знаки предпочтений; P26: интерфейс и обновление статистики; P27: архитектура, локальная работа и поддержка справочника | world | карточка этапа; реестр sources/checks: singleStep, toggle | `b837cedfbd4e` |
| [dist/evolution.css](../../dist/evolution.css) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `d4710252e19f` |
| [dist/evolution.js](../../dist/evolution.js) | P01: путь порции до энергии; P02: источники и начальная раскладка; P11: размножение и жизненная линия; P16: случайность, повторы, попытки и вымирания | actions, deposits, energy, food, intro, limits | карточка этапа; реестр sources/checks: addAgent, canDeposit, depositFood, die, feeling, validateDigestionTime | `0caeb8c67d97` |
| [dist/experiment-archive.js](../../dist/experiment-archive.js) | P23: сохранения, архивы и загрузка частями | saves | карточка этапа | `57e0c817d0f5` |
| [dist/experiment-design-ui.js](../../dist/experiment-design-ui.js) | P15: план и сочетания параметров | research | карточка этапа | `9d4f801805b8` |
| [dist/experiment-execution.js](../../dist/experiment-execution.js) | P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `d5cb476ad0db` |
| [dist/experiment-fields.js](../../dist/experiment-fields.js) | P15: план и сочетания параметров | research | карточка этапа | `341c6b087fa0` |
| [dist/experiment-genomes.js](../../dist/experiment-genomes.js) | P12: геном, числовые мутации и основатели; P15: план и сочетания параметров | genome | карточка этапа | `e651c533c69c` |
| [dist/experiment-grouping.js](../../dist/experiment-grouping.js) | P21: группы и сравнение выбранной пары | research | карточка этапа | `4527230ee289` |
| [dist/experiment-outcomes.js](../../dist/experiment-outcomes.js) | P16: случайность, повторы, попытки и вымирания | research | карточка этапа | `657929452bab` |
| [dist/experiment-plan.js](../../dist/experiment-plan.js) | P15: план и сочетания параметров; P16: случайность, повторы, попытки и вымирания; P17: запуск, остановка и распределение вычислителей; P23: сохранения, архивы и загрузка частями | research | карточка этапа | `36873a25ad39` |
| [dist/experiment-preferences.js](../../dist/experiment-preferences.js) | P15: план и сочетания параметров | research | карточка этапа | `577f96b8271c` |
| [dist/experiment-runner.js](../../dist/experiment-runner.js) | P16: случайность, повторы, попытки и вымирания; P17: запуск, остановка и распределение вычислителей | research | карточка этапа; реестр sources/checks: validateExperimentConfig | `0ca5d2708a48` |
| [dist/experiment-runs-ui.js](../../dist/experiment-runs-ui.js) | P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `5bd4a7f9ab6a` |
| [dist/experiment-series.js](../../dist/experiment-series.js) | P16: случайность, повторы, попытки и вымирания; P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `6c2964518edc` |
| [dist/experiment-statistics.js](../../dist/experiment-statistics.js) | P21: группы и сравнение выбранной пары | research | карточка этапа | `4963224c6b05` |
| [dist/experiment-store.js](../../dist/experiment-store.js) | P23: сохранения, архивы и загрузка частями | saves | карточка этапа | `3b555df425b9` |
| [dist/experiment-ui.js](../../dist/experiment-ui.js) | P17: запуск, остановка и распределение вычислителей; P23: сохранения, архивы и загрузка частями | research | карточка этапа | `d827016c819a` |
| [dist/experiment-worker.js](../../dist/experiment-worker.js) | P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `fa10f1a05bc8` |
| [dist/food-controls.js](../../dist/food-controls.js) | P02: источники и начальная раскладка | food | карточка этапа | `7e7f064e1a72` |
| [dist/food-distribution.js](../../dist/food-distribution.js) | P02: источники и начальная раскладка | food | карточка этапа | `5ebc308e3eb5` |
| [dist/food-exposure.js](../../dist/food-exposure.js) | P18: история жизни, поля и происхождение показателей | research | карточка этапа | `e946d0a814c4` |
| [dist/food-island-checks.js](../../dist/food-island-checks.js) | P03: автоматическое изменение среды | environment | карточка этапа | `23486e5417f4` |
| [dist/food-island-evolution.js](../../dist/food-island-evolution.js) | P03: автоматическое изменение среды | environment | карточка этапа; реестр sources/checks: evolveFoodGroups | `71a9430a5e98` |
| [dist/food-islands.js](../../dist/food-islands.js) | P02: источники и начальная раскладка | food | карточка этапа | `18240687b4fd` |
| [dist/food-layout.js](../../dist/food-layout.js) | P02: источники и начальная раскладка | food | карточка этапа | `a63c18a164a3` |
| [dist/food-production-history.js](../../dist/food-production-history.js) | P03: автоматическое изменение среды; P18: история жизни, поля и происхождение показателей | environment | карточка этапа | `d7350f5c8950` |
| [dist/food-settings.js](../../dist/food-settings.js) | P02: источники и начальная раскладка | food | карточка этапа; реестр sources/checks | `9af0290719a2` |
| [dist/founder-senses.js](../../dist/founder-senses.js) | P06: ощущения и знаки предпочтений; P12: геном, числовые мутации и основатели; P15: план и сочетания параметров | brain | карточка этапа | `9857a588c9b3` |
| [dist/genome-analysis-ui.js](../../dist/genome-analysis-ui.js) | P14: чтение генома и схемы жителя | brain, genome | карточка этапа | `0557330fb06e` |
| [dist/genome-analysis.js](../../dist/genome-analysis.js) | P06: ощущения и знаки предпочтений; P14: чтение генома и схемы жителя | brain | карточка этапа | `73011e383fd1` |
| [dist/genome.js](../../dist/genome.js) | P12: геном, числовые мутации и основатели; P13: начальная структура и структурная эволюция; P23: сохранения, архивы и загрузка частями | genome | карточка этапа; реестр sources/checks: genomeMetadata, mutateGenome | `dd520dcf4fed` |
| [dist/geography.js](../../dist/geography.js) | P02: источники и начальная раскладка | geography | карточка этапа; реестр sources/checks: balancedFounderPositions, classifyLandRegions, createLakesAndRivers, geographicNeighbours | `4ee90b89bb05` |
| [dist/guide-actions-text.js](../../dist/guide-actions-text.js) | P27: архитектура, локальная работа и поддержка справочника | actions | предварительно по семейству; подтвердить владельца; реестр sources/checks | `d4c330751ea5` |
| [dist/guide-energy-text.js](../../dist/guide-energy-text.js) | P27: архитектура, локальная работа и поддержка справочника | energy | предварительно по семейству; подтвердить владельца; реестр sources/checks: guideDeficitExample | `5ddd7acf8453` |
| [dist/guide-geography-text.js](../../dist/guide-geography-text.js) | P27: архитектура, локальная работа и поддержка справочника | geography | предварительно по семейству; подтвердить владельца; реестр sources/checks: guideNavigationExample | `a767a6b9fa43` |
| [dist/guide-markup.js](../../dist/guide-markup.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `313ab358647d` |
| [dist/guide-numbers-text.js](../../dist/guide-numbers-text.js) | P27: архитектура, локальная работа и поддержка справочника | numbers | предварительно по семейству; подтвердить владельца; реестр sources/checks | `f451d4673aed` |
| [dist/guide-parameters.js](../../dist/guide-parameters.js) | P01: путь порции до энергии; P11: размножение и жизненная линия; P27: архитектура, локальная работа и поддержка справочника | food, deposits | карточка этапа | `014f0369a777` |
| [dist/guide-reference-text.js](../../dist/guide-reference-text.js) | P27: архитектура, локальная работа и поддержка справочника | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks | `19abf982dc0b` |
| [dist/guide-time-text.js](../../dist/guide-time-text.js) | P27: архитектура, локальная работа и поддержка справочника | time | предварительно по семейству; подтвердить владельца; реестр sources/checks | `c89801a23db0` |
| [dist/help.js](../../dist/help.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `0e1016b6bbb2` |
| [dist/heritable-statistics.js](../../dist/heritable-statistics.js) | P18: история жизни, поля и происхождение показателей | research | карточка этапа | `1e814c68ee87` |
| [dist/history-charts.js](../../dist/history-charts.js) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `2a178d2735e4` |
| [dist/history-differences-ui.js](../../dist/history-differences-ui.js) | P21: группы и сравнение выбранной пары | research | карточка этапа | `fd94dd7fb58d` |
| [dist/history-drawers.js](../../dist/history-drawers.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `704b3d7caf5d` |
| [dist/history-estimates-ui.js](../../dist/history-estimates-ui.js) | P20: средние, медианы, веса и интервалы | research | предварительно по семейству; подтвердить владельца | `ba4f8838a97a` |
| [dist/history-ui.js](../../dist/history-ui.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `1fd86bb220de` |
| [dist/history-window.js](../../dist/history-window.js) | P19: периоды, когорты и дожитие | research | карточка этапа | `697c8cc1550a` |
| [dist/index.html](../../dist/index.html) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `a9971f1a7b1e` |
| [dist/json-export.js](../../dist/json-export.js) | P23: сохранения, архивы и загрузка частями | saves | карточка этапа | `1fb1dda70ef7` |
| [dist/lab-report-checks.js](../../dist/lab-report-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `2b2d6a5e3d3d` |
| [dist/lab-reports.js](../../dist/lab-reports.js) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `799bb0fe66be` |
| [dist/lab-tabs.js](../../dist/lab-tabs.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `9f98f39e0c69` |
| [dist/layout.css](../../dist/layout.css) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `9682e78ee2d7` |
| [dist/legacy-browser-checks.js](../../dist/legacy-browser-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `793855bc1f41` |
| [dist/legacy.html](../../dist/legacy.html) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `485edbf3f2a4` |
| [dist/life-cohorts.js](../../dist/life-cohorts.js) | P19: периоды, когорты и дожитие | research | карточка этапа; реестр sources/checks: aggregateLifeCohorts | `5652877db17b` |
| [dist/life-history.js](../../dist/life-history.js) | P10: вычисления и энергетическая цена мозга; P11: размножение и жизненная линия; P18: история жизни, поля и происхождение показателей | brain, energy | карточка этапа | `531afd004853` |
| [dist/life-observations.js](../../dist/life-observations.js) | P10: вычисления и энергетическая цена мозга; P18: история жизни, поля и происхождение показателей | brain, energy | карточка этапа | `0fbeb41a4f41` |
| [dist/metric-options.js](../../dist/metric-options.js) | P19: периоды, когорты и дожитие; P26: интерфейс и обновление статистики | research | карточка этапа | `b7267fd22208` |
| [dist/model-rules.js](../../dist/model-rules.js) | P01: путь порции до энергии | energy, numbers | карточка этапа; реестр sources/checks: actionEnergyCost, validateDigestionTime | `978b232830e3` |
| [dist/mutation-checks.js](../../dist/mutation-checks.js) | P13: начальная структура и структурная эволюция | genome | предварительно по семейству; подтвердить владельца | `8d293e42add8` |
| [dist/mutation-parameters.js](../../dist/mutation-parameters.js) | P12: геном, числовые мутации и основатели | genome | карточка этапа | `a5ebb37ad5fc` |
| [dist/navigation.js](../../dist/navigation.js) | P05: память мест и её изменение | geography | карточка этапа; реестр sources/checks: localNeighbours, memoryWorldPosition, moveLocally, rotate, worldAxial, worldOffset | `15696fdeba44` |
| [dist/neighbour-checks.js](../../dist/neighbour-checks.js) | P04: наблюдения и доступные сведения | geography, memory | предварительно по семейству; подтвердить владельца | `10c201c6589a` |
| [dist/neighbour-perception.js](../../dist/neighbour-perception.js) | P04: наблюдения и доступные сведения | geography, memory | карточка этапа | `c0d9fb80d4c8` |
| [dist/neural-brain.js](../../dist/neural-brain.js) | P07: устройство мозга и числовые входы | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks: createNeuralBrain | `69c6a3f9dece` |
| [dist/neural-checks.js](../../dist/neural-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `a94cdf4958ce` |
| [dist/neural-layout.js](../../dist/neural-layout.js) | P07: устройство мозга и числовые входы | brain | предварительно по семейству; подтвердить владельца | `cb5aa3052173` |
| [dist/neural-optimization-checks.js](../../dist/neural-optimization-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `7d5f0c5788fe` |
| [dist/neural-v018-reference.js](../../dist/neural-v018-reference.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `9ef13cd2993a` |
| [dist/numeric-rules.js](../../dist/numeric-rules.js) | P27: архитектура, локальная работа и поддержка справочника | numbers | предварительно по семейству; подтвердить владельца; реестр sources/checks: numericRuleRows | `6e207be04000` |
| [dist/pair-comparison-ui.js](../../dist/pair-comparison-ui.js) | P21: группы и сравнение выбранной пары | research | карточка этапа | `cb4cc5fe3523` |
| [dist/pair-series.js](../../dist/pair-series.js) | P21: группы и сравнение выбранной пары | research | карточка этапа | `f86b4d17d691` |
| [dist/pair-statistics-client.js](../../dist/pair-statistics-client.js) | P21: группы и сравнение выбранной пары | research | предварительно по семейству; подтвердить владельца | `ad838b8a8d2d` |
| [dist/pair-statistics-worker.js](../../dist/pair-statistics-worker.js) | P21: группы и сравнение выбранной пары | research | предварительно по семейству; подтвердить владельца | `d8daa13ce38f` |
| [dist/pair-statistics.js](../../dist/pair-statistics.js) | P21: группы и сравнение выбранной пары | research | карточка этапа | `678c832b1ccd` |
| [dist/parallel-world.js](../../dist/parallel-world.js) | P24: исполнители и границы состояния | world | карточка этапа | `7d0bfc7ff3d7` |
| [dist/performance-checks.js](../../dist/performance-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `2d9826b22375` |
| [dist/performance-probe.js](../../dist/performance-probe.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `73cd1e0c68e0` |
| [dist/performance-profiler.js](../../dist/performance-profiler.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `b73123c5b54a` |
| [dist/performance-tabs.js](../../dist/performance-tabs.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `762fc7144574` |
| [dist/performance-ui.js](../../dist/performance-ui.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `7477432eedf3` |
| [dist/policy-layout.js](../../dist/policy-layout.js) | P07: устройство мозга и числовые входы | brain | предварительно по семейству; подтвердить владельца | `cd5dabfd1e89` |
| [dist/population-statistics.js](../../dist/population-statistics.js) | P18: история жизни, поля и происхождение показателей; P19: периоды, когорты и дожитие | research | карточка этапа | `6c85ae05f819` |
| [dist/project-guide-search.js](../../dist/project-guide-search.js) | P27: архитектура, локальная работа и поддержка справочника | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks: guideCoverage, searchGuideArticles | `dee1e6b5151a` |
| [dist/project-guide-sources-ui.js](../../dist/project-guide-sources-ui.js) | P27: архитектура, локальная работа и поддержка справочника | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks: createGuideSources, installGuideCoverage | `1e6c6a48b5c3` |
| [dist/project-guide-topics.js](../../dist/project-guide-topics.js) | P00: инвентаризация и фиксация границ | intro | карточка этапа; реестр sources/checks | `ac663d2e2ac4` |
| [dist/project-guide-ui.js](../../dist/project-guide-ui.js) | P27: архитектура, локальная работа и поддержка справочника | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks: installProjectGuide | `bfa400d83ecc` |
| [dist/project-guide.js](../../dist/project-guide.js) | P00: инвентаризация и фиксация границ | нужно определить | карточка этапа | `1a7c7a9c55d0` |
| [dist/random-seed.js](../../dist/random-seed.js) | P02: источники и начальная раскладка; P16: случайность, повторы, попытки и вымирания | food | карточка этапа | `f2a04ef8c5c0` |
| [dist/reproduction.js](../../dist/reproduction.js) | P11: размножение и жизненная линия | selection | карточка этапа; реестр sources/checks: reproductionProfile | `f31e9591824b` |
| [dist/resident-trail-checks.js](../../dist/resident-trail-checks.js) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `9bb40c40edb0` |
| [dist/resident-trail.js](../../dist/resident-trail.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `512ef4148e09` |
| [dist/retained-results.js](../../dist/retained-results.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `f50f4b974309` |
| [dist/screen-tabs.js](../../dist/screen-tabs.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `285682a7f78c` |
| [dist/set-brain-checks.js](../../dist/set-brain-checks.js) | P08: оценка, выбор и пересмотр действия | brain, actions | предварительно по семейству; подтвердить владельца | `d029bae0ce4c` |
| [dist/set-brain-engine.js](../../dist/set-brain-engine.js) | P07: устройство мозга и числовые входы; P08: оценка, выбор и пересмотр действия; P09: личное обучение; P10: вычисления и энергетическая цена мозга | brain, intro | карточка этапа; реестр sources/checks: learnSetBrain | `344bbea6ff3a` |
| [dist/set-brain-inputs.js](../../dist/set-brain-inputs.js) | P07: устройство мозга и числовые входы | brain | предварительно по семейству; подтвердить владельца | `accd2aedc8bb` |
| [dist/set-brain-layout.js](../../dist/set-brain-layout.js) | P07: устройство мозга и числовые входы | brain | карточка этапа | `27ddbaae27ce` |
| [dist/set-brain.js](../../dist/set-brain.js) | P08: оценка, выбор и пересмотр действия | brain, actions | предварительно по семейству; подтвердить владельца | `f0b458bd2795` |
| [dist/sidebar.js](../../dist/sidebar.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `f2ba9c09aef6` |
| [dist/simulation.js](../../dist/simulation.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | карточка этапа | `64e1110bac67` |
| [dist/source-viewer.js](../../dist/source-viewer.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | карточка этапа | `83a6dbe92a15` |
| [dist/source.html](../../dist/source.html) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | карточка этапа | `ad9a70106b7a` |
| [dist/stable-text-list.js](../../dist/stable-text-list.js) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `c5cca827546e` |
| [dist/state-codec.js](../../dist/state-codec.js) | P23: сохранения, архивы и загрузка частями | saves | карточка этапа | `a4dd1aac6da8` |
| [dist/statistical-blocks.js](../../dist/statistical-blocks.js) | P20: средние, медианы, веса и интервалы; P21: группы и сравнение выбранной пары | research | карточка этапа | `f78650771a43` |
| [dist/statistical-series.js](../../dist/statistical-series.js) | P19: периоды, когорты и дожитие; P20: средние, медианы, веса и интервалы | research | карточка этапа | `536307549038` |
| [dist/statistics-client.js](../../dist/statistics-client.js) | P20: средние, медианы, веса и интервалы | research | предварительно по семейству; подтвердить владельца | `99ea5396d4ee` |
| [dist/statistics-estimates.js](../../dist/statistics-estimates.js) | P20: средние, медианы, веса и интервалы | research | карточка этапа; реестр sources/checks: estimateWorlds | `179d494c1cbd` |
| [dist/statistics-format.js](../../dist/statistics-format.js) | P20: средние, медианы, веса и интервалы | research | карточка этапа | `5cef05ecdfad` |
| [dist/statistics-preparation.js](../../dist/statistics-preparation.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `070755d71a5a` |
| [dist/statistics-worker.js](../../dist/statistics-worker.js) | P20: средние, медианы, веса и интервалы | research | предварительно по семейству; подтвердить владельца | `f6c2fbed1f57` |
| [dist/structural-brain.js](../../dist/structural-brain.js) | P07: устройство мозга и числовые входы; P10: вычисления и энергетическая цена мозга; P13: начальная структура и структурная эволюция | genome | карточка этапа; реестр sources/checks: mutateStructure | `42254b350050` |
| [dist/structural-checks.js](../../dist/structural-checks.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `a8e2373a228f` |
| [dist/style.css](../../dist/style.css) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `1f0d7a64706a` |
| [dist/survival-curve.js](../../dist/survival-curve.js) | P19: периоды, когорты и дожитие | research | карточка этапа | `eebc196108a3` |
| [dist/temporal-brain.js](../../dist/temporal-brain.js) | P08: оценка, выбор и пересмотр действия; P09: личное обучение | brain, actions | карточка этапа | `b7a906fd711b` |
| [dist/temporal-checks.js](../../dist/temporal-checks.js) | P25: измерения и проверки механизмов | checks | карточка этапа; реестр sources/checks | `04e15732b094` |
| [dist/temporal-inputs.js](../../dist/temporal-inputs.js) | P04: наблюдения и доступные сведения; P07: устройство мозга и числовые входы | brain, geography, intro | карточка этапа; реестр sources/checks: prepareSetInput | `d90e0a956524` |
| [dist/temporal-layout.js](../../dist/temporal-layout.js) | P07: устройство мозга и числовые входы | brain | карточка этапа | `cefd06a1b5b9` |
| [dist/temporal-world.js](../../dist/temporal-world.js) | P01: путь порции до энергии; P04: наблюдения и доступные сведения; P06: ощущения и знаки предпочтений; P08: оценка, выбор и пересмотр действия; P09: личное обучение; P10: вычисления и энергетическая цена мозга; P11: размножение и жизненная линия; P18: история жизни, поля и происхождение показателей | actions, energy, food, geography, intro, selection, time | карточка этапа; реестр sources/checks: acceptTemporalChoice, advanceTemporal, advanceTemporalBodies, complete, finishTemporal, localTemporalObservation, prepareTemporalBoundary, sampleCells, sampleLife, temporalAvailableMask, temporalBirthAvailability, temporalNavigation, temporalSelectedChoice | `dd4612a618fb` |
| [dist/transient-status.js](../../dist/transient-status.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `1a40bc29b68b` |
| [dist/typography.js](../../dist/typography.js) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `fb2a5239ad6a` |
| [dist/ui-numbers.js](../../dist/ui-numbers.js) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `86326a003faf` |
| [dist/ui-text.js](../../dist/ui-text.js) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | карточка этапа | `250dfd470dfc` |
| [dist/weighted-statistics.js](../../dist/weighted-statistics.js) | P20: средние, медианы, веса и интервалы | research | карточка этапа | `45572e4041d3` |
| [dist/worker-benchmark-settings.js](../../dist/worker-benchmark-settings.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `abccf149a82a` |
| [dist/worker-timing.js](../../dist/worker-timing.js) | P24: исполнители и границы состояния | world | карточка этапа | `b61d95bd5a68` |
| [dist/workspace-ui.js](../../dist/workspace-ui.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `6d8eb055a320` |
| [dist/workspace.css](../../dist/workspace.css) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `ea460ea736ed` |
| [dist/world-client.js](../../dist/world-client.js) | P24: исполнители и границы состояния | world | карточка этапа | `2717c89111c8` |
| [dist/world-defaults.js](../../dist/world-defaults.js) | P11: размножение и жизненная линия | selection | карточка этапа | `37d5f1aa0b00` |
| [dist/world-edit.js](../../dist/world-edit.js) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `31d8f96ad820` |
| [dist/world-files-ui.js](../../dist/world-files-ui.js) | P23: сохранения, архивы и загрузка частями | saves | карточка этапа | `c3eb3431c18a` |
| [dist/world-profiler.js](../../dist/world-profiler.js) | P25: измерения и проверки механизмов | checks | карточка этапа | `8c23a39781ac` |
| [dist/world-runtime.js](../../dist/world-runtime.js) | P24: исполнители и границы состояния | world | карточка этапа; реестр sources/checks: setRunning | `e4881838c209` |
| [dist/world-save.js](../../dist/world-save.js) | P05: память мест и её изменение; P23: сохранения, архивы и загрузка частями | limits, saves | карточка этапа; реестр sources/checks: loadWorld, saveWorld | `c67bc20d0e81` |
| [dist/world-substeps.js](../../dist/world-substeps.js) | P24: исполнители и границы состояния | world | карточка этапа | `bfd7e2d8e264` |
| [dist/world-view.js](../../dist/world-view.js) | P24: исполнители и границы состояния | world | карточка этапа | `95ea0fc431f6` |
| [dist/world-worker.js](../../dist/world-worker.js) | P24: исполнители и границы состояния | world | карточка этапа | `4404269a6597` |

Незакрытый пробел каждой строки: прочитать соответствующий контракт и рабочий путь, проверить объяснение/пример/границы, записать доказательство и фактическую reviewedVersion статьи. У тестов — установить проверяемый контракт; наличие теста не означает его запуска. После выполнения тематического этапа менять статус только его проверенной части.
