/** Координатор хранит только численность записей удалённой памяти.
 * WeakMap не попадает в геном/снимок и не выдаётся за содержимое памяти. */
const summaries=new WeakMap();
export function setCognitionSummary(agent,short,long){summaries.set(agent,{short,long});}
export function cognitionPlaces(agent){return summaries.get(agent)??{short:agent.brain.memory.size,long:agent.brain.longMemory.size};}
