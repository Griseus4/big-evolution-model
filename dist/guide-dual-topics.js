/** Только затронутые главы: текущие источники и выполненные проверки v15. */
const sources=[
 {file:'mutation-help.js',symbols:['MUTATION_DETAILS'],purpose:'Назначение семи групп и точный охват мутаций в подсказках и пособии.'},
 {file:'brain-economy.js',symbols:['BRAIN_ECONOMY','scaledBrainCost'],purpose:'Общая положительная цена вычислений мира.'},
 {file:'energy-preview.js',symbols:['ENERGY_PREVIEW','energyPreview'],purpose:'Условный полный бюджет питания, тела и двух сетей.'},
 {file:'guide-dual-text.js',symbols:['DUAL_GUIDE_TEXT'],purpose:'Текущие статьи о покое, геноме, мутациях, времени и цене.'},
 {file:'brain-evolution-rules.js',symbols:['EVOLUTION_RULES'],purpose:'Стартовые диапазоны, пределы и численные правила новой схемы.'},
 {file:'dual-brain-genome.js',symbols:['randomDualGenome','mutateDualGenome'],purpose:'Две структуры и отдельные регуляторы блоков; родительские правила мутаций.'},
 {file:'rest-policy.js',symbols:['restProbabilities'],purpose:'Единая политика относительной оценки покоя для выбора и TD.'},
 {file:'temporal-world.js',symbols:['acceptTemporalChoice','payAttention'],purpose:'Покой, расходы и применение основного решения.'},
 {file:'brain-cost.js',symbols:['ATTENTION_REFERENCE_OPERATIONS','ATTENTION_OPERATION_PRICE'],purpose:'Калибровка условных операций диспетчера.'},
];
export const GUIDE_DUAL_TOPICS=Object.fromEntries(['genome','structure-evolution','choice','brain-cost','time'].map(id=>[id,{
 reviewedVersion:id==='structure-evolution'?'0.55.4':id==='brain-cost'?'0.55.3':['genome','structure-evolution'].includes(id)?'0.55.1':'0.55.0',sources,keywords:['покой','диспетчер','регуляторы блоков','v16'],checks:[
  {file:'tests/dual-world.test.mjs',symbols:[],purpose:'Локальное/Worker-исполнение, покой, цена и сохранение.'},
  {file:'tests/modular-mutations.test.mjs',symbols:[],purpose:'Семь пар, отключение блоков, наследование и сохранение.'},
  {file:'tests/dual-brain-genome.test.mjs',symbols:[],purpose:'Мутации двух структур и независимость регуляторов.'},
  {file:'tests/rest-policy.test.mjs',symbols:[],purpose:'Допуск относительно покоя и нормировка целей.'}]}]));
