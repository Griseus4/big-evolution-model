# Пища и изменение среды

[Выбор темы](README.md). Фактические условия мира и цели следующего события — разные данные.

Главы пособия пакета A: [путь порции и выложенные запасы](../../dist/guide-food-text.js), [источники и расписания](../../dist/guide-food-sources-text.js), [автоматика среды](../../dist/guide-environment-text.js). Сверенные обязанности и оставшиеся связи — в [реестре охвата](../guide-plan/coverage.md).

## food-layout
**Задача:** начальные источники, ёмкость, число/размер островков, периоды/разбросы, ручная правка.
**Сейчас:** `validateFoodSettings`/`createFoodTemplate` — [food-settings.js](../../dist/food-settings.js); `placeFoodIslands` — [food-layout.js](../../dist/food-layout.js); расписания — [food-islands.js](../../dist/food-islands.js). Ручной план: `validateWorldFoodChange`/`planWorldFoodChange` — [world-edit.js](../../dist/world-edit.js).
**Граница:** начальная генерация и применение к живому миру различны. Изменение мест источников не должно незаметно создавать/уничтожать лежащую еду. Ручное применение сообщает [автоматике](#environment) о вмешательстве; UI и фактические распределения связаны через [food-distribution.js](../../dist/food-distribution.js).
**Проверка:** [update037.test.mjs](../../tests/update037.test.mjs), [environment-save.test.mjs](../../tests/environment-save.test.mjs), [target-environment.test.mjs](../../tests/target-environment.test.mjs): группы, сохранение запасов, последствия ручного вмешательства. Для различий опытов проверить [план](experiments-and-statistics.md#design).
**История:** [индивидуальные островки 0.27](../updates/v027-food-islands-and-trail.md), [общие поля 0.36.1](../updates/v036-interface-screens.md), [целевая среда 0.38](../updates/v038-target-food-environment.md).
**Дальше:** переход распределений на нормальное, эволюционирующие растения/биомы требуют отдельного решения; существующий [список механик](../future-ideas.md#новые-механики) не разрешает их автоматически.

## environment
**Задача:** целевые число источников/период, коридор выработки, подготовка/колебания, включение и календарь.
**Сейчас:** схема/валидация/выработка — [environment-settings.js](../../dist/environment-settings.js). `advanceEnvironment` в [automatic-environment.js](../../dist/automatic-environment.js) вызывает `prepareEnvironmentPlan` из [environment-plan.js](../../dist/environment-plan.js), затем применяет допустимый план. Вызов идёт из `advanceTemporalBodies` в [temporal-world.js](../../dist/temporal-world.js).
**Граница:** мир хранит календарь, отдельный RNG среды и журнал. Подготовка плана не меняет живые группы; неудача откладывает событие. Внутри плана сначала корректируется число источников, затем при необходимости периоды. Изменение целей не равно ручной замене текущих условий.
**Проверка:** [target-environment.test.mjs](../../tests/target-environment.test.mjs): пять ступеней, обновление целей, приоритет коррекции, границы и сетка времени; [environment-save.test.mjs](../../tests/environment-save.test.mjs): календарь/RNG и ручное вмешательство. Старые названия тестов могут отражать прежний контракт — смотреть текущие assertions.
**История:** [первый сценарий 0.36](../updates/v036-environment-energy-save.md) заменён [контрактом целей](../next-target-environment.md) и [0.38](../updates/v038-target-food-environment.md); старые фиксированные цели/пороги не являются нынешними правилами.
**Дальше:** расширенные сценарии среды — [предложения](../future-ideas.md#новые-механики). При новом параметре проверить [группы](#food-movement), [полный снимок](interface-and-files.md#world-save), поля/отличия [опыта](experiments-and-statistics.md#design) и пищевые ряды [статистики](experiments-and-statistics.md#statistics).

## food-movement
**Задача:** островков долго остаётся мало, дальность переноса, компактность, отдельные кусты.
**Сейчас:** `proposedIslandCount` — [environment-plan.js](../../dist/environment-plan.js); `translateFoodGroup`/`evolveFoodGroups`/`constrainFoodSources` — [food-island-evolution.js](../../dist/food-island-evolution.js). Границы/число попыток — `ENVIRONMENT_RULES` в [environment-settings.js](../../dist/environment-settings.js).
**Граница:** целый островок переносится одним смещением или остаётся на месте; отдельные кусты имеют свой режим. Создание/удаление и рост/обрезка — отдельные операции. Приоритет выработки может скорректировать предложенный состав. Лежащая пища остаётся на прежних клетках.
**Проверка:** [island-mobility.test.mjs](../../tests/island-mobility.test.mjs): реакция малых чисел, дальность, жёсткое смещение, ограниченная работа при заблокированном переносе; [target-environment.test.mjs](../../tests/target-environment.test.mjs): итоговый план и выработка.
**История:** [целые группы 0.37](../updates/v037-moving-islands-statistics.md), [малые количества и дальний перенос 0.38.1](../updates/v038-island-mobility.md).
**Дальше:** слияние/разделение групп не входят в нынешний договор. Для новой динамики начать с [контракта среды](../next-target-environment.md) и отметить новое предложение, а не переносить старую отменённую идею в код.
