import {validateRaster,type Raster} from './conversion.js';
import type {FocusRect} from './focus.js';
export type SelectionPoint={x:number;y:number};
export type SelectionMode='replace'|'add'|'subtract';
function size(width:number,height:number){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4*1024*1024)throw Error('Selection exceeds the image budget.');}
/** Four-connected, seed-relative colour selection. A fixed seed prevents gradual leakage. */
export function magicFocusSelection(source:Raster,point:SelectionPoint,tolerance:number):Uint8Array{
 validateRaster(source);size(source.width,source.height);
 if(!Number.isInteger(point.x)||!Number.isInteger(point.y)||point.x<0||point.y<0||point.x>=source.width||point.y>=source.height||!Number.isInteger(tolerance)||tolerance<0||tolerance>255)throw Error('Invalid magic selection.');
 const {width:w,height:h,pixels}=source,mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),queue=new Int32Array(w*h),seed=(point.y*w+point.x)*4;let start=0,end=0;
 if(!pixels[seed+3])return mask;
 const add=(i:number)=>{if(seen[i])return;seen[i]=1;const p=i*4;if(!pixels[p+3]||Math.max(Math.abs(pixels[p]-pixels[seed]),Math.abs(pixels[p+1]-pixels[seed+1]),Math.abs(pixels[p+2]-pixels[seed+2]))>tolerance)return;mask[i]=1;queue[end++]=i;};
 add(point.y*w+point.x);while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}return mask;
}
export function shapeFocusSelection(width:number,height:number,shape:'rectangle'|'ellipse'|'polygon',points:SelectionPoint[]):Uint8Array{
 size(width,height);if(!['rectangle','ellipse','polygon'].includes(shape)||points.length<2||points.length>8192||points.some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=width||p.y>=height)||shape==='polygon'&&points.length<3)throw Error('Draw an outline with at least three points.');
 const mask=new Uint8Array(width*height);let left=width,top=height,right=0,bottom=0;for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 if(shape==='polygon'){
  if(points.length*(bottom-top+1)>32*1024*1024)throw Error('Outline exceeds the selection work budget. Use fewer points or a smaller image.');
  for(let y=top;y<=bottom;y++){const py=y+.5,crossings:number[]=[];for(let k=0,j=points.length-1;k<points.length;j=k++){const p=points[k],q=points[j];if((p.y>py)!==(q.y>py))crossings.push((q.x-p.x)*(py-p.y)/(q.y-p.y)+p.x);}crossings.sort((a,b)=>a-b);for(let i=0;i+1<crossings.length;i+=2){const from=Math.max(left,Math.ceil(crossings[i]-.5)),to=Math.min(right+1,Math.ceil(crossings[i+1]-.5));mask.fill(1,y*width+from,y*width+to);}}
 }else for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(shape==='rectangle'||((x+.5-(left+right+1)/2)/((right-left+1)/2))**2+((y+.5-(top+bottom+1)/2)/((bottom-top+1)/2))**2<=1)mask[y*width+x]=1;
 return mask;
}
export function brushFocusSelection(mask:Uint8Array,width:number,height:number,from:SelectionPoint,to:SelectionPoint,radius:number){
 size(width,height);if(mask.length!==width*height||!Number.isFinite(radius)||radius<.5||radius>128||[from,to].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=width||p.y>=height))throw Error('Invalid selection brush.');
 const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
 for(let y=Math.max(0,Math.floor(Math.min(from.y,to.y)-radius));y<=Math.min(height-1,Math.ceil(Math.max(from.y,to.y)+radius));y++)for(let x=Math.max(0,Math.floor(Math.min(from.x,to.x)-radius));x<=Math.min(width-1,Math.ceil(Math.max(from.x,to.x)+radius));x++){const t=length?Math.max(0,Math.min(1,((x-from.x)*dx+(y-from.y)*dy)/length)):0;if((x-from.x-t*dx)**2+(y-from.y-t*dy)**2<=radius*radius)mask[y*width+x]=1;}
}
export function combineFocusSelection(current:Uint8Array|null,next:Uint8Array,mode:SelectionMode):Uint8Array{
 if(!['replace','add','subtract'].includes(mode)||current&&current.length!==next.length||next.some(n=>n>1)||current?.some(n=>n>1))throw Error('Invalid selection mask.');
 if(mode==='replace')return next.slice();return next.map((n,i)=>mode==='add'?Number(!!n||!!(current?.[i]??1)):Number(!!(current?.[i]??1)&&!n));
}
/** Compact mask follows its crop when motion tracking translates the selection. */
export function cropFocusSelection(mask:Uint8Array,width:number,height:number):{rect:FocusRect;mask:Uint8Array}|null{
 size(width,height);if(mask.length!==width*height||mask.some(n=>n>1))throw Error('Invalid selection mask.');let left=width,top=height,right=-1,bottom=-1;
 for(let i=0;i<mask.length;i++)if(mask[i]){const x=i%width,y=Math.floor(i/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<0)return null;const rect={x:left,y:top,width:right-left+1,height:bottom-top+1},cropped=new Uint8Array(rect.width*rect.height);for(let y=0;y<rect.height;y++)cropped.set(mask.subarray((y+top)*width+left,(y+top)*width+right+1),y*rect.width);return {rect,mask:cropped};
}
