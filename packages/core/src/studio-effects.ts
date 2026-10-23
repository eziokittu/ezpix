import type {StudioOptions} from './studio.js';
import {compositeDrawingPixel} from './drawing.js';
import type {RGBA} from './document.js';
/** Original EzPix 3x5 block glyphs. No system fonts, canvas text or external assets. */
import {alphabet,glyphs,BITMAP_TEXT_CHARACTERS} from './bitmap-text.js';
export {BITMAP_TEXT_CHARACTERS} from './bitmap-text.js';
const round=(v:number)=>Math.floor(v+.5);
const clamp=(v:number)=>Math.max(0,Math.min(255,round(v)));
export function validateStudioEffects(o:StudioOptions){
 if(o.text!==undefined&&(typeof o.text!=='string'||o.text.length>128||[...o.text.toUpperCase()].some(c=>!BITMAP_TEXT_CHARACTERS.includes(c))))throw new Error('Text supports at most 128 basic Latin letters, digits, spaces, newlines and !?.,:-+/().');
 if(o.kind==='text'&&(!o.text?.trim()||o.radius>8||o.secondaryAmount<0||o.secondaryAmount>8||!o.points.length))throw new Error('Text needs content, origin, scale 1-8 and spacing 0-8.');
 if(o.kind==='iso'&&(!o.points.length||o.amount<1||o.amount>32))throw new Error('Isometric construction needs an origin and extent 1-32.');
 if(o.kind==='iso'&&o.variant==='box'&&(o.secondaryAmount<1||o.secondaryAmount>32))throw new Error('Box height must be 1-32 units.');
 if(o.kind==='edges'&&(o.amount<0||o.amount>500))throw new Error('Edge gain must be 0-500 percent.');
 if(o.kind==='motion'&&(Math.abs(o.amount)>32||Math.abs(o.secondaryAmount)>32))throw new Error('Motion vector must stay within -32 to 32 pixels.');
 if(o.kind==='posterize'&&(o.amount<2||o.amount>32))throw new Error('Posterization needs 2-32 levels.');
 if(o.kind==='noise'&&(!Number.isInteger(o.seed)||o.seed!<0||o.seed!>0xffffffff||o.amount<0||o.amount>255||o.secondaryAmount<0||o.secondaryAmount>100))throw new Error('Noise needs uint32 seed, strength 0-255 and density 0-100.');
}
/** Null means the operation belongs to the original studio raster family. */
export function studioEffects(before:Uint8ClampedArray,w:number,h:number,o:StudioOptions):Uint8ClampedArray|null{
 if(!['text','iso','motion','mosaic','posterize','edges','noise'].includes(o.kind))return null;
 const out=before.slice(),index=(x:number,y:number)=>(y*w+x)*4;
 const sample=(x:number,y:number)=>{x=o.wrap?(x%w+w)%w:Math.max(0,Math.min(w-1,x));y=o.wrap?(y%h+h)%h:Math.max(0,Math.min(h-1,y));return index(x,y);};
 const put=(x:number,y:number,c:RGBA)=>{if(x<0||x>=w||y<0||y>=h)return;const i=index(x,y);out.set(compositeDrawingPixel([...out.subarray(i,i+4)] as unknown as RGBA,c,o.over?'over':'replace'),i);};
 if(o.kind==='text'){
  const origin=o.points[0],scale=o.radius;let x=origin.x,y=origin.y;
  for(const c of o.text!.toUpperCase()){if(c==='\n'){x=origin.x;y+=6*scale;continue;}const bits=glyphs[alphabet.indexOf(c)];if(bits)for(let k=0;k<15;k++)if(bits[k]==='1')for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++)put(x+k%3*scale+dx,y+Math.floor(k/3)*scale+dy,o.color);x+=(3+o.secondaryAmount)*scale;}
  return out;
 }
 if(o.kind==='iso'){
  const origin=o.points[0],s=o.radius,n=o.amount,marks=new Map<number,RGBA>();
  const mark=(x:number,y:number,c:RGBA)=>{if(x>=0&&x<w&&y>=0&&y<h)marks.set(y*w+x,c);};
  const line=(ax:number,ay:number,bx:number,by:number,c:RGBA)=>{const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let t=0;t<=steps;t++)mark(round(ax+(bx-ax)*(steps?t/steps:0)),round(ay+(by-ay)*(steps?t/steps:0)),c);};
  const iso=(u:number,v:number,z=0)=>({x:origin.x+(u-v)*2*s,y:origin.y+(u+v)*s-z*2*s});
  const edge=(a:ReturnType<typeof iso>,b:ReturnType<typeof iso>,c:RGBA=o.color)=>line(a.x,a.y,b.x,b.y,c);
  if(o.variant==='grid')for(let k=0;k<=n;k++){edge(iso(k,0),iso(k,n));edge(iso(0,k),iso(n,k));}
  else{const a=iso(0,0),b=iso(n,0),c=iso(n,n),d=iso(0,n);edge(a,b);edge(b,c);edge(c,d);edge(d,a);if(o.variant==='box'){const height=Math.max(1,o.secondaryAmount);for(const [u,v] of [[0,0],[n,0],[n,n],[0,n]])edge(iso(u,v),iso(u,v,height),o.secondary);const A=iso(0,0,height),B=iso(n,0,height),C=iso(n,n,height),D=iso(0,n,height);edge(A,B,o.secondary);edge(B,C,o.secondary);edge(C,D,o.secondary);edge(D,A,o.secondary);}}
  for(const [i,c] of marks)put(i%w,Math.floor(i/w),c);return out;
 }
 const hash=(x:number,y:number,k:number)=>{let n=(o.seed!^Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b)^Math.imul(k+1,0xc2b2ae35))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);return (n^(n>>>15))>>>0;};
 const average=(indices:number[],i:number)=>{let alpha=0;const channels=[0,0,0];for(const j of indices){alpha+=before[j+3];for(let k=0;k<3;k++)channels[k]+=before[j+k]*before[j+3];}out[i+3]=round(alpha/indices.length);if(alpha)for(let k=0;k<3;k++)out[i+k]=round(channels[k]/alpha);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=index(x,y);
  if(o.kind==='motion'){const samples=[];for(let t=-o.radius;t<=o.radius;t++){if(o.variant==='trailing'&&t>0)continue;samples.push(sample(x+round(o.amount*t/o.radius),y+round(o.secondaryAmount*t/o.radius)));}average(samples,i);}
  else if(o.kind==='mosaic'){const ax=Math.floor(x/o.radius)*o.radius,ay=Math.floor(y/o.radius)*o.radius;if(o.variant==='nearest'){const j=sample(ax,ay);out.set(before.subarray(j,j+4),i);}else{const samples=[];for(let yy=ay;yy<Math.min(h,ay+o.radius);yy++)for(let xx=ax;xx<Math.min(w,ax+o.radius);xx++)samples.push(index(xx,yy));average(samples,i);}}
  else if(o.kind==='posterize'){if(!before[i+3])continue;const quant=(v:number)=>round(round(v*(o.amount-1)/255)*255/(o.amount-1));if(o.variant==='alpha')out[i+3]=quant(before[i+3]);else if(o.variant==='luma'){const v=quant(round((54*before[i]+183*before[i+1]+19*before[i+2])/256));out.set([v,v,v],i);}else for(let k=0;k<3;k++)out[i+k]=quant(before[i+k]);}
  else if(o.kind==='edges'){if(!before[i+3])continue;for(let k=0;k<3;k++){const value=(dx:number,dy:number)=>{const j=sample(x+dx,y+dy);return round(before[j+k]*before[j+3]/255);};let v:number;if(o.variant==='sobel'){const gx=-value(-1,-1)+value(1,-1)-2*value(-1,0)+2*value(1,0)-value(-1,1)+value(1,1),gy=-value(-1,-1)-2*value(0,-1)-value(1,-1)+value(-1,1)+2*value(0,1)+value(1,1);v=Math.hypot(gx,gy);}else if(o.variant==='emboss')v=128+value(1,1)-value(-1,-1);else v=Math.abs(4*value(0,0)-value(-1,0)-value(1,0)-value(0,-1)-value(0,1));out[i+k]=clamp(v*o.amount/100);}}
  else if(o.kind==='noise'){if(!before[i+3]||hash(x,y,0)%100>=o.secondaryAmount)continue;for(let k=0;k<3;k++){const n=hash(x,y,o.variant==='rgb'?k+1:1),delta=o.variant==='salt'?(n&1?o.amount:-o.amount):round((n/0xffffffff*2-1)*o.amount);out[i+k]=clamp(before[i+k]+delta);}}
 }
 return out;
}
