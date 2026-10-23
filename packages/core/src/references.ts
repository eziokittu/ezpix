import {validatePlacement,type ReferencePlacement} from './authored-metadata.js';
import type {Raster} from './conversion.js';
export const MAX_REFERENCES=4,MAX_REFERENCE_AXIS=1024,MAX_REFERENCE_PIXELS=1024*1024,MAX_REFERENCE_FILE_BYTES=8*1024*1024;
export interface ReferenceImage extends Raster {id:string;name:string;placement?:ReferencePlacement}
export type ReferenceState={references:ReferenceImage[];activeReferenceId:string|null};
export function validateReferenceMetadata(references:unknown,active:unknown):asserts references is ReferenceImage[]{
 if(!Array.isArray(references)||references.length>MAX_REFERENCES)throw new Error('Projects support up to four reference images.');
 const ids=new Set<string>();let total=0;
 for(const r of references){if(!r||typeof r.id!=='string'||!/^reference-[1-9][0-9]{0,8}$/.test(r.id)||ids.has(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>80||!Number.isInteger(r.width)||!Number.isInteger(r.height)||r.width<1||r.height<1||r.width>MAX_REFERENCE_AXIS||r.height>MAX_REFERENCE_AXIS)throw new Error('Invalid reference image metadata.');if(r.placement!==undefined)validatePlacement(r.placement);ids.add(r.id);total+=r.width*r.height;}
 if(total>MAX_REFERENCE_PIXELS)throw new Error('Reference images exceed the combined one megapixel budget.');
 if(active!==null&&(typeof active!=='string'||!ids.has(active)))throw new Error('Invalid selected reference image.');
}
export function validateReferences(state:ReferenceState){validateReferenceMetadata(state.references,state.activeReferenceId);for(const r of state.references)if(!(r.pixels instanceof Uint8ClampedArray)||r.pixels.length!==r.width*r.height*4)throw new Error('Invalid reference RGBA pixels.');}
/** Metadata and all encoded lengths are checked before importing any raster. */
export function validateEncodedReferences(references:unknown,active:unknown){
 validateReferenceMetadata(references,active);
 for(const r of references as unknown as {width:number;height:number;rgba:unknown}[]){const length=r.width*r.height*4,value=r.rgba;if(typeof value!=='string'||value.length!==4*Math.ceil(length/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(value)||value.length/4*3-(value.endsWith('==')?2:value.endsWith('=')?1:0)!==length)throw new Error('Invalid encoded reference image.');}
}
