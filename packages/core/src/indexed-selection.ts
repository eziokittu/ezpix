import {activeLayer,encodeProject,type PixelDocument} from './document.js';
import {layerEditable} from './groups.js';
import {captureIndexedCel,refreshIndexedCaches,validateIndexedDocument} from './indexed-document.js';
import {expandIndexedCel,type IndexedCel} from './indexed-cel.js';
import {permuteRaster} from './raster-transform.js';
import {prepareAuthored} from './authored-workflows.js';
import {copySelectionMask,innerSelectionMask} from './selection-mask.js';
import {combineSelectionMask,type AdvancedMaskOperation,type MaskCombine} from './selection-advanced.js';
import type {Selection,Transform,Rect} from './toolkit.js';
const snapshots=new WeakMap<object,{baseline:string;cel:IndexedCel}>();
export type IndexedSelectionOperation=({kind:'indexed-selection';transform:Transform}|{kind:'indexed-selection-clear'}|{kind:'indexed-selection-paint';slot:number;paint:'fill'|'stroke';thickness:number})&{rect:Rect;mask?:Uint8Array};
function rect(r:Rect,w:number,h:number){if(!r||![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>w||r.y+r.height>h)throw new Error('Indexed selection must fit wholly inside the canvas.');}
export function attachIndexedSelection(doc:PixelDocument,s:Selection){if(!doc.indexed)return s;const token=Object.freeze({});snapshots.set(token,{baseline:encodeProject(doc,false),cel:captureIndexedCel(doc)});s.indexed=token;return s;}
function source(s:Selection){const v=s.indexed&&snapshots.get(s.indexed);if(!v)throw new Error('Select a fresh indexed region.');if(s.canvasWidth!==v.cel.width||s.canvasHeight!==v.cel.height)throw new Error('Indexed selection dimensions changed.');rect(s.rect,v.cel.width,v.cel.height);copySelectionMask(s.rect,s.mask);return v;}
function current(doc:PixelDocument,s:Selection){const v=source(s);if(v.baseline!==encodeProject(doc,false)||doc.activeLayerId!==s.layerId||doc.activeFrameId!==s.frameId)throw new Error('Indexed selection source changed. Select again.');return v;}
/** Files keep original bounds. Holes use the designated transparent slot, never a manufactured table entry. */
export function indexedSelectionData(doc:PixelDocument,s:Selection):IndexedCel{
 const {cel:c}=current(doc,s),r=s.rect,indices=new Uint8Array(r.width*r.height);
 if(s.mask?.some(v=>!v)&&c.transparentIndex===null)throw new Error('Indexed selection file holes need a transparent slot. Add transparency or reset the mask.');
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=y*r.width+x;indices[i]=!s.mask||s.mask[i]?c.indices[(r.y+y)*c.width+r.x+x]:c.transparentIndex!;}
 return {width:r.width,height:r.height,palette:c.palette.map(p=>[...p]),transparentIndex:c.transparentIndex,indices};
}
/** Indexed wand compares original slot numbers, including equal-colour duplicate slots. */
export function indexedSlotSelectionMask(s:Selection,op:Extract<AdvancedMaskOperation,{kind:'wand'|'colour'}>,combine:MaskCombine='replace'):Selection{
 const {cel:c}=source(s),r=s.rect,w=r.width,h=r.height,n=w*h;
 if(!op||!['wand','colour'].includes(op.kind)||!op.seed||![op.seed.x,op.seed.y].every(Number.isInteger)||op.seed.x<0||op.seed.y<0||op.seed.x>=w||op.seed.y>=h||![4,8].includes(op.connectivity)||op.tolerance!==0||op.channels!=='rgba')throw new Error('Indexed wand uses exact slots, tolerance 0, RGBA and four or eight neighbours.');
 const at=(i:number)=>c.indices[(r.y+Math.floor(i/w))*c.width+r.x+i%w],seed=op.seed.y*w+op.seed.x,slot=at(seed),out=new Uint8Array(n);
 if(op.kind==='colour'){for(let i=0;i<n;i++)out[i]=+(at(i)===slot);}
 else{const queue=new Uint32Array(n),seen=new Uint8Array(n);let head=0,tail=1;queue[0]=seed;seen[seed]=1;while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);out[i]=1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!(dx||dy)||op.connectivity===4&&dx&&dy||x+dx<0||y+dy<0||x+dx>=w||y+dy>=h)continue;const j=i+dy*w+dx;if(!seen[j]){seen[j]=1;if(at(j)===slot)queue[tail++]=j;}}}}
 return combineSelectionMask(s,out,combine);
}
function transform(c:IndexedCel,r:Rect,t:Transform,mask?:Uint8Array){
 rect(r,c.width,c.height);const membership=copySelectionMask(r,mask),rotation=t.rotation??0,rw=rotation===90||rotation===270?r.height:r.width,rh=rotation===90||rotation===270?r.width:r.height,w=t.width??rw,h=t.height??rh;
 rect({x:t.x,y:t.y,width:w,height:h},c.width,c.height);if(![t.copy,t.flipX,t.flipY].every(v=>typeof v==='boolean'))throw new Error('Indexed selection flags must be Boolean.');
 const cut=new Uint8Array(r.width*r.height);for(let y=0;y<r.height;y++)cut.set(c.indices.subarray((r.y+y)*c.width+r.x,(r.y+y)*c.width+r.x+r.width),y*r.width);
 const p=new Uint8Array(c.indices),out=permuteRaster(cut,r.width,r.height,w,h,rotation,t.flipX,t.flipY,1),target=membership?permuteRaster(membership,r.width,r.height,w,h,rotation,t.flipX,t.flipY,1):undefined;
 if(!t.copy)for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(!membership||membership[y*r.width+x]){
  const sx=r.x+x,sy=r.y+y,dx=sx-t.x,dy=sy-t.y,covered=dx>=0&&dy>=0&&dx<w&&dy<h&&(!target||target[dy*w+dx]);
  if(c.transparentIndex===null){if(!covered)throw new Error('Moving indexed pixels into a new area needs a transparent slot. Use Copy or add transparency.');}else p[sy*c.width+sx]=c.transparentIndex;
 }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!target||target[y*w+x])p[(t.y+y)*c.width+t.x+x]=out[y*w+x];return p;
}
export function indexedSelectionPixels(s:Selection,t:Transform){const {cel:c}=source(s);return expandIndexedCel({...c,indices:transform(c,s.rect,t,s.mask)}).pixels;}
export function prepareIndexedSelection(doc:PixelDocument,s:Selection,t:Transform,budget=8*1024*1024){current(doc,s);return prepareAuthored(doc,{kind:'indexed-selection',rect:s.rect,mask:s.mask,transform:t},budget);}
export function prepareIndexedSelectionClear(doc:PixelDocument,s:Selection,budget=8*1024*1024){current(doc,s);return prepareAuthored(doc,{kind:'indexed-selection-clear',rect:s.rect,mask:s.mask},budget);}
export function prepareIndexedSelectionPaint(doc:PixelDocument,s:Selection,slot:number,paint:'fill'|'stroke',thickness=1,budget=8*1024*1024){current(doc,s);return prepareAuthored(doc,{kind:'indexed-selection-paint',rect:s.rect,mask:s.mask,slot,paint,thickness},budget);}
export function indexedSelectionOperation(doc:PixelDocument,o:IndexedSelectionOperation){
 validateIndexedDocument(doc);if(!doc.indexed)throw new Error('Enter indexed storage first.');const l=activeLayer(doc);if(!layerEditable(doc,l))throw new Error('Show and unlock the indexed layer and its parents.');const c=captureIndexedCel(doc);rect(o.rect,c.width,c.height);const mask=copySelectionMask(o.rect,o.mask);let pixels:Uint8Array;
 if(o.kind==='indexed-selection')pixels=transform(c,o.rect,o.transform,mask);
 else{
  let selected:Uint8Array|undefined=mask;let slot:number;
  if(o.kind==='indexed-selection-clear'){if(c.transparentIndex===null&&(!mask||mask.some(Boolean)))throw new Error('Indexed cut needs a transparent slot.');slot=c.transparentIndex??0;}
  else if(o.kind==='indexed-selection-paint'){
   if(!Number.isInteger(o.slot)||o.slot<0||o.slot>=c.palette.length||!['fill','stroke'].includes(o.paint)||!Number.isInteger(o.thickness)||o.thickness<1||o.thickness>256)throw new Error('Choose an existing indexed slot, fill/stroke and thickness 1-256.');slot=o.slot;if(o.paint==='stroke')selected=innerSelectionMask(o.rect,mask,o.thickness);
  }else throw new Error('Unknown indexed selection operation.');
  pixels=new Uint8Array(c.indices);for(let y=0;y<o.rect.height;y++)for(let x=0;x<o.rect.width;x++)if(!selected||selected[y*o.rect.width+x])pixels[(o.rect.y+y)*c.width+o.rect.x+x]=slot;
 }
 const planes=doc.indexed.cels[l.id],old=planes[doc.activeFrameId];for(const id of Object.keys(planes))if(planes[id]===old)planes[id]=pixels;refreshIndexedCaches(doc);
}
