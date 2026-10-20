/** Семь неизменных свойств наблюдателя: один раз на рождение, без RNG.
 * Полная сеть и приобретённые поправки в историю жизней не копируются. */
import {worldWeights} from './weighted-statistics.js';
import {mutationProfile} from './mutation-parameters.js';
export const HERITABLE_SCHEMA='heritable-statistics-v1';
export const SENSITIVITY_BIN_WIDTH=5;
export const HERITABLE_METRICS=Object.freeze([
 {id:'senseEnergy',label:'Чувствительность к энергии',unit:'% шкалы чувств',digits:1,signed:true},
 {id:'senseHealth',label:'Чувствительность к здоровью',unit:'% шкалы чувств',digits:1,signed:true},
 {id:'senseStomach',label:'Чувствительность к наполнению желудка',unit:'% шкалы чувств',digits:1,signed:true},
 {id:'shortCapacity',label:'Ёмкость краткой памяти',unit:'мест',digits:1},
 {id:'longCapacity',label:'Ёмкость долгой памяти',unit:'мест',digits:1},
 {id:'mutationRate',label:'Вероятность мутации',unit:'% / ген сети',digits:3},
 {id:'mutationStrength',label:'Сила мутации',unit:'максимальная прибавка ±',digits:3},
].map(m=>Object.freeze({...m,inherited:true})));
export function captureHeritable(a){
 const t=a.brain.traits,v=t.values,n=Math.abs(v[0])+Math.abs(v[1])+Math.abs(v[3]),mutation=mutationProfile(a.genome);
 return {schema:HERITABLE_SCHEMA,senseEnergy:n?v[0]/n*100:0,senseHealth:n?v[1]/n*100:0,senseStomach:n?v[3]/n*100:0,
  shortCapacity:t.shortCapacity,longCapacity:t.longCapacity,mutationRate:mutation?100*mutation.rate:null,mutationStrength:mutation?.strength??null};
}
export function sensitivityDistributions(rows,{start,end,origin='all',weightMode=null}={}){
 const bins=200/SENSITIVITY_BIN_WIDTH,result=['senseEnergy','senseHealth','senseStomach'].map(id=>({id,count:0,positive:0,negative:0,zero:0,bins:new Float64Array(bins),mass:0}));
 const eligible=rows.filter(r=>Number.isFinite(r.born)&&r.born>=start&&r.born<end&&(origin==='all'||(origin==='founders'?r.parentId===null:r.parentId!==null))&&r.heritable?.schema===HERITABLE_SCHEMA);
 const weights=weightMode==='worlds'?worldWeights(eligible):eligible.map(()=>1);
 for(let rowIndex=0;rowIndex<eligible.length;rowIndex++){const r=eligible[rowIndex],weight=weights[rowIndex];if(!Number.isFinite(r.born)||r.born<start||r.born>=end||origin==='founders'&&r.parentId!==null||origin==='descendants'&&r.parentId===null||r.heritable?.schema!==HERITABLE_SCHEMA)continue;
  for(const s of result){const v=r.heritable[s.id];if(!Number.isFinite(v)||v< -100-1e-9||v>100+1e-9)continue;s.count++;s.mass+=weight;s[v>0?'positive':v<0?'negative':'zero']++;s.bins[Math.min(bins-1,Math.max(0,Math.floor((v+100)/SENSITIVITY_BIN_WIDTH)))]+=weight;}
 }
 return result.map(s=>({...s,points:Array.from(s.bins,(n,id)=>({id,x:-100+(id+.5)*SENSITIVITY_BIN_WIDTH,mean:s.mass?100*n/s.mass:null,complete:true}))}));
}
