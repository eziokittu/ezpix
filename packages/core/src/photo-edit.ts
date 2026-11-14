import {developPhoto,clonePhoto,type DevelopEdit,type CloneEdit} from './photo-lab.js';
import {applyPhotoEffect,type PhotoEffect} from './photo-effects.js';
import {shapedPixels,type MosaicEdit} from './pixel-shapes.js';
import {frameColor,FRAME_STYLES,composeCollage,type CollageEdit,type FrameStyle} from './design-tools.js';
import {validateRaster,type Raster} from './conversion.js';
import type { RGBA } from './document.js';
import { permuteRaster, rotatedSize, type QuarterTurn } from './raster-transform.js';
import { renderBitmapText, validateBitmapText } from './bitmap-text.js';
import {creativeEdit,type CreativeEdit} from './creative.js';

export type PhotoEdit = CreativeEdit | CollageEdit | DevelopEdit | CloneEdit | MosaicEdit
  | {kind:'canvas';width:number;height:number;color:RGBA}
  | {kind:'patch';image:Raster;mask:Uint8Array}
  | { kind: 'crop'; ratio: number; zoom: number; x: number; y: number }
  | { kind: 'rotate'; angle: QuarterTurn }
  | { kind: 'frame'; size: number; color: RGBA; pattern?:FrameStyle }
  | { kind: 'text'; text: string; size: number; x: number; y: number; color: RGBA }
  | { kind: 'effect'; effect: PhotoEffect; amount: number };
