import {validateLayerMask,cloneLayerMask,maskByte,type LargeLayerMask} from './large-layer-mask.js';
import {largeWarpRaster,type LargeWarpOptions} from './large-transform.js';
import type {LargeMask} from './large-mask.js';
export type TiledCoverageCombine='min'|'max'|'multiply'|'subtract';
export type TiledCoverageEdit={kind:'gradient';radial:boolean;start:{x:number;y:number};end:{x:number;y:number};from:number;to:number}|{kind:'combine';mask:LargeLayerMask;mode:TiledCoverageCombine}|{kind:'morph';operation:'grow'|'shrink';radius:number}|{kind:'levels';low:number;high:number;gamma:number}|{kind:'threshold';value:number}|{kind:'transform';options:LargeWarpOptions};
function sample(m:LargeLayerMask,x:number,y:number){const r=m.rect;return x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height?m.coverage[(y-r.y)*r.width+x-r.x]:m.outside;}
export function combineLayerMasks(a:LargeLayerMask,b:LargeLayerMask,mode:TiledCoverageCombine):LargeLayerMask{
 validateLayerMask(a);validateLayerMask(b);if(!['min','max','multiply','subtract'].includes(mode))throw Error('Unknown coverage combine mode.');const x=Math.min(a.rect.x,b.rect.x),y=Math.min(a.rect.y,b.rect.y),width=Math.max(a.rect.x+a.rect.width,b.rect.x+b.rect.width)-x,height=Math.max(a.rect.y+a.rect.height,b.rect.y+b.rect.height)-y;if(width*height>1048576)throw Error('Combined coverage window exceeds one megapixel.');
 const combine=(a:number,b:number)=>mode==='min'?Math.min(a,b):mode==='max'?Math.max(a,b):mode==='multiply'?Math.round(a*b/255):Math.max(0,a-b),out:LargeLayerMask={enabled:a.enabled,outside:combine(a.outside,b.outside),rect:{x,y,width,height},coverage:new Uint8Array(width*height)};
 for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++)out.coverage[yy*width+xx]=combine(sample(a,x+xx,y+yy),sample(b,x+xx,y+yy));return out;
}
export function authorLayerMask(source:LargeLayerMask,edit:TiledCoverageEdit):LargeLayerMask{
 validateLayerMask(source);const out=cloneLayerMask(source),{width:w,height:h}=out.rect;
 if(edit.kind==='gradient'){
  maskByte(edit.from);maskByte(edit.to);if(typeof edit.radial!=='boolean'||![edit.start?.x,edit.start?.y,edit.end?.x,edit.end?.y].every(Number.isFinite)||edit.start.x<0||edit.start.y<0||edit.end.x<0||edit.end.y<0||edit.start.x>w-1||edit.end.x>w-1||edit.start.y>h-1||edit.end.y>h-1)throw Error('Gradient endpoints must be inside the local mask window.');const dx=edit.end.x-edit.start.x,dy=edit.end.y-edit.start.y,n=dx*dx+dy*dy;if(n<1e-12)throw Error('Gradient endpoints must differ.');for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ax=x-edit.start.x,ay=y-edit.start.y,t=Math.max(0,Math.min(1,edit.radial?Math.sqrt((ax*ax+ay*ay)/n):(ax*dx+ay*dy)/n));out.coverage[y*w+x]=Math.round(edit.from+(edit.to-edit.from)*t);}
 }else if(edit.kind==='combine')return combineLayerMasks(source,edit.mask,edit.mode);
 else if(edit.kind==='levels'||edit.kind==='threshold'){
  let map:(v:number)=>number;if(edit.kind==='threshold'){maskByte(edit.value);map=v=>v>=edit.value?255:0;}else{maskByte(edit.low);maskByte(edit.high);if(edit.low>=edit.high||!Number.isFinite(edit.gamma)||edit.gamma<.1||edit.gamma>5)throw Error('Use ordered coverage levels and gamma from 0.1 to 5.');map=v=>Math.round(255*Math.pow(Math.max(0,Math.min(1,(v-edit.low)/(edit.high-edit.low))),1/edit.gamma));}out.coverage=out.coverage.map(map);out.outside=map(out.outside);
 }else if(edit.kind==='morph'){
  const r=edit.radius;if(!Number.isInteger(r)||r<1||r>16||!['grow','shrink'].includes(edit.operation))throw Error('Use grow/shrink radius 1-16.');const pass=new Uint8Array(w*h),grow=edit.operation==='grow',fold=(a:number,b:number)=>grow?Math.max(a,b):Math.min(a,b);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=grow?0:255;for(let dx=-r;dx<=r;dx++)v=fold(v,x+dx<0||x+dx>=w?out.outside:source.coverage[y*w+x+dx]);pass[y*w+x]=v;}for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=grow?0:255;for(let dy=-r;dy<=r;dy++)v=fold(v,y+dy<0||y+dy>=h?out.outside:pass[(y+dy)*w+x]);out.coverage[y*w+x]=v;}
 }else if(edit.kind==='transform'){
  const o=edit.options;if(!o||![o.x,o.y].every(Number.isInteger)||o.x<0||o.y<0)throw Error('Use integer mask destination coordinates.');const rgba=new Uint8ClampedArray(w*h*4);source.coverage.forEach((v,i)=>rgba.set([v,v,v,255],i*4));const raster=largeWarpRaster({rect:source.rect,bits:new Uint8Array(w*h).fill(1)},rgba,o.warp,o.flipX,o.flipY);out.rect={x:o.x,y:o.y,width:raster.width,height:raster.height};out.coverage=raster.bits.map((v,i)=>v?raster.pixels[i*4]:source.outside);validateLayerMask(out);
 }else throw Error('Unknown coverage edit.');return out;
}
export function layerMaskSelection(mask:LargeLayerMask,threshold=128):LargeMask{validateLayerMask(mask);maskByte(threshold);return{rect:{...mask.rect},bits:mask.coverage.map(v=>Number(v>=threshold))};}
function base64(p:Uint8Array){let s='';for(let i=0;i<p.length;i+=4096)s+=String.fromCharCode(...p.subarray(i,i+4096));return btoa(s);}
export function encodeLayerMask(mask:LargeLayerMask){validateLayerMask(mask);const r=mask.rect;return JSON.stringify({kind:'ezpix-layer-mask',version:1,enabled:mask.enabled,outside:mask.outside,rect:{x:r.x,y:r.y,width:r.width,height:r.height},data:base64(mask.coverage)});}
export function decodeLayerMask(text:string):LargeLayerMask{
 if(typeof text!=='string'||text.length>2*1048576)throw Error('Coverage file exceeds 2 MiB.');const v=JSON.parse(text);if(v?.kind!=='ezpix-layer-mask'||v.version!==1)throw Error('Unknown coverage format.');const n=v.rect?.width*v.rect?.height;if(!Number.isInteger(n)||n<1||n>1048576||typeof v.data!=='string'||v.data.length!==Math.ceil(n/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.data))throw Error('Invalid coverage bytes.');const out:LargeLayerMask={enabled:v.enabled,outside:v.outside,rect:{...v.rect},coverage:new Uint8Array(n)};validateLayerMask(out);const s=atob(v.data);if(s.length!==n||btoa(s)!==v.data)throw Error('Noncanonical coverage bytes.');out.coverage=Uint8Array.from(s,c=>c.charCodeAt(0));return out;
}
export class LayerMaskLibrary{
 private slots=new Map<number,LargeLayerMask>();
 private slot(slot:number){if(!Number.isInteger(slot)||slot<1||slot>4)throw Error('Choose a mask slot from 1 to 4.');}
 store(slot:number,mask:LargeLayerMask){this.slot(slot);validateLayerMask(mask);this.slots.set(slot,cloneLayerMask(mask));}
 load(slot:number){this.slot(slot);const mask=this.slots.get(slot);if(!mask)throw Error('Coverage slot is empty.');return cloneLayerMask(mask);}
 clear(slot:number){this.slot(slot);return this.slots.delete(slot);}
}
