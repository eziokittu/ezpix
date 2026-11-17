import {validateRaster,type Raster} from './conversion.js';
import type {RGBA} from './document.js';

export const GRADIENT_STYLES=['linear','radial','angle','reflected','diamond'] as const;
export type GradientStyle=typeof GRADIENT_STYLES[number];
export type PaintPoint={x:number;y:number};
export interface PhotoPaint {
 mode:'gradient'|'bucket'|'solid'|'pattern';
 foreground:RGBA; background:RGBA; opacity:number;
 start:PaintPoint; end:PaintPoint; style:GradientStyle;
 tolerance:number; contiguous:boolean;
 pattern:'checker'|'stripes'|'dots'; scale:number;
}
const bound=(n:number,min:number,max:number)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error('Paint value is out of bounds.');};
/** Local full-resolution fill. Returns an existing patch operation, keeping photo v2 compatible. */
export function paintPhoto(source:Raster,options:PhotoPaint,selection:Uint8Array|null=null):{kind:'patch';image:Raster;mask:Uint8Array}{
 validateRaster(source);
 const {width:w,height:h}=source,n=w*h;
 if(!options||!['gradient','bucket','solid','pattern'].includes(options.mode)||!GRADIENT_STYLES.includes(options.style)||!['checker','stripes','dots'].includes(options.pattern)||typeof options.contiguous!=='boolean')throw Error('Choose valid Paint options.');
 for(const color of [options.foreground,options.background])if(!Array.isArray(color)||color.length!==4||color.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Choose an RGBA paint colour.');
 for(const point of [options.start,options.end]){if(!point)throw Error('Choose a paint position.');bound(point.x,0,1);bound(point.y,0,1);}
 bound(options.opacity,0,1);bound(options.tolerance,0,255);bound(options.scale,2,512);
 if(selection!==null&&(!(selection instanceof Uint8Array)||selection.length!==n||selection.some(v=>v>1)))throw Error('This selection belongs to a different canvas.');
 const mask=new Uint8Array(n),pixels=source.pixels.slice();
 const sx=options.start.x*(w-1),sy=options.start.y*(h-1),ex=options.end.x*(w-1),ey=options.end.y*(h-1),dx=ex-sx,dy=ey-sy,length=Math.hypot(dx,dy);
 if(options.mode==='gradient'&&length<.5)throw Error('Drag a longer line to paint a gradient.');
 if(options.mode==='bucket'){
  const seed=Math.round(sy)*w+Math.round(sx),offset=seed*4;
  const matches=(i:number)=> (!selection||!!selection[i])&&[0,1,2,3].every(c=>Math.abs(source.pixels[i*4+c]-source.pixels[offset+c])<=options.tolerance);
  if(matches(seed)){
   if(options.contiguous){
    // One bounded queue and visited bit per source pixel; no recursion or duplicate entries.
    const queue=new Int32Array(n),seen=new Uint8Array(n);let head=0,tail=1;queue[0]=seed;seen[seed]=1;
    const add=(i:number)=>{if(!seen[i]){seen[i]=1;if(matches(i))queue[tail++]=i;}};
    while(head<tail){const i=queue[head++];mask[i]=1;const x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);if(i>=w)add(i-w);if(i<n-w)add(i+w);}
   }else for(let i=0;i<n;i++)if(matches(i))mask[i]=1;
  }
 }else for(let i=0;i<n;i++)if(!selection||selection[i])mask[i]=1;
 for(let i=0;i<n;i++)if(mask[i]){
  const x=i%w,y=Math.floor(i/w);let t=0;
  if(options.mode==='gradient'){
   const px=x-sx,py=y-sy,projection=(px*dx+py*dy)/(length*length);
   if(options.style==='linear')t=projection;
   else if(options.style==='radial')t=Math.hypot(px,py)/length;
   else if(options.style==='reflected')t=Math.abs(projection);
   else if(options.style==='diamond')t=(Math.abs(px*dx+py*dy)+Math.abs(py*dx-px*dy))/(length*length);
   else t=((Math.atan2(py,px)-Math.atan2(dy,dx))/(2*Math.PI)+1)%1;
   t=Math.max(0,Math.min(1,t));
  }else if(options.mode==='pattern'){
   const size=options.scale;
   t=options.pattern==='checker'?(Math.floor(x/size)+Math.floor(y/size))%2:options.pattern==='stripes'?Math.floor((x+y)/size)%2:(Math.hypot(x%size-size/2,y%size-size/2)<size*.28?0:1);
  }
  const color=options.foreground.map((v,c)=>v+(options.background[c]-v)*t),p=i*4,a=color[3]/255*options.opacity,da=pixels[p+3]/255,oa=a+da*(1-a);
  if(oa){for(let c=0;c<3;c++)pixels[p+c]=(color[c]*a+pixels[p+c]*da*(1-a))/oa;pixels[p+3]=oa*255;}
 }
 return {kind:'patch',image:{width:w,height:h,pixels},mask};
}
