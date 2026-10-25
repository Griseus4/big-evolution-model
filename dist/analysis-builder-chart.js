/** Рисуем только готовые ячейки. Изменение размера не запускает статистику. */
const palette=['#86bf80','#e1c86e','#91b8d0','#cba4e4','#ed9a7a','#73c8bd','#d7a6bc','#c2ca8a'];
export function analysisColor(group,index){return group.color??(group.label==='learning: вкл'?palette[0]:group.label==='learning: выкл'?palette[1]:palette[index%palette.length]);}
import {formatChartNumber} from './statistics-format.js';
const number={format:formatChartNumber};
export function drawAnalysis(canvas,result){
 if(!result||result.config.chart==='table')return;const ctx=canvas.getContext('2d');if(!ctx)return;
 const width=Math.max(340,canvas.getBoundingClientRect().width||700),height=320,ratio=Math.min(2,globalThis.devicePixelRatio||1);canvas.width=Math.round(width*ratio);canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
 const left=65,right=20,top=20,bottom=62,w=width-left-right,h=height-top-bottom,finite=result.cells.filter(p=>Number.isFinite(p.value));
 let min=0,max=0;for(const c of finite){min=Math.min(min,c.value,c.interval?.low??c.value);max=Math.max(max,c.value,c.interval?.high??c.value);}if(max===min)max=1;const span=max-min;max+=span*.06;min-=min<0?span*.03:0;
 const xs=result.xs,lo=xs[0]?.x??0,hi=xs.at(-1)?.x??1,numeric=hi>lo&&xs.every((x,i)=>!i||x.x>xs[i-1].x),xAt=i=>left+(numeric?(xs[i].x-lo)/(hi-lo):i/Math.max(1,xs.length-1))*w;
 const x=i=>xs.length===1?left+w/2:result.config.chart==='bar'?left+(i+.5)*w/xs.length:xAt(i),y=v=>top+h-(v-min)/(max-min)*h;
 ctx.font='12px system-ui';ctx.textAlign='right';for(let i=0;i<=4;i++){const v=min+(max-min)*i/4,py=y(v);ctx.strokeStyle='#35433a';ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(width-right,py);ctx.stroke();ctx.fillStyle='#b8c5b8';ctx.fillText(number.format(v),left-8,py+4);}
 ctx.textAlign='center';const stride=Math.max(1,Math.ceil(xs.length/8));for(let i=0;i<xs.length;i++)if(i%stride===0||i===xs.length-1){const label=result.config.axis==='born'?number.format(xs[i].x):xs[i].label;ctx.fillText(label.length>22?label.slice(0,20)+'…':label,x(i),height-bottom+22);}
 ctx.fillText(result.config.axis==='born'?'Период рождения родителей, Т':result.config.axis==='child'?'Номер ребёнка':result.config.axis,left+w/2,height-10);
 const index=new Map(result.cells.map(c=>[JSON.stringify([c.group,c.x]),c]));
 result.groups.forEach((group,gi)=>{ctx.strokeStyle=ctx.fillStyle=analysisColor(group,gi);ctx.lineWidth=2;let previous=null;
  xs.forEach((point,i)=>{const p=index.get(JSON.stringify([group.id,point.key]));if(!Number.isFinite(p?.value)){previous=null;return;}
   const bw=Math.min(80,w/xs.length*.8)/result.groups.length,px=x(i)+(result.config.chart==='bar'?(gi-(result.groups.length-1)/2)*bw:0),py=y(p.value);if(result.config.chart==='bar'){const bx=px-bw/2;ctx.globalAlpha=.8;ctx.fillRect(bx,Math.min(y(0),py),Math.max(1,bw-1),Math.max(1,Math.abs(y(0)-py)));ctx.globalAlpha=1;}
   else if(previous){ctx.beginPath();ctx.moveTo(previous.px,previous.py);ctx.lineTo(px,py);ctx.stroke();}
   else{ctx.beginPath();ctx.moveTo(px-3,py);ctx.lineTo(px+3,py);ctx.stroke();}
   if(p.interval){ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,y(p.interval.low));ctx.lineTo(px,y(p.interval.high));ctx.moveTo(px-3,y(p.interval.low));ctx.lineTo(px+3,y(p.interval.low));ctx.moveTo(px-3,y(p.interval.high));ctx.lineTo(px+3,y(p.interval.high));ctx.stroke();ctx.lineWidth=2;}previous={px,py};
  });
 });
}
