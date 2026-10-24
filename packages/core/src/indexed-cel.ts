import {captureIndexedCel} from './indexed-document.js';
import {composite,encodeProject,type PixelDocument} from './document.js';
import type {Raster} from './conversion.js';
import {pngChunk,decodeNativePngData} from './native-png.js';
import {concat,deflate} from './native-utils.js';
export const MAX_INDEXED_CEL_BYTES=128*1024;
/** Palette entries are RGBA slots, including unused and duplicate opaque/partial-alpha slots. */
export interface IndexedCel {width:number;height:number;palette:readonly (readonly number[])[];indices:Uint8Array;transparentIndex:number|null}
export function validateIndexedCel(c:IndexedCel){
 if(!c||Object.keys(c).sort().join()!=='height,indices,palette,transparentIndex,width'||![c.width,c.height].every(n=>Number.isInteger(n)&&n>=1&&n<=256)||!(c.indices instanceof Uint8Array)||c.indices.length!==c.width*c.height||!Array.isArray(c.palette)||c.palette.length<1||c.palette.length>256||Array.from(c.palette).some(p=>!Array.isArray(p)||p.length!==4||!Array.from(p).every(n=>Number.isInteger(n)&&n>=0&&n<=255)))throw new Error('Indexed cel needs 1-256 dimensions/slots, RGBA bytes and one byte per pixel.');
 if(c.transparentIndex!==null&&(!Number.isInteger(c.transparentIndex)||c.transparentIndex<0||c.transparentIndex>=c.palette.length))throw new Error('Transparent slot must be null or an existing slot.');
 if(c.palette.some((p,i)=>(p[3]===0)!==(i===c.transparentIndex)))throw new Error('Exactly the designated transparent slot must have zero alpha; other slots may use alpha 1-255.');
 if(c.indices.some(i=>i>=c.palette.length))throw new Error('Pixel index exceeds the palette slots.');
}
export function copyIndexedCel(c:IndexedCel):IndexedCel{validateIndexedCel(c);return {width:c.width,height:c.height,palette:c.palette.map(p=>[...p]),indices:new Uint8Array(c.indices),transparentIndex:c.transparentIndex};}
export function expandIndexedCel(c:IndexedCel):Raster{validateIndexedCel(c);const pixels=new Uint8ClampedArray(c.indices.length*4);c.indices.forEach((slot,i)=>pixels.set(c.palette[slot],i*4));return {width:c.width,height:c.height,pixels};}
export function indexRasterExact(r:Raster):IndexedCel{
 if(!r||![r.width,r.height].every(n=>Number.isInteger(n)&&n>=1&&n<=256)||!(r.pixels instanceof Uint8ClampedArray)||r.pixels.length!==r.width*r.height*4)throw new Error('Indexed source needs bounded exact RGBA pixels.');
 const palette:number[][]=[],indices=new Uint8Array(r.width*r.height),lookup=new Map<string,number>();let transparentIndex:number|null=null;
 for(let i=0;i<indices.length;i++){const p=Array.from(r.pixels.subarray(i*4,i*4+4)),key=p.join();let slot=lookup.get(key);if(slot===undefined){if(palette.length===256)throw new Error('Exact indexing exceeds 256 RGBA slots. Reduce colours/alpha variants or use RGBA.');slot=palette.length;if(p[3]===0){if(transparentIndex!==null)throw new Error('Exact indexing needs one transparent RGB value. Use a normalized visible composite or RGBA to retain multiple hidden colours.');transparentIndex=slot;}palette.push(p);lookup.set(key,slot);}indices[i]=slot;}
 return {width:r.width,height:r.height,palette,indices,transparentIndex};
}
export function encodeIndexedCel(input:IndexedCel){const c=copyIndexedCel(input),text=JSON.stringify({format:'ezpix-indexed-cel',version:1,width:c.width,height:c.height,palette:c.palette,transparentIndex:c.transparentIndex,indices:btoa(Array.from(c.indices,n=>String.fromCharCode(n)).join(''))});if(new TextEncoder().encode(text).length>MAX_INDEXED_CEL_BYTES)throw new Error('Indexed cel exceeds 128 KiB.');return text;}
export function decodeIndexedCel(text:string):IndexedCel{
 if(typeof text!=='string'||text.length>MAX_INDEXED_CEL_BYTES||new TextEncoder().encode(text).length>MAX_INDEXED_CEL_BYTES)throw new Error('Indexed cel exceeds 128 KiB.');let v;try{v=JSON.parse(text);}catch{throw new Error('Invalid indexed cel JSON.');}
 if(!v||Object.keys(v).sort().join()!=='format,height,indices,palette,transparentIndex,version,width'||v.format!=='ezpix-indexed-cel'||v.version!==1||![v.width,v.height].every(n=>Number.isInteger(n)&&n>=1&&n<=256))throw new Error('Unsupported indexed cel v1 envelope.');
 const length=v.width*v.height;if(typeof v.indices!=='string'||v.indices.length!==4*Math.ceil(length/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.indices))throw new Error('Invalid indexed byte plane.');let raw;try{raw=atob(v.indices);}catch{throw new Error('Invalid indexed byte plane.');}if(raw.length!==length||btoa(raw)!==v.indices)throw new Error('Noncanonical indexed byte plane.');const c={width:v.width,height:v.height,palette:v.palette,transparentIndex:v.transparentIndex,indices:Uint8Array.from(raw,c=>c.charCodeAt(0))};validateIndexedCel(c);return copyIndexedCel(c);
}
/** A complete permutation remaps indices and transparency together, preserving visible and hidden RGBA. */
export function reorderIndexedSlots(input:IndexedCel,order:readonly number[]):IndexedCel {const c=copyIndexedCel(input);if(!Array.isArray(order)||order.length!==c.palette.length||new Set(order).size!==order.length||Array.from(order).some(i=>!Number.isInteger(i)||i<0||i>=order.length))throw new Error('Slot order must be a complete permutation.');const inverse=Array.from({length:order.length},(_,i)=>order.indexOf(i));return {width:c.width,height:c.height,palette:order.map(i=>c.palette[i]),indices:c.indices.map(i=>inverse[i]),transparentIndex:c.transparentIndex===null?null:inverse[c.transparentIndex]};}
export function replaceIndexedSlot(input:IndexedCel,slot:number,color:readonly number[]):IndexedCel{const c=copyIndexedCel(input);if(!Number.isInteger(slot)||slot<0||slot>=c.palette.length)throw new Error('Choose an existing slot.');const out={...c,palette:c.palette.map((p,i)=>i===slot?[...color]:p)};validateIndexedCel(out);return out;}
/** PNG retains the declared slot table and exact index plane, including unused/duplicate slots. */
export async function encodeIndexedCelPng(input:IndexedCel){const c=copyIndexedCel(input),header=new Uint8Array(13),v=new DataView(header.buffer);v.setUint32(0,c.width);v.setUint32(4,c.height);header[8]=8;header[9]=3;const rows=new Uint8Array((c.width+1)*c.height);for(let y=0;y<c.height;y++)rows.set(c.indices.subarray(y*c.width,(y+1)*c.width),y*(c.width+1)+1);return concat([Uint8Array.of(137,80,78,71,13,10,26,10),pngChunk('IHDR',header),pngChunk('PLTE',Uint8Array.from(c.palette.flatMap(p=>p.slice(0,3)))),pngChunk('tRNS',Uint8Array.from(c.palette.map(p=>p[3]))),pngChunk('IDAT',await deflate(rows)),pngChunk('IEND',new Uint8Array())]);}
export interface IndexedCelPlan {readonly baseline:string;readonly text:string;readonly slots:number;readonly transparentIndex:number|null;readonly preview:Uint8ClampedArray}
const plans=new WeakMap<IndexedCelPlan,string>();
export function prepareIndexedCel(doc:PixelDocument):IndexedCelPlan{const baseline=encodeProject(doc,false),c=indexRasterExact({width:doc.width,height:doc.height,pixels:composite(doc)}),text=encodeIndexedCel(c),plan=Object.freeze({baseline,text,slots:c.palette.length,transparentIndex:c.transparentIndex,get preview(){return expandIndexedCel(c).pixels;}});plans.set(plan,text);return plan;}
export function reviewedIndexedCel(doc:PixelDocument,plan:IndexedCelPlan){const text=plans.get(plan);if(!text||plan.baseline!==encodeProject(doc,false))throw new Error('Indexed source changed. Prepare again.');return decodeIndexedCel(text);}

