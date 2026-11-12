import {renderWorkspaceEdit} from './photo-workspace.js';
import {focusAnimation,focusRaster,encodeProject,type FocusOptions} from './index.js';
import { convert, validateRaster, type Raster, type Recipe } from './index.js';
export function processConversion(data: { source: Raster; recipe: Recipe }) {
  const doc = convert(data.source, data.recipe);
  return { width: doc.width, height: doc.height, pixels: doc.cel.pixels };
}
/** Cache media within this worker only; replacing/terminating it drops those pixels. */
export function createConversionProcessor(){
 let source:Raster|undefined,focusFrames:Raster[]|undefined;
 return (data:{source?:Raster;recipe:Recipe;focus?:{frames?:Raster[];options:FocusOptions;fps:number;track:boolean;photo?:boolean;workspace?:boolean;fullMask?:Uint8Array|null}})=>{
  if(data.focus){
   const f=data.focus,frames=f.frames??focusFrames;
   if(!frames)throw new Error('Load focus frames before converting.');
   if(f.photo){if(!frames.length||frames.length>32)throw Error('Invalid photo frames.');for(const frame of frames)validateRaster(frame);if(frames.reduce((n,f)=>n+f.pixels.byteLength,0)>32*1024*1024)throw Error('Photo frames exceed 32 MiB.');const photo=f.workspace?renderWorkspaceEdit(frames[0],{kind:'tone',options:f.options},f.fullMask??null):focusRaster(frames[0],f.options);focusFrames=frames;return {width:photo.width,height:photo.height,pixels:photo.pixels,photo};}
   if(f.workspace){const photo=renderWorkspaceEdit(frames[0],{kind:'tone',options:f.options,recipe:data.recipe},f.fullMask??null);focusFrames=frames;return {width:photo.width,height:photo.height,pixels:photo.pixels,photo,project:encodeProject(focusAnimation(frames,f.options,data.recipe,f.fps,f.track),false)};}
   const doc=focusAnimation(frames,f.options,data.recipe,f.fps,f.track);
   // Cache only a successful request, so rejected replacement data cannot poison it.
   focusFrames=frames;
   return {width:doc.width,height:doc.height,pixels:doc.cel.pixels,project:encodeProject(doc,false)};
  }
  if(data.source){validateRaster(data.source);source=data.source;}
  if(!source)throw new Error('Load an image before converting.');
  return processConversion({source,recipe:data.recipe});
 };
}