const finite = (value: number, min: number, max: number) => { if (!Number.isFinite(value) || value < min || value > max) throw Error('Editing value is out of bounds.'); return value; };
function dimensions(width: number, height: number) { if (![width,height].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || width * height > 4_000_000) throw Error('Edited image exceeds four megapixels.'); }
function rgba(color: RGBA) { if (!Array.isArray(color) || color.length !== 4 || !color.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) throw Error('Choose an RGBA colour.'); }
export function photoCropRect(w:number,h:number,edit:Extract<PhotoEdit,{kind:'crop'}>) {
    dimensions(w,h);
    finite(edit.ratio,.05,20); finite(edit.zoom,1,4); finite(edit.x,0,1); finite(edit.y,0,1);
    let cw = Math.min(w,h*edit.ratio)/edit.zoom, ch = cw/edit.ratio;
    const width = Math.max(1,Math.floor(cw)), height = Math.max(1,Math.floor(ch)), x = Math.round((w-width)*edit.x), y = Math.round((h-height)*edit.y);
    return {width,height,x,y};
}
/** Deterministic edits; input buffers are never changed. Coordinates are normalized. */
export function editPhoto(source: Raster, edit: PhotoEdit): Raster {
  if(edit.kind==='patch'){validateRaster(source);validateRaster(edit.image);if(edit.image.width!==source.width||edit.image.height!==source.height||!(edit.mask instanceof Uint8Array)||edit.mask.length!==source.width*source.height||edit.mask.some(n=>n>1))throw Error('This patch belongs to a different image.');const pixels=source.pixels.slice();for(let i=0;i<edit.mask.length;i++)if(edit.mask[i])pixels.set(edit.image.pixels.subarray(i*4,i*4+4),i*4);return {...source,pixels};}
  if(edit.kind==='mosaic')return shapedPixels(source,edit);
  if(edit.kind==='effect'&&!['vignette','posterize','grain','duotone'].includes(edit.effect))return applyPhotoEffect(source,edit.effect,edit.amount);
  if(edit.kind==='develop')return developPhoto(source,edit);
  if(edit.kind==='clone')return clonePhoto(source,edit);
  if(edit.kind==='stamp'||edit.kind==='draw'||edit.kind==='redact'||edit.kind==='resize')return creativeEdit(source,edit);
  if(edit.kind==='collage')return composeCollage(edit,source);
  dimensions(source.width, source.height);
  if (source.pixels.length !== source.width * source.height * 4) throw Error('Invalid source pixels.');
  const {width: w, height: h} = source;
  if(edit.kind==='canvas'){
    dimensions(edit.width,edit.height);rgba(edit.color);
    const scale=Math.min(1,edit.width/w,edit.height/h),image=scale<1?creativeEdit(source,{kind:'resize',width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),sampling:'smooth'}):source;
    const pixels=new Uint8ClampedArray(edit.width*edit.height*4);for(let i=0;i<pixels.length;i+=4)pixels.set(edit.color,i);
    const left=Math.floor((edit.width-image.width)/2),top=Math.floor((edit.height-image.height)/2);
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const s=(y*image.width+x)*4,d=((top+y)*edit.width+left+x)*4,a=image.pixels[s+3]/255,da=pixels[d+3]/255,o=a+da*(1-a);if(o){for(let c=0;c<3;c++)pixels[d+c]=(image.pixels[s+c]*a+pixels[d+c]*da*(1-a))/o;pixels[d+3]=o*255;}}
    return {width:edit.width,height:edit.height,pixels};
  }
  if (edit.kind === 'rotate') { const size = rotatedSize(w,h,edit.angle); return {...size,pixels:permuteRaster(source.pixels,w,h,size.width,size.height,edit.angle)}; }
  if (edit.kind === 'crop') {
    const {width,height,x,y}=photoCropRect(w,h,edit);
    const pixels = new Uint8ClampedArray(width*height*4);
    for(let row=0;row<height;row++) pixels.set(source.pixels.subarray(((row+y)*w+x)*4,((row+y)*w+x+width)*4),row*width*4);
    return {width,height,pixels};
  }
  if (edit.kind === 'frame') {
    finite(edit.size,0,.25); rgba(edit.color);if(edit.pattern&&!FRAME_STYLES.includes(edit.pattern))throw Error('Unknown frame pattern.');
    const pad = Math.max(0,Math.round(Math.min(w,h)*edit.size)), width=w+pad*2,height=h+pad*2; dimensions(width,height);
    const pixels = new Uint8ClampedArray(width*height*4);
    for(let y=0;y<height;y++){const paint=(x:number)=>pixels.set(edit.pattern?frameColor(edit.pattern,x,y,width,height,pad,edit.color):edit.color,(y*width+x)*4);if(y<pad||y>=height-pad){for(let x=0;x<width;x++)paint(x);}else{for(let x=0;x<pad;x++)paint(x);for(let x=width-pad;x<width;x++)paint(x);}}
    for(let y=0;y<h;y++)pixels.set(source.pixels.subarray(y*w*4,(y+1)*w*4),((y+pad)*width+pad)*4);
    return {width,height,pixels};
  }
  const pixels = new Uint8ClampedArray(source.pixels);
  if (edit.kind === 'text') {
    finite(edit.size,1,8); finite(edit.x,0,1); finite(edit.y,0,1); rgba(edit.color);
    if(edit.text.length>32)throw Error('Pixel captions support up to 32 characters.');
    const scale=Math.max(1,Math.round(Math.min(w,h)*edit.size/64)), lines=edit.text.toUpperCase().split('\n'), tw=Math.max(...lines.map(l=>l.length))*4*scale, th=lines.length*6*scale;
    const text={text:edit.text,x:Math.round(Math.max(0,w-tw)*edit.x),y:Math.round(Math.max(0,h-th)*edit.y),scale,spacing:1,color:edit.color};
    validateBitmapText({...text,x:0,y:0,scale:1}); const ink=renderBitmapText(w,h,text);
    for(let i=0;i<pixels.length;i+=4){const a=ink[i+3]/255;if(!a)continue;const da=pixels[i+3]/255,oa=a+da*(1-a);for(let c=0;c<3;c++)pixels[i+c]=(ink[i+c]*a+pixels[i+c]*da*(1-a))/oa;pixels[i+3]=oa*255;}
  } else if(edit.kind==='effect'){
    finite(edit.amount,0,1);const amount=edit.amount;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,l=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];
      const distance=Math.min(1,Math.hypot((x-(w-1)/2)/Math.max(1,w/2),(y-(h-1)/2)/Math.max(1,h/2))/Math.SQRT2),noise=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%256/255-.5;
      for(let c=0;c<3;c++){const original=pixels[i+c];if(edit.effect==='vignette')pixels[i+c]=original*(1-distance*distance*amount);else if(edit.effect==='posterize'){const levels=Math.max(2,Math.round(16-amount*14));pixels[i+c]=Math.round(original/255*(levels-1))*255/(levels-1);}else if(edit.effect==='grain')pixels[i+c]=original+noise*amount*100;else{const dark=[38,24,64][c],light=[255,214,176][c];pixels[i+c]=original*(1-amount)+(dark+(light-dark)*l/255)*amount;}}
    }
  } else throw Error('Unknown image edit.');
  return {width:w,height:h,pixels};
}
export function editPhotoFrames(frames: readonly Raster[], edit: PhotoEdit): Raster[] {
  if (!frames.length || frames.length > 32) throw Error('Image editing supports one to 32 frames.');
  // Validate the first result and memory before allocating the remaining frames.
  const first=editPhoto(frames[0],edit);
  if(first.width*first.height*4*frames.length>32*1024*1024)throw Error('Edited animation exceeds 32 MiB.');
  return [first,...frames.slice(1).map(frame=>{if(frame.width!==frames[0].width||frame.height!==frames[0].height)throw Error('Animation frame dimensions differ.');return editPhoto(frame,edit);})];
}