export function prepareIndexedRawCel(doc:PixelDocument):IndexedCelPlan{const baseline=encodeProject(doc,false),c=captureIndexedCel(doc),text=encodeIndexedCel(c),plan=Object.freeze({baseline,text,slots:c.palette.length,transparentIndex:c.transparentIndex,get preview(){return expandIndexedCel(c).pixels;}});plans.set(plan,text);return plan;}

/** Strict non-interlaced 8-bit indexed PNG. No quantization, palette inference or profile conversion. */
export async function decodeIndexedCelPng(input:Uint8Array):Promise<IndexedCel>{
 if(!(input instanceof Uint8Array)||input.length<33||input.length>MAX_INDEXED_CEL_BYTES)throw new Error('Raw indexed PNG needs 33 bytes to 128 KiB.');const bytes=input.slice(),v=new DataView(bytes.buffer);
 if(![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)||bytes[24]!==8||bytes[25]!==3)throw new Error('Raw indexed PNG requires 8-bit palette storage. Packed, RGBA and grayscale PNG need ordinary image import.');
 const width=v.getUint32(16),height=v.getUint32(20);if(![width,height].every(n=>n>=1&&n<=256))throw new Error('Raw indexed PNG dimensions must be 1-256.');
 const r=await decodeNativePngData(bytes,width,height);if(!r.palette||!r.indices)throw new Error('Indexed PNG needs a declared palette and index plane.');const palette=Array.from({length:r.palette.length/3},(_,i)=>[...r.palette!.subarray(i*3,i*3+3),r.alpha?.[i]??255]),zeros=palette.map((p,i)=>p[3]===0?i:-1).filter(i=>i>=0);
 if(zeros.length>1)throw new Error('Indexed storage accepts one transparent slot; this PNG declares several. Use ordinary RGBA import to retain its pixels.');return copyIndexedCel({width,height,palette,transparentIndex:zeros[0]??null,indices:r.indices});
}
