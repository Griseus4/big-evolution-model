export const GUIDE_SYSTEM_TOPICS={
 "runtime": {
  "reviewedVersion": "0.56.2",
  "keywords": [
   "runtime",
   "исполнение",
   "интерфейс",
   "производительность",
   "разработка",
   "кэш",
   "обновление",
   "плавное движение",
   "интерполяция",
   "маршрут",
   "кадры",
   "кэш карты",
   "медленное движение",
   "пауза",
   "прерывание перемещения"
  ],
  "related": [
   "performance",
   "development",
   "research",
   "world",
   "files"
  ],
  "sources": [
   {
    "file": "world-motion.js",
    "symbols": [
     "MOTION_RULES",
     "MotionCapture",
     "MotionPlayer"
    ],
    "purpose": "Подтверждённые маршруты, пределы визуального воспроизведения и выбор точки."
   },
   {
    "file": "world-map-layers.js",
    "symbols": [
     "WorldMapLayers"
    ],
    "purpose": "Отдельные Canvas-кэши рельефа, пищи и наблюдателя."
   },
   {
    "file": "world-runtime.js",
    "symbols": [
     "pulse"
    ],
    "purpose": "Планирование, команды, согласованные снимки и смена пула."
   },
   {
    "file": "parallel-world.js",
    "symbols": [
     "cognition"
    ],
    "purpose": "Владельцы и барьеры."
   },
   {
    "file": "world-substeps.js",
    "symbols": [
     "parallelSubstep"
    ],
    "purpose": "Один физический подшаг."
   },
   {
    "file": "world-client.js",
    "symbols": [
     "receive"
    ],
    "purpose": "Команды, эпохи и ACK."
   },
   {
    "file": "cognition-owner.js",
    "symbols": [
     "evaluate"
    ],
    "purpose": "Личная память и подтверждение обучения."
   },
   {
    "file": "world-view.js",
    "symbols": [
     "worldPresentation"
    ],
    "purpose": "Проекция наблюдателя."
   },
   {
    "file": "guide-system-text.js",
    "symbols": [],
    "purpose": "Глава системного пакета."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-system05416.test.mjs",
    "purpose": "Связи, источники и полный индекс статей."
   },
   {
    "file": "tests/world-motion0561.test.mjs",
    "symbols": [],
    "purpose": "Углы маршрута, разрывы, кэши, пределы, физика/обучение/RNG до 1000 жителей."
   }
  ]
 },
 "performance": {
  "reviewedVersion": "0.54.16",
  "keywords": [
   "performance",
   "исполнение",
   "интерфейс",
   "производительность",
   "разработка",
   "кэш",
   "обновление"
  ],
  "related": [
   "runtime",
   "development",
   "research",
   "world",
   "files"
  ],
  "sources": [
   {
    "file": "performance-ui.js",
    "symbols": [
     "installPerformancePanel"
    ],
    "purpose": "Запись и чтение профиля."
   },
   {
    "file": "performance-profiler.js",
    "symbols": [],
    "purpose": "Лёгкое и подробное измерение."
   },
   {
    "file": "worker-timing.js",
    "symbols": [],
    "purpose": "Очереди, завершённые задачи и ожидание."
   },
   {
    "file": "benchmark-versions.js",
    "symbols": [],
    "purpose": "Серия, версии и порядок повторов."
   },
   {
    "file": "benchmark-fixtures.js",
    "symbols": [],
    "purpose": "Нагрузки и suiteId."
   },
   {
    "file": "configuration-benchmark-runner.js",
    "symbols": [
     "runConfigurationBenchmarks"
    ],
    "purpose": "Сравнение версий и вычислителей."
   },
   {
    "file": "browser-checks.js",
    "symbols": [
     "runBrowserChecks"
    ],
    "purpose": "Реестр проверок механизмов."
   },
   {
    "file": "benchmark-state.js",
    "symbols": [
     "captureBenchmarkState",
     "restoreBenchmarkState"
    ],
    "purpose": "Подготовка и контрольные отпечатки."
   },
   {
    "file": "guide-system-text.js",
    "symbols": [],
    "purpose": "Глава системного пакета."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-system05416.test.mjs",
    "purpose": "Связи, источники и полный индекс статей."
   }
  ]
 },
 "development": {
  "reviewedVersion": "0.56.2",
  "keywords": [
   "development",
   "исполнение",
   "интерфейс",
   "производительность",
   "разработка",
   "кэш",
   "обновление"
  ],
  "related": [
   "runtime",
   "performance",
   "research",
   "world",
   "files"
  ],
  "sources": [
   {
    "file": "tools/open-game.py",
    "symbols": [
     "main",
     "existing_game",
     "game_url",
     "GameRequestHandler"
    ],
    "purpose": "Локальный HTTP-запуск текущей игры, браузер и повторное использование своего сервера."
   },
   {
    "file": "evolution-app.js",
    "symbols": [],
    "purpose": "Текущая точка входа."
   },
   {
    "file": "source-viewer.js",
    "symbols": [],
    "purpose": "Чтение поставленных исходников."
   },
   {
    "file": "guide-parameters.js",
    "symbols": [],
    "purpose": "Контекст действующих параметров."
   },
   {
    "file": "project-guide-ui.js",
    "symbols": [],
    "purpose": "Дерево, ссылки и выжимки."
   },
   {
    "file": "tools/export-source.py",
    "symbols": [],
    "purpose": "Производная поставка."
   },
   {
    "file": "tools/verify-local.py",
    "symbols": [],
    "purpose": "Выбор локальных проверок."
   },
   {
    "file": "tools/guide_inventory.py",
    "symbols": [],
    "purpose": "Инвентарь без смыслового аудита."
   },
   {
    "file": ".github/workflows/pages.yml",
    "symbols": [],
    "purpose": "Публикация dist."
   },
   {
    "file": "guide-system-text.js",
    "symbols": [],
    "purpose": "Глава системного пакета."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-system05416.test.mjs",
    "purpose": "Связи, источники и полный индекс статей."
   }
  ]
 },
 "world": {
  "reviewedVersion": "0.54.16",
  "keywords": [
   "world",
   "исполнение",
   "интерфейс",
   "производительность",
   "разработка",
   "кэш",
   "обновление"
  ],
  "related": [
   "runtime",
   "performance",
   "development",
   "research",
   "files"
  ],
  "sources": [
   {
    "file": "evolution-app.js",
    "symbols": [],
    "purpose": "Карта и панели."
   },
   {
    "file": "sidebar.js",
    "symbols": [
     "installSidebar"
    ],
    "purpose": "Вкладки наблюдателя."
   },
   {
    "file": "workspace-ui.js",
    "symbols": [],
    "purpose": "Постоянные формы."
   },
   {
    "file": "world-edit.js",
    "symbols": [],
    "purpose": "Ручное вмешательство."
   },
   {
    "file": "help.js",
    "symbols": [
     "installHelp"
    ],
    "purpose": "Подсказки и задержка."
   },
   {
    "file": "transient-status.js",
    "symbols": [
     "transientStatus"
    ],
    "purpose": "Временные подтверждения."
   },
   {
    "file": "guide-system-text.js",
    "symbols": [],
    "purpose": "Глава системного пакета."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-system05416.test.mjs",
    "purpose": "Связи, источники и полный индекс статей."
   }
  ]
 },
 "research": {
  "reviewedVersion": "0.54.16",
  "keywords": [
   "research",
   "исполнение",
   "интерфейс",
   "производительность",
   "разработка",
   "кэш",
   "обновление"
  ],
  "related": [
   "runtime",
   "performance",
   "development",
   "world",
   "files"
  ],
  "sources": [
   {
    "file": "history-ui.js",
    "symbols": [
     "installHistoryUI"
    ],
    "purpose": "Монтаж и порядок обновления."
   },
   {
    "file": "statistics-preparation.js",
    "symbols": [
     "statisticsPreparation"
    ],
    "purpose": "Низкоприоритетная очередь на стабильных данных."
   },
   {
    "file": "retained-results.js",
    "symbols": [
     "retainedResults"
    ],
    "purpose": "Ограниченный кэш."
   },
   {
    "file": "chart-update-state.js",
    "symbols": [
     "chartUpdateState"
    ],
    "purpose": "Сохранение готового кадра."
   },
   {
    "file": "deferred-control.js",
    "symbols": [
     "deferredControl"
    ],
    "purpose": "Объединение ввода."
   },
   {
    "file": "lab-tabs.js",
    "symbols": [],
    "purpose": "Условие фоновой подготовки."
   },
   {
    "file": "guide-system-text.js",
    "symbols": [],
    "purpose": "Глава системного пакета."
   }
  ],
  "checks": [
   {
    "file": "tests/guide-system05416.test.mjs",
    "purpose": "Связи, источники и полный индекс статей."
   }
  ]
 }
};
