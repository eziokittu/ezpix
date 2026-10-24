import {editingPalette} from './editing-policy.js';
import {validatePaletteSlots} from './document.js';
import {encodeProject,type PixelDocument} from './document.js';
import {validatePalette} from './toolkit.js';
export type HarmonyMode='complementary'|'analogous'|'triadic';
export interface HarmonyOptions {kind:'harmony';base:string;mode:HarmonyMode}
export interface SortPaletteOptions {kind:'sort';by:'hue'|'brightness'|'hex';direction:'ascending'|'descending'}
export interface PrunePaletteOptions {kind:'prune'}
export type PaletteOperationOptions=HarmonyOptions|SortPaletteOptions|PrunePaletteOptions;
export interface DocumentPaletteAudit {counts:ReadonlyArray<{color:string;pixels:number}>;outsidePixels:number;transparentPixels:number;uniqueCels:number;emptyCels:number;outsideSamples:ReadonlyArray<string>}
export interface PaletteOperationPlan {readonly baseline:string;readonly options:Readonly<PaletteOperationOptions>;readonly colors:ReadonlyArray<string>;readonly preview:ReadonlyArray<string>;readonly changed:boolean;readonly added:number;readonly removed:number}
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
/** Exact encoded RGB hue as a nonnegative rational in degrees; grey hue is zero. */
function hue(value:number[]):{numerator:number;denominator:number}{
 const [r,g,b]=value,hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo;
 if(!delta)return {numerator:0,denominator:1};
 const raw=60*(hi===r?g-b:hi===g?b-r+2*delta:r-g+4*delta),period=360*delta;
 return {numerator:(raw%period+period)%period,denominator:delta};
}
/** Hue rotation preserves encoded RGB extrema; rational intermediates, half-up bytes. */
function rotate(base:string,degrees:number):string {
 const value=rgb(base),lo=Math.min(...value),hi=Math.max(...value),delta=hi-lo;
 if(!delta)return base;
 const h=hue(value),period=360*delta,n=((h.numerator+degrees*delta)%period+period)%period,sector=Math.floor(n/(60*delta)),remainder=n%(60*delta),low=lo*60,high=hi*60;
 const rising=low+remainder,falling=high-remainder;
 const channels=sector===0?[high,rising,low]:sector===1?[falling,high,low]:sector===2?[low,high,rising]:sector===3?[low,falling,high]:sector===4?[rising,low,high]:[high,low,falling];
 return '#'+channels.map(v=>Math.floor((v+30)/60).toString(16).padStart(2,'0')).join('');
}
export function paletteHarmony(options:HarmonyOptions):string[]{
 if(!options||options.kind!=='harmony'||!['complementary','analogous','triadic'].includes(options.mode))throw new Error('Choose complementary, analogous or triadic harmony.');
 const base=validatePalette([options.base])[0],offsets=options.mode==='complementary'?[0,180]:options.mode==='analogous'?[0,-30,30]:[0,120,240];
 return offsets.map(offset=>rotate(base,offset));
}
export function sortPalette(colors:ReadonlyArray<string>,options:SortPaletteOptions):string[]{
 const palette=validatePalette(colors);
 if(!options||options.kind!=='sort'||!['hue','brightness','hex'].includes(options.by)||!['ascending','descending'].includes(options.direction))throw new Error('Choose hue, brightness or hex and an ascending/descending direction.');
 const sign=options.direction==='ascending'?1:-1;
 return palette.map((color,index)=>({color,index,value:rgb(color),hue:hue(rgb(color))})).sort((a,b)=>{
  const comparison=options.by==='hue'?a.hue.numerator*b.hue.denominator-b.hue.numerator*a.hue.denominator:options.by==='brightness'?Math.max(...a.value)-Math.max(...b.value):parseInt(a.color.slice(1),16)-parseInt(b.color.slice(1),16);
  return sign*comparison||a.index-b.index;
 }).map(item=>item.color);
}
/** Every layer/frame's stored artwork, unique linked buffers once per layer. */
export function auditDocumentPalette(doc:PixelDocument):DocumentPaletteAudit {
 const colors=validatePalette(doc.palette),counts=colors.map(color=>({color,pixels:0})),lookup=new Map(colors.map((c,i)=>[c,i])),outsideSamples:string[]=[];
 let outsidePixels=0,transparentPixels=0,uniqueCels=0,emptyCels=0;
 for(const layer of doc.layers){const seen=new Set<Uint8ClampedArray>();for(const frame of doc.frames){const pixels=layer.cels[frame.id];if(seen.has(pixels))continue;seen.add(pixels);uniqueCels++;
  if(!pixels.length){emptyCels++;transparentPixels+=doc.width*doc.height;continue;}
  for(let i=0;i<pixels.length;i+=4){if(!pixels[i+3]){transparentPixels++;continue;}const color='#'+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''),index=lookup.get(color);if(index!==undefined)counts[index].pixels++;else{outsidePixels++;if(outsideSamples.length<16&&!outsideSamples.includes(color))outsideSamples.push(color);}}
 }}
 return {counts,outsidePixels,transparentPixels,uniqueCels,emptyCels,outsideSamples};
}
export function preparePaletteOperation(doc:PixelDocument,options:PaletteOperationOptions):PaletteOperationPlan {
 if(doc.editingMode&&options?.kind!=='harmony'&&new Set(doc.palette).size!==doc.palette.length)throw new Error('Use authored palette slot tools to preserve equal-gray slot identity.');
 const before=doc.editingMode?validatePaletteSlots(doc.palette):validatePalette(doc.palette);let colors:string[],preview:string[],settings:Readonly<PaletteOperationOptions>;
 if(options?.kind==='harmony'){
  preview=editingPalette(doc,paletteHarmony(options));colors=doc.editingMode?validatePaletteSlots([...before,...new Set(preview.filter(c=>!before.includes(c)))]):validatePalette([...new Set([...before,...preview])]);settings=Object.freeze({kind:'harmony',base:options.base.toLowerCase(),mode:options.mode});
 }else if(options?.kind==='sort'){
  colors=sortPalette(before,options);preview=colors.slice();settings=Object.freeze({kind:'sort',by:options.by,direction:options.direction});
 }else if(options?.kind==='prune'){
  const audit=auditDocumentPalette(doc);colors=audit.counts.filter(c=>c.pixels>0).map(c=>c.color);if(!colors.length)colors=[before[0]];preview=colors.slice();settings=Object.freeze({kind:'prune'});
 }else throw new Error('Unknown palette operation.');
 return Object.freeze({baseline:encodeProject(doc,false),options:settings,colors:Object.freeze(colors),preview:Object.freeze(preview),changed:colors.join()!==before.join(),added:colors.filter(c=>!before.includes(c)).length,removed:before.filter(c=>!colors.includes(c)).length});
}
