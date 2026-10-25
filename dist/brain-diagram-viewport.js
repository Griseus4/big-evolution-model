/** Геометрия камеры в CSS-пикселях, без DOM/мозга/RNG. */
export const NODE_PITCH=28,EDGE_WIDTH=1.1;
export function diagramLayout(model){
 const groups=new Map();for(const node of model.nodes){if(!groups.has(node.layer))groups.set(node.layer,[]);groups.get(node.layer).push(node);}
 const levels=[...groups.keys()].sort((a,b)=>a-b),rows=Math.max(1,...[...groups.values()].map(g=>g.length));
 const width=440+Math.max(1,levels.length-1)*280,height=Math.max(140,(rows-1)*NODE_PITCH+80),nodes=[];
 levels.forEach((level,column)=>groups.get(level).forEach((node,row)=>nodes.push({...node,x:220+column*280,y:40+(row-(groups.get(level).length-1)/2)*NODE_PITCH+(height-80)/2})));
 return {nodes,lookup:new Map(nodes.map(n=>[n.id,n])),width,height,pitch:NODE_PITCH};
}
const bound=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function fitViewport(layout,width,height){
 width=Math.max(1,width);height=Math.max(1,height);
 const min=Math.max(.0001,Math.min(Math.max(1,width-32)/layout.width,Math.max(1,height-32)/layout.height));
 const max=Math.max(min,(height-32)/(3*layout.pitch));
 return {width,height,min,max,scale:min,x:(width-layout.width*min)/2,y:(height-layout.height*min)/2};
}
export function clampViewport(camera,layout){
 const sizeX=layout.width*camera.scale,sizeY=layout.height*camera.scale;
 camera.x=sizeX<=camera.width?(camera.width-sizeX)/2:bound(camera.x,camera.width-sizeX-16,16);
 camera.y=sizeY<=camera.height?(camera.height-sizeY)/2:bound(camera.y,camera.height-sizeY-16,16);return camera;
}
export function zoomViewport(camera,layout,factor,x=camera.width/2,y=camera.height/2){
 const scale=bound(camera.scale*factor,camera.min,camera.max),ratio=scale/camera.scale;
 camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.scale=scale;return clampViewport(camera,layout);
}
export function panViewport(camera,layout,dx,dy){camera.x+=dx;camera.y+=dy;return clampViewport(camera,layout);}
export function resizeViewport(camera,layout,width,height){
 const next=fitViewport(layout,width,height);if(!camera||Math.abs(camera.scale-camera.min)<1e-8)return next;
 const wx=(camera.width/2-camera.x)/camera.scale,wy=(camera.height/2-camera.y)/camera.scale;
 next.scale=bound(camera.scale,next.min,next.max);next.x=width/2-wx*next.scale;next.y=height/2-wy*next.scale;return clampViewport(next,layout);
}
export function diagramHit(model,layout,camera,x,y){
 const wx=(x-camera.x)/camera.scale,wy=(y-camera.y)/camera.scale;
 let node=null,nearest=Math.max(6,9/camera.scale);for(const n of layout.nodes){const distance=Math.hypot(wx-n.x,wy-n.y);if(distance<=nearest){nearest=distance;node=n;}}if(node)return {node:node.id};
 let best=6/camera.scale,chosen=null;for(const edge of model.edges){const a=layout.lookup.get(edge.from),b=layout.lookup.get(edge.to),dx=b.x-a.x,dy=b.y-a.y,t=bound(((wx-a.x)*dx+(wy-a.y)*dy)/(dx*dx+dy*dy),0,1),distance=Math.hypot(wx-a.x-t*dx,wy-a.y-t*dy);if(distance<best){best=distance;chosen=edge;}}
 return chosen?{edge:chosen.index}:null;
}
export function selectedEdge(edge,selection){return selection?.edge===edge.index||selection?.node===edge.from||selection?.node===edge.to;}
