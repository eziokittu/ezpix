import {editingPalette} from './editing-policy.js';
import {validatePaletteSlots} from './document.js';
import {activeLayer,encodeProject,rasterCel,type PixelDocument} from './document.js';
import {validatePalette} from './toolkit.js';
export interface PaletteAudit {counts:ReadonlyArray<{color:string;pixels:number}>;transparentPixels:number;outsidePixels:number;outsideSamples:ReadonlyArray<string>}
/** Selected stored cel only: no compositing, opacity weighting or link multiplication. */
export function auditPalette(doc:PixelDocument):PaletteAudit {
 const colors=validatePalette(doc.palette),counts=colors.map(color=>({color,pixels:0})),lookup=new Map(colors.map((c,i)=>[c,i])),outsideSamples:string[]=[];
 let transparentPixels=0,outsidePixels=0;const pixels=rasterCel(doc,activeLayer(doc));
 for(let i=0;i<pixels.length;i+=4){
  if(!pixels[i+3]){transparentPixels++;continue;}
  const color='#'+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''),index=lookup.get(color);
  if(index!==undefined)counts[index].pixels++;else{outsidePixels++;if(outsideSamples.length<16&&!outsideSamples.includes(color))outsideSamples.push(color);}
 }
 return {counts,transparentPixels,outsidePixels,outsideSamples};
}
export interface PaletteRampOptions {from:string;to:string;steps:number}
export interface PaletteRampPlan {readonly baseline:string;readonly options:Readonly<PaletteRampOptions>;readonly ramp:ReadonlyArray<string>;readonly colors:ReadonlyArray<string>;readonly added:number}
/** Encoded sRGB interpolation with exact rational byte rounding; includes endpoints. */
export function paletteRamp(options:PaletteRampOptions):string[]{
 if(!options||!Number.isInteger(options.steps)||options.steps<2||options.steps>32)throw new Error('A ramp needs 2-32 whole steps.');
 const from=validatePalette([options.from])[0],to=validatePalette([options.to])[0],span=options.steps-1;
 return Array.from({length:options.steps},(_,i)=>'#'+[1,3,5].map(k=>{const numerator=parseInt(from.slice(k,k+2),16)*(span-i)+parseInt(to.slice(k,k+2),16)*i;return Math.floor((2*numerator+span)/(2*span)).toString(16).padStart(2,'0');}).join(''));
}
export function preparePaletteRamp(doc:PixelDocument,options:PaletteRampOptions):PaletteRampPlan {
 const ramp=editingPalette(doc,paletteRamp(options)),colors=doc.editingMode?validatePaletteSlots([...doc.palette,...new Set(ramp.filter(c=>!doc.palette.includes(c)))]):validatePalette([...new Set([...validatePalette(doc.palette),...ramp])]);
 return Object.freeze({baseline:encodeProject(doc,false),options:Object.freeze({from:options.from.toLowerCase(),to:options.to.toLowerCase(),steps:options.steps}),ramp:Object.freeze(ramp),colors:Object.freeze(colors),added:colors.length-doc.palette.length});
}
