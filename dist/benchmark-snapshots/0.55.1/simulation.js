// Pure simulation: no DOM, rendering, timers or wall-clock dependencies.
export const WIDTH = 28, HEIGHT = 18;
export const key = (x,y) => `${x},${y}`;
// Odd-row horizontal hex layout. Display and navigation use the same geometry.
const axial = p => ({q:p.x-(p.y-(p.y&1))/2,r:p.y});
export const distance = (a,b) => {const l=axial(a),r=axial(b),dq=l.q-r.q,dr=l.r-r.r;return (Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2;};
export const HEX_RADIUS=21, HEX_WIDTH=Math.sqrt(3)*HEX_RADIUS;
export const MAP_WIDTH=Math.ceil((WIDTH+.5)*HEX_WIDTH+12);
export const MAP_HEIGHT=Math.ceil((HEIGHT-1)*HEX_RADIUS*1.5+HEX_RADIUS*2+12);
export const hexCenter = p => ({x:6+HEX_WIDTH*(p.x+.5+(p.y&1)/2),y:6+HEX_RADIUS+p.y*HEX_RADIUS*1.5});
export function hexAt(x,y) {
  // Nearest center is exact for a regular hex grid; reject points outside the map.
  let best=null,nearest=Infinity;
  for(let row=0;row<HEIGHT;row++) for(let col=0;col<WIDTH;col++) {
    const p={x:col,y:row},c=hexCenter(p),d=(x-c.x)**2+(y-c.y)**2;
    if(d<nearest){nearest=d;best=p;}
  }
  const c=hexCenter(best),dx=Math.abs(x-c.x),dy=Math.abs(y-c.y);
  return dx<=HEX_WIDTH/2 && dy<=HEX_RADIUS-dx/Math.sqrt(3)?best:null;
}
export const FOOD_ENERGY=22, DIGESTION_RATE=1.1, REVISIT_AGE=60;
export const PATH_RISK_WEIGHT=100;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
// Small priority queue for A*: lower estimated total cost, then insertion order.
class MinHeap {
  constructor(){this.items=[];this.sequence=0;}
  before(a,b){return a.priority<b.priority||(a.priority===b.priority&&a.order<b.order);}
  push(value){
    const a=this.items;value.order=this.sequence++;a.push(value);let i=a.length-1;
    while(i){const parent=(i-1)>>1;if(!this.before(a[i],a[parent]))break;[a[i],a[parent]]=[a[parent],a[i]];i=parent;}
  }
  pop(){
    const a=this.items,first=a[0],last=a.pop();if(!a.length)return first;a[0]=last;let i=0;
    while(true){const left=i*2+1,right=left+1;let best=i;
      if(left<a.length&&this.before(a[left],a[best]))best=left;
      if(right<a.length&&this.before(a[right],a[best]))best=right;
      if(best===i)break;[a[i],a[best]]=[a[best],a[i]];i=best;
    }
    return first;
  }
  get length(){return this.items.length;}
}
export class Random {
  constructor(seed=1) { this.state = seed >>> 0; }
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t=this.state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
}
export function probabilities(options) {
  if (!options.length) return [];
  const peak=Math.max(...options.map(o=>o.score));
  const weights=options.map(o=>Math.exp(clamp(o.score-peak,-25,0)));
  const sum=weights.reduce((a,b)=>a+b,0);
  return options.map((o,i)=>({...o,probability:weights[i]/sum}));
}
export class Simulation {
  constructor({seed=42,scenario='mixed',hungerSensitivity=1,fearSensitivity=1}={}) {
    this.seed=seed>>>0; this.scenario=scenario; this.random=new Random(this.seed);
    this.tick=0; this.events=[]; this.history=[]; this.revision=0;
    this.stats={gathered:0,eaten:0,regrown:0,injuries:0,decisions:0,explored:0,revisited:0,digested:0,absorbed:0,overflow:0};
    this.agent={x:8,y:9,energy:68,health:100,inventory:0,capacity:5,stomach:0,lastAbsorbed:0,
      hungerSensitivity,fearSensitivity,memory:new Map(),plan:null,alive:true};
    this.tiles=[];
    for(let y=0;y<HEIGHT;y++) for(let x=0;x<WIDTH;x++) {
      const coast=24+Math.round(Math.sin(y*.52)*1.5);
      const terrain=x>=coast?'water':'land';
      this.tiles.push({x,y,terrain,food:0,maxFood:0,risk:0});
    }
    const hazard=scenario==='risk'?{x:12,y:9}:{x:19,y:6};
    for(const cell of this.tiles) {
      if(cell.terrain==='land') cell.risk=Math.max(0,1-Math.hypot(cell.x-hazard.x,cell.y-hazard.y)/4)*.16;
    }
    this.hazard=hazard;
    const sources=scenario==='risk'?[[10,9,8],[20,14,8]]:[[10,9,6],[7,13,7],[19,6,12],[20,14,7]];
    for(const [x,y,n] of sources) {Object.assign(this.tile(x,y),{food:n,maxFood:n});}
    this.initialFood=this.tiles.reduce((s,c)=>s+c.food,0);
    this.observe();
    this.log('Начало','Житель знает только окрестности. Остальная карта ему неизвестна.');
    this.record();
  }
  tile(x,y) {return x<0||y<0||x>=WIDTH||y>=HEIGHT?null:this.tiles[y*WIDTH+x];}
  neighbours(p) {
    const side=p.y&1;
    const directions=[[1,0],[-1,0],[side-1,-1],[side,-1],[side-1,1],[side,1]];
    return directions.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(p=>this.tile(p.x,p.y));
  }
  hunger() {const a=this.agent;return clamp(100-a.energy-a.stomach*.85,0,100)*a.hungerSensitivity;}
  digest() {
    const a=this.agent,amount=Math.min(a.stomach,DIGESTION_RATE);
    a.stomach=Math.max(0,a.stomach-amount);
    a.lastAbsorbed=Math.min(amount,100-a.energy);
    a.energy+=a.lastAbsorbed;
    this.stats.digested+=amount;this.stats.absorbed+=a.lastAbsorbed;
    this.stats.overflow+=amount-a.lastAbsorbed;
  }
  log(title,text,kind='info') {
    this.events.unshift({tick:this.tick,title,text,kind}); this.events.length=Math.min(this.events.length,70);
    this.revision++;
  }
  observe() {
    const a=this.agent; let fresh=0,found=0;
    for(let y=Math.max(0,a.y-3);y<=Math.min(HEIGHT-1,a.y+3);y++) {
      for(let x=Math.max(0,a.x-3);x<=Math.min(WIDTH-1,a.x+3);x++) {
        if(distance({x,y},a)>3) continue;
        const c=this.tile(x,y),k=key(x,y),old=a.memory.get(k);
        if(!old) fresh++;
        if(c.food>0&&(!old||old.food===0)) found++;
        a.memory.set(k,{x,y,terrain:c.terrain,food:c.food,maxFood:c.maxFood,risk:c.risk,seenAt:this.tick});
      }
    }
    this.stats.explored+=fresh;
    if(found&&this.tick) this.log('Найдена еда',`Замечен источник еды. Обновлены сведения о местности.`,'good');
    return fresh;
  }
  // A step costs time plus aversion to remembered risk; water is impassable.
  // This is a game utility cost, not a probability of harm along the whole route.
  pathCost(path) {
    return path.reduce((sum,p)=>sum+1+PATH_RISK_WEIGHT*Math.max(0,this.agent.fearSensitivity)
      *(this.agent.memory.get(key(p.x,p.y))?.risk??.015),0);
  }
  pathRiskText(path) {
    const chance=1-path.reduce((safe,p)=>safe*(1-(this.agent.memory.get(key(p.x,p.y))?.risk??.015)),1);
    return `оценка риска повреждения по пути ${Math.round(chance*100)}%`;
  }
  // A* uses only memory, with hex distance as a lower bound on remaining cost.
  // An unknown cell is allowed solely as the final exploration step.
  route(target,allowUnknownEnd=false) {
    const a=this.agent,start=key(a.x,a.y),end=key(target.x,target.y);
    if(start===end) return [];
    const queue=new MinHeap(),parent=new Map([[start,null]]),costs=new Map([[start,0]]);
    queue.push({x:a.x,y:a.y,cost:0,priority:distance(a,target)});
    while(queue.length) {
      const p=queue.pop(),pk=key(p.x,p.y);
      if(p.cost>costs.get(pk))continue;
      if(pk===end) {
        const result=[];let cursor=end;
        while(cursor!==start){const [x,y]=cursor.split(',').map(Number);result.push({x,y});cursor=parent.get(cursor);}
        return result.reverse();
      }
      for(const n of this.neighbours(p)) {
        const k=key(n.x,n.y);
        const m=a.memory.get(k);
        if(!(m?.terrain==='land'||(allowUnknownEnd&&k===end&&!m))) continue;
        const cost=p.cost+this.pathCost([n]);
        if(cost>=(costs.get(k)??Infinity))continue;
        costs.set(k,cost);parent.set(k,pk);
        queue.push({...n,cost,priority:cost+distance(n,target)});
      }
    }
    return null;
  }
  evaluate() {
    const a=this.agent;
    if(!a.alive) return [];
    const hunger=Math.pow(this.hunger()/100,2);
    const fear=a.fearSensitivity;
    const options=[];
    const riskOf=path=>path.reduce((s,p)=>s+(a.memory.get(key(p.x,p.y))?.risk??.015),0);
    const add=(type,label,target,path,score,reason)=>options.push({type,label,target,path,score,reason});
    if(a.inventory>0) add('eat','Поесть',{x:a.x,y:a.y},[],-3+15*hunger-a.stomach/FOOD_ENERGY*1.4,
      `Голод ${Math.round(this.hunger())}; ещё усваивается ${(a.stomach/FOOD_ENERGY).toFixed(1)} порции. Энергия поступит постепенно.`);
    if(a.inventory<a.capacity) {
      const sources=[...a.memory.values()].filter(m=>m.food>0&&m.terrain==='land')
        .sort((l,r)=>distance(a,l)-distance(a,r)).slice(0,4);
      for(const m of sources) {
        const path=this.route(m); if(!path) continue;
        const confidence=Math.exp(-(this.tick-m.seenAt)/180);
        const routeRisk=riskOf(path)+m.risk*2;
        const score=-1+7*hunger+Math.min(m.food,a.capacity-a.inventory)*.1*confidence-a.inventory*.28
          -path.length*.07-routeRisk*7*fear-(1-confidence)*1.2;
        add('gather',`За едой (${m.x+1}, ${m.y+1})`,{x:m.x,y:m.y},path,score,
          `По памяти: ${m.food} еды; путь ${path.length} шагов; ${this.pathRiskText(path)}; риск места ${Math.round(m.risk*100)}%.`);
      }
    }
    const frontier=new Map();
    for(const m of a.memory.values()) if(m.terrain==='land') {
      for(const n of this.neighbours(m)) if(!a.memory.has(key(n.x,n.y))) frontier.set(key(n.x,n.y),n);
    }
    const nearby=[...frontier.values()].sort((l,r)=>distance(a,l)-distance(a,r)).slice(0,12);
    let best=null;
    for(const target of nearby) {
      const path=this.route(target,true); if(!path) continue;
      const score=.55+hunger*(options.some(o=>o.type==='gather')?.25:2)
        -path.length*.065-riskOf(path)*7*fear;
      if(!best||score>best.score) best={target,path,score};
    }
    if(best) add('explore','Исследовать',best.target,best.path,best.score,
      `Проверить неизвестный участок; путь ${best.path.length} шагов; ${this.pathRiskText(best.path)}. Наличие еды неизвестно.`);
    // Revisits use remembered sources, including empty ones, and stale land observations.
    // The current contents of a distant cell are never read during evaluation.
    const stale=[...a.memory.values()].filter(m=>m.terrain==='land'&&this.tick-m.seenAt>=REVISIT_AGE)
      .sort((l,r)=>((r.maxFood>0?2:0)+(this.tick-r.seenAt)/180-distance(a,r)*.07)
        -((l.maxFood>0?2:0)+(this.tick-l.seenAt)/180-distance(a,l)*.07)).slice(0,12);
    let revisit=null;
    for(const target of stale) {
      const path=this.route(target);if(!path||!path.length)continue;
      const age=this.tick-target.seenAt;
      const score=.1+Math.min(age/180,1.8)+(target.maxFood>0?.7+2*hunger:0)
        -path.length*.065-riskOf(path)*7*fear;
      if(!revisit||score>revisit.score)revisit={target,path,score,age};
    }
    if(revisit)add('revisit','Проверить знакомое место',revisit.target,revisit.path,revisit.score,
      `Сведения ${revisit.age} шагов назад; ${revisit.target.maxFood>0?'здесь был источник, еда могла восстановиться':'местность могла измениться'}; путь ${revisit.path.length}; ${this.pathRiskText(revisit.path)}.`);
    const currentRisk=a.memory.get(key(a.x,a.y))?.risk??0;
    if(currentRisk>.005) {
      const safe=[...a.memory.values()].filter(m=>m.terrain==='land'&&m.risk<.005)
        .sort((l,r)=>distance(a,l)-distance(a,r));
      for(const m of safe) {
        const path=this.route(m); if(!path) continue;
        add('flee','Уйти от угрозы',m,path,.8+currentRisk*32*fear-riskOf(path)*2*fear-path.length*.03,
          `Сейчас риск ${Math.round(currentRisk*100)}%; ближайшее известное безопасное место.`);
        break;
      }
    }
    add('wait','Подождать',{x:a.x,y:a.y},[],-.05-2.5*hunger-currentRisk*12*fear,
      'Короткая пауза с меньшим расходом энергии; еды она не даёт.');
    return probabilities(options);
  }
  choose() {
    const options=this.evaluate(); if(!options.length)return;
    let roll=this.random.next(),chosen=options[options.length-1];
    for(const o of options) {roll-=o.probability;if(roll<=0){chosen=o;break;}}
    this.lastDecision={tick:this.tick,options:options.map(o=>({...o,path:o.path.map(p=>({...p}))})),chosen:chosen.label};
    this.agent.plan={...chosen,path:chosen.path.map(p=>({...p})),steps:0,remaining:chosen.type==='wait'?3:3};
    this.stats.decisions++;
    this.log('Решение',`${chosen.label} · вероятность ${Math.round(chosen.probability*100)}%. ${chosen.reason}`);
  }
  endPlan() {this.agent.plan=null;}
  step() {
    const a=this.agent;if(!a.alive)return;
    this.tick++;
    if(this.tick%90===0) for(const c of this.tiles) if(c.food<c.maxFood){c.food++;this.stats.regrown++;}
    // Digest existing food before acting; a new meal starts yielding energy next tick.
    this.digest();
    this.observe();
    if(a.plan&&a.plan.type!=='flee'&&a.plan.type!=='eat') {
      const risk=a.memory.get(key(a.x,a.y))?.risk??0;
      if(risk>.025&&this.random.next()<clamp(risk*a.fearSensitivity*2,0,.6)) {
        this.log('План прерван','Замеченная угроза заставила заново оценить варианты.','warning');this.endPlan();
      }
    }
    if(!a.plan)this.choose();
    let p=a.plan;
    if(!p)return;
    if(p.path.length&&p.target) {
      const replacement=this.route(p.target,p.type==='explore');
      const blocked=p.path.some(n=>a.memory.get(key(n.x,n.y))?.terrain==='water');
      if(!replacement){this.log('Путь закрыт','По новым сведениям цель недоступна. План отменён.');this.endPlan();p=null;}
      else if(blocked||this.pathCost(replacement)+1e-9<this.pathCost(p.path)) {
        p.path=replacement;
        this.log('Маршрут пересчитан','Новые наблюдения позволили выбрать путь с меньшей ценой расстояния и риска.');
      }
    }
    let expenditure=(!p||p.type==='wait') ? 0.08 : 0.25;
    if(p){
      p.steps++;
      if(p.path.length) {
        const next=p.path.shift(),cell=this.tile(next.x,next.y);
        if(cell.terrain==='water') {this.log('Путь закрыт','Обнаружена вода. Нужен другой маршрут.');this.endPlan();}
        else {a.x=next.x;a.y=next.y;expenditure+=.14;this.observe();}
      } else if(p.type==='eat') {
        if(a.inventory>0) {a.inventory--;a.stomach+=FOOD_ENERGY;this.stats.eaten++;this.log('Питание','Съедена одна порция. Началось постепенное усвоение.','good');}
        this.endPlan();
      } else if(p.type==='gather') {
        const c=this.tile(a.x,a.y);
        if(c.food>0&&a.inventory<a.capacity) {
          c.food--;a.inventory++;this.stats.gathered++;expenditure+=.15;p.remaining--;
          this.log('Сбор',`Одна порция в инвентаре (${a.inventory}/${a.capacity}).`,'good');this.observe();
        }
        if(c.food===0||a.inventory===a.capacity||p.remaining<=0)this.endPlan();
      } else if(p.type==='wait') {if(--p.remaining<=0)this.endPlan();}
      else {
        if(p.type==='revisit'){this.stats.revisited++;this.log('Повторная разведка','Сведения о знакомом участке обновлены наблюдением.','good');}
        this.endPlan();
      }
    }
    a.energy=clamp(a.energy-expenditure,0,100);
    const risk=this.tile(a.x,a.y).risk;
    if(risk&&this.random.next()<risk) {
      const damage=7+Math.floor(this.random.next()*9);a.health=Math.max(0,a.health-damage);this.stats.injuries++;
      this.log('Повреждение',`Опасный участок: здоровье −${damage}. План пересмотрен.`,'danger');this.endPlan();
    }
    if(a.energy===0)a.health=Math.max(0,a.health-3);
    if(a.health===0) {a.alive=false;this.endPlan();this.log('Житель погиб',a.energy===0?'Организм истощён.':'Накопленные повреждения оказались смертельными.','danger');}
    // Bound commitment so plans do not continue indefinitely as conditions change.
    if(a.plan&&a.plan.steps>=14)this.endPlan();
    this.record();
  }
  advance(n) {for(let i=0;i<n&&this.agent.alive;i++)this.step();}
  record() {
    this.history.push({tick:this.tick,energy:this.agent.energy,health:this.agent.health,inventory:this.agent.inventory,stomach:this.agent.stomach});
    if(this.history.length>800)this.history.shift();
  }
  snapshot() {
    return {seed:this.seed,scenario:this.scenario,tick:this.tick,rng:this.random.state,
      agent:{...this.agent,memory:[...this.agent.memory.entries()]},stats:{...this.stats},
      tiles:this.tiles.map(c=>({...c})),lastDecision:this.lastDecision,events:this.events,history:this.history};
  }
}
