/** Паспорта пакета B: проверены темы, а не весь код перечисленных файлов. */
const topic=(keywords,related,sources)=>({reviewedVersion:'0.54.12',keywords,related,
 sources:sources.map(([file,symbols,purpose])=>({file,symbols,purpose})),
 checks:[{file:'tests/guide-mind05412.test.mjs',purpose:'Наблюдение, снимок деятельности, память, знаки ощущений и нормировка выбора.'}]});
export const GUIDE_MIND_TOPICS={
 observation:topic(['обзор','наблюдения','видимость','соседи','деятельность','снимок','сведения','общая граница'],['geography','memory','brain-structure','choice'],[
 ['temporal-world.js',['sampleCells','localTemporalObservation','prepareTemporalBoundary'],'Обзор, собственный процесс и общая граница решений.'],
 ['activity-perception.js',['rebuildActivities','sampleActivities'],'Счётчики текущей чужой деятельности и исключение себя.'],
 ['neighbour-perception.js',['countOthers'],'Количество других и преобразование плотности.'],
 ['temporal-inputs.js',['prepareSetInput'],'Реальные числовые входы из доступных данных.'],
 ]),
 memory:topic(['краткая память','долгая память','забывание','значимость','закрепление','прогноз пищи','наблюдения','посещения'],['observation','feelings','brain','saves'],[
 ['cognition.js',['createBrain','observe','memoryStrength','rememberDecision','rememberExperience','memoryBelief','spatialContext'],'Жизненный цикл записей, прогноз и геометрический потенциал.'],
 ['brain-parameters.js',['cognitiveTraits'],'Наследуемые параметры памяти и их шкалы.'],
 ['cognition-rules.js',[],'Предел прогноза и параметры значимости/удаления.'],
 ['temporal-world.js',['observeTime','prepareTemporalDecision','commitTemporalBrain'],'Использование памяти действующим временным мозгом.'],
 ]),
 feelings:topic(['чувствительность','знак','энергия','здоровье','желудок','боль','процент','самочувствие','субъективная оценка'],['energy','food','choice','genome'],[
 ['brain-controller.js',['controllerFeeling'],'Действующая формула трёх чувствительностей временной схемы.'],
 ['brain-parameters.js',['cognitiveTraits'],'Преобразование генов в свойства.'],
 ['evolution-app.js',[],'Проценты предпочтений выбранного жителя.'],
 ['brain-input-scales.js',[],'Центры сигналов и масштаб самочувствия.'],
 ['guide-mind-text.js',['guideFeelingExample'],'Учебное изменение только знака рабочей функцией.'],
 ]),
 'brain-structure':topic(['кодировщик клеток','главный контекст','проекция цели','проекция операции','нейрон','связь','слой','Q','входы','насыщение'],['observation','memory','choice','genome'],[
 ['temporal-layout.js',[],'Порядок и названия семейств входов/проекций.'],
 ['temporal-inputs.js',['prepareSetInput','setCandidateInput'],'Подстановка наблюдений, памяти, процесса и цены кандидата.'],
 ['set-brain-engine.js',['createSetBrainEngine'],'Кодирование клеток и объединение контекста, операции и цели.'],
 ['structural-brain.js',['contextForward'],'Прямой проход изменяемого DAG.'],
 ['brain-diagram-help.js',['brainFeatureExplanation'],'Соответствие терминов пояснениям схемы.'],
 ]),
 choice:topic(['выбор','вероятность','softmax','температура','logmeanexp','кандидат','пересмотр','контроллер вызова','повтор','оценка'],['actions','brain-structure','feelings','energy'],[
 ['temporal-world.js',['temporalAvailableMask','localTemporalFrame','prepareTemporalDecision','acceptTemporalChoice'],'Допустимость, состав кандидатов и принятие выбора.'],
 ['set-brain-engine.js',['createSetBrainEngine'],'Единая нормировка вероятностей по операциям и целям.'],
 ['brain-controller.js',['selectControllerDecision'],'Выбор по случайному числу мира.'],
 ['attention-gate.js',['rememberAttention','attentionRequest'],'Снимок и наследуемый запрос пересмотра.'],
 ['guide-mind-text.js',['guideOperationExample'],'Учебный набор с равными оценками.'],
 ]),
};
