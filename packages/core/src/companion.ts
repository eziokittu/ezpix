import {checkCelBudget,composite,type PixelDocument} from './document.js';
import {validatePalette,grabPalette} from './toolkit.js';
export type CompanionDestination='new-document'|'layer'|'palette'|'reference';
/** Pure preflight used before any undoable editor mutation. References stay display-only. */
export function companionImportPlan(target:PixelDocument,source:PixelDocument,destination:CompanionDestination){
 if(!['new-document','layer','palette','reference'].includes(destination))throw new Error('Choose an import destination.');
 if(destination==='layer'){
  if(target.width!==source.width||target.height!==source.height)throw new Error('Layer import needs matching canvas dimensions. Use a new document or reference instead.');
  checkCelBudget(target.width,target.height,target.layers.length+1,target.frames.length);
  return {pixels:composite(source),name:source.name.slice(0,80)||'Capture'};
 }
 if(destination==='palette')return {palette:validatePalette([...new Set([...target.palette,...grabPalette(source)])])};
 if(destination==='reference')return {pixels:composite(source),name:source.name,width:source.width,height:source.height};
 return {};
}
