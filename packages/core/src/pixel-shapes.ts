import {validateRaster,type Raster} from './conversion.js';
export const PIXEL_SHAPES=['square','rectangle','rectangle-b','rectangle-c','hexagon','hexagon-b','triangle','triangle-b','triangle-c','diamond','diamond-b','brick','brick-b','brick-c'] as const;
export const PIXEL_SHAPE_LABELS:Record<string,string>={square:'Square',rectangle:'Rectangle A','rectangle-b':'Rectangle B','rectangle-c':'Rectangle C',hexagon:'Hexagon A','hexagon-b':'Hexagon B',triangle:'Triangle A','triangle-b':'Triangle B','triangle-c':'Triangle C',diamond:'Diamond A','diamond-b':'Diamond B',brick:'Brick A','brick-b':'Brick B','brick-c':'Brick C'};
export interface MosaicEdit{kind:'mosaic';columns:number;rows:number;shape:typeof PIXEL_SHAPES[number];gap:number}
/** Every position belongs to exactly one tile. No transparent geometry gaps at zero spacing.
 * Legacy circle/octagon edits remain readable, but cannot be chosen for new projects.
 */
export function shapedPixels(source:Raster,edit:MosaicEdit):Raster{
 validateRaster(source);const shape=edit.shape as string;if(![edit.columns,edit.rows].every(n=>Number.isInteger(n)&&n>=1&&n<=256)||!([...PIXEL_SHAPES,'circle','octagon'] as string[]).includes(shape)||!Number.isFinite(edit.gap)||edit.gap<0||edit.gap>.3)throw Error('Invalid shaped pixel grid.');
 const {width:w,height:h}=source,pixels=new Uint8ClampedArray(w*h*4);let cw=w/edit.columns,ch=h/edit.rows;
 if(shape==='square')cw=ch=Math.min(cw,ch);if(['rectangle','brick','brick-c'].includes(shape))cw*=2;if(['rectangle-b','brick-b'].includes(shape))ch*=2;if(shape==='rectangle-c')cw*=3;
 const vertical=['hexagon-b','diamond-b','brick-b','triangle-c'].includes(shape);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const px=vertical?(y+.5)/ch:(x+.5)/cw,py=vertical?(x+.5)/cw:(y+.5)/ch;let row=Math.floor(py),col=Math.floor(px),cx=col+.5,cy=row+.5;
  if(shape.startsWith('hexagon')){let best=Infinity;for(let dy=-1;dy<=1;dy++){const r=row+dy,c=Math.round(px-.5-(r&1)*.5),xx=c+.5+(r&1)*.5,yy=r+.5,d=(px-xx)**2+(py-yy)**2*.75;if(d<best){best=d;cx=xx;cy=yy;}}}
  else if(shape.startsWith('brick')){const offset=shape==='brick-c'?(row%3)/3:(row&1)*.5;cx=Math.floor(px-offset)+.5+offset;}
  else if(shape.startsWith('diamond')){const a=Math.floor(px+py),b=Math.floor(px-py);cx=(a+b+1)/2;cy=(a-b)/2;}
  else if(shape.startsWith('triangle')){const u=px-col,v=py-row,back=shape==='triangle-b';const upper=back?u<v:u+v<1;cx=col+(upper?1/3:2/3);cy=row+(back?(upper?2/3:1/3):(upper?1/3:2/3));}
  const dx=Math.abs(px-cx),dy=Math.abs(py-cy);let inside=true;
  if(shape==='circle')inside=Math.hypot(dx,dy)<=.5-edit.gap;
  else if(shape==='octagon')inside=Math.max(dx,dy)<=.5-edit.gap&&dx+dy<=.707-edit.gap;
  else if(edit.gap>0){if(shape.startsWith('hexagon'))inside=dx<=.5-edit.gap&&dx*.5+dy*.75<=.5-edit.gap;else if(shape.startsWith('diamond'))inside=dx+dy<=.5-edit.gap;else if(shape.startsWith('triangle')){const u=px-col,v=py-row;inside=Math.min(u,v,1-u,1-v,Math.abs(shape==='triangle-b'?u-v:u+v-1)*.707)>=edit.gap;}else inside=dx<=.5-edit.gap&&dy<=.5-edit.gap;}
  if(inside){const sx=Math.max(0,Math.min(w-1,Math.floor((vertical?cy:cx)*cw))),sy=Math.max(0,Math.min(h-1,Math.floor((vertical?cx:cy)*ch)));pixels.set(source.pixels.subarray((sy*w+sx)*4,(sy*w+sx)*4+4),(y*w+x)*4);}
 }return {width:w,height:h,pixels};
}
