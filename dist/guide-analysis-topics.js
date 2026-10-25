export const GUIDE_ANALYSIS_TOPICS={
 "estimates": {
  "reviewedVersion": "0.54.15",
  "keywords": [
   "Как",
   "устроены",
   "веса",
   "и",
   "доверительные",
   "интервалы",
   "estimates",
   "статистика",
   "анализ"
  ],
  "related": [
   "groups",
   "charts",
   "files",
   "periods",
   "life-data"
  ],
  "sources": [
   {
    "file": "statistics-estimates.js",
    "symbols": [
     "createWorldEstimator",
     "estimateWorlds",
     "bootstrapDraws"
    ],
    "purpose": "Веса, медиана и bootstrap."
   },
   {
    "file": "weighted-statistics.js",
    "symbols": [
     "weightedSummary",
     "worldWeights"
    ],
    "purpose": "Взвешенная медиана и равные массы миров."
   },
   {
    "file": "statistical-series.js",
    "symbols": [
     "prepareMetric"
    ],
    "purpose": "Первичные выборки временных и индивидуальных показателей."
   },
   {
    "file": "statistics-format.js",
    "symbols": [
     "formatStatistic"
    ],
    "purpose": "Только округление подписей."
   },
   {
    "file": "guide-analysis-text.js",
    "symbols": [],
    "purpose": "Главы анализа и файлов, рабочий пример весов."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-analysis05415.test.mjs",
    "purpose": "Числа примера, веса, шаблон, единицы и ссылки."
   }
  ]
 },
 "groups": {
  "reviewedVersion": "0.54.15",
  "keywords": [
   "Как",
   "сравнить",
   "группы",
   "и",
   "выбранную",
   "пару",
   "groups",
   "статистика",
   "анализ"
  ],
  "related": [
   "estimates",
   "charts",
   "files",
   "periods",
   "life-data"
  ],
  "sources": [
   {
    "file": "experiment-grouping.js",
    "symbols": [
     "groupedExperimentSources"
    ],
    "purpose": "Состав групп и блоков."
   },
   {
    "file": "statistical-blocks.js",
    "symbols": [
     "selectCompleteBlocks"
    ],
    "purpose": "Полные исходные повторы."
   },
   {
    "file": "pair-statistics.js",
    "symbols": [
     "estimatePair"
    ],
    "purpose": "Парные эффекты и совместная перевыборка."
   },
   {
    "file": "pair-series.js",
    "symbols": [],
    "purpose": "Временные разности."
   },
   {
    "file": "guide-analysis-text.js",
    "symbols": [],
    "purpose": "Главы анализа и файлов, рабочий пример весов."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-analysis05415.test.mjs",
    "purpose": "Числа примера, веса, шаблон, единицы и ссылки."
   }
  ]
 },
 "charts": {
  "reviewedVersion": "0.54.15",
  "keywords": [
   "Как",
   "создать",
   "и",
   "сохранить",
   "свой",
   "график",
   "charts",
   "статистика",
   "анализ"
  ],
  "related": [
   "estimates",
   "groups",
   "files",
   "periods",
   "life-data"
  ],
  "sources": [
   {
    "file": "chart-catalogue.js",
    "symbols": [
     "validateCatalogue"
    ],
    "purpose": "Шаблоны и категории."
   },
   {
    "file": "chart-catalogue-ui.js",
    "symbols": [
     "installChartCatalogue"
    ],
    "purpose": "Фактическая точка монтажа редактора."
   },
   {
    "file": "chart-context.js",
    "symbols": [],
    "purpose": "Закрепления и контекст."
   },
   {
    "file": "analysis-expression.js",
    "symbols": [
     "compileExpression"
    ],
    "purpose": "Безопасный синтаксис."
   },
   {
    "file": "analysis-builder-core.js",
    "symbols": [
     "createAnalysisEngine"
    ],
    "purpose": "Возраст рождения и агрегаторы."
   },
   {
    "file": "guide-analysis-text.js",
    "symbols": [],
    "purpose": "Главы анализа и файлов, рабочий пример весов."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-analysis05415.test.mjs",
    "purpose": "Числа примера, веса, шаблон, единицы и ссылки."
   }
  ]
 },
 "files": {
  "reviewedVersion": "0.54.15",
  "keywords": [
   "Какой",
   "файл",
   "нужен",
   "и",
   "как",
   "устроен",
   "архив",
   "files",
   "статистика",
   "анализ"
  ],
  "related": [
   "estimates",
   "groups",
   "charts",
   "periods",
   "life-data"
  ],
  "sources": [
   {
    "file": "world-save.js",
    "symbols": [
     "saveWorld",
     "loadWorld"
    ],
    "purpose": "Полное состояние и совместимость."
   },
   {
    "file": "world-files-ui.js",
    "symbols": [
     "installWorldFiles"
    ],
    "purpose": "Отмена/проверка перед заменой."
   },
   {
    "file": "experiment-archive.js",
    "symbols": [
     "experimentArchive",
     "openExperimentArchive",
     "loadArchiveWindow",
     "materializeExperiment"
    ],
    "purpose": "Схемы и сжатые блоки."
   },
   {
    "file": "experiment-store.js",
    "symbols": [],
    "purpose": "Транзакции завершённых попыток."
   },
   {
    "file": "state-codec.js",
    "symbols": [],
    "purpose": "Типизированное состояние."
   },
   {
    "file": "guide-analysis-text.js",
    "symbols": [],
    "purpose": "Главы анализа и файлов, рабочий пример весов."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-analysis05415.test.mjs",
    "purpose": "Числа примера, веса, шаблон, единицы и ссылки."
   }
  ]
 }
};

