/** Содержательная сверка пакета C, не всего кода связанных файлов. */
export const GUIDE_EVOLUTION_TOPICS={
 "learning": {
  "reviewedVersion": "0.54.13",
  "keywords": [
   "личное обучение",
   "Expected SARSA",
   "градиент",
   "след",
   "дисконт",
   "поправки",
   "забывание",
   "подкрепление"
  ],
  "related": [
   "feelings",
   "choice",
   "brain-cost",
   "genome"
  ],
  "sources": [
   {
    "file": "set-brain-engine.js",
    "symbols": [
     "createSetBrainEngine"
    ],
    "purpose": "Личные веса, ограничение ошибки и градиентный след."
   },
   {
    "file": "temporal-world.js",
    "symbols": [
     "prepareTemporalDecision",
     "commitTemporalBrain",
     "accrueTemporalReward"
    ],
    "purpose": "Живой переход, время и ожидаемое продолжение."
   },
   {
    "file": "neural-brain.js",
    "symbols": [
     "createNeuralBrain"
    ],
    "purpose": "Личное состояние нового мозга."
   },
   {
    "file": "guide-learning-text.js",
    "symbols": [],
    "purpose": "Глава обучения и стоимости."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-evolution05413.test.mjs",
    "purpose": "Счётчик, бюджет, анализ наследуемой основы и паспорта."
   },
   {
    "file": "tests/structural-brain053.test.mjs",
    "purpose": "Градиент, мутации, стоимость и отсутствие наследования личных поправок."
   },
   {
    "file": "tests/temporal.test.mjs",
    "purpose": "Живой переход, обучение и завершение родов."
   }
  ]
 },
 "brain-cost": {
  "reviewedVersion": "0.54.13",
  "keywords": [
   "стоимость мозга",
   "цена",
   "вычисления",
   "операции",
   "энергия",
   "вызов",
   "дефицит"
  ],
  "related": [
   "learning",
   "energy",
   "choice",
   "research"
  ],
  "sources": [
   {
    "file": "brain-cost.js",
    "symbols": [
     "brainCostProfile",
     "operationCounts",
     "decisionCharge",
     "learningCharge"
    ],
    "purpose": "Счётчик, эталон и разделение фаз."
   },
   {
    "file": "temporal-world.js",
    "symbols": [
     "acceptTemporalChoice"
    ],
    "purpose": "Оплата вычислений до начала действия."
   },
   {
    "file": "life-cohorts.js",
    "symbols": [],
    "purpose": "Средняя запрошенная стоимость на вызов."
   },
   {
    "file": "guide-learning-text.js",
    "symbols": [
     "guideReferenceOperations"
    ],
    "purpose": "Учебный эталонный счётчик."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-evolution05413.test.mjs",
    "purpose": "Счётчик, бюджет, анализ наследуемой основы и паспорта."
   },
   {
    "file": "tests/structural-brain053.test.mjs",
    "purpose": "Градиент, мутации, стоимость и отсутствие наследования личных поправок."
   },
   {
    "file": "tests/temporal.test.mjs",
    "purpose": "Живой переход, обучение и завершение родов."
   }
  ]
 },
 "selection": {
  "reviewedVersion": "0.54.13",
  "keywords": [
   "родитель",
   "ребёнок",
   "роды",
   "размножение",
   "зрелость",
   "мягкий лимит",
   "родословная"
  ],
  "related": [
   "genome",
   "structure-evolution",
   "actions",
   "research"
  ],
  "sources": [
   {
    "file": "temporal-world.js",
    "symbols": [
     "temporalBirthAvailability",
     "complete"
    ],
    "purpose": "Разные условия старта и завершения."
   },
   {
    "file": "evolution.js",
    "symbols": [
     "addAgent"
    ],
    "purpose": "Ресурсы, место и новое личное состояние ребёнка."
   },
   {
    "file": "reproduction.js",
    "symbols": [
     "reproductionProfile"
    ],
    "purpose": "Пороги и интервалы."
   },
   {
    "file": "guide-genetics-text.js",
    "symbols": [],
    "purpose": "Роды, наследование и структура."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-evolution05413.test.mjs",
    "purpose": "Счётчик, бюджет, анализ наследуемой основы и паспорта."
   },
   {
    "file": "tests/structural-brain053.test.mjs",
    "purpose": "Градиент, мутации, стоимость и отсутствие наследования личных поправок."
   },
   {
    "file": "tests/temporal.test.mjs",
    "purpose": "Живой переход, обучение и завершение родов."
   }
  ]
 },
 "genome": {
  "reviewedVersion": "0.54.13",
  "keywords": [
   "ген",
   "геном",
   "мутация",
   "наследование",
   "основатель",
   "регулятор",
   "версия"
  ],
  "related": [
   "structure-evolution",
   "learning",
   "genome-analysis",
   "selection"
  ],
  "sources": [
   {
    "file": "genome.js",
    "symbols": [
     "genomeMetadata",
     "mutateGenome",
     "validateGenomeFile"
    ],
    "purpose": "Версии, обычные мутации и файлы."
   },
   {
    "file": "mutation-parameters.js",
    "symbols": [
     "mutationProfile",
     "mutateRegulator"
    ],
    "purpose": "Логарифмические регуляторы изменчивости."
   },
   {
    "file": "founder-senses.js",
    "symbols": [
     "validateFounderSenses",
     "compileFounderSenses"
    ],
    "purpose": "Замена выбранных чувствительностей основателей."
   },
   {
    "file": "guide-genetics-text.js",
    "symbols": [],
    "purpose": "Семейства генов и личное состояние."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-evolution05413.test.mjs",
    "purpose": "Счётчик, бюджет, анализ наследуемой основы и паспорта."
   },
   {
    "file": "tests/structural-brain053.test.mjs",
    "purpose": "Градиент, мутации, стоимость и отсутствие наследования личных поправок."
   },
   {
    "file": "tests/temporal.test.mjs",
    "purpose": "Живой переход, обучение и завершение родов."
   }
  ]
 },
 "structure-evolution": {
  "reviewedVersion": "0.54.13",
  "keywords": [
   "структурная мутация",
   "слой",
   "нейрон",
   "связь",
   "DAG",
   "начальная связность",
   "процент"
  ],
  "related": [
   "brain-structure",
   "brain-cost",
   "genome",
   "genome-analysis"
  ],
  "sources": [
   {
    "file": "structural-brain.js",
    "symbols": [
     "randomStructuralGenome",
     "structuralProbability",
     "mutateStructure",
     "compileStructure"
    ],
    "purpose": "Изменяемый DAG и структурное событие."
   },
   {
    "file": "brain-initialization.js",
    "symbols": [
     "initialLayerCounts",
     "initialConnectionBudget",
     "initialEdges"
    ],
    "purpose": "Таблица и база процента связей."
   },
   {
    "file": "brain-structure-rules.js",
    "symbols": [],
    "purpose": "Пределы и начальные вероятности."
   },
   {
    "file": "guide-genetics-text.js",
    "symbols": [
     "guideTopologyExample"
    ],
    "purpose": "Учебный расчёт бюджета."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-evolution05413.test.mjs",
    "purpose": "Счётчик, бюджет, анализ наследуемой основы и паспорта."
   },
   {
    "file": "tests/structural-brain053.test.mjs",
    "purpose": "Градиент, мутации, стоимость и отсутствие наследования личных поправок."
   },
   {
    "file": "tests/temporal.test.mjs",
    "purpose": "Живой переход, обучение и завершение родов."
   }
  ]
 },
 "genome-analysis": {
  "reviewedVersion": "0.54.13",
  "keywords": [
   "анализ генома",
   "схема мозга",
   "масштаб",
   "навигация",
   "вес",
   "экспорт",
   "JSON",
   "Markdown"
  ],
  "related": [
   "genome",
   "structure-evolution",
   "feelings",
   "research"
  ],
  "sources": [
   {
    "file": "genome-analysis.js",
    "symbols": [
     "parseGenomeText",
     "analyzeGenome",
     "makeGenomeAnalysisReport"
    ],
    "purpose": "Валидация, свойства и сравнение."
   },
   {
    "file": "genome-analysis-ui.js",
    "symbols": [
     "installGenomeAnalysis"
    ],
    "purpose": "Слоты A/B и экспорт отчёта."
   },
   {
    "file": "brain-diagram-ui.js",
    "symbols": [
     "renderBrainDiagram"
    ],
    "purpose": "Выбор и показ структуры жителя."
   },
   {
    "file": "brain-diagram-viewport.js",
    "symbols": [],
    "purpose": "Камера и попадание по элементам."
   },
   {
    "file": "tools/analyze-genomes.mjs",
    "symbols": [],
    "purpose": "Разбор без симуляции."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-evolution05413.test.mjs",
    "purpose": "Счётчик, бюджет, анализ наследуемой основы и паспорта."
   },
   {
    "file": "tests/structural-brain053.test.mjs",
    "purpose": "Градиент, мутации, стоимость и отсутствие наследования личных поправок."
   },
   {
    "file": "tests/temporal.test.mjs",
    "purpose": "Живой переход, обучение и завершение родов."
   }
  ]
 }
};
