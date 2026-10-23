import {composite} from './document.js';
import type {PixelDocument} from './document.js';
/** Display-only. Deliberately separate from every artwork/export compositor. */
export function referenceOverlay(doc:PixelDocument,position:'behind'|'above'){
 const out=new Uint8ClampedArray(doc.width*doc.height*4),planes=new Float64Array(out.length);
 for(const r of doc.references){const p=r.placement;if(!p?.visible||p.position!==position||!p.opacity)continue;const left=Math.max(0,p.x),top=Math.max(0,p.y),right=Math.min(doc.width,p.x+p.width),bottom=Math.min(doc.height,p.y+p.height);
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const sx=Math.min(r.width-1,Math.floor((x-p.x+.5)*r.width/p.width)),sy=Math.min(r.height-1,Math.floor((y-p.y+.5)*r.height/p.height)),s=(sy*r.width+sx)*4,i=(y*doc.width+x)*4,a=r.pixels[s+3]*p.opacity/(255*255);for(let k=0;k<3;k++)planes[i+k]=r.pixels[s+k]*a+planes[i+k]*(1-a);planes[i+3]=a+planes[i+3]*(1-a);}
 }for(let i=0;i<out.length;i+=4)if(planes[i+3]){for(let k=0;k<3;k++)out[i+k]=Math.round(planes[i+k]/planes[i+3]);out[i+3]=Math.round(planes[i+3]*255);}return out;
}

export function referenceDisplay(doc:PixelDocument){const planes=new Float64Array(doc.width*doc.height*4);for(const source of [referenceOverlay(doc,'behind'),composite(doc),referenceOverlay(doc,'above')])for(let i=0;i<source.length;i+=4){const a=source[i+3]/255;for(let k=0;k<3;k++)planes[i+k]=source[i+k]*a+planes[i+k]*(1-a);planes[i+3]=a+planes[i+3]*(1-a);}const out=new Uint8ClampedArray(planes.length);for(let i=0;i<out.length;i+=4)if(planes[i+3]){for(let k=0;k<3;k++)out[i+k]=Math.round(planes[i+k]/planes[i+3]);out[i+3]=Math.round(planes[i+3]*255);}return out;}
