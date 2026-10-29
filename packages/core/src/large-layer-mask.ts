import type {LargeRect} from './large-canvas.js';
import type {LargeMask} from './large-mask.js';
import {validateLargeMask} from './large-mask.js';
import {encodeNativePng,decodeNativePng} from './native-png.js';
export interface LargeLayerMask{enabled:boolean;outside:number;rect:LargeRect;coverage:Uint8Array}
export type LargeLayerMaskEdit={kind:'selection';hide:boolean}|{kind:'invert'}|{kind:'fill';value:number}|{kind:'feather';radius:number}|{kind:'paint';value:number;size:number;points:{x:number;y:number}[]}|{kind:'enabled';enabled:boolean}|{kind:'outside';value:number}|{kind:'remove'}|{kind:'bake'};
export function maskByte(v:number){if(!Number.isInteger(v)||v<0||v>255)throw Error('Use mask coverage from 0 to 255.');return v;}
export function validateLayerMask(m:LargeLayerMask,width=10240,height=10240){const r=m?.rect;if(!r||![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>width||r.y+r.height>height||r.width*r.height>1048576||typeof m.enabled!=='boolean'||!(m.coverage instanceof Uint8Array)||m.coverage.length!==r.width*r.height)throw Error('Layer masks need a valid one-megapixel window inside the canvas.');maskByte(m.outside);}
export function cloneLayerMask(m:LargeLayerMask,copy=true):LargeLayerMask{return{enabled:m.enabled,outside:m.outside,rect:{...m.rect},coverage:copy?Uint8Array.from(m.coverage):m.coverage};}
export function layerMaskCoverage(m:LargeLayerMask|undefined,x:number,y:number){if(!m||!m.enabled)return 255;const r=m.rect;return x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height?m.coverage[(y-r.y)*r.width+x-r.x]:m.outside;}
export function selectionLayerMask(s:LargeMask,hide=false):LargeLayerMask{validateLargeMask(s);if(typeof hide!=='boolean')throw Error('Invalid mask mode.');return{enabled:true,outside:hide?255:0,rect:{...s.rect},coverage:s.bits.map(v=>hide?255-v*255:v*255)};}
export function editLayerMask(source:LargeLayerMask,edit:LargeLayerMaskEdit):LargeLayerMask{
 validateLayerMask(source);const out=cloneLayerMask(source),{width:w,height:h}=out.rect;
 if(edit.kind==='enabled'){if(typeof edit.enabled!=='boolean')throw Error('Invalid mask enabled state.');out.enabled=edit.enabled;}
 else if(edit.kind==='outside')out.outside=maskByte(edit.value);
 else if(edit.kind==='invert'){out.coverage=out.coverage.map(v=>255-v);out.outside=255-out.outside;}
 else if(edit.kind==='fill')out.coverage.fill(maskByte(edit.value));
 else if(edit.kind==='feather'){
  const r=edit.radius;if(!Number.isInteger(r)||r<1||r>16)throw Error('Feather radius must be 1-16.');const sums=new Uint32Array(w*h),n=2*r+1,original=out.coverage;
  for(let y=0;y<h;y++){let sum=0;for(let x=-r;x<=r;x++)sum+=x<0||x>=w?out.outside:original[y*w+x];for(let x=0;x<w;x++){sums[y*w+x]=sum;sum+=(x+r+1<w?original[y*w+x+r+1]:out.outside)-(x-r>=0?original[y*w+x-r]:out.outside);}}
  for(let x=0;x<w;x++){let sum=0;for(let y=-r;y<=r;y++)sum+=y<0||y>=h?out.outside*n:sums[y*w+x];for(let y=0;y<h;y++){out.coverage[y*w+x]=Math.round(sum/(n*n));sum+=(y+r+1<h?sums[(y+r+1)*w+x]:out.outside*n)-(y-r>=0?sums[(y-r)*w+x]:out.outside*n);}}
 }else if(edit.kind==='paint'){
  maskByte(edit.value);if(!Number.isInteger(edit.size)||edit.size<1||edit.size>64||!Array.isArray(edit.points)||edit.points.length<1||edit.points.length>4096)throw Error('Use a mask brush 1-64 and at most 4096 local points.');
  const points=Array.from(edit.points);for(const p of points)if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=w||p.y>=h)throw Error('Mask brush points must be inside its local window.');let work=0;const stamp=(x:number,y:number)=>{if((work+=edit.size*edit.size)>4*1048576)throw Error('Mask brush work exceeds four megapixels.');const a=Math.floor((edit.size-1)/2);for(let yy=Math.max(0,y-a);yy<Math.min(h,y-a+edit.size);yy++)for(let xx=Math.max(0,x-a);xx<Math.min(w,x-a+edit.size);xx++)out.coverage[yy*w+xx]=edit.value;};
  let last=points[0];stamp(last.x,last.y);for(const p of points.slice(1)){const dx=Math.abs(p.x-last.x),dy=Math.abs(p.y-last.y),count=Math.max(dx,dy);for(let i=1;i<=count;i++)stamp(Math.round(last.x+(p.x-last.x)*i/count),Math.round(last.y+(p.y-last.y)*i/count));last=p;}
 }else throw Error('Unsupported layer-mask edit.');return out;
}
export function translateLayerMask(m:LargeLayerMask,width:number,height:number,dx:number,dy:number):LargeLayerMask{const r=m.rect,x=Math.max(0,r.x+dx),y=Math.max(0,r.y+dy),right=Math.min(width,r.x+dx+r.width),bottom=Math.min(height,r.y+dy+r.height);if(x>=right||y>=bottom)return{enabled:m.enabled,outside:m.outside,rect:{x:0,y:0,width:1,height:1},coverage:Uint8Array.of(m.outside)};const coverage=new Uint8Array((right-x)*(bottom-y));for(let yy=y;yy<bottom;yy++)for(let xx=x;xx<right;xx++)coverage[(yy-y)*(right-x)+xx-x]=m.coverage[(yy-dy-r.y)*r.width+xx-dx-r.x];return{enabled:m.enabled,outside:m.outside,rect:{x,y,width:right-x,height:bottom-y},coverage};}
export async function exportLayerMaskPng(m:LargeLayerMask){validateLayerMask(m);const p=new Uint8ClampedArray(m.coverage.length*4);m.coverage.forEach((v,i)=>p.set([v,v,v,255],i*4));return encodeNativePng(m.rect.width,m.rect.height,p);}
export async function importLayerMaskPng(bytes:Uint8Array,rect:LargeRect,outside=255):Promise<LargeLayerMask>{const m:LargeLayerMask={enabled:true,outside,rect:{...rect},coverage:new Uint8Array(0)};if(!rect||!Number.isInteger(rect.width)||!Number.isInteger(rect.height)||rect.width<1||rect.height<1||rect.width*rect.height>1048576)throw Error('Use a one-megapixel mask window.');m.coverage=new Uint8Array(rect.width*rect.height);validateLayerMask(m);if(!(bytes instanceof Uint8Array)||bytes.length>5*1048576)throw Error('Mask PNG exceeds 5 MiB.');const p=await decodeNativePng(Uint8Array.from(bytes),rect.width,rect.height);for(let i=0;i<m.coverage.length;i++){const j=i*4;if(p[j]!==p[j+1]||p[j]!==p[j+2]||p[j+3]!==255)throw Error('Layer-mask PNG must be opaque grayscale at exact window dimensions.');m.coverage[i]=p[j];}return m;}
