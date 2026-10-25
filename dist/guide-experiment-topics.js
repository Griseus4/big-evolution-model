/** Темы опытов и первичных наблюдений, P15–P19. */
export const GUIDE_EXPERIMENT_TOPICS={
 "experiment-design": {
  "reviewedVersion": "0.54.14",
  "keywords": [
   "Как",
   "составить",
   "план",
   "опыта",
   "experiment-design",
   "опыт",
   "показатель",
   "период",
   "данные"
  ],
  "related": [
   "experiment-attempts",
   "experiment-runs",
   "life-data",
   "periods",
   "research"
  ],
  "sources": [
   {
    "file": "experiment-plan.js",
    "symbols": [
     "validatePlan",
     "validateWorldOptions"
    ],
    "purpose": "Проверка плана и настроек вариантов."
   },
   {
    "file": "experiment-fields.js",
    "symbols": [
     "factorDesign"
    ],
    "purpose": "Декартовы сочетания, типы и границы."
   },
   {
    "file": "experiment-preferences.js",
    "symbols": [
     "experimentPreferences"
    ],
    "purpose": "Черновик и личный стандарт."
   },
   {
    "file": "experiment-genomes.js",
    "symbols": [],
    "purpose": "Основы геномов."
   },
   {
    "file": "guide-experiments-text.js",
    "symbols": [],
    "purpose": "Глава и рабочие учебные примеры пакета D."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-experiments05414.test.mjs",
    "purpose": "План, исходы, неизвестное дожитие и нули после вымирания."
   }
  ]
 },
 "experiment-attempts": {
  "reviewedVersion": "0.54.14",
  "keywords": [
   "Чем",
   "отличаются",
   "повтор",
   "и",
   "попытка",
   "experiment-attempts",
   "опыт",
   "показатель",
   "период",
   "данные",
   "seed",
   "сид",
   "вымирание",
   "перезапуск"
  ],
  "related": [
   "experiment-design",
   "experiment-runs",
   "life-data",
   "periods",
   "research"
  ],
  "sources": [
   {
    "file": "experiment-plan.js",
    "symbols": [
     "seedMatrix",
     "selectAttempt"
    ],
    "purpose": "Матрица seeds и выбор итога."
   },
   {
    "file": "experiment-series.js",
    "symbols": [],
    "purpose": "Перезапуски и сохранение попыток."
   },
   {
    "file": "experiment-outcomes.js",
    "symbols": [
     "experimentOutcomes"
    ],
    "purpose": "Два знаменателя вымирания."
   },
   {
    "file": "experiment-statistics.js",
    "symbols": [
     "experimentWorlds"
    ],
    "purpose": "Выбранные нормальные итоги и исходный pairId."
   },
   {
    "file": "guide-experiments-text.js",
    "symbols": [],
    "purpose": "Глава и рабочие учебные примеры пакета D."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-experiments05414.test.mjs",
    "purpose": "План, исходы, неизвестное дожитие и нули после вымирания."
   }
  ]
 },
 "experiment-runs": {
  "reviewedVersion": "0.54.14",
  "keywords": [
   "Как",
   "выполняется",
   "и",
   "останавливается",
   "опыт",
   "experiment-runs",
   "опыт",
   "показатель",
   "период",
   "данные"
  ],
  "related": [
   "experiment-design",
   "experiment-attempts",
   "life-data",
   "periods",
   "research"
  ],
  "sources": [
   {
    "file": "experiment-series.js",
    "symbols": [],
    "purpose": "Очередь, бюджет и остановки."
   },
   {
    "file": "experiment-execution.js",
    "symbols": [],
    "purpose": "Смена пула до отказа от старого."
   },
   {
    "file": "experiment-ui.js",
    "symbols": [
     "installExperimentUI"
    ],
    "purpose": "Пауза основного мира и возврат прежнего состояния."
   },
   {
    "file": "experiment-runner.js",
    "symbols": [],
    "purpose": "Промежуточные и финальные данные исполнителя."
   },
   {
    "file": "guide-experiments-text.js",
    "symbols": [],
    "purpose": "Глава и рабочие учебные примеры пакета D."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-experiments05414.test.mjs",
    "purpose": "План, исходы, неизвестное дожитие и нули после вымирания."
   }
  ]
 },
 "life-data": {
  "reviewedVersion": "0.54.14",
  "keywords": [
   "Какие",
   "данные",
   "записываются",
   "о",
   "жизни",
   "life-data",
   "опыт",
   "показатель",
   "период",
   "данные",
   "возраст рождения второго ребёнка",
   "наблюдение",
   "знаменатель",
   "метрика",
   "число детей"
  ],
  "related": [
   "experiment-design",
   "experiment-attempts",
   "experiment-runs",
   "periods",
   "research"
  ],
  "sources": [
   {
    "file": "life-history.js",
    "symbols": [
     "lifeRow"
    ],
    "purpose": "Строка наблюдения и накопительные сводки."
   },
   {
    "file": "life-observations.js",
    "symbols": [
     "describeLifeObservations"
    ],
    "purpose": "Инвентарь, стоимость и события."
   },
   {
    "file": "heritable-statistics.js",
    "symbols": [
     "captureHeritable"
    ],
    "purpose": "Наследуемый снимок рождения."
   },
   {
    "file": "life-cohorts.js",
    "symbols": [
     "lifeMetric"
    ],
    "purpose": "Определения стандартных показателей."
   },
   {
    "file": "analysis-builder-core.js",
    "symbols": [],
    "purpose": "Восстановление возраста n-го ребёнка по полной связи."
   },
   {
    "file": "guide-experiments-text.js",
    "symbols": [],
    "purpose": "Глава и рабочие учебные примеры пакета D."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-experiments05414.test.mjs",
    "purpose": "План, исходы, неизвестное дожитие и нули после вымирания."
   }
  ]
 },
 "periods": {
  "reviewedVersion": "0.54.14",
  "keywords": [
   "Как",
   "читать",
   "периоды",
   "и",
   "дожитие",
   "periods",
   "опыт",
   "показатель",
   "период",
   "данные",
   "когорта",
   "цензурирование",
   "дожитие",
   "половина интервала",
   "численность населения"
  ],
  "related": [
   "experiment-design",
   "experiment-attempts",
   "experiment-runs",
   "life-data",
   "research"
  ],
  "sources": [
   {
    "file": "life-cohorts.js",
    "symbols": [
     "aggregateLifeCohorts"
    ],
    "purpose": "Когорты, известность исходов и режимы жизни."
   },
   {
    "file": "survival-curve.js",
    "symbols": [
     "survivalCurve",
     "survivalAtAge"
    ],
    "purpose": "Границы неизвестных исходов по возрасту."
   },
   {
    "file": "population-statistics.js",
    "symbols": [
     "populationTimeline",
     "populationCohorts"
    ],
    "purpose": "Численность на целых Т и нули после вымирания."
   },
   {
    "file": "history-window.js",
    "symbols": [
     "windowLifeCohorts"
    ],
    "purpose": "Период и краевые корзины."
   },
   {
    "file": "food-production-history.js",
    "symbols": [
     "productionCohorts"
    ],
    "purpose": "Усреднение выработки по времени."
   },
   {
    "file": "guide-experiments-text.js",
    "symbols": [],
    "purpose": "Глава и рабочие учебные примеры пакета D."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-experiments05414.test.mjs",
    "purpose": "План, исходы, неизвестное дожитие и нули после вымирания."
   }
  ]
 }
};
