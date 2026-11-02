# Физиология, питание и размножение 0.57

Маршрут текущей модели v18. [Контракт P00–P14](../next-feeding-system.md), [точная спецификация](../specifications/physiology-2026-11-02.md), [механики](../mechanics-reference.md).

| Задача | Владелец | Проверка |
| --- | --- | --- |
| Параметры мира, гены, единицы | physiology-settings.js, body-physiology.js | physiology057 |
| Численная мутация A/r | numeric-mutation.js, dual-brain-genome.js | numeric-mutation057 |
| Желудок, ресурсы | digestion.js, food-resources.js | digestion057, food-resources057 |
| Бюджет, плод, роды | physiology-budget.js, pregnancy.js | budget-pregnancy057 |
| Фазы, атаки, смерть | physiology-world.js, physiology-actions.js | physiology-world057, physiology-integration057 |
| Входы и владельцы мозгов | physiology-inputs.js, physiology-cognition.js | physiology-parallel057 |
| Полный мир | physiology-save.js, world-runtime.js | physiology-save057 |
| Метрики, калькулятор, настройки | physiology-metrics.js, physiology-preview.js, physiology-settings-ui.js | physiology-integration057, world-ui |
| Пособие и числовые привязки | guide-physiology-text.js, guide-physiology-topics.js, guide-parameters.js | guide-*, check-project-docs.py |

Имена JS относятся к dist; тесты — к tests/*.test.mjs. Исторические action-timing/energy-budget/temporal-world остаются нужны прежним форматам и общим переходам обучения. Не переносить их постоянные ёмкости в текущую физику.
