import {focusAnimation,encodeProject,type FocusOptions} from './index.js';
import { convert, validateRaster, type Raster, type Recipe } from './index.js';
export function processConversion(data: { source: Raster; recipe: Recipe }) {
  const doc = convert(data.source, data.recipe);
  return { width: doc.width, height: doc.height, pixels: doc.cel.pixels };
}
/** Cache media within this worker only; replacing/terminating it drops those pixels. */
export function createConversionProcessor(){
 let source:Raster|undefined,focusFrames:Raster[]|undefined;
 return (data:{source?:Raster;recipe:Recipe;focus?:{frames?:Raster[];options:FocusOptions;fps:number;track:boolean}})=>{
  if(data.focus){
   const f=data.focus,frames=f.frames??focusFrames;
   if(!frames)throw new Error('Load focus frames before converting.');
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
