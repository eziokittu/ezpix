import {renderBitmapText,validateBitmapText} from './bitmap-text.js';
import type {Layer} from './document.js';
export interface LayerMask {enabled:boolean;values:Uint8ClampedArray}
export const LIVE_EFFECTS=['invert','grayscale','brightness','contrast','alpha','posterize','mosaic','blur'] as const;
export type LiveEffectKind=typeof LIVE_EFFECTS[number];
export interface LiveEffect {kind:LiveEffectKind;enabled:boolean;amount:number}
export const MAX_LIVE_EFFECTS=8;
export function validateLayerRendering(layer:Pick<Layer,'mask'|'effects'|'text'|'adjustment'>,width:number,height:number){
 if(layer.mask!==undefined&&(!layer.mask||typeof layer.mask.enabled!=='boolean'||!(layer.mask.values instanceof Uint8ClampedArray)||layer.mask.values.length!==width*height))throw new Error('Layer mask needs one byte per canvas pixel and an enabled flag.');
 validateLiveEffects(layer.effects);if(layer.text!==undefined)validateBitmapText(layer.text);if(layer.adjustment!==undefined&&layer.adjustment!==true)throw new Error('Invalid adjustment layer flag.');if(layer.text&&layer.adjustment)throw new Error('A layer cannot be both text and adjustment.');
}
export function validateLiveEffects(effects:unknown):asserts effects is LiveEffect[]|undefined {
 if(effects===undefined)return;
 if(!Array.isArray(effects)||effects.length>MAX_LIVE_EFFECTS)throw new Error('Use at most eight ordered live effects per layer.');
 for(const e of effects){if(!e||Object.keys(e).length!==3||Object.keys(e).some(k=>!['kind','enabled','amount'].includes(k))||!LIVE_EFFECTS.includes(e.kind)||typeof e.enabled!=='boolean'||!Number.isInteger(e.amount))throw new Error('Invalid live effect.');
  const [lo,hi]=e.kind==='brightness'?[-255,255]:e.kind==='contrast'?[-100,100]:e.kind==='alpha'?[0,200]:e.kind==='posterize'?[2,32]:e.kind==='mosaic'?[1,16]:e.kind==='blur'?[1,4]:[0,0];
  if(e.amount<lo||e.amount>hi)throw new Error(`${e.kind} amount must be ${lo} to ${hi}.`);
 }
}
const byte=(v:number)=>Math.max(0,Math.min(255,Math.floor(v+.5)));
/** Raw cels are never changed. Each enabled effect rounds its output to bytes. */
export function renderLayerPixels(layer:Layer,width:number,height:number,frameId:string,includeMask=true):Uint8ClampedArray {
 let p=layer.cels[frameId];if(!p)throw new Error('Cel is missing.');
 if(!p.length)p=new Uint8ClampedArray(width*height*4);
 if(layer.text)p=renderBitmapText(width,height,layer.text);p=applyLiveEffects(p,width,height,layer.effects);
 if(includeMask&&layer.mask?.enabled){p=p.slice();for(let i=0;i<layer.mask.values.length;i++)p[i*4+3]=byte(p[i*4+3]*layer.mask.values[i]/255);}
 return p;
}

export function applyLiveEffects(source:Uint8ClampedArray,width:number,height:number,effects?:LiveEffect[]){let p=source;
 for(const e of effects??[]){if(!e.enabled)continue;const out=p.slice();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;
   if(e.kind==='mosaic'){const j=(Math.floor(y/e.amount)*e.amount*width+Math.floor(x/e.amount)*e.amount)*4;out.set(p.subarray(j,j+4),i);continue;}
   if(e.kind==='blur'){let a=0,n=0;const rgb=[0,0,0];for(let yy=Math.max(0,y-e.amount);yy<=Math.min(height-1,y+e.amount);yy++)for(let xx=Math.max(0,x-e.amount);xx<=Math.min(width-1,x+e.amount);xx++){const j=(yy*width+xx)*4;n++;a+=p[j+3];for(let k=0;k<3;k++)rgb[k]+=p[j+k]*p[j+3];}out[i+3]=byte(a/n);for(let k=0;k<3;k++)out[i+k]=a?byte(rgb[k]/a):0;continue;}
   if(e.kind==='alpha'){out[i+3]=byte(p[i+3]*e.amount/100);continue;}
   const gray=byte((54*p[i]+183*p[i+1]+19*p[i+2])/256);
   for(let k=0;k<3;k++){const v=p[i+k];out[i+k]=e.kind==='invert'?255-v:e.kind==='grayscale'?gray:e.kind==='brightness'?byte(v+e.amount):e.kind==='contrast'?byte((v-127.5)*(100+e.amount)/(100-e.amount||.000001)+127.5):byte(Math.floor(v*(e.amount-1)/255+.5)*255/(e.amount-1));}
  }p=out;
 }
 return p;
}
