/** Только анализ. Каждая непустая группа мира имеет массу 1; неизвестные
 * значения предварительно исключаются вызывающей метрикой, не заменяются 0. */
export function worldWeights(rows){const counts=new Map();for(const r of rows)counts.set(r.worldId,(counts.get(r.worldId)??0)+1);return rows.map(r=>1/counts.get(r.worldId));}
export function weightedSummary(values,weights=null){
 const count=values.length;if(!count)return {count:0,min:null,median:null,mean:null,max:null};
 const order=values.map((value,i)=>({value,weight:weights?.[i]??1})).sort((a,b)=>a.value-b.value);
 let mass=0,sum=0;for(const r of order){mass+=r.weight;sum+=r.value*r.weight;}
 let cumulative=0,median=order.at(-1).value;
 for(let i=0;i<count;i++){cumulative+=order[i].weight;if(cumulative>=mass/2-1e-12){median=Math.abs(cumulative-mass/2)<=1e-12&&i+1<count?(order[i].value+order[i+1].value)/2:order[i].value;break;}}
 return {count,min:order[0].value,median,mean:sum/mass,max:order.at(-1).value};
}
