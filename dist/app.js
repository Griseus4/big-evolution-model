import {Simulation, WIDTH, HEIGHT, key, hexCenter, hexAt, HEX_RADIUS, HEX_WIDTH, MAP_WIDTH, MAP_HEIGHT, FOOD_ENERGY} from './simulation.js';
const $=id=>document.getElementById(id);
const canvas=$('world'),ctx=canvas.getContext('2d'),chart=$('chart'),gc=chart.getContext('2d');
let sim=new Simulation(),running=true,accumulator=0,lastFrame=0,lastPaint=0,eventRevision=-1;
canvas.width=MAP_WIDTH;canvas.height=MAP_HEIGHT;
function settings(){return {seed:Number($('seed').value)>>>0,scenario:$('scenario').value,hungerSensitivity:Number($('hunger-sensitivity').value),fearSensitivity:Number($('fear-sensitivity').value)};}
function pause(){running=false;accumulator=0;update();}
function reset(useCurrent=false){running=$('autoplay').checked;accumulator=0;sim=new Simulation(useCurrent?settings():{seed:sim.seed,scenario:sim.scenario,hungerSensitivity:sim.agent.hungerSensitivity,fearSensitivity:sim.agent.fearSensitivity});eventRevision=-1;update();draw();}
function setRunning(){if(!sim.agent.alive)return;running=!running;accumulator=0;update();}
$('play').addEventListener('click',setRunning);
$('step').addEventListener('click',()=>{pause();sim.step();update();draw();});
$('restart').addEventListener('click',()=>reset());
$('apply').addEventListener('click',()=>reset(true));
$('memory-view').addEventListener('change',draw);
$('speed').addEventListener('change',()=>{accumulator=0;});
$('autoplay').addEventListener('change',()=>{running=$('autoplay').checked&&sim.agent.alive;accumulator=0;update();});
for(const name of ['hunger','fear'])$(''+name+'-sensitivity').addEventListener('input',()=>{$(name+'-output').textContent=Number($(name+'-sensitivity').value).toFixed(1)+'×';});
$('about-open').addEventListener('click',()=>{pause();$('about').showModal();});
$('about-close').addEventListener('click',()=>$('about').close());
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||$('about').open)return;
 if(e.code==='Space'){e.preventDefault();setRunning();}
 if(e.code==='ArrowRight'){e.preventDefault();pause();sim.step();update();draw();}
 if(e.code==='KeyR')reset();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();lastFrame=0;});
