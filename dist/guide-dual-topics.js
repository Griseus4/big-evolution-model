/** Только затронутые главы: текущие источники и выполненные проверки v15. */
const sources=[
 {file:'guide-dual-text.js',symbols:['DUAL_GUIDE_TEXT'],purpose:'Текущие статьи о покое, геноме, мутациях, времени и цене.'},
 {file:'brain-evolution-rules.js',symbols:['EVOLUTION_RULES'],purpose:'Стартовые диапазоны, пределы и численные правила новой схемы.'},
 {file:'dual-brain-genome.js',symbols:['randomDualGenome','mutateDualGenome'],purpose:'Две структуры и шесть регуляторов; родительские правила мутаций.'},
 {file:'rest-policy.js',symbols:['restProbabilities'],purpose:'Единая политика относительной оценки покоя для выбора и TD.'},
 {file:'temporal-world.js',symbols:['acceptTemporalChoice','payAttention'],purpose:'Покой, расходы и применение основного решения.'},
 {file:'brain-cost.js',symbols:['ATTENTION_REFERENCE_OPERATIONS','ATTENTION_OPERATION_PRICE'],purpose:'Калибровка условных операций диспетчера.'},
];
export const GUIDE_DUAL_TOPICS=Object.fromEntries(['genome','structure-evolution','choice','brain-cost','time'].map(id=>[id,{
 reviewedVersion:'0.55.0',sources,keywords:['покой','диспетчер','шесть регуляторов','v15'],checks:[
  {file:'tests/dual-world.test.mjs',symbols:[],purpose:'Локальное/Worker-исполнение, покой, цена и сохранение.'},
  {file:'tests/dual-brain-genome.test.mjs',symbols:[],purpose:'Мутации двух структур и независимость регуляторов.'},
  {file:'tests/rest-policy.test.mjs',symbols:[],purpose:'Допуск относительно покоя и нормировка целей.'}]}]));
