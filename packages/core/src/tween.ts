import {activeLayer,checkCelBudget,composite,encodeProject,rasterCel,validateDuration,type PixelDocument} from './document.js';
import {layerEditable} from './groups.js';
export const MAX_TWEEN_FRAMES=16;
export interface TranslationOptions {frames:number;dx:number;dy:number;duration:number}
export interface TranslationPlan {readonly baseline:string;readonly options:Readonly<TranslationOptions>;readonly frames:ReadonlyArray<Record<string,Uint8ClampedArray>>;readonly clippedPixels:number}
/** Round nearest with symmetric half-away-from-zero ties; all arithmetic is bounded integer. */
export function tweenOffset(delta:number,step:number,total:number){if(!Number.isInteger(delta)||Math.abs(delta)>256||!Number.isInteger(total)||total<1||total>MAX_TWEEN_FRAMES||!Number.isInteger(step)||step<1||step>total)throw new Error('Invalid tween interpolation bounds.');return Math.sign(delta)*Math.floor((Math.abs(delta)*step*2+total)/(2*total));}
export function prepareTranslation(doc:PixelDocument,options:TranslationOptions):TranslationPlan {
 const {frames,dx,dy,duration}=options;
 if(!Number.isInteger(frames)||frames<1||frames>MAX_TWEEN_FRAMES||![dx,dy].every(n=>Number.isInteger(n)&&Math.abs(n)<=256))throw new Error('Tween needs 1-16 new frames and whole offsets from -256 to 256.');
 validateDuration(duration);checkCelBudget(doc.width,doc.height,doc.layers.length,doc.frames.length+frames);
 const layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer before tweening.');
 const source=rasterCel(doc,layer);let clippedPixels=0;
 const generated=Array.from({length:frames},(_,index)=>{const x=tweenOffset(dx,index+1,frames),y=tweenOffset(dy,index+1,frames),pixels=new Uint8ClampedArray(source.length);
  for(let sy=0;sy<doc.height;sy++)for(let sx=0;sx<doc.width;sx++){const from=(sy*doc.width+sx)*4,tx=sx+x,ty=sy+y;if(tx<0||ty<0||tx>=doc.width||ty>=doc.height){if(source.subarray(from,from+4).some(v=>v!==0))clippedPixels++;continue;}pixels.set(source.subarray(from,from+4),(ty*doc.width+tx)*4);}
  return Object.fromEntries(doc.layers.map(l=>[l.id,l.id===layer.id?(pixels.some(v=>v!==0)?pixels:new Uint8ClampedArray(0)):l.cels[doc.activeFrameId].slice()]));
 });
 return Object.freeze({baseline:encodeProject(doc,false),options:Object.freeze({frames,dx,dy,duration}),frames:Object.freeze(generated),clippedPixels});
}
export function translationPreview(doc:PixelDocument,plan:TranslationPlan,index:number){if(!Number.isInteger(index)||index<0||index>=plan.frames.length)throw new Error('Tween preview frame is missing.');return composite({...doc,layers:doc.layers.map(l=>({...l,cels:{...l.cels,[doc.activeFrameId]:plan.frames[index][l.id]}}))});}