function update(){
 const a=sim.agent;
 $('time').textContent=`Шаг ${sim.tick}`;
 $('play').textContent=running?'Ⅱ Пауза':'▶ Автошаги';
 $('play').disabled=!a.alive;$('step').disabled=!a.alive;
 $('status').textContent=!a.alive?'Наблюдение завершено':running?'Время идёт':'На паузе';
 $('energy-value').textContent=`${Math.round(a.energy)} / 100`;$('health-value').textContent=`${a.health} / 100`;
 $('energy-bar').style.width=a.energy+'%';$('health-bar').style.width=a.health+'%';
 $('inventory-value').textContent=`${a.inventory} / ${a.capacity}`;
 $('inventory').replaceChildren(...Array.from({length:a.capacity},(_,i)=>{const s=document.createElement('span');s.className='slot'+(i<a.inventory?' filled':'');return s;}));
 $('hunger').textContent=Math.round(sim.hunger());
 $('digestion').textContent=`${(a.stomach/FOOD_ENERGY).toFixed(1)} порции`;
 $('digestion-rate').textContent=`За последний шаг: +${a.lastAbsorbed.toFixed(1)} энергии`;
 $('revisits').textContent=`Повторных проверок: ${sim.stats.revisited}`;
 const m=a.memory.get(key(a.x,a.y));$('current-risk').textContent=`${Math.round((m?.risk??0)*100)}%`;
 $('intention').textContent=!a.alive?'Житель погиб':a.plan?.label??'Выбирает следующий план';
 $('plan-description').textContent=a.plan?`${a.plan.reason} Осталось пройти: ${a.plan.path.length}.`:'Следующее решение будет принято на следующем шаге.';
 $('coverage').textContent=`Изучено ${Math.round(a.memory.size/(WIDTH*HEIGHT)*100)}%`;
 $('decision-count').textContent=`Решений: ${sim.stats.decisions}`;
 if(eventRevision!==sim.revision){
  eventRevision=sim.revision;
  $('events').replaceChildren(...sim.events.slice(0,18).map(e=>{const row=document.createElement('div');row.className='event '+e.kind;const time=document.createElement('time');time.textContent=e.tick;const body=document.createElement('div'),title=document.createElement('strong'),text=document.createElement('p');title.textContent=e.title;text.textContent=e.text;body.append(title,text);row.append(time,body);return row;}));
  const d=sim.lastDecision;
  $('choice-tick').textContent=d?`Шаг ${d.tick}`:'—';
  if(d)$('choices').replaceChildren(...d.options.map(o=>{const row=document.createElement('div');row.className='choice'+(o.label===d.chosen?' selected':'');const head=document.createElement('div');head.className='choice-row';const label=document.createElement('span'),value=document.createElement('span');label.textContent=(o.label===d.chosen?'◆ ':'')+o.label;value.textContent=Math.round(o.probability*100)+'%';head.append(label,value);const meter=document.createElement('div');meter.className='meter';const fill=document.createElement('span');fill.style.width=o.probability*100+'%';meter.append(fill);const reason=document.createElement('small');reason.textContent=o.reason;row.append(head,meter,reason);return row;}));
  else $('choices').textContent='Первое решение ещё не принято.';
 }
 $('map-state').hidden=a.alive;$('map-state').textContent='Житель погиб · опыт можно повторить';
 drawChart();
}
const noise=(x,y)=>{let n=Math.imul(x+11,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)%100/100;};
function hexPath(x,y){
 ctx.beginPath();
 for(let i=0;i<6;i++){const angle=(60*i-30)*Math.PI/180,px=x+HEX_RADIUS*Math.cos(angle),py=y+HEX_RADIUS*Math.sin(angle);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
 ctx.closePath();
}
function draw(){
 const memory=$('memory-view').checked,a=sim.agent;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#1e2922';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const c of sim.tiles){
  const known=a.memory.get(key(c.x,c.y)),shown=memory?known:c,{x,y}=hexCenter(c),n=noise(c.x,c.y);
  hexPath(x,y);
  ctx.fillStyle=!shown?(n>.5?'#27332b':'#29352d'):shown.terrain==='water'?(n>.5?'#466d71':'#41686d'):(n>.7?'#819267':n>.35?'#78895f':'#738459');ctx.fill();
  ctx.save();ctx.clip();
  if(!shown){ctx.fillStyle='#485442';ctx.fillRect(x-1,y-1,2,2);}
  else if(shown.terrain==='water'){
   ctx.strokeStyle='#69909466';ctx.beginPath();ctx.moveTo(x-10,y+2);ctx.quadraticCurveTo(x,y-2,x+10,y+2);ctx.stroke();
  }else{
   ctx.fillStyle='#a6b27b44';ctx.fillRect(x-10+n*5,y-8,2,5);ctx.fillRect(x+8,y+6,2,4);
   if(shown.risk>0){ctx.fillStyle=`rgba(153,67,48,${shown.risk*3.4})`;ctx.fillRect(x-HEX_WIDTH,y-HEX_RADIUS,2*HEX_WIDTH,2*HEX_RADIUS);if(shown.risk>.10){ctx.strokeStyle='#d1a58d';ctx.beginPath();ctx.moveTo(x-8,y+5);ctx.lineTo(x,y-9);ctx.lineTo(x+8,y+5);ctx.stroke();}}
   if(shown.food>0){
    ctx.fillStyle='#365735';for(const [dx,dy,r] of [[-5,0,8],[5,-1,7],[0,-6,6]]){ctx.beginPath();ctx.arc(x+dx,y+dy,r,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#dbafc9';for(const [dx,dy]of [[-5,-3],[1,-6],[6,-1],[0,4]]){ctx.beginPath();ctx.arc(x+dx,y+dy,2.2,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#f1e9d7';ctx.font='10px Segoe UI';ctx.textAlign='center';ctx.fillText(shown.food,x,y+15);
   }else if(shown.maxFood>0){ctx.strokeStyle='#b4c296';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.stroke();}
  }
  if(memory&&shown&&sim.tick-shown.seenAt>30){ctx.fillStyle='#18261b66';ctx.fillRect(x-HEX_WIDTH,y-HEX_RADIUS,2*HEX_WIDTH,2*HEX_RADIUS);}
  ctx.restore();hexPath(x,y);ctx.strokeStyle='#263a2a80';ctx.lineWidth=.8;ctx.stroke();
 }
 if(a.plan?.path.length){ctx.strokeStyle='#f0d998';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();const start=hexCenter(a);ctx.moveTo(start.x,start.y);for(const p of a.plan.path){const c=hexCenter(p);ctx.lineTo(c.x,c.y);}ctx.stroke();ctx.setLineDash([]);}
 const {x,y}=hexCenter(a);
 ctx.fillStyle='#1b2b2966';ctx.beginPath();ctx.ellipse(x,y+9,12,5,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=a.alive?'#f7e4ae':'#c28c78';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle=a.alive?'#e3c68a':'#9c7565';ctx.fillRect(x-5,y-1,10,12);ctx.beginPath();ctx.arc(x,y-7,5,0,Math.PI*2);ctx.fill();
 $('map-badge').textContent=memory?'Память жителя · старые сведения затемнены':'Весь мир · эти сведения доступны только наблюдателю';
}
canvas.addEventListener('mousemove',e=>{
 const box=canvas.getBoundingClientRect(),p=hexAt((e.clientX-box.left)/box.width*canvas.width,(e.clientY-box.top)/box.height*canvas.height);
 if(!p){$('cell-info').textContent='За пределами карты.';return;}
 const {x,y}=p,memory=$('memory-view').checked,c=memory?sim.agent.memory.get(key(x,y)):sim.tile(x,y);
 $('cell-info').textContent=c?`(${x+1}, ${y+1}) · ${c.terrain==='water'?'Вода':'Суша'} · еда ${c.food} · риск ${Math.round(c.risk*100)}%${memory?' · наблюдение на шаге '+c.seenAt+' (давность '+(sim.tick-c.seenAt)+')':''}`:`(${x+1}, ${y+1}) · Житель ещё не знает это место.`;
});
canvas.addEventListener('mouseleave',()=>{$('cell-info').textContent='Наведите курсор на гекс, чтобы проверить сведения.';});
function drawChart(){
 const w=chart.width,h=chart.height;gc.clearRect(0,0,w,h);gc.strokeStyle='#354238';gc.lineWidth=1;
 for(const level of [0,50,100]){const y=h-16-level/100*(h-24);gc.beginPath();gc.moveTo(30,y);gc.lineTo(w,y);gc.stroke();gc.fillStyle='#80907b';gc.font='12px Segoe UI';gc.fillText(level,0,y+4);}
 const hist=sim.history;
 for(const [field,color]of [['energy','#d6c28b'],['health','#94be8c']]){
  gc.strokeStyle=color;gc.lineWidth=2;gc.beginPath();hist.forEach((p,i)=>{const x=30+i/Math.max(hist.length-1,1)*(w-34),y=h-16-p[field]/100*(h-24);if(!i)gc.moveTo(x,y);else gc.lineTo(x,y);});gc.stroke();
 }
}
function frame(now){
 if(!lastFrame)lastFrame=now;
 const elapsed=Math.min((now-lastFrame)/1000,.15);lastFrame=now;
 if(running){accumulator+=elapsed*6*Number($('speed').value);let count=Math.min(100,Math.floor(accumulator));accumulator-=count;sim.advance(count);if(!sim.agent.alive)running=false;}
 if(now-lastPaint>100){update();draw();lastPaint=now;}
 requestAnimationFrame(frame);
}
update();draw();requestAnimationFrame(frame);
