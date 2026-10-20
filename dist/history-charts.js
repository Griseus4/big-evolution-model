/** Canvas-графики наблюдателя: без DOM-узла на каждую точку.
 * Получают готовые сводки; масштабирование/выбор не пересчитывает жизни. */
export const HISTORY_LINES=Object.freeze([
 {id:'min',label:'Минимум',color:'#91b8d0'}, {id:'median',label:'Медиана',color:'#e1c88c'},
 {id:'mean',label:'Среднее',color:'#86bf80'}, {id:'max',label:'Максимум',color:'#cba4e4'},
].map(Object.freeze));
const short=new Intl.NumberFormat('ru-RU',{notation:'compact',maximumSignificantDigits:3});
const label=n=>short.format(n);
const LEFT=58,RIGHT=14,TOP=16,BOTTOM=40,HEIGHT=235;
const position=(p,width)=>p.x??((p.start??p.id*width)+(p.end??(p.id+1)*width))/2;
export function historyChartMaximum(points,keys,maximum=null){
 if(maximum!==null)return maximum;
 let max=0;for(const p of points)for(const key of keys)if(Number.isFinite(p[key]))max=Math.max(max,p[key]);
 return max?Math.min(Number.MAX_VALUE,max*1.08):1;
}
export function drawHistoryChart(canvas,{points,keys,domainStart=0,domainEnd,width=1,selected=null,single=false,maximum=null,minimum=0,age=false,markers=[],xLabel=null,xTicks=null,histogram=false,lines=HISTORY_LINES,bands=[]}){
 const context=canvas.getContext('2d');if(!context)return;
 const cssWidth=Math.max(280,Math.round(canvas.getBoundingClientRect().width||600)),ratio=Math.min(2,globalThis.devicePixelRatio||1);
 const pixelWidth=Math.round(cssWidth*ratio),pixelHeight=Math.round(HEIGHT*ratio);
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,cssWidth,HEIGHT);
 const span=cssWidth-LEFT-RIGHT,h=HEIGHT-TOP-BOTTOM;
 const max=historyChartMaximum(points,[...keys,...bands.map(b=>b.high)],maximum),count=points.reduce((n,p)=>n+Number(keys.some(key=>Number.isFinite(p[key]))),0);
 const x=value=>LEFT+(value-domainStart)/(domainEnd-domainStart)*span,y=value=>TOP+h-(value-minimum)/(max-minimum)*h;
 context.font='11px system-ui';context.lineWidth=1;
 for(let i=0;i<=4;i++){
  const py=TOP+h-i*h/4;context.strokeStyle='#35433a';context.beginPath();context.moveTo(LEFT,py);context.lineTo(cssWidth-RIGHT,py);context.stroke();
  context.fillStyle='#a6b3a6';context.textAlign='right';context.fillText(label(minimum+(max-minimum)*i/4),LEFT-8,py+4);
 }
 context.textAlign='center';context.font=xTicks?'10px system-ui':'11px system-ui';if(xTicks){for(const tick of xTicks)if(tick>=domainStart&&tick<=domainEnd)context.fillText(label(tick),x(tick),HEIGHT-20);}
 else for(let i=0;i<=4;i++)context.fillText(label(domainStart+(domainEnd-domainStart)*i/4),LEFT+span*i/4,HEIGHT-20);
 context.font='11px system-ui';
 context.fillStyle='#a6b3a6';context.textAlign='center';context.fillText(xLabel??(age?'Возраст, Т':single==='food'?'Время мира, Т':'Время рождения, Т'),LEFT+span/2,HEIGHT-2);
 if(selected!==null){const p=points.find(p=>p.id===selected);if(p){const px=x(position(p,width));context.strokeStyle='#e1c88c88';context.setLineDash([3,4]);context.beginPath();context.moveTo(px,TOP);context.lineTo(px,TOP+h);context.stroke();context.setLineDash([]);}}
 if(!count){context.fillStyle='#a6b3a6';context.fillText(keys.length?'Пока недостаточно данных':'Выбери хотя бы одну линию',LEFT+span/2,TOP+h/2);return;}
 if(histogram){const bin=width/(domainEnd-domainStart)*span;for(const p of points)for(let i=0;i<keys.length;i++){const key=keys[i];if(!Number.isFinite(p[key]))continue;context.fillStyle=lines.find(l=>l.id===key)?.color??'#86bf80';context.fillRect(x(p.x-width/2)+i*bin/keys.length+.25,y(p[key]),Math.max(.1,bin/keys.length-.5),y(0)-y(p[key]));}return;}
 for(const band of bands){
  context.fillStyle=band.color+'30';let previous=null;
  for(const p of points){
   if(!Number.isFinite(p[band.low])||!Number.isFinite(p[band.high])){previous=null;continue;}
   const px=x(position(p,width));
   if(previous&&p.id===previous.id+1){const left=x(position(previous,width));context.beginPath();context.moveTo(left,y(previous[band.low]));context.lineTo(px,y(p[band.low]));context.lineTo(px,y(p[band.high]));context.lineTo(left,y(previous[band.high]));context.lineTo(left,y(previous[band.low]));context.fill();}
   else context.fillRect(px-1,y(p[band.high]),2,Math.max(1,y(p[band.low])-y(p[band.high])));
   previous=p;
  }
 }
 if(age&&points.some(p=>Number.isFinite(p.upper))){
  // Полоса показывает границы исхода для живых, ещё не достигших возраста.
  for(let i=1;i<points.length;i++){const p=points[i-1],next=points[i];if(p.upper<=p.lower)continue;context.fillStyle='#86bf8028';context.fillRect(x(p.x),y(p.upper),x(next.x)-x(p.x),y(p.lower)-y(p.upper));}
 }
 for(const key of keys){
  context.strokeStyle=lines.find(l=>l.id===key)?.color??'#86bf80';context.fillStyle=context.strokeStyle;context.lineWidth=key==='median'?2.2:1.4;
  let previous=null;
  for(const p of points){
   const v=p[key];if(!Number.isFinite(v)){previous=null;continue;}
   const px=x(position(p,width)),py=y(v);
   if(previous&&p.id===previous.id+1){
    context.setLineDash(lines.find(l=>l.id===key)?.dashed?[4,4]:(age?previous.complete:previous.complete&&p.complete)?[]:[4,4]);context.beginPath();context.moveTo(x(position(previous,width)),y(previous[key]));
    if(age){context.lineTo(px,y(previous[key]));context.stroke();context.setLineDash(lines.find(l=>l.id===key)?.dashed?[4,4]:p.complete?[]:[4,4]);context.beginPath();context.moveTo(px,y(previous[key]));}
    context.lineTo(px,py);context.stroke();
   }
   // Одиночный интервал остаётся видимым тонким штрихом, без кружков.
   if(!age&&count===1){context.setLineDash(lines.find(l=>l.id===key)?.dashed?[4,4]:p.complete?[]:[4,4]);context.beginPath();context.moveTo(px-4,py);context.lineTo(px+4,py);context.stroke();}
   context.setLineDash([]);previous=p;
  }
 }
 if(age&&points.some(p=>Number.isFinite(p.upper))){context.strokeStyle='#86bf8099';context.setLineDash([4,4]);for(let i=1;i<points.length;i++){const p=points[i-1],next=points[i];if(p.upper===p.lower&&next.upper===next.lower)continue;context.beginPath();context.moveTo(x(p.x),y(p.upper));context.lineTo(x(next.x),y(p.upper));context.lineTo(x(next.x),y(next.upper));context.stroke();}context.setLineDash([]);}
 // Разные строки подписи сохраняют читаемость при совпавших среднем и медиане.
 for(const [i,marker]of markers.entries()){
  if(!Number.isFinite(marker.value)||marker.value<domainStart||marker.value>domainEnd)continue;
  const px=x(marker.value);context.strokeStyle=marker.color;context.lineWidth=1.5;context.setLineDash(i%2?[2,3]:[7,3]);
  context.beginPath();context.moveTo(px,TOP);context.lineTo(px,TOP+h);context.stroke();context.setLineDash([]);
  const right=px>LEFT+span/2;context.textAlign=right?'right':'left';context.fillStyle=marker.color;context.fillText(`${marker.label}: ${label(marker.value)} Т`,px+(right?-5:5),TOP+13+i*16);
 }
}
export function chartTimeAt(canvas,clientX,start,end){
 const box=canvas.getBoundingClientRect(),span=Math.max(1,box.width-LEFT-RIGHT);
 return Math.max(start,Math.min(end,start+(clientX-box.left-LEFT)/span*(end-start)));
}
export function chartCohortAt(canvas,clientX,domainEnd,width,domainStart=0){
 const time=chartTimeAt(canvas,clientX,domainStart,domainEnd);
 return Math.max(Math.floor(domainStart/width),Math.min(Math.ceil(domainEnd/width)-1,Math.floor(time/width)));
}
