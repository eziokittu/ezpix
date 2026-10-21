import {validateRaster,validateRecipe,type Raster,type Recipe} from './conversion.js';
import type {RGBA} from './document.js';
export type QuickPreset='sprite'|'icon'|'photo'|'tile';
export function quickRecipe(source:Raster,current:Recipe,preset:QuickPreset):Recipe {
  validateRaster(source);validateRecipe(current,source);if(!['sprite','icon','photo','tile'].includes(preset))throw new Error('Unknown quick preset.');
  const recipe=structuredClone(current);
  if(preset==='tile'){const size=Math.min(recipe.crop.width,recipe.crop.height);recipe.crop={x:recipe.crop.x+Math.floor((recipe.crop.width-size)/2),y:recipe.crop.y+Math.floor((recipe.crop.height-size)/2),width:size,height:size};}
  const edge=preset==='icon'?32:preset==='photo'?128:preset==='tile'?16:64,ratio=edge/Math.max(recipe.crop.width,recipe.crop.height);
  recipe.width=Math.max(1,Math.round(recipe.crop.width*ratio));recipe.height=Math.max(1,Math.round(recipe.crop.height*ratio));recipe.palette='adaptive';recipe.colors=preset==='icon'?8:preset==='photo'?32:16;recipe.sampling='area';recipe.dither=preset==='photo';return recipe;
}
/** Transparent edges only. No guessed subject/background segmentation. */
export function alphaBounds(source:Raster):Recipe['crop']|null {
  validateRaster(source);let x0=source.width,y0=source.height,x1=-1,y1=-1;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(source.pixels[(y*source.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  return x1<0?null:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1};
}
export function finishPixels(source:Raster,kind:'outline'|'speckles',color:RGBA):Uint8ClampedArray {
  validateRaster(source);if(!['outline','speckles'].includes(kind))throw new Error('Unknown finishing tool.');const {width,height,pixels}=source,out=pixels.slice();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*4;let neighbour=false;for(let dy=-1;dy<=1&&!neighbour;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||kind==='outline'&&dx&&dy)continue;const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<width&&yy<height&&pixels[(yy*width+xx)*4+3]){neighbour=true;break;}}
    if(kind==='outline'&&!pixels[p+3]&&neighbour)out.set(color,p);else if(kind==='speckles'&&pixels[p+3]&&!neighbour)out.fill(0,p,p+4);
  }
  return out;
}
