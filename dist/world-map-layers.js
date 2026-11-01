/** Три Canvas-слоя ограниченного размера: рельеф, пища и сведения наблюдателя.
 * Движущиеся точки рисуются поверх; ни DOM, ни карта не пересобираются на rAF. */
import {hexCenter,HEX_RADIUS} from './evolution.js';
export function traceHex(context,x,y){context.beginPath();for(let i=0;i<6;i++){const angle=(i*60-30)*Math.PI/180,px=x+HEX_RADIUS*Math.cos(angle),py=y+HEX_RADIUS*Math.sin(angle);if(i===0)context.moveTo(px,py);else context.lineTo(px,py);}context.closePath();}
export function drawTerrainLayer(context,tiles,width,height){
 context.clearRect(0,0,width,height);context.fillStyle='#1e2922';context.fillRect(0,0,width,height);
 for(const cell of tiles){const {x,y}=hexCenter(cell);traceHex(context,x,y);const shade=(cell.x*13+cell.y*7)%3;
  context.fillStyle=cell.terrain==='water'?(cell.feature==='river'?'#477b8a':'#416b70'):cell.feature==='ford'?'#a6b493':['#71875c','#788d62','#809367'][shade];context.fill();
  context.strokeStyle='#233b2b77';context.lineWidth=.6;context.stroke();
  if(cell.feature==='ford'){context.strokeStyle='#47665a';context.lineWidth=1.5;context.beginPath();context.moveTo(x-8,y-4);context.lineTo(x+8,y-4);context.moveTo(x-8,y+4);context.lineTo(x+8,y+4);context.stroke();}
 }
}
export function drawFoodLayer(context,tiles,width,height){
 context.clearRect(0,0,width,height);
 for(const cell of tiles){const {x,y}=hexCenter(cell);
  if(cell.food>0){context.fillStyle='#324d31';context.beginPath();context.arc(x,y-2,7,0,Math.PI*2);context.fill();
   context.fillStyle='#d5acc5';context.beginPath();context.arc(x-3,y-3,2.5,0,Math.PI*2);context.arc(x+3,y,2.5,0,Math.PI*2);context.fill();
   context.font='9px Segoe UI';context.textAlign='center';context.fillStyle='#e9edda';context.fillText(cell.food,x,y+14);
   if(cell.maxFood===0){context.strokeStyle='#dfc98c';context.setLineDash([2,2]);context.beginPath();context.arc(x,y-2,9,0,Math.PI*2);context.stroke();context.setLineDash([]);}
  }else if(cell.maxFood>0){context.strokeStyle='#b9c69677';context.beginPath();context.arc(x,y,4,0,Math.PI*2);context.stroke();}
 }
}
export class WorldMapLayers{
 constructor(canvas,createCanvas){this.canvas=canvas;this.layers=Array.from({length:3},createCanvas);this.tiles=null;this.foodRevision=null;this.overlayDirty=true;this.builds={terrain:0,food:0,overlay:0};}
 invalidateOverlay(){this.overlayDirty=true;}
 draw(context,view,drawOverlay){
  const width=this.canvas.width,height=this.canvas.height;
  const terrainKey=view.terrainRevision??view.tiles;
  if(this.owner!==view||this.terrainKey!==terrainKey||this.layers[0].width!==width||this.layers[0].height!==height){
   for(const layer of this.layers){layer.width=width;layer.height=height;}
   drawTerrainLayer(this.layers[0].getContext('2d'),view.tiles,width,height);this.builds.terrain++;
   this.owner=view;this.terrainKey=terrainKey;this.foodRevision=null;this.overlayDirty=true;
  }
  const revision=view.foodRevision??view.tick;
  if(this.foodRevision!==revision){drawFoodLayer(this.layers[1].getContext('2d'),view.tiles,width,height);this.foodRevision=revision;this.builds.food++;}
  if(this.overlayDirty){const c=this.layers[2].getContext('2d');c.clearRect(0,0,width,height);drawOverlay(c);this.overlayDirty=false;this.builds.overlay++;}
  for(const layer of this.layers)context.drawImage(layer,0,0);
 }
}
