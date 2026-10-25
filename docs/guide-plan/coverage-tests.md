# P00: Проверки и фикстуры

Исходный снимок P00 сохранён для сравнения; текущие статусы и назначения — в [аудите P28](audit.md). Записи «впереди/не проверено» ниже относятся к моменту P00.

[Индекс и правила чтения](coverage.md).

Общие поля всех строк: **статус — не проверено**; новая содержательная сверка — отсутствует. SHA-256 ниже фиксирует исходный файл (первые 12 знаков), а не качество описания. Ответственность и статьи — маршрут проверки, не заключение о полноте. Строки без sources в реестре требуют сначала установить рабочую точку вызова; служебные файлы — назначение и потребителей.

| Источник | Следующие этапы / ответственность по карточке | Статья-вход | Основание маршрута / символы | SHA-256 |
| --- | --- | --- | --- | --- |
| [tests/activity-perception.test.mjs](../../tests/activity-perception.test.mjs) | P04: наблюдения и доступные сведения | geography, memory | карточка этапа; реестр sources/checks | `b7ce18de44d3` |
| [tests/analysis-builder047.test.mjs](../../tests/analysis-builder047.test.mjs) | P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `599395933ed5` |
| [tests/brain-diagram0531.test.mjs](../../tests/brain-diagram0531.test.mjs) | P07: устройство мозга и числовые входы; P14: чтение генома и схемы жителя | brain | карточка этапа | `4a1794164f8d` |
| [tests/brain-initialization0532.test.mjs](../../tests/brain-initialization0532.test.mjs) | P12: геном, числовые мутации и основатели; P13: начальная структура и структурная эволюция | genome | карточка этапа; реестр sources/checks | `8bfe5a41c6dc` |
| [tests/chart-catalogue048.test.mjs](../../tests/chart-catalogue048.test.mjs) | P21: группы и сравнение выбранной пары; P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `851f24889ed4` |
| [tests/chart-context049.test.mjs](../../tests/chart-context049.test.mjs) | P21: группы и сравнение выбранной пары; P22: шаблоны, формулы и локальные настройки графика | research | карточка этапа | `03b73d761eba` |
| [tests/cognition-worker-adapter.mjs](../../tests/cognition-worker-adapter.mjs) | P24: исполнители и границы состояния | world | предварительно по семейству; подтвердить владельца | `2bc900f7312e` |
| [tests/cognition.test.mjs](../../tests/cognition.test.mjs) | P05: память мест и её изменение | memory | предварительно по семейству; подтвердить владельца | `2771822ca4e2` |
| [tests/configuration-benchmark.test.mjs](../../tests/configuration-benchmark.test.mjs) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `5cee603d76f3` |
| [tests/consolidation.test.mjs](../../tests/consolidation.test.mjs) | P05: память мест и её изменение | memory | предварительно по семейству; подтвердить владельца | `47175c0af799` |
| [tests/digestion-experiments046.test.mjs](../../tests/digestion-experiments046.test.mjs) | P01: путь порции до энергии | food | карточка этапа; реестр sources/checks | `9743cefe7c89` |
| [tests/environment-save.test.mjs](../../tests/environment-save.test.mjs) | P03: автоматическое изменение среды; P23: сохранения, архивы и загрузка частями; P24: исполнители и границы состояния | energy, limits, saves | карточка этапа; реестр sources/checks | `4f54456a7f19` |
| [tests/evolution-interface.test.mjs](../../tests/evolution-interface.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `852c0f44a72e` |
| [tests/evolution.test.mjs](../../tests/evolution.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `0770e6792074` |
| [tests/expanded-world.test.mjs](../../tests/expanded-world.test.mjs) | P04: наблюдения и доступные сведения | geography | предварительно по семейству; подтвердить владельца; реестр sources/checks | `2253bfe17ad5` |
| [tests/experiment-constructor.test.mjs](../../tests/experiment-constructor.test.mjs) | P15: план и сочетания параметров; P16: случайность, повторы, попытки и вымирания; P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `50f4a038455a` |
| [tests/experiment-factors.test.mjs](../../tests/experiment-factors.test.mjs) | P15: план и сочетания параметров | research | карточка этапа | `e1532eeb7782` |
| [tests/experiment-statistics.test.mjs](../../tests/experiment-statistics.test.mjs) | P20: средние, медианы, веса и интервалы | research | предварительно по семейству; подтвердить владельца | `6b6ed9159de0` |
| [tests/experiment-storage045.test.mjs](../../tests/experiment-storage045.test.mjs) | P23: сохранения, архивы и загрузка частями | saves | карточка этапа | `3b8121917976` |
| [tests/experiment-ui.test.mjs](../../tests/experiment-ui.test.mjs) | P17: запуск, остановка и распределение вычислителей | research | карточка этапа | `df6f8dce5ba5` |
| [tests/fixtures/numeric-rules0548.json](../../tests/fixtures/numeric-rules0548.json) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `ee5ed9db1013` |
| [tests/food-layout.test.mjs](../../tests/food-layout.test.mjs) | P02: источники и начальная раскладка | food | предварительно по семейству; подтвердить владельца | `4a516b058ccd` |
| [tests/genome-experiments044.test.mjs](../../tests/genome-experiments044.test.mjs) | P06: ощущения и знаки предпочтений; P12: геном, числовые мутации и основатели; P15: план и сочетания параметров; P23: сохранения, архивы и загрузка частями | brain | карточка этапа | `f5058fb6e36a` |
| [tests/guide-actions0546.test.mjs](../../tests/guide-actions0546.test.mjs) | P08: оценка, выбор и пересмотр действия | actions | карточка этапа; реестр sources/checks | `6f148370d209` |
| [tests/guide-energy0547.test.mjs](../../tests/guide-energy0547.test.mjs) | P01: путь порции до энергии | energy | карточка этапа; реестр sources/checks | `167b25748d8f` |
| [tests/guide-geography0545.test.mjs](../../tests/guide-geography0545.test.mjs) | P04: наблюдения и доступные сведения | geography | карточка этапа; реестр sources/checks | `c2454a1a0c21` |
| [tests/guide-parameters0543.test.mjs](../../tests/guide-parameters0543.test.mjs) | P11: размножение и жизненная линия | selection | карточка этапа | `2e27805acac5` |
| [tests/guide-reader0542.test.mjs](../../tests/guide-reader0542.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks | `98f385ef9d6a` |
| [tests/guide-time0544.test.mjs](../../tests/guide-time0544.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | time | предварительно по семейству; подтвердить владельца; реестр sources/checks | `ce435504f04c` |
| [tests/help-ui.test.mjs](../../tests/help-ui.test.mjs) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `426b290e5f33` |
| [tests/history-ui.test.mjs](../../tests/history-ui.test.mjs) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `00c370d8cbf2` |
| [tests/history-window.test.mjs](../../tests/history-window.test.mjs) | P18: история жизни, поля и происхождение показателей; P19: периоды, когорты и дожитие | research | карточка этапа | `84477c49f435` |
| [tests/interface.test.mjs](../../tests/interface.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `7aed4ae36702` |
| [tests/interface0361.test.mjs](../../tests/interface0361.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `10f11de90553` |
| [tests/island-mobility.test.mjs](../../tests/island-mobility.test.mjs) | P03: автоматическое изменение среды | environment | карточка этапа; реестр sources/checks | `92e5f05fea50` |
| [tests/js-syntax.test.mjs](../../tests/js-syntax.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | checks | предварительно по семейству; подтвердить владельца; реестр sources/checks | `5208af884519` |
| [tests/life-cohorts.test.mjs](../../tests/life-cohorts.test.mjs) | P18: история жизни, поля и происхождение показателей; P19: периоды, когорты и дожитие | research | карточка этапа | `b3469148dded` |
| [tests/live-computations.test.mjs](../../tests/live-computations.test.mjs) | P24: исполнители и границы состояния | world | предварительно по семейству; подтвердить владельца | `417d9d1a319d` |
| [tests/live-history.test.mjs](../../tests/live-history.test.mjs) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `900bd9de17b2` |
| [tests/live-statistics0533.test.mjs](../../tests/live-statistics0533.test.mjs) | P10: вычисления и энергетическая цена мозга; P18: история жизни, поля и происхождение показателей; P26: интерфейс и обновление статистики | brain, energy | карточка этапа | `518375561b54` |
| [tests/memory-genes.test.mjs](../../tests/memory-genes.test.mjs) | P12: геном, числовые мутации и основатели | genome | предварительно по семейству; подтвердить владельца | `9a0a7e24028c` |
| [tests/navigation.test.mjs](../../tests/navigation.test.mjs) | P04: наблюдения и доступные сведения | geography, memory | предварительно по семейству; подтвердить владельца | `db76673c0b9d` |
| [tests/node-cognition-worker.mjs](../../tests/node-cognition-worker.mjs) | P24: исполнители и границы состояния | world | предварительно по семейству; подтвердить владельца | `728470f8e9fc` |
| [tests/numeric-rules0548.test.mjs](../../tests/numeric-rules0548.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | numbers | предварительно по семейству; подтвердить владельца; реестр sources/checks | `06062508327b` |
| [tests/pair-statistics042.test.mjs](../../tests/pair-statistics042.test.mjs) | P16: случайность, повторы, попытки и вымирания; P21: группы и сравнение выбранной пары | research | карточка этапа | `93ef9c11878e` |
| [tests/parallel-benchmark.test.mjs](../../tests/parallel-benchmark.test.mjs) | P24: исполнители и границы состояния | world | предварительно по семейству; подтвердить владельца | `ecc16366da00` |
| [tests/parallel-world.test.mjs](../../tests/parallel-world.test.mjs) | P04: наблюдения и доступные сведения; P09: личное обучение; P11: размножение и жизненная линия; P24: исполнители и границы состояния | time | карточка этапа; реестр sources/checks | `716c92754f50` |
| [tests/performance-detail.test.mjs](../../tests/performance-detail.test.mjs) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `f01f8c0e9de9` |
| [tests/project-guide054.test.mjs](../../tests/project-guide054.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro | предварительно по семейству; подтвердить владельца; реестр sources/checks | `65134ab54552` |
| [tests/routing.test.mjs](../../tests/routing.test.mjs) | P04: наблюдения и доступные сведения | geography, memory | предварительно по семейству; подтвердить владельца | `dbba4d1a0e75` |
| [tests/simulation.test.mjs](../../tests/simulation.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `e7c64c8f81ce` |
| [tests/statistical-ui041.test.mjs](../../tests/statistical-ui041.test.mjs) | P19: периоды, когорты и дожитие; P20: средние, медианы, веса и интервалы | research | карточка этапа | `ffee5d3cd27a` |
| [tests/statistics043.test.mjs](../../tests/statistics043.test.mjs) | P20: средние, медианы, веса и интервалы; P21: группы и сравнение выбранной пары | research | карточка этапа; реестр sources/checks | `3b0800083ad6` |
| [tests/structural-brain053.test.mjs](../../tests/structural-brain053.test.mjs) | P07: устройство мозга и числовые входы; P08: оценка, выбор и пересмотр действия; P09: личное обучение; P10: вычисления и энергетическая цена мозга; P12: геном, числовые мутации и основатели; P13: начальная структура и структурная эволюция | brain, intro | карточка этапа; реестр sources/checks | `43c264d34834` |
| [tests/target-environment.test.mjs](../../tests/target-environment.test.mjs) | P03: автоматическое изменение среды | environment | предварительно по семейству; подтвердить владельца | `d4d9c3c0924a` |
| [tests/temporal.test.mjs](../../tests/temporal.test.mjs) | P01: путь порции до энергии; P08: оценка, выбор и пересмотр действия; P09: личное обучение; P11: размножение и жизненная линия | actions, deposits, energy, selection, time | карточка этапа; реестр sources/checks | `defb9d7902b7` |
| [tests/ui-text-controls.test.mjs](../../tests/ui-text-controls.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `63cc5a5ee187` |
| [tests/ui051.test.mjs](../../tests/ui051.test.mjs) | P16: случайность, повторы, попытки и вымирания; P26: интерфейс и обновление статистики | research | карточка этапа | `590b8c76323c` |
| [tests/ui052.test.mjs](../../tests/ui052.test.mjs) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `ccd4347dbf1c` |
| [tests/update037.test.mjs](../../tests/update037.test.mjs) | P27: архитектура, локальная работа и поддержка справочника | intro / будущий раздел разработки | предварительно по семейству; подтвердить владельца | `2e91f93b63ce` |
| [tests/worker-count-benchmark.test.mjs](../../tests/worker-count-benchmark.test.mjs) | P25: измерения и проверки механизмов | checks | предварительно по семейству; подтвердить владельца | `3a4f6763753d` |
| [tests/worker-count-ui.test.mjs](../../tests/worker-count-ui.test.mjs) | P26: интерфейс и обновление статистики | world, research | предварительно по семейству; подтвердить владельца | `c0e5ebb32e03` |
| [tests/worker-timing.test.mjs](../../tests/worker-timing.test.mjs) | P24: исполнители и границы состояния | world | карточка этапа | `df12cb585a2f` |
| [tests/workspace050.test.mjs](../../tests/workspace050.test.mjs) | P26: интерфейс и обновление статистики | world, research | карточка этапа | `854376f0f437` |
| [tests/world-ui.test.mjs](../../tests/world-ui.test.mjs) | P26: интерфейс и обновление статистики | world | карточка этапа; реестр sources/checks | `c18a0957f847` |
| [tests/world-worker-adapter.mjs](../../tests/world-worker-adapter.mjs) | P24: исполнители и границы состояния | world | предварительно по семейству; подтвердить владельца | `c0e632cc567a` |
| [tests/world-worker.test.mjs](../../tests/world-worker.test.mjs) | P24: исполнители и границы состояния | world | карточка этапа | `27da205aa6fa` |

Незакрытый пробел каждой строки: прочитать соответствующий контракт и рабочий путь, проверить объяснение/пример/границы, записать доказательство и фактическую reviewedVersion статьи. У тестов — установить проверяемый контракт; наличие теста не означает его запуска. После выполнения тематического этапа менять статус только его проверенной части.
