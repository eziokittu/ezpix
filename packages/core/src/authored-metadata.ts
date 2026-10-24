import type {PixelDocument} from './document.js';
export interface ReferencePlacement {x:number;y:number;width:number;height:number;opacity:number;visible:boolean;position:'behind'|'above'}
export interface PaletteGroup {id:string;name:string;indices:number[]}
export interface PaletteOrganisation {groups:PaletteGroup[];locked:number[]}
export interface SpriteSlice {id:string;name:string;x:number;y:number;width:number;height:number;pivotX:number;pivotY:number}
export function defaultReferencePlacement(width:number,height:number):ReferencePlacement{return {x:0,y:0,width:Math.min(256,width),height:Math.min(256,height),opacity:128,visible:false,position:'behind'};}
const int=(v:unknown,a:number,b:number)=>Number.isInteger(v)&&(v as number)>=a&&(v as number)<=b;
export function validatePlacement(value:unknown):asserts value is ReferencePlacement {
 const p=value as ReferencePlacement;if(!p||Object.keys(p).length!==7||Object.keys(p).some(k=>!['x','y','width','height','opacity','visible','position'].includes(k))||!int(p.x,-1024,1024)||!int(p.y,-1024,1024)||!int(p.width,1,2048)||!int(p.height,1,2048)||!int(p.opacity,0,255)||typeof p.visible!=='boolean'||!['behind','above'].includes(p.position))throw new Error('Reference placement needs x/y +/-1024, size 1-2048, opacity 0-255, visibility and behind/above position.');
}
export function validatePaletteOrganisation(value:unknown,count:number):asserts value is PaletteOrganisation|undefined {
 if(value===undefined)return;const o=value as PaletteOrganisation;if(!o||Object.keys(o).length!==2||!Array.isArray(o.groups)||o.groups.length>16||!Array.isArray(o.locked)||o.locked.length>count)throw new Error('Palette supports sixteen groups and bounded locked indices.');
 const ids=new Set<string>(),names=new Set<string>(),used=new Set<number>();
 for(const g of o.groups){if(!g||Object.keys(g).length!==3||typeof g.id!=='string'||!/^palette-group-[1-9][0-9]{0,8}$/.test(g.id)||ids.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>80||names.has(g.name.toLowerCase())||!Array.isArray(g.indices)||g.indices.length>count)throw new Error('Invalid palette group.');ids.add(g.id);names.add(g.name.toLowerCase());for(const i of g.indices){if(!int(i,0,count-1)||used.has(i))throw new Error('A swatch can belong to one group only.');used.add(i);}}
 if(new Set(o.locked).size!==o.locked.length||o.locked.some(i=>!int(i,0,count-1)))throw new Error('Invalid locked palette indices.');
}
export function validateSlices(value:unknown,width:number,height:number):asserts value is SpriteSlice[]|undefined {
 if(value===undefined)return;if(!Array.isArray(value)||value.length>32)throw new Error('Use at most 32 sprite slices.');const ids=new Set<string>(),names=new Set<string>();for(const s of value){if(!s||Object.keys(s).length!==8||typeof s.id!=='string'||!/^slice-[1-9][0-9]{0,8}$/.test(s.id)||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||names.has(s.name.toLowerCase())||!int(s.x,0,width-1)||!int(s.y,0,height-1)||!int(s.width,1,width-s.x)||!int(s.height,1,height-s.y)||!int(s.pivotX,-1024,1024)||!int(s.pivotY,-1024,1024))throw new Error('Slices need unique names/IDs, in-canvas rectangles and local integer pivots +/-1024.');ids.add(s.id);names.add(s.name.toLowerCase());}
}
export function validateAuthoredMetadata(doc:PixelDocument){validatePaletteOrganisation(doc.paletteOrganisation,doc.palette.length);validateSlices(doc.slices,doc.width,doc.height);}

export function nativeMetadataWarnings(doc:PixelDocument){const warnings:string[]=[];if(doc.indexed)warnings.push('Persistent indexed slots/links are omitted by flattened/native export. Keep an EzPix project or indexed cel file.');if(doc.editingMode)warnings.push('Grayscale editing policy is omitted by native/image formats. Save an EzPix project to retain constrained editing.');if(doc.outputMode)warnings.push('Document output mode is baked only by flattened export; the editable mode is omitted in this format.');if(doc.paletteOrganisation)warnings.push('Palette groups and swatch locks are omitted in this format. Save an EzPix project to retain them.');if(doc.slices?.length)warnings.push('Sprite slice rectangles and pivots are omitted in this format. Asset bundles retain them.');return warnings;}
