# P28: текущие маршруты файлов

[Результат и границы аудита](audit.md). Это индекс назначения и навигации, не доказательство каждой строки реализации. Паспорта и таблицы ответственности A–F содержат смысловые доказательства. Для точечного входа ищите имя файла в этой таблице, затем откройте указанную статью/владельца.

Версия 0.54.17. Статусы: **описано** — тематическая ответственность связана с главой; **служебное** — назначение поддержки/проверки; **историческое** — прежний выпуск/экран, не нынешняя механика. Проверенная версия статьи не означает повторный запуск всех связанных тестов.

| Файл | Статус | Статья / назначение |
| --- | --- | --- |
| [.gitattributes](../../.gitattributes) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [.github/workflows/pages.yml](../../.github/workflows/pages.yml) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [.gitignore](../../.gitignore) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [AGENTS.md](../../AGENTS.md) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [Install.cmd](../../Install.cmd) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [Install.ps1](../../Install.ps1) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [Launch.ps1](../../Launch.ps1) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [README.md](../../README.md) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [README.ru.md](../../README.ru.md) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [Start.cmd](../../Start.cmd) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [dist/action-catalog.js](../../dist/action-catalog.js) | описано | `choice` |
| [dist/action-timing.js](../../dist/action-timing.js) | описано | `numbers`, `time`, `actions` |
| [dist/activity-perception.js](../../dist/activity-perception.js) | описано | `observation` |
| [dist/analysis-builder-chart.js](../../dist/analysis-builder-chart.js) | служебное | `charts` |
| [dist/analysis-builder-core.js](../../dist/analysis-builder-core.js) | служебное | `life-data`, `charts` |
| [dist/analysis-builder-ui.js](../../dist/analysis-builder-ui.js) | историческое | `development` |
| [dist/analysis-builder-worker.js](../../dist/analysis-builder-worker.js) | служебное | `charts` |
| [dist/analysis-expression.js](../../dist/analysis-expression.js) | описано | `charts` |
| [dist/analysis-projection.js](../../dist/analysis-projection.js) | описано | `charts` |
| [dist/app-version.js](../../dist/app-version.js) | описано | `development` |
| [dist/app.js](../../dist/app.js) | историческое | `development` |
| [dist/attention-gate.js](../../dist/attention-gate.js) | описано | `actions`, `choice` |
| [dist/automatic-environment.js](../../dist/automatic-environment.js) | описано | `environment` |
| [dist/benchmark-checks.js](../../dist/benchmark-checks.js) | историческое | `performance` |
| [dist/benchmark-comparison-runner.js](../../dist/benchmark-comparison-runner.js) | описано | `performance` |
| [dist/benchmark-configurations.js](../../dist/benchmark-configurations.js) | описано | `performance` |
| [dist/benchmark-fixtures.js](../../dist/benchmark-fixtures.js) | описано | `performance` |
| [dist/benchmark-report.js](../../dist/benchmark-report.js) | служебное | `performance` |
| [dist/benchmark-runner.js](../../dist/benchmark-runner.js) | историческое | `performance` |
| [dist/benchmark-snapshot-runtime.js](../../dist/benchmark-snapshot-runtime.js) | описано | `performance` |
| [dist/benchmark-state.js](../../dist/benchmark-state.js) | описано | `performance` |
| [dist/benchmark-ui.js](../../dist/benchmark-ui.js) | служебное | `performance` |
| [dist/benchmark-version-checks.js](../../dist/benchmark-version-checks.js) | историческое | `performance` |
| [dist/benchmark-versions.js](../../dist/benchmark-versions.js) | описано | `performance` |
| [dist/benchmark-worker.js](../../dist/benchmark-worker.js) | служебное | `performance` |
| [dist/brain-controller.js](../../dist/brain-controller.js) | описано | `intro`, `feelings`, `choice` |
| [dist/brain-cost.js](../../dist/brain-cost.js) | описано | `energy`, `brain`, `brain-cost` |
| [dist/brain-diagram-help.js](../../dist/brain-diagram-help.js) | описано | `brain-structure` |
| [dist/brain-diagram-ui.js](../../dist/brain-diagram-ui.js) | служебное | `genome-analysis` |
| [dist/brain-diagram-viewport.js](../../dist/brain-diagram-viewport.js) | описано | `genome-analysis` |
| [dist/brain-initialization-ui.js](../../dist/brain-initialization-ui.js) | служебное | `structure-evolution` |
| [dist/brain-initialization.js](../../dist/brain-initialization.js) | описано | `structure-evolution` |
| [dist/brain-input-scales.js](../../dist/brain-input-scales.js) | описано | `numbers`, `feelings` |
| [dist/brain-parameters.js](../../dist/brain-parameters.js) | описано | `feelings`, `memory` |
| [dist/brain-structure-rules.js](../../dist/brain-structure-rules.js) | описано | `numbers`, `structure-evolution` |
| [dist/browser-checks.js](../../dist/browser-checks.js) | служебное | `performance`, `checks` |
| [dist/catalogue-expression-client.js](../../dist/catalogue-expression-client.js) | служебное | `charts` |
| [dist/chart-catalogue-ui.js](../../dist/chart-catalogue-ui.js) | служебное | `charts` |
| [dist/chart-catalogue.js](../../dist/chart-catalogue.js) | описано | `charts` |
| [dist/chart-context.js](../../dist/chart-context.js) | описано | `charts` |
| [dist/chart-local-renderer.js](../../dist/chart-local-renderer.js) | описано | `research` |
| [dist/chart-pins-ui.js](../../dist/chart-pins-ui.js) | служебное | `charts` |
| [dist/chart-update-state.js](../../dist/chart-update-state.js) | описано | `research` |
| [dist/cognition-owner.js](../../dist/cognition-owner.js) | описано | `runtime` |
| [dist/cognition-packet.js](../../dist/cognition-packet.js) | описано | `runtime` |
| [dist/cognition-rules.js](../../dist/cognition-rules.js) | описано | `numbers`, `memory` |
| [dist/cognition-summary.js](../../dist/cognition-summary.js) | описано | `runtime` |
| [dist/cognition-worker.js](../../dist/cognition-worker.js) | служебное | `runtime` |
| [dist/cognition.js](../../dist/cognition.js) | описано | `intro`, `memory` |
| [dist/comparison-charts.js](../../dist/comparison-charts.js) | описано | `groups` |
| [dist/computation-settings.js](../../dist/computation-settings.js) | описано | `runtime` |
| [dist/configuration-benchmark-report.js](../../dist/configuration-benchmark-report.js) | служебное | `performance` |
| [dist/configuration-benchmark-runner.js](../../dist/configuration-benchmark-runner.js) | описано | `performance` |
| [dist/configuration-benchmark-ui.js](../../dist/configuration-benchmark-ui.js) | служебное | `performance` |
| [dist/continuation-checks.js](../../dist/continuation-checks.js) | историческое | `performance` |
| [dist/controls.css](../../dist/controls.css) | служебное | `world` |
| [dist/deferred-control.js](../../dist/deferred-control.js) | описано | `research` |
| [dist/energy-budget.js](../../dist/energy-budget.js) | описано | `energy` |
| [dist/environment-checks.js](../../dist/environment-checks.js) | служебное | `performance` |
| [dist/environment-plan.js](../../dist/environment-plan.js) | описано | `environment` |
| [dist/environment-settings.js](../../dist/environment-settings.js) | описано | `environment` |
| [dist/environment-ui.js](../../dist/environment-ui.js) | служебное | `environment` |
| [dist/evolution-app.js](../../dist/evolution-app.js) | описано | `world`, `feelings`, `development` |
| [dist/evolution.css](../../dist/evolution.css) | служебное | `world` |
| [dist/evolution.js](../../dist/evolution.js) | описано | `intro`, `energy`, `actions`, `selection`, `deposits`, `limits` |
| [dist/experiment-archive.js](../../dist/experiment-archive.js) | описано | `files` |
| [dist/experiment-design-ui.js](../../dist/experiment-design-ui.js) | служебное | `experiment-design` |
| [dist/experiment-execution.js](../../dist/experiment-execution.js) | описано | `experiment-runs` |
| [dist/experiment-fields.js](../../dist/experiment-fields.js) | описано | `experiment-design` |
| [dist/experiment-genomes.js](../../dist/experiment-genomes.js) | описано | `experiment-design` |
| [dist/experiment-grouping.js](../../dist/experiment-grouping.js) | описано | `groups` |
| [dist/experiment-outcomes.js](../../dist/experiment-outcomes.js) | описано | `experiment-attempts` |
| [dist/experiment-plan.js](../../dist/experiment-plan.js) | описано | `experiment-design`, `experiment-attempts` |
| [dist/experiment-preferences.js](../../dist/experiment-preferences.js) | описано | `experiment-design` |
| [dist/experiment-runner.js](../../dist/experiment-runner.js) | описано | `experiment-runs` |
| [dist/experiment-runs-ui.js](../../dist/experiment-runs-ui.js) | служебное | `experiment-runs` |
| [dist/experiment-series.js](../../dist/experiment-series.js) | описано | `experiment-attempts`, `experiment-runs` |
| [dist/experiment-statistics.js](../../dist/experiment-statistics.js) | описано | `experiment-attempts` |
| [dist/experiment-store.js](../../dist/experiment-store.js) | описано | `files` |
| [dist/experiment-ui.js](../../dist/experiment-ui.js) | служебное | `experiment-runs` |
| [dist/experiment-worker.js](../../dist/experiment-worker.js) | служебное | `experiment-runs` |
| [dist/food-controls.js](../../dist/food-controls.js) | описано | `food` |
| [dist/food-distribution.js](../../dist/food-distribution.js) | описано | `food` |
| [dist/food-exposure.js](../../dist/food-exposure.js) | описано | `periods` |
| [dist/food-island-checks.js](../../dist/food-island-checks.js) | историческое | `performance` |
| [dist/food-island-evolution.js](../../dist/food-island-evolution.js) | описано | `environment` |
| [dist/food-islands.js](../../dist/food-islands.js) | описано | `food` |
| [dist/food-layout.js](../../dist/food-layout.js) | служебное | `food` |
| [dist/food-production-history.js](../../dist/food-production-history.js) | описано | `environment`, `periods` |
| [dist/food-settings.js](../../dist/food-settings.js) | описано | `food` |
| [dist/founder-senses.js](../../dist/founder-senses.js) | описано | `genome` |
| [dist/genome-analysis-ui.js](../../dist/genome-analysis-ui.js) | служебное | `genome-analysis` |
| [dist/genome-analysis.js](../../dist/genome-analysis.js) | описано | `genome-analysis` |
| [dist/genome.js](../../dist/genome.js) | описано | `genome` |
| [dist/geography.js](../../dist/geography.js) | описано | `geography` |
| [dist/guide-actions-text.js](../../dist/guide-actions-text.js) | служебное | `actions` |
| [dist/guide-analysis-text.js](../../dist/guide-analysis-text.js) | служебное | `estimates`, `groups`, `charts`, `files` |
| [dist/guide-analysis-topics.js](../../dist/guide-analysis-topics.js) | служебное | `development` |
| [dist/guide-audit-topics.js](../../dist/guide-audit-topics.js) | служебное | `development` |
| [dist/guide-energy-text.js](../../dist/guide-energy-text.js) | служебное | `energy` |
| [dist/guide-environment-text.js](../../dist/guide-environment-text.js) | служебное | `environment` |
| [dist/guide-evolution-topics.js](../../dist/guide-evolution-topics.js) | служебное | `development` |
| [dist/guide-experiment-topics.js](../../dist/guide-experiment-topics.js) | служебное | `development` |
| [dist/guide-experiments-text.js](../../dist/guide-experiments-text.js) | служебное | `experiment-design`, `experiment-attempts`, `experiment-runs`, `life-data`, `periods` |
| [dist/guide-food-sources-text.js](../../dist/guide-food-sources-text.js) | служебное | `food` |
| [dist/guide-food-text.js](../../dist/guide-food-text.js) | служебное | `food` |
| [dist/guide-genetics-text.js](../../dist/guide-genetics-text.js) | служебное | `structure-evolution`, `selection`, `genome` |
| [dist/guide-geography-text.js](../../dist/guide-geography-text.js) | служебное | `geography` |
| [dist/guide-learning-text.js](../../dist/guide-learning-text.js) | служебное | `learning`, `brain-cost` |
| [dist/guide-markup.js](../../dist/guide-markup.js) | служебное | `development` |
| [dist/guide-mind-text.js](../../dist/guide-mind-text.js) | служебное | `feelings`, `choice` |
| [dist/guide-mind-topics.js](../../dist/guide-mind-topics.js) | служебное | `development` |
| [dist/guide-numbers-text.js](../../dist/guide-numbers-text.js) | служебное | `numbers` |
| [dist/guide-parameters.js](../../dist/guide-parameters.js) | служебное | `development` |
| [dist/guide-reference-text.js](../../dist/guide-reference-text.js) | служебное | `intro` |
| [dist/guide-system-text.js](../../dist/guide-system-text.js) | служебное | `world`, `research`, `runtime`, `performance`, `development` |
| [dist/guide-system-topics.js](../../dist/guide-system-topics.js) | служебное | `development` |
| [dist/guide-time-text.js](../../dist/guide-time-text.js) | служебное | `time` |
| [dist/help.js](../../dist/help.js) | описано | `world` |
| [dist/heritable-statistics.js](../../dist/heritable-statistics.js) | описано | `life-data` |
| [dist/history-charts.js](../../dist/history-charts.js) | описано | `research` |
| [dist/history-differences-ui.js](../../dist/history-differences-ui.js) | служебное | `groups` |
| [dist/history-drawers.js](../../dist/history-drawers.js) | описано | `research` |
| [dist/history-estimates-ui.js](../../dist/history-estimates-ui.js) | служебное | `estimates` |
| [dist/history-ui.js](../../dist/history-ui.js) | служебное | `research` |
| [dist/history-window.js](../../dist/history-window.js) | описано | `periods` |
| [dist/index.html](../../dist/index.html) | служебное | `development` |
| [dist/json-export.js](../../dist/json-export.js) | описано | `files` |
| [dist/lab-report-checks.js](../../dist/lab-report-checks.js) | историческое | `performance` |
| [dist/lab-reports.js](../../dist/lab-reports.js) | служебное | `performance` |
| [dist/lab-tabs.js](../../dist/lab-tabs.js) | описано | `research` |
| [dist/layout.css](../../dist/layout.css) | служебное | `world` |
| [dist/legacy-browser-checks.js](../../dist/legacy-browser-checks.js) | историческое | `performance` |
| [dist/legacy.html](../../dist/legacy.html) | историческое | `development` |
| [dist/life-cohorts.js](../../dist/life-cohorts.js) | описано | `brain-cost`, `life-data`, `periods` |
| [dist/life-history.js](../../dist/life-history.js) | описано | `life-data` |
| [dist/life-observations.js](../../dist/life-observations.js) | описано | `life-data` |
| [dist/metric-options.js](../../dist/metric-options.js) | описано | `research` |
| [dist/model-rules.js](../../dist/model-rules.js) | описано | `numbers`, `energy`, `food` |
| [dist/mutation-checks.js](../../dist/mutation-checks.js) | историческое | `performance` |
| [dist/mutation-parameters.js](../../dist/mutation-parameters.js) | описано | `genome` |
| [dist/navigation.js](../../dist/navigation.js) | описано | `geography` |
| [dist/neighbour-checks.js](../../dist/neighbour-checks.js) | историческое | `performance` |
| [dist/neighbour-perception.js](../../dist/neighbour-perception.js) | описано | `observation` |
| [dist/neural-brain.js](../../dist/neural-brain.js) | описано | `intro`, `learning` |
| [dist/neural-checks.js](../../dist/neural-checks.js) | историческое | `performance` |
| [dist/neural-layout.js](../../dist/neural-layout.js) | служебное | `genome` |
| [dist/neural-optimization-checks.js](../../dist/neural-optimization-checks.js) | историческое | `performance` |
| [dist/neural-v018-reference.js](../../dist/neural-v018-reference.js) | историческое | `performance` |
| [dist/numeric-rules.js](../../dist/numeric-rules.js) | описано | `numbers` |
| [dist/pair-comparison-ui.js](../../dist/pair-comparison-ui.js) | служебное | `groups` |
| [dist/pair-series.js](../../dist/pair-series.js) | описано | `groups` |
| [dist/pair-statistics-client.js](../../dist/pair-statistics-client.js) | служебное | `groups` |
| [dist/pair-statistics-worker.js](../../dist/pair-statistics-worker.js) | служебное | `groups` |
| [dist/pair-statistics.js](../../dist/pair-statistics.js) | описано | `groups` |
| [dist/parallel-world.js](../../dist/parallel-world.js) | описано | `runtime` |
| [dist/performance-checks.js](../../dist/performance-checks.js) | историческое | `performance` |
| [dist/performance-probe.js](../../dist/performance-probe.js) | описано | `performance` |
| [dist/performance-profiler.js](../../dist/performance-profiler.js) | описано | `performance` |
| [dist/performance-tabs.js](../../dist/performance-tabs.js) | описано | `performance` |
| [dist/performance-ui.js](../../dist/performance-ui.js) | служебное | `performance` |
| [dist/policy-layout.js](../../dist/policy-layout.js) | служебное | `genome` |
| [dist/population-statistics.js](../../dist/population-statistics.js) | описано | `periods` |
| [dist/project-guide-search.js](../../dist/project-guide-search.js) | служебное | `intro` |
| [dist/project-guide-sources-ui.js](../../dist/project-guide-sources-ui.js) | служебное | `intro` |
| [dist/project-guide-topics.js](../../dist/project-guide-topics.js) | служебное | `intro` |
| [dist/project-guide-ui.js](../../dist/project-guide-ui.js) | служебное | `intro`, `development` |
| [dist/project-guide.js](../../dist/project-guide.js) | служебное | `development` |
| [dist/random-seed.js](../../dist/random-seed.js) | описано | `experiment-attempts` |
| [dist/reproduction.js](../../dist/reproduction.js) | описано | `selection` |
| [dist/resident-trail-checks.js](../../dist/resident-trail-checks.js) | историческое | `performance` |
| [dist/resident-trail.js](../../dist/resident-trail.js) | описано | `world` |
| [dist/retained-results.js](../../dist/retained-results.js) | описано | `research` |
| [dist/screen-tabs.js](../../dist/screen-tabs.js) | описано | `world` |
| [dist/set-brain-checks.js](../../dist/set-brain-checks.js) | историческое | `performance` |
| [dist/set-brain-engine.js](../../dist/set-brain-engine.js) | описано | `intro`, `brain`, `brain-structure`, `choice`, `learning` |
| [dist/set-brain-inputs.js](../../dist/set-brain-inputs.js) | описано | `brain-structure` |
| [dist/set-brain-layout.js](../../dist/set-brain-layout.js) | служебное | `brain-structure` |
| [dist/set-brain.js](../../dist/set-brain.js) | описано | `brain-structure` |
| [dist/sidebar.js](../../dist/sidebar.js) | описано | `world` |
| [dist/simulation.js](../../dist/simulation.js) | описано | `development` |
| [dist/source-viewer.js](../../dist/source-viewer.js) | описано | `development` |
| [dist/source.html](../../dist/source.html) | служебное | `development` |
| [dist/stable-text-list.js](../../dist/stable-text-list.js) | описано | `world` |
| [dist/state-codec.js](../../dist/state-codec.js) | описано | `files` |
| [dist/statistical-blocks.js](../../dist/statistical-blocks.js) | описано | `groups` |
| [dist/statistical-series.js](../../dist/statistical-series.js) | описано | `estimates` |
| [dist/statistics-client.js](../../dist/statistics-client.js) | служебное | `estimates` |
| [dist/statistics-estimates.js](../../dist/statistics-estimates.js) | описано | `estimates` |
| [dist/statistics-format.js](../../dist/statistics-format.js) | описано | `estimates` |
| [dist/statistics-preparation.js](../../dist/statistics-preparation.js) | описано | `research` |
| [dist/statistics-worker.js](../../dist/statistics-worker.js) | служебное | `estimates` |
| [dist/structural-brain.js](../../dist/structural-brain.js) | описано | `brain-structure`, `structure-evolution` |
| [dist/structural-checks.js](../../dist/structural-checks.js) | служебное | `performance` |
| [dist/style.css](../../dist/style.css) | служебное | `world` |
| [dist/survival-curve.js](../../dist/survival-curve.js) | описано | `periods` |
| [dist/temporal-brain.js](../../dist/temporal-brain.js) | описано | `brain-structure` |
| [dist/temporal-checks.js](../../dist/temporal-checks.js) | служебное | `checks` |
| [dist/temporal-inputs.js](../../dist/temporal-inputs.js) | описано | `intro`, `brain`, `observation`, `brain-structure`, `geography` |
| [dist/temporal-layout.js](../../dist/temporal-layout.js) | служебное | `brain-structure` |
| [dist/temporal-world.js](../../dist/temporal-world.js) | описано | `intro`, `time`, `energy`, `actions`, `observation`, `choice`, `learning`, `brain-cost`, `memory`, `selection`, `geography`, `food` |
| [dist/transient-status.js](../../dist/transient-status.js) | описано | `world` |
| [dist/typography.js](../../dist/typography.js) | описано | `development` |
| [dist/ui-numbers.js](../../dist/ui-numbers.js) | служебное | `development` |
| [dist/ui-text.js](../../dist/ui-text.js) | служебное | `development` |
| [dist/weighted-statistics.js](../../dist/weighted-statistics.js) | описано | `estimates` |
| [dist/worker-benchmark-settings.js](../../dist/worker-benchmark-settings.js) | служебное | `performance` |
| [dist/worker-timing.js](../../dist/worker-timing.js) | служебное | `performance` |
| [dist/workspace-ui.js](../../dist/workspace-ui.js) | служебное | `world` |
| [dist/workspace.css](../../dist/workspace.css) | служебное | `world` |
| [dist/world-client.js](../../dist/world-client.js) | служебное | `runtime` |
| [dist/world-defaults.js](../../dist/world-defaults.js) | описано | `world` |
| [dist/world-edit.js](../../dist/world-edit.js) | описано | `world`, `food` |
| [dist/world-files-ui.js](../../dist/world-files-ui.js) | служебное | `files` |
| [dist/world-profiler.js](../../dist/world-profiler.js) | описано | `performance` |
| [dist/world-runtime.js](../../dist/world-runtime.js) | описано | `runtime` |
| [dist/world-save.js](../../dist/world-save.js) | описано | `saves`, `files`, `limits` |
| [dist/world-substeps.js](../../dist/world-substeps.js) | описано | `runtime` |
| [dist/world-view.js](../../dist/world-view.js) | описано | `runtime` |
| [dist/world-worker.js](../../dist/world-worker.js) | служебное | `runtime` |
| [docs/START_HERE.md](../../docs/START_HERE.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/action-time-balance.md](../../docs/action-time-balance.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/action-time-spec.md](../../docs/action-time-spec.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/analysis-builder-guide.md](../../docs/analysis-builder-guide.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/analysis/seed2330676295-25880-feelings.md](../../docs/analysis/seed2330676295-25880-feelings.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/analysis/seed42-217652-food-floor.md](../../docs/analysis/seed42-217652-food-floor.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/architecture.md](../../docs/architecture.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/brain-and-predators-notes.md](../../docs/brain-and-predators-notes.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/brain-growth-options.md](../../docs/brain-growth-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/brain-input-output-options.md](../../docs/brain-input-output-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/current-model.md](../../docs/current-model.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/decisions.md](../../docs/decisions.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/development-options-2026-10-18.md](../../docs/development-options-2026-10-18.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/energy-deficit-options.md](../../docs/energy-deficit-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/environment-variability-options.md](../../docs/environment-variability-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/experiment-comparison-plan.md](../../docs/experiment-comparison-plan.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/experiments-browser.md](../../docs/experiments-browser.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/food-budget-v036.md](../../docs/food-budget-v036.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/future-ideas.md](../../docs/future-ideas.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/github-pages.md](../../docs/github-pages.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/github-readme-draft.md](../../docs/github-readme-draft.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/github-repository-proposal.md](../../docs/github-repository-proposal.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/github-upload.md](../../docs/github-upload.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/ideas-archive.md](../../docs/ideas-archive.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/interface-layout-options.md](../../docs/interface-layout-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/mechanics-reference.md](../../docs/mechanics-reference.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/navigation/README.md](../../docs/navigation/README.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/navigation/experiments-and-statistics.md](../../docs/navigation/experiments-and-statistics.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/navigation/food.md](../../docs/navigation/food.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/navigation/interface-and-files.md](../../docs/navigation/interface-and-files.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/navigation/world-and-brain.md](../../docs/navigation/world-and-brain.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/neural-brain-design.md](../../docs/neural-brain-design.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-action-time.md](../../docs/next-action-time.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-experiment-factors.md](../../docs/next-experiment-factors.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-experiment-statistics-ui.md](../../docs/next-experiment-statistics-ui.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-experiment-storage.md](../../docs/next-experiment-storage.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-feeling-behavior.md](../../docs/next-feeling-behavior.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-food-islands-update.md](../../docs/next-food-islands-update.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-game-guide.md](../../docs/next-game-guide.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-genome-experiments.md](../../docs/next-genome-experiments.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-island-count.md](../../docs/next-island-count.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-memory.md](../../docs/next-memory.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-neighbours.md](../../docs/next-neighbours.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-performance-map.md](../../docs/next-performance-map.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-target-environment.md](../../docs/next-target-environment.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/next-v036.md](../../docs/next-v036.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/numeric-rules.md](../../docs/numeric-rules.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/optimization-options.md](../../docs/optimization-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/parallelism-options.md](../../docs/parallelism-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/performance-plan.md](../../docs/performance-plan.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/preference-system-options.md](../../docs/preference-system-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/roadmap.md](../../docs/roadmap.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/templates/contract.md](../../docs/templates/contract.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/ui-redesign.md](../../docs/ui-redesign.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/updates/README.md](../../docs/updates/README.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v006-experiments.md](../../docs/updates/v006-experiments.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v009-physiology.md](../../docs/updates/v009-physiology.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v010-world-changes.md](../../docs/updates/v010-world-changes.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v011-geography.md](../../docs/updates/v011-geography.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v012-reproduction-results.md](../../docs/updates/v012-reproduction-results.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v012-reproduction.md](../../docs/updates/v012-reproduction.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v013-deposit-and-sidebar.md](../../docs/updates/v013-deposit-and-sidebar.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v014-genome-analysis.md](../../docs/updates/v014-genome-analysis.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v015-body-senses.md](../../docs/updates/v015-body-senses.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v016-brain-interface.md](../../docs/updates/v016-brain-interface.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v016-check-results.md](../../docs/updates/v016-check-results.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v016-startup-fix.md](../../docs/updates/v016-startup-fix.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v017-neural-brain.md](../../docs/updates/v017-neural-brain.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v017-observation-results.md](../../docs/updates/v017-observation-results.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v018-performance.md](../../docs/updates/v018-performance.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v019-buffer-check-fix.md](../../docs/updates/v019-buffer-check-fix.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v019-neural-optimization.md](../../docs/updates/v019-neural-optimization.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v020-fixed-benchmarks.md](../../docs/updates/v020-fixed-benchmarks.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v021-test-tabs.md](../../docs/updates/v021-test-tabs.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v022-continuation-optimization.md](../../docs/updates/v022-continuation-optimization.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v023-repeat-limit.md](../../docs/updates/v023-repeat-limit.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v023-version-benchmarks-and-panel.md](../../docs/updates/v023-version-benchmarks-and-panel.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v024-inputs-groups-and-seed.md](../../docs/updates/v024-inputs-groups-and-seed.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v024-shared-repeats-and-results.md](../../docs/updates/v024-shared-repeats-and-results.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v025-neighbour-perception.md](../../docs/updates/v025-neighbour-perception.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v026-heritable-mutations.md](../../docs/updates/v026-heritable-mutations.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v027-food-islands-and-trail.md](../../docs/updates/v027-food-islands-and-trail.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v028-set-context-brain.md](../../docs/updates/v028-set-context-brain.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v029-visible-food-sources.md](../../docs/updates/v029-visible-food-sources.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v030-profile-detail.md](../../docs/updates/v030-profile-detail.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v030-world-worker.md](../../docs/updates/v030-world-worker.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v031-github-package.md](../../docs/updates/v031-github-package.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v031-input-allocations.md](../../docs/updates/v031-input-allocations.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v031-local-status-history.md](../../docs/updates/v031-local-status-history.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v031-readme-before-github.md](../../docs/updates/v031-readme-before-github.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v031-shared-decision-inputs.md](../../docs/updates/v031-shared-decision-inputs.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v031-worker-diagnostics.md](../../docs/updates/v031-worker-diagnostics.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v032-action-time.md](../../docs/updates/v032-action-time.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v032-cpu-time-diagnosis.md](../../docs/updates/v032-cpu-time-diagnosis.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v032-parallel-feasibility.md](../../docs/updates/v032-parallel-feasibility.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v033-live-controls.md](../../docs/updates/v033-live-controls.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v033-parallel-world.md](../../docs/updates/v033-parallel-world.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v033-worker-counts.md](../../docs/updates/v033-worker-counts.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v034-visible-activities.md](../../docs/updates/v034-visible-activities.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v035-history-window.md](../../docs/updates/v035-history-window.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v035-life-history-charts.md](../../docs/updates/v035-life-history-charts.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v036-environment-energy-save.md](../../docs/updates/v036-environment-energy-save.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v036-interface-help-survival.md](../../docs/updates/v036-interface-help-survival.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v036-interface-screens.md](../../docs/updates/v036-interface-screens.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v036-live-history.md](../../docs/updates/v036-live-history.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v037-chart-controls-and-food-ui.md](../../docs/updates/v037-chart-controls-and-food-ui.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v037-drawer-playback-fixes.md](../../docs/updates/v037-drawer-playback-fixes.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v037-fixed-survival-axis.md](../../docs/updates/v037-fixed-survival-axis.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v037-moving-islands-statistics.md](../../docs/updates/v037-moving-islands-statistics.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v038-agent-context.md](../../docs/updates/v038-agent-context.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v038-island-mobility.md](../../docs/updates/v038-island-mobility.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v038-target-food-environment.md](../../docs/updates/v038-target-food-environment.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v039-experiment-constructor.md](../../docs/updates/v039-experiment-constructor.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v039-factor-editor.md](../../docs/updates/v039-factor-editor.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v039-shared-food-seed.md](../../docs/updates/v039-shared-food-seed.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v040-experiment-organization.md](../../docs/updates/v040-experiment-organization.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v041-statistics-bands-export.md](../../docs/updates/v041-statistics-bands-export.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v042-paired-comparison.md](../../docs/updates/v042-paired-comparison.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v043-difference-charts.md](../../docs/updates/v043-difference-charts.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v044-genome-experiments.md](../../docs/updates/v044-genome-experiments.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v045-compact-experiment-archives.md](../../docs/updates/v045-compact-experiment-archives.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v045-github-publication.md](../../docs/updates/v045-github-publication.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v045-notifications-and-documentation.md](../../docs/updates/v045-notifications-and-documentation.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v045-project-navigation.md](../../docs/updates/v045-project-navigation.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v046-digestion-experiments.md](../../docs/updates/v046-digestion-experiments.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v047-analysis-builder.md](../../docs/updates/v047-analysis-builder.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v048-chart-catalogue.md](../../docs/updates/v048-chart-catalogue.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v049-chart-settings.md](../../docs/updates/v049-chart-settings.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v050-workspace.md](../../docs/updates/v050-workspace.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v051-ui-and-statistics-cache.md](../../docs/updates/v051-ui-and-statistics-cache.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v052-local-chart-updates.md](../../docs/updates/v052-local-chart-updates.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v052-no-chart-captions.md](../../docs/updates/v052-no-chart-captions.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v052-summary-without-notes.md](../../docs/updates/v052-summary-without-notes.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v053-brain-viewer.md](../../docs/updates/v053-brain-viewer.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v053-initial-structure.md](../../docs/updates/v053-initial-structure.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v053-live-statistics.md](../../docs/updates/v053-live-statistics.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v053-structural-brain.md](../../docs/updates/v053-structural-brain.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-actions.md](../../docs/updates/v054-guide-actions.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-analysis.md](../../docs/updates/v054-guide-analysis.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-audit.md](../../docs/updates/v054-guide-audit.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-energy.md](../../docs/updates/v054-guide-energy.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-environment.md](../../docs/updates/v054-guide-environment.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-evolution.md](../../docs/updates/v054-guide-evolution.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-experiments.md](../../docs/updates/v054-guide-experiments.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-food-path.md](../../docs/updates/v054-guide-food-path.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-food-sources.md](../../docs/updates/v054-guide-food-sources.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-geography.md](../../docs/updates/v054-guide-geography.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-inventory.md](../../docs/updates/v054-guide-inventory.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-mind.md](../../docs/updates/v054-guide-mind.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-navigation.md](../../docs/updates/v054-guide-navigation.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-parameters.md](../../docs/updates/v054-guide-parameters.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-readability.md](../../docs/updates/v054-guide-readability.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-series-plan.md](../../docs/updates/v054-guide-series-plan.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-system.md](../../docs/updates/v054-guide-system.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-guide-time.md](../../docs/updates/v054-guide-time.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-numeric-rules.md](../../docs/updates/v054-numeric-rules.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/updates/v054-project-guide.md](../../docs/updates/v054-project-guide.md) | историческое | протокол выпуска; действующее поведение сверять по главе и коду, `development` |
| [docs/verification.md](../../docs/verification.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/work/current.md](../../docs/work/current.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/workflows/context.md](../../docs/workflows/context.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/workflows/guide-authoring.md](../../docs/workflows/guide-authoring.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/workflows/local.md](../../docs/workflows/local.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [docs/world-save-options.md](../../docs/world-save-options.md) | служебное | карта, контракт, инструкция или план; статус указан внутри документа, `development` |
| [game.html](../../game.html) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [package.json](../../package.json) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [society_simulation_plan.md](../../society_simulation_plan.md) | служебное | корневая инструкция, запуск либо конфигурация поставки; `development` |
| [tests/activity-perception.test.mjs](../../tests/activity-perception.test.mjs) | служебное | проверка / фикстура; `geography` |
| [tests/analysis-builder047.test.mjs](../../tests/analysis-builder047.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/brain-diagram0531.test.mjs](../../tests/brain-diagram0531.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/brain-initialization0532.test.mjs](../../tests/brain-initialization0532.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/chart-catalogue048.test.mjs](../../tests/chart-catalogue048.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/chart-context049.test.mjs](../../tests/chart-context049.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/cognition-worker-adapter.mjs](../../tests/cognition-worker-adapter.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/cognition.test.mjs](../../tests/cognition.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/configuration-benchmark.test.mjs](../../tests/configuration-benchmark.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/consolidation.test.mjs](../../tests/consolidation.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/digestion-experiments046.test.mjs](../../tests/digestion-experiments046.test.mjs) | служебное | проверка / фикстура; `food` |
| [tests/environment-save.test.mjs](../../tests/environment-save.test.mjs) | служебное | проверка / фикстура; `saves`, `energy`, `limits` |
| [tests/evolution-interface.test.mjs](../../tests/evolution-interface.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/evolution.test.mjs](../../tests/evolution.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/expanded-world.test.mjs](../../tests/expanded-world.test.mjs) | служебное | проверка / фикстура; `geography` |
| [tests/experiment-constructor.test.mjs](../../tests/experiment-constructor.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/experiment-factors.test.mjs](../../tests/experiment-factors.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/experiment-statistics.test.mjs](../../tests/experiment-statistics.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/experiment-storage045.test.mjs](../../tests/experiment-storage045.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/experiment-ui.test.mjs](../../tests/experiment-ui.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/fixtures/numeric-rules0548.json](../../tests/fixtures/numeric-rules0548.json) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/food-layout.test.mjs](../../tests/food-layout.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/genome-experiments044.test.mjs](../../tests/genome-experiments044.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/guide-actions0546.test.mjs](../../tests/guide-actions0546.test.mjs) | служебное | проверка / фикстура; `actions` |
| [tests/guide-analysis05415.test.mjs](../../tests/guide-analysis05415.test.mjs) | служебное | проверка / фикстура; `estimates`, `groups`, `charts`, `files` |
| [tests/guide-audit05417.test.mjs](../../tests/guide-audit05417.test.mjs) | служебное | проверка / фикстура; `saves`, `brain`, `checks`, `limits` |
| [tests/guide-energy0547.test.mjs](../../tests/guide-energy0547.test.mjs) | служебное | проверка / фикстура; `energy` |
| [tests/guide-environment05411.test.mjs](../../tests/guide-environment05411.test.mjs) | служебное | проверка / фикстура; `environment` |
| [tests/guide-evolution05413.test.mjs](../../tests/guide-evolution05413.test.mjs) | служебное | проверка / фикстура; `learning`, `brain-cost`, `structure-evolution`, `genome-analysis`, `selection`, `genome` |
| [tests/guide-experiments05414.test.mjs](../../tests/guide-experiments05414.test.mjs) | служебное | проверка / фикстура; `experiment-design`, `experiment-attempts`, `experiment-runs`, `life-data`, `periods` |
| [tests/guide-food0549.test.mjs](../../tests/guide-food0549.test.mjs) | служебное | проверка / фикстура; `food`, `deposits` |
| [tests/guide-geography0545.test.mjs](../../tests/guide-geography0545.test.mjs) | служебное | проверка / фикстура; `geography` |
| [tests/guide-mind05412.test.mjs](../../tests/guide-mind05412.test.mjs) | служебное | проверка / фикстура; `observation`, `feelings`, `brain-structure`, `choice`, `memory` |
| [tests/guide-parameters0543.test.mjs](../../tests/guide-parameters0543.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/guide-reader0542.test.mjs](../../tests/guide-reader0542.test.mjs) | служебное | проверка / фикстура; `intro` |
| [tests/guide-sources05410.test.mjs](../../tests/guide-sources05410.test.mjs) | служебное | проверка / фикстура; `food` |
| [tests/guide-system05416.test.mjs](../../tests/guide-system05416.test.mjs) | служебное | проверка / фикстура; `world`, `research`, `runtime`, `performance`, `development` |
| [tests/guide-time0544.test.mjs](../../tests/guide-time0544.test.mjs) | служебное | проверка / фикстура; `time` |
| [tests/help-ui.test.mjs](../../tests/help-ui.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/history-ui.test.mjs](../../tests/history-ui.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/history-window.test.mjs](../../tests/history-window.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/interface.test.mjs](../../tests/interface.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/interface0361.test.mjs](../../tests/interface0361.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/island-mobility.test.mjs](../../tests/island-mobility.test.mjs) | служебное | проверка / фикстура; `environment` |
| [tests/js-syntax.test.mjs](../../tests/js-syntax.test.mjs) | служебное | проверка / фикстура; `checks` |
| [tests/life-cohorts.test.mjs](../../tests/life-cohorts.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/live-computations.test.mjs](../../tests/live-computations.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/live-history.test.mjs](../../tests/live-history.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/live-statistics0533.test.mjs](../../tests/live-statistics0533.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/memory-genes.test.mjs](../../tests/memory-genes.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/navigation.test.mjs](../../tests/navigation.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/node-cognition-worker.mjs](../../tests/node-cognition-worker.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/numeric-rules0548.test.mjs](../../tests/numeric-rules0548.test.mjs) | служебное | проверка / фикстура; `numbers` |
| [tests/pair-statistics042.test.mjs](../../tests/pair-statistics042.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/parallel-benchmark.test.mjs](../../tests/parallel-benchmark.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/parallel-world.test.mjs](../../tests/parallel-world.test.mjs) | служебное | проверка / фикстура; `time` |
| [tests/performance-detail.test.mjs](../../tests/performance-detail.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/project-guide054.test.mjs](../../tests/project-guide054.test.mjs) | служебное | проверка / фикстура; `intro` |
| [tests/routing.test.mjs](../../tests/routing.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/simulation.test.mjs](../../tests/simulation.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/statistical-ui041.test.mjs](../../tests/statistical-ui041.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/statistics043.test.mjs](../../tests/statistics043.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/structural-brain053.test.mjs](../../tests/structural-brain053.test.mjs) | служебное | проверка / фикстура; `intro`, `brain`, `learning`, `brain-cost`, `structure-evolution`, `genome-analysis`, `selection`, `genome` |
| [tests/target-environment.test.mjs](../../tests/target-environment.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/temporal.test.mjs](../../tests/temporal.test.mjs) | служебное | проверка / фикстура; `time`, `energy`, `actions`, `learning`, `brain-cost`, `structure-evolution`, `genome-analysis`, `selection`, `genome`, `deposits` |
| [tests/ui-text-controls.test.mjs](../../tests/ui-text-controls.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/ui051.test.mjs](../../tests/ui051.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/ui052.test.mjs](../../tests/ui052.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/update037.test.mjs](../../tests/update037.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/worker-count-benchmark.test.mjs](../../tests/worker-count-benchmark.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/worker-count-ui.test.mjs](../../tests/worker-count-ui.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/worker-timing.test.mjs](../../tests/worker-timing.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/workspace050.test.mjs](../../tests/workspace050.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/world-ui.test.mjs](../../tests/world-ui.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/world-worker-adapter.mjs](../../tests/world-worker-adapter.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tests/world-worker.test.mjs](../../tests/world-worker.test.mjs) | служебное | проверка / фикстура; тематический запуск через verify-local; назначение по проверяемому модулю, не новая механика |
| [tools/analyze-genomes.mjs](../../tools/analyze-genomes.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/build-offline.mjs](../../tools/build-offline.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-agent-context.py](../../tools/check-agent-context.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-benchmark-snapshots.py](../../tools/check-benchmark-snapshots.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-browser-wiring.py](../../tools/check-browser-wiring.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-input-performance.mjs](../../tools/check-input-performance.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-js-syntax.mjs](../../tools/check-js-syntax.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-mechanisms.mjs](../../tools/check-mechanisms.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-profile-overhead.mjs](../../tools/check-profile-overhead.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-project-docs.py](../../tools/check-project-docs.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/check-startup.mjs](../../tools/check-startup.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/compare-learning.mjs](../../tools/compare-learning.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/export-source.py](../../tools/export-source.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/freeze-benchmark.py](../../tools/freeze-benchmark.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/guide_inventory.py](../../tools/guide_inventory.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/measure-parallel-033.mjs](../../tools/measure-parallel-033.mjs) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/package-github.py](../../tools/package-github.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [tools/verify-local.py](../../tools/verify-local.py) | служебное | локальная проверка/анализ/сборка; `development`, для измерений также `performance` |
| [docs/updates/v054-test-baselines.md](../../docs/updates/v054-test-baselines.md) | историческое | Технический протокол эталонов проверок; `performance`, `development` |
| [docs/updates/v054-guide-panes.md](../../docs/updates/v054-guide-panes.md) | историческое | Отдельная прокрутка и компактное дерево; `development` |
