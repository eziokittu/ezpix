import {focusAnimation,encodeProject,type FocusOptions} from './index.js';
import { convert, validateRaster, type Raster, type Recipe } from './index.js';
export function processConversion(data: { source: Raster; recipe: Recipe }) {
  const doc = convert(data.source, data.recipe);
  return { width: doc.width, height: doc.height, pixels: doc.cel.pixels };
}
/** One source clone per worker lifetime; result buffers are transferred separately. */
export function createConversionProcessor(){let source:Raster|undefined;return (data:{source?:Raster;recipe:Recipe;focus?:{frames:Raster[];options:FocusOptions;fps:number;track:boolean}})=>{if(data.focus){const f=data.focus,doc=focusAnimation(f.frames,f.options,data.recipe,f.fps,f.track);return {width:doc.width,height:doc.height,pixels:doc.cel.pixels,project:encodeProject(doc,false)};}if(data.source){validateRaster(data.source);source=data.source;}if(!source)throw new Error('Load an image before converting.');return processConversion({source,recipe:data.recipe});};}
