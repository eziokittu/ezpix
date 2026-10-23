/** Component blends in the document's byte RGB space (no colour-space conversion). */
export const BLEND_MODES=['normal','multiply','screen','overlay','darken','lighten','difference','exclusion'] as const;
export type BlendMode=typeof BLEND_MODES[number];
export function validateBlendMode(value:unknown):asserts value is BlendMode {
 if(!BLEND_MODES.includes(value as BlendMode))throw new Error('Unsupported layer blend mode.');
}
/** Inputs and result are straight RGB channels in [0,255]. */
export function blendChannel(backdrop:number,source:number,mode:BlendMode):number {
 switch(mode){
  case 'normal':return source;
  case 'multiply':return backdrop*source/255;
  case 'screen':return backdrop+source-backdrop*source/255;
  case 'overlay':return backdrop<=127.5?2*backdrop*source/255:255-2*(255-backdrop)*(255-source)/255;
  case 'darken':return Math.min(backdrop,source);
  case 'lighten':return Math.max(backdrop,source);
  case 'difference':return Math.abs(backdrop-source);
  case 'exclusion':return backdrop+source-2*backdrop*source/255;
 }
}
