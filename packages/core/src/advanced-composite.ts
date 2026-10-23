import type {PixelDocument} from './document.js';
import {layerForest,type LayerNode} from './groups.js';
import {blendChannel} from './blend.js';
import {applyLiveEffects,renderLayerPixels} from './layer-render.js';
/** New render boundaries quantize to straight RGBA before filtering; ordinary groups retain floats. */
export function advancedComposite(doc:PixelDocument,frameId:string){
 const size=doc.width*doc.height*4,layers=new Map(doc.layers.map(l=>[l.id,l])),groups=new Map(doc.groups.map(g=>[g.id,g]));
 const bytes=(p:Float64Array)=>{const out=new Uint8ClampedArray(size);for(let i=0;i<size;i+=4)if(p[i+3]){for(let k=0;k<3;k++)out[i+k]=Math.round(p[i+k]/p[i+3]);out[i+3]=Math.round(p[i+3]*255);}return out;};
 const premult=(p:Uint8ClampedArray)=>{const out=new Float64Array(size);for(let i=0;i<size;i+=4){out[i+3]=p[i+3]/255;for(let k=0;k<3;k++)out[i+k]=p[i+k]*out[i+3];}return out;};
 const render=(nodes:LayerNode[]):Float64Array=>{const dst=new Float64Array(size);for(const n of nodes){const item=n.group?groups.get(n.id)!:layers.get(n.id)!;if(!item.visible||!item.opacity)continue;
  if(!n.group&&layers.get(n.id)!.adjustment){const l=layers.get(n.id)!;if(!l.effects?.some(e=>e.enabled))continue;const filtered=premult(applyLiveEffects(bytes(dst),doc.width,doc.height,l.effects));for(let i=0;i<size;i+=4){const t=l.opacity/255*(l.mask?.enabled?l.mask.values[i/4]/255:1);for(let k=0;k<4;k++)dst[i+k]=dst[i+k]*(1-t)+filtered[i+k]*t;}continue;}
  let src:Float64Array|undefined,raw:Uint8ClampedArray|undefined;if(n.group){src=render(n.children);const effects=groups.get(n.id)!.effects;if(effects?.some(e=>e.enabled))src=premult(applyLiveEffects(bytes(src),doc.width,doc.height,effects));}else raw=renderLayerPixels(layers.get(n.id)!,doc.width,doc.height,frameId);
  for(let i=0;i<size;i+=4){const a=dst[i+3],opacity=item.opacity/255,sa=raw?raw[i+3]/255*opacity:src![i+3]*opacity,mode=n.group?'normal':layers.get(n.id)!.blendMode;for(let k=0;k<3;k++){let s=raw?raw[i+k]*sa:src![i+k]*opacity;if(mode!=='normal'&&a&&sa)s=(1-a)*s+sa*a*blendChannel(dst[i+k]/a,s/sa,mode);dst[i+k]=s+dst[i+k]*(1-sa);}dst[i+3]=sa+a*(1-sa);}
 }return dst;};return bytes(render(layerForest(doc)));
}
