/** План редкого изменения групп. Координаты переводятся в осевые: простой
 * сдвиг x/y на нечётной строке исказил бы форму гексагона. Запасы пищи этот
 * модуль не читает и не переносит, меняется только размещение производства. */
import {worldAxial,worldOffset} from './navigation.js';
import {worldDistance} from './food-layout.js';
import {FOOD_LIMITS,SOURCE_CAPACITY_LIMITS} from './food-settings.js';
import {islandSizes} from './food-islands.js';
import {ENVIRONMENT_RULES as R} from './environment-settings.js';
const point=c=>({x:c.x,y:c.y}),key=c=>`${c.x},${c.y}`,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const neighbours=p=>{const a=worldAxial(p);return [{q:1,r:0},{q:0,r:1},{q:-1,r:1},{q:-1,r:0},{q:0,r:-1},{q:1,r:-1}].map(d=>worldOffset({q:a.q+d.q,r:a.r+d.r}));};
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r.next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const offsets=[];for(let q=-R.relocationRadius;q<=R.relocationRadius;q++)for(let r=-R.relocationRadius;r<=R.relocationRadius;r++)if((q||r)&&Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=R.relocationRadius)offsets.push({q,r});
/** Сохраняет все относительные координаты группы или не двигает её вовсе. */
export function translateFoodGroup(world,group,used,random){
 const own=new Set(group.sources.map(key)),origin=worldAxial(group.centre);
 for(const d of shuffle(offsets.slice(),random)){
  const cells=[];let valid=true;
  for(const p of group.sources){const a=worldAxial(p),to=worldOffset({q:a.q+d.q,r:a.r+d.r}),c=world.tile(to.x,to.y);if(!c||c.terrain!=='land'||used.has(key(c))&&!own.has(key(c))){valid=false;break;}cells.push({...p,...point(c)});}
  if(!valid)continue;
  const from=point(group.centre),to=worldOffset({q:origin.q+d.q,r:origin.r+d.r}),moved=group.sources.map((p,i)=>({groupId:group.id,from:point(p),to:point(cells[i])}));
  for(const p of group.sources)used.delete(key(p));for(const p of cells)used.add(key(p));group.sources=cells;group.centre=to;
  return {id:group.id,kind:group.kind,from,to,sourceCount:cells.length,moved};
 }
 return null;
}
function trim(group,size,used){
 if(group.sources.length<=size)return;
 // Строим дерево связности и снимаем дальние листья. Это не разрывает узкий
 // сухой перешеек внутри группы. Старые несвязные группы становятся лесом:
 // новых разрывов не создаём и не переносим их источники по отдельности.
 const nodes=new Map(group.sources.map(p=>[key(p),{p,parent:null,children:0,d:worldDistance(p,group.centre)}])),seen=new Set();
 for(const root of [...nodes.values()].sort((a,b)=>a.d-b.d)){
  if(seen.has(key(root.p)))continue;seen.add(key(root.p));const queue=[root];
  for(let i=0;i<queue.length;i++)for(const n of neighbours(queue[i].p)){const k=key(n),child=nodes.get(k);if(!child||seen.has(k))continue;seen.add(k);child.parent=queue[i];queue[i].children++;queue.push(child);}
 }
 const leaves=[...nodes.values()].filter(n=>!n.children);
 while(nodes.size>size){let at=0;for(let i=1;i<leaves.length;i++)if(leaves[i].d>leaves[at].d)at=i;const node=leaves.splice(at,1)[0];nodes.delete(key(node.p));used.delete(key(node.p));if(node.parent&&--node.parent.children===0)leaves.push(node.parent);}
 group.sources=group.sources.filter(p=>nodes.has(key(p)));
 if(!group.sources.some(p=>key(p)===key(group.centre)))group.centre=point(group.sources[0]);
}
function grow(world,group,size,used,random,capacity){
 const frontier=new Map();
 function add(p){for(const n of neighbours(p)){const c=world.tile(n.x,n.y),k=key(n);if(c?.terrain==='land'&&!used.has(k))frontier.set(k,c);}}
 for(const p of group.sources)add(p);
 while(group.sources.length<size&&frontier.size){
  let best=null,bestScore=Infinity;for(const c of frontier.values()){const score=worldDistance(c,group.centre)+random.next()*.25;if(score<bestScore){best=c;bestScore=score;}}
  const k=key(best);frontier.delete(k);if(used.has(k))continue;used.add(k);group.sources.push({...point(best),capacity});add(best);
 }
}
export function evolveFoodGroups(world,{sourceCount,islandCount,sizeSpread,periodSpread,capacityFactor,normal}){
 const random=world.automaticEnvironment.random,land=shuffle(world.tiles.filter(c=>c.terrain==='land'),random),old=world.foodIslands;
 const copy=g=>({...g,centre:point(g.centre),sources:g.sources.map(p=>({...point(p),capacity:world.tile(p.x,p.y).maxFood})),remaining:clamp((g.nextTick-world.tick)/g.period,0,1)});
 let islands=shuffle(old.filter(g=>g.kind==='island').map(copy),random),bushes=shuffle(old.filter(g=>g.kind==='bush').map(copy),random);
 const n=Math.min(sourceCount,islandCount),bushCount=n?Math.min(Math.floor(sourceCount*FOOD_LIMITS.scatteredFraction),sourceCount-n):sourceCount;
 islands=islands.slice(0,n);bushes=bushes.slice(0,bushCount);
 const used=new Set([...islands,...bushes].flatMap(g=>g.sources.map(key))),sizes=islandSizes(sourceCount-bushCount,n,sizeSpread,random);
 for(let i=0;i<islands.length;i++)trim(islands[i],sizes[i],used);
 let cursor=0,nextId=world.automaticEnvironment.nextGroupId??Math.max(-1,...old.map(g=>g.id))+1;
 const capacities=old.flatMap(g=>g.sources.map(p=>world.tile(p.x,p.y).maxFood)),mean=capacities.length?capacities.reduce((a,b)=>a+b,0)/capacities.length:4.5;
 const capacity=clamp(Math.round(mean*capacityFactor),SOURCE_CAPACITY_LIMITS.min,SOURCE_CAPACITY_LIMITS.max);
 function seed(kind){while(cursor<land.length&&used.has(key(land[cursor])))cursor++;if(cursor===land.length)return null;const c=land[cursor++];used.add(key(c));return {id:nextId++,kind,centre:point(c),sources:[{...point(c),capacity}],period:world.foodSettings.regrowInterval,remaining:1-random.next()};}
 while(islands.length<n){const g=seed('island');if(!g)break;islands.push(g);}
 const movedGroups=[];
 // Все островки получают попытку, даже когда предыдущему не хватило места.
 for(const g of islands){const movement=translateFoodGroup(world,g,used,random);if(movement)movedGroups.push(movement);}
 for(let i=0;i<islands.length;i++)grow(world,islands[i],sizes[i],used,random,capacity);
 while(bushes.length<bushCount){const g=seed('bush');if(!g)break;bushes.push(g);}
 // Ограниченная суша может не вместить рост компактной группы. Остаток бюджета
 // размещается самостоятельными кустами, не удалёнными частями островка.
 while(used.size<sourceCount){const g=seed('bush');if(!g)break;bushes.push(g);}
 for(const g of bushes.slice(0,Math.ceil(bushes.length*R.relocationFraction))){const movement=translateFoodGroup(world,g,used,random);if(movement)movedGroups.push(movement);}
 const groups=[...islands,...bushes],spread=clamp((world.foodSettings.capacitySpread??100/3)+normal*10,0,100),lo=clamp(Math.round(mean*capacityFactor*(1-spread/100)),SOURCE_CAPACITY_LIMITS.min,SOURCE_CAPACITY_LIMITS.max),hi=clamp(Math.round(mean*capacityFactor*(1+spread/100)),lo,SOURCE_CAPACITY_LIMITS.max);
 for(const g of groups){
  g.period=Math.max(.1,world.foodSettings.regrowInterval*(1+(random.next()*2-1)*periodSpread/100));
  for(const p of g.sources)p.capacity=lo+Math.floor(random.next()*(hi-lo+1));
 }
 world.automaticEnvironment.nextGroupId=nextId;
 return {groups,movedGroups,moved:movedGroups.flatMap(g=>g.moved),sizeSpread,periodSpread};
}
