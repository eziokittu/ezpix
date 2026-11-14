import {validateRaster,type Raster} from './conversion.js';
import type {RGBA} from './document.js';
import {brushFocusSelection} from './focus-selection.js';

export const BRUSH_STYLES=['round','square','marker','pencil','spray','neon','dashed','calligraphy','dots','double','rainbow','chalk','wash','ribbon','stitch','sparkle','triple','hollow','crosshatch','dry','charcoal','confetti','wave','beads','soft','chisel','diamond','star'] as const;
export type CreativeEdit =
 | {kind:'stamp';image:Raster;x:number;y:number;size:number;angle:number;opacity:number;editor?:{tool:string;fields:Record<string,string|boolean>}}
 | {kind:'draw';points:{x:number;y:number}[];size:number;color:RGBA;brush?:typeof BRUSH_STYLES[number]}
 | {kind:'redact';x:number;y:number;width:number;height:number;style:'pixelate'|'blur'|'solid'}
 | {kind:'resize';width:number;height:number;sampling:'smooth'|'nearest'};
const bound=(n:number,min:number,max:number)=>{if(!Number.isFinite(n)||n<min||n>max)throw Error('Creative edit is out of bounds.');return n;};
function over(out:Uint8ClampedArray,i:number,r:number,g:number,b:number,alpha:number){
 const a=alpha/255,d=out[i+3]/255,o=a+d*(1-a);if(!o)return;
 out[i]=(r*a+out[i]*d*(1-a))/o;out[i+1]=(g*a+out[i+1]*d*(1-a))/o;out[i+2]=(b*a+out[i+2]*d*(1-a))/o;out[i+3]=o*255;
}
/** Local, bounded raster operations. Every edit returns an independent buffer. */
export function creativeEdit(source:Raster,edit:CreativeEdit):Raster {
 validateRaster(source);const {width:w,height:h}=source;
 if(edit.kind==='resize'){
  const {width,height}=edit;if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4_000_000||!['smooth','nearest'].includes(edit.sampling))throw Error('Resize supports up to four megapixels.');
  const pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const sx=Math.max(0,Math.min(w-1,(x+.5)*w/width-.5)),sy=Math.max(0,Math.min(h-1,(y+.5)*h/height-.5)),i=(y*width+x)*4;
   if(edit.sampling==='nearest'){const p=(Math.round(sy)*w+Math.round(sx))*4;pixels.set(source.pixels.subarray(p,p+4),i);continue;}
   const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;let a=0;const c=[0,0,0];
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const p=(Math.min(h-1,iy+dy)*w+Math.min(w-1,ix+dx))*4,t=(dx?fx:1-fx)*(dy?fy:1-fy)*source.pixels[p+3]/255;a+=t;for(let k=0;k<3;k++)c[k]+=source.pixels[p+k]*t;}
   if(a){for(let k=0;k<3;k++)pixels[i+k]=c[k]/a;pixels[i+3]=a*255;}
  }return {width,height,pixels};
 }
 const pixels=source.pixels.slice();
 if(edit.kind==='stamp'){
  if(edit.editor&&(!['type','clipart','stickers','emoji','image'].includes(edit.editor.tool)||!edit.editor.fields||Object.keys(edit.editor.fields).length>40||Object.entries(edit.editor.fields).some(([key,value])=>!/^[-a-z]{1,30}$/.test(key)||typeof value!=='boolean'&&(typeof value!=='string'||value.length>200))))throw Error('Invalid object properties.');
  validateRaster(edit.image);bound(edit.x,-1,2);bound(edit.y,-1,2);bound(edit.size,1/4_194_304,4_194_304);bound(edit.angle,-180,180);bound(edit.opacity,0,1);
  const sw=Math.max(1,Math.min(w,h)*edit.size),sh=sw*edit.image.height/edit.image.width,co=Math.cos(edit.angle*Math.PI/180),si=Math.sin(edit.angle*Math.PI/180),cx=edit.x*(w-1),cy=edit.y*(h-1),extent=Math.hypot(sw,sh)/2;
  for(let y=Math.max(0,Math.floor(cy-extent));y<Math.min(h,Math.ceil(cy+extent));y++)for(let x=Math.max(0,Math.floor(cx-extent));x<Math.min(w,Math.ceil(cx+extent));x++){
   const dx=x+.5-cx,dy=y+.5-cy,u=(co*dx+si*dy)/sw+.5,v=(-si*dx+co*dy)/sh+.5;if(u<0||v<0||u>=1||v>=1)continue;
   const p=(Math.min(edit.image.height-1,Math.floor(v*edit.image.height))*edit.image.width+Math.min(edit.image.width-1,Math.floor(u*edit.image.width)))*4;
   over(pixels,(y*w+x)*4,edit.image.pixels[p],edit.image.pixels[p+1],edit.image.pixels[p+2],edit.image.pixels[p+3]*edit.opacity);
  }
 }else if(edit.kind==='draw'){
  bound(edit.size,.001,.2);if(!edit.points.length||edit.points.length>8192||edit.color.length!==4||edit.color.some(c=>!Number.isInteger(c)||c<0||c>255))throw Error('Invalid drawing.');
  const points=edit.points.map(p=>({x:Math.round(bound(p.x,0,1)*(w-1)),y:Math.round(bound(p.y,0,1)*(h-1))})),mask=new Uint8Array(w*h),radius=Math.max(.5,Math.min(128,Math.min(w,h)*edit.size/2));
  const brush=edit.brush??'round';if(!BRUSH_STYLES.includes(brush))throw Error('Unknown brush.');
  const segment=(a:{x:number;y:number},b:{x:number;y:number},r:number)=>brushFocusSelection(mask,w,h,{x:Math.max(0,Math.min(w-1,Math.round(a.x))),y:Math.max(0,Math.min(h-1,Math.round(a.y)))},{x:Math.max(0,Math.min(w-1,Math.round(b.x))),y:Math.max(0,Math.min(h-1,Math.round(b.y)))},Math.max(.5,Math.min(128,r)));
  let lastDot:{x:number;y:number}|undefined;
  points.forEach((p,i)=>{const from=points[Math.max(0,i-1)];
   if(['dots','beads','sparkle','star','diamond','confetti'].includes(brush)){
    if(lastDot&&Math.hypot(p.x-lastDot.x,p.y-lastDot.y)<radius*2.8)return;lastDot=p;
    if(brush==='sparkle'||brush==='star'){segment({x:p.x-radius,y:p.y},{x:p.x+radius,y:p.y},radius*.18);segment({x:p.x,y:p.y-radius},{x:p.x,y:p.y+radius},radius*.18);if(brush==='star')for(const d of [-1,1])segment({x:p.x-radius*.7,y:p.y-radius*.7*d},{x:p.x+radius*.7,y:p.y+radius*.7*d},radius*.18);}
    else if(brush==='diamond'){for(let y=Math.max(0,Math.floor(p.y-radius));y<Math.min(h,p.y+radius);y++)for(let x=Math.max(0,Math.floor(p.x-radius));x<Math.min(w,p.x+radius);x++)if(Math.abs(x-p.x)+Math.abs(y-p.y)<=radius)mask[y*w+x]=1;}
    else segment(p,p,radius*(brush==='confetti'?.4:.65));return;
   }
   if(brush==='double'||brush==='triple'){for(const offset of brush==='double'?[-radius*.7,radius*.7]:[-radius,0,radius])segment({x:from.x,y:from.y+offset},{x:p.x,y:p.y+offset},radius*.22);return;}
   if(brush==='dashed'&&Math.floor(i/4)%2)return;
   if(['square','calligraphy','chisel'].includes(brush)){const steps=Math.max(1,Math.ceil(Math.hypot(p.x-from.x,p.y-from.y)));for(let step=0;step<=steps;step++){const cx=from.x+(p.x-from.x)*step/steps,cy=from.y+(p.y-from.y)*step/steps,rx=radius,ry=brush==='square'?radius:Math.max(.5,radius/3);for(let y=Math.max(0,Math.floor(cy-ry));y<Math.min(h,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<Math.min(w,Math.ceil(cx+rx));x++)if(brush!=='chisel'||(x-cx)+(y-cy)*2<radius*.6)mask[y*w+x]=1;}return;}
   if(brush==='wave'){segment({x:from.x,y:from.y+Math.sin(from.x/Math.max(2,radius))*radius},{x:p.x,y:p.y+Math.sin(p.x/Math.max(2,radius))*radius},radius*.35);return;}
   segment(from,p,radius);
  });
  if(brush==='hollow'||brush==='beads'){const original=mask.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(original[i-1]&&original[i+1]&&original[i-w]&&original[i+w])mask[i]=0;}}
  if(brush==='neon'){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(mask[i])continue;const near=x>1&&mask[i-2]||x<w-2&&mask[i+2]||y>1&&mask[i-w*2]||y<h-2&&mask[i+w*2];if(near)over(pixels,i*4,edit.color[0],edit.color[1],edit.color[2],edit.color[3]*.2);}}
  for(let i=0;i<mask.length;i++)if(mask[i]){const noise=((Math.imul(i+1,374761393)^668265263)>>>0)%100;if(brush==='crosshatch'&&(i%w+Math.floor(i/w))%5>1&&(i%w-Math.floor(i/w)+h)%5>1||brush==='dry'&&noise<48||brush==='charcoal'&&noise<25||brush==='spray'&&noise<65||brush==='pencil'&&noise<20||brush==='chalk'&&noise<35||brush==='stitch'&&Math.floor((i%w+Math.floor(i/w))/Math.max(2,radius))%3===0)continue;const alpha=edit.color[3]*(brush==='soft'?.18+noise/160:brush==='charcoal'?.45:brush==='marker'?.35:brush==='pencil'?.55:brush==='wash'?.2+noise/200:brush==='chalk'?.65:1);const rgb=brush==='rainbow'?[0,1,2].map(c=>128+127*Math.sin((i%w+Math.floor(i/w))*.07+c*2.094)):brush==='ribbon'?edit.color.slice(0,3).map(v=>v*(.6+.4*Math.sin((i%w)*.35)**2)):edit.color;over(pixels,i*4,rgb[0],rgb[1],rgb[2],alpha);}

 }else if(edit.kind==='redact'){
  bound(edit.x,0,1);bound(edit.y,0,1);bound(edit.width,.01,1);bound(edit.height,.01,1);if(!['pixelate','blur','solid'].includes(edit.style))throw Error('Unknown redaction.');
  const rw=Math.max(1,Math.round(edit.width*w)),rh=Math.max(1,Math.round(edit.height*h)),left=Math.round((w-rw)*edit.x),top=Math.round((h-rh)*edit.y),block=Math.max(4,Math.round(Math.min(w,h)/24));
  if(edit.style==='solid'){for(let y=top;y<top+rh;y++)for(let x=left;x<left+rw;x++)pixels.set([24,24,28,255],(y*w+x)*4);}
  else if(edit.style==='pixelate'){
   for(let by=top;by<top+rh;by+=block)for(let bx=left;bx<left+rw;bx+=block){const sum=[0,0,0,0];let count=0;for(let y=by;y<Math.min(top+rh,by+block);y++)for(let x=bx;x<Math.min(left+rw,bx+block);x++){const i=(y*w+x)*4;for(let k=0;k<4;k++)sum[k]+=pixels[i+k];count++;}for(let y=by;y<Math.min(top+rh,by+block);y++)for(let x=bx;x<Math.min(left+rw,bx+block);x++)pixels.set(sum.map(v=>v/count),(y*w+x)*4);}
  }else{
   // Separable sliding-window blur; bounded O(pixels), independent of radius.
   const radius=Math.max(2,Math.min(32,block)),temp=pixels.slice();
   for(const vertical of [false,true]){const input=vertical?temp:source.pixels,output=vertical?pixels:temp,lines=vertical?rw:rh,length=vertical?rh:rw;
    for(let line=0;line<lines;line++){const sum=[0,0,0,0];const index=(p:number)=>((top+(vertical?p:line))*w+left+(vertical?line:p))*4;
     for(let p=-radius;p<=length-1;p++){
      const add=p+radius;if(add<length){const i=index(add);for(let k=0;k<4;k++)sum[k]+=input[i+k];}
      const remove=p-radius-1;if(remove>=0){const i=index(remove);for(let k=0;k<4;k++)sum[k]-=input[i+k];}
      if(p>=0){const n=Math.min(length-1,p+radius)-Math.max(0,p-radius)+1,i=index(p);for(let k=0;k<4;k++)output[i+k]=sum[k]/n;}
     }
    }
   }
  }
 }else throw Error('Unknown creative edit.');
 return {width:w,height:h,pixels};
}
