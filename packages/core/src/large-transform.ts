import {validateLargeMask,type LargeMask} from './large-mask.js';
import {encodeNativePng,decodeNativePng} from './native-png.js';
export type LargeWarp=
 |{kind:'turn';turn:0|1|2|3;width:number;height:number}
 |{kind:'rotate';angle:number}
 |{kind:'shear';shearX:number;shearY:number}
 |{kind:'perspective';width:number;height:number;quad:{x:number;y:number}[]};
export interface LargeWarpOptions{x:number;y:number;copy:boolean;flipX:boolean;flipY:boolean;warp:LargeWarp}
export interface LargeWarpRaster{width:number;height:number;pixels:Uint8ClampedArray;bits:Uint8Array}
const size=(w:number,h:number)=>{if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>10240||h>10240||w*h>1048576)throw Error('Transform output must fit a one-megapixel window with axes up to 10240.');};
type Matrix=[number,number,number,number,number,number,number,number,number];
function inverse(m:Matrix):Matrix{const [a,b,c,d,e,f,g,h,i]=m,A=e*i-f*h,B=c*h-b*i,C=b*f-c*e,D=f*g-d*i,E=a*i-c*g,F=c*d-a*f,G=d*h-e*g,H=b*g-a*h,I=a*e-b*d,det=a*A+b*D+c*G;if(!Number.isFinite(det)||Math.abs(det)<1e-8)throw Error('Transform is singular or too thin.');return [A,B,C,D,E,F,G,H,I].map(v=>v/det) as Matrix;}
function warpPlane(mask:LargeMask,source:Uint8Array|Uint8ClampedArray,channels:1|4,warp:LargeWarp,flipX=false,flipY=false){
 validateLargeMask(mask);if(source.length!==mask.bits.length*channels||typeof flipX!=='boolean'||typeof flipY!=='boolean'||!warp)throw Error('Invalid transform source.');
 const sw=mask.rect.width,sh=mask.rect.height;let width:number,height:number,map:(x:number,y:number)=>{x:number;y:number};
 if(warp.kind==='turn'){
  if(![0,1,2,3].includes(warp.turn))throw Error('Use a quarter turn from 0 to 3.');size(warp.width,warp.height);width=warp.width;height=warp.height;const rw=warp.turn%2?sh:sw,rh=warp.turn%2?sw:sh;
  map=(x,y)=>{const rx=Math.floor(x*rw/width),ry=Math.floor(y*rh/height);return warp.turn===0?{x:rx,y:ry}:warp.turn===1?{x:ry,y:sh-1-rx}:warp.turn===2?{x:sw-1-rx,y:sh-1-ry}:{x:sw-1-ry,y:rx};};
 }else{
  let matrix:Matrix;
  if(warp.kind==='rotate'||warp.kind==='shear'){
   let a:number,b:number,d:number,e:number;
   if(warp.kind==='rotate'){if(!Number.isFinite(warp.angle)||Math.abs(warp.angle)>360)throw Error('Use a rotation angle from -360 to 360.');const rad=warp.angle*Math.PI/180;a=e=Math.cos(rad);b=-Math.sin(rad);d=Math.sin(rad);a=Math.abs(a)<1e-12?0:a;b=Math.abs(b)<1e-12?0:b;d=Math.abs(d)<1e-12?0:d;e=Math.abs(e)<1e-12?0:e;}
   else{if(![warp.shearX,warp.shearY].every(v=>Number.isFinite(v)&&Math.abs(v)<=4))throw Error('Use shear factors from -4 to 4.');a=e=1;b=warp.shearX;d=warp.shearY;}
   const xs=[0,a*sw,b*sh,a*sw+b*sh],ys=[0,d*sw,e*sh,d*sw+e*sh],left=Math.min(...xs),top=Math.min(...ys);width=Math.max(1,Math.ceil(Math.max(...xs)-left-1e-10));height=Math.max(1,Math.ceil(Math.max(...ys)-top-1e-10));matrix=[a,b,-left,d,e,-top,0,0,1];
  }else if(warp.kind==='perspective'){
   width=warp.width;height=warp.height;size(width,height);const q=warp.quad;
   if(!Array.isArray(q)||q.length!==4||Array.from(q).some(p=>!p||![p.x,p.y].every(Number.isFinite)||p.x<0||p.y<0||p.x>width||p.y>height))throw Error('Use four quadrilateral corners inside the output window.');
   let sign=0;for(let n=0;n<4;n++){const p=q[n],v=q[(n+1)%4],r=q[(n+2)%4],cross=(v.x-p.x)*(r.y-v.y)-(v.y-p.y)*(r.x-v.x);if(Math.abs(cross)<1e-6||sign&&Math.sign(cross)!==sign)throw Error('Use a convex, nondegenerate quadrilateral in corner order.');sign=Math.sign(cross);}
   const [p0,p1,p2,p3]=q,dx1=p1.x-p2.x,dx2=p3.x-p2.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,sx=p0.x-p1.x+p2.x-p3.x,sy=p0.y-p1.y+p2.y-p3.y,den=dx1*dy2-dx2*dy1;let g=0,h=0;
   if(Math.abs(sx)+Math.abs(sy)>1e-10){if(Math.abs(den)<1e-8)throw Error('Perspective is singular.');g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;}
   if([1,1+g,1+h,1+g+h].some(v=>!Number.isFinite(v)||v<=1e-6))throw Error('Perspective crosses its horizon.');
   matrix=[(p1.x-p0.x+g*p1.x)/sw,(p3.x-p0.x+h*p3.x)/sh,p0.x,(p1.y-p0.y+g*p1.y)/sw,(p3.y-p0.y+h*p3.y)/sh,p0.y,g/sw,h/sh,1];
  }else throw Error('Unknown selection transform.');
  size(width,height);const inv=inverse(matrix);map=(x,y)=>{const den=inv[6]*x+inv[7]*y+inv[8];if(!Number.isFinite(den)||Math.abs(den)<1e-10)return{x:-1,y:-1};return{x:Math.floor((inv[0]*x+inv[1]*y+inv[2])/den+1e-10),y:Math.floor((inv[3]*x+inv[4]*y+inv[5])/den+1e-10)};};
 }
 size(width,height);const out=channels===4?new Uint8ClampedArray(width*height*4):new Uint8Array(width*height),bits=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=map((flipX?width-1-x:x)+.5,(flipY?height-1-y:y)+.5);if(p.x<0||p.y<0||p.x>=sw||p.y>=sh)continue;const si=p.y*sw+p.x,i=y*width+x;if(mask.bits[si]){bits[i]=1;out.set(source.subarray(si*channels,(si+1)*channels),i*channels);}}
 return {width,height,plane:out,bits};
}
/** The same nearest-coordinate map samples bytes directly; RGBA matching is never used. */
export function largeWarpRaster(mask:LargeMask,pixels:Uint8ClampedArray,warp:LargeWarp,flipX=false,flipY=false):LargeWarpRaster{
 if(!(pixels instanceof Uint8ClampedArray))throw Error('Invalid RGBA transform source.');const r=warpPlane(mask,pixels,4,warp,flipX,flipY);return {width:r.width,height:r.height,pixels:r.plane as Uint8ClampedArray,bits:r.bits};
}
export interface LargeWarpIndices{width:number;height:number;indices:Uint8Array;bits:Uint8Array}
export function largeWarpIndices(mask:LargeMask,indices:Uint8Array,warp:LargeWarp,flipX=false,flipY=false):LargeWarpIndices{
 if(!(indices instanceof Uint8Array))throw Error('Invalid indexed transform source.');const r=warpPlane(mask,indices,1,warp,flipX,flipY);return {width:r.width,height:r.height,indices:r.plane as Uint8Array,bits:r.bits};
}
export async function exportLargeMaskPng(mask:LargeMask):Promise<Uint8Array>{validateLargeMask(mask);const pixels=new Uint8ClampedArray(mask.bits.length*4);for(let i=0;i<mask.bits.length;i++)pixels.set(mask.bits[i]?[255,255,255,255]:[0,0,0,255],i*4);return encodeNativePng(mask.rect.width,mask.rect.height,pixels);}
export async function importLargeMaskPng(bytes:Uint8Array,rect:LargeMask['rect']):Promise<LargeMask>{
 // Validate dimensions before decoder allocation, and snapshot caller-owned bytes.
 if(!(bytes instanceof Uint8Array)||bytes.length>5*1048576)throw Error('Mask PNG exceeds 5 MiB.');size(rect?.width,rect?.height);const mask:LargeMask={rect:{...rect},bits:new Uint8Array(rect.width*rect.height)};validateLargeMask(mask);const pixels=await decodeNativePng(Uint8Array.from(bytes),rect.width,rect.height);
 for(let i=0;i<mask.bits.length;i++){const j=i*4,v=pixels[j];if(![0,255].includes(v)||pixels[j+1]!==v||pixels[j+2]!==v||pixels[j+3]!==255)throw Error('Mask PNG must contain only opaque black and white at exact window dimensions.');mask.bits[i]=Number(v===255);}return mask;
}
