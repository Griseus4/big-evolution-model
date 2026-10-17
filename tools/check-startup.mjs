/** Узкая проверка инициализации, без step(), таймеров и испытаний эволюции.
 * Одного импорта модуля недостаточно: отсутствующее имя внутри функции
 * обнаруживается только при её вызове. Проверяем путь new Evolution(), на
 * котором главная страница создаёт основателей до подключения кнопок.
 * DOM, настоящую отрисовку и пользовательские клики этот файл не проверяет.
 */
import assert from 'node:assert/strict';
import {Evolution} from '../dist/evolution.js';
import {genomeMetadata} from '../dist/genome.js';
import {GENOME_SIZES} from '../dist/policy-layout.js';
import {layoutForGenes} from '../dist/neural-layout.js';

function checkInitialWorld(world){
 assert.equal(world.tick,0,'Проверка не должна продвигать время мира');
 assert.equal(world.agents.length,world.initialPopulation);
 for(const agent of world.agents){
  assert.equal(agent.genome.length,layoutForGenes(agent.genome)?.genes??GENOME_SIZES[genomeMetadata(agent.genome).version]);
  assert.ok(agent.genome.every(Number.isFinite));
 }
 const agent=world.agents[0],options=world.evaluate(agent);
 assert.ok(options.length>0,'Начальные оценки для панели должны быть доступны');
 assert.ok(options.every(o=>Number.isFinite(o.score)&&Number.isFinite(o.probability)));
 assert.equal(world.genomeFile(agent).genes.length,agent.genome.length);
 world.summary();
 assert.equal(world.tick,0);
}

checkInitialWorld(new Evolution());
// Сохранённый геном текущей схемы должен запускать новый мир без миграции.
checkInitialWorld(new Evolution({population:1,baseGenome:new Evolution({population:1}).agents[0].genome}));
console.log('Инициализация: обычный мир и текущая сохранённая основа работают; шаги симуляции не выполнялись.');
