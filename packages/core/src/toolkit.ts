import { rasterCel,activeLayer, composite, type PixelDocument } from './document.js';
export type Point={x:number;y:number};
export type Rect=Point&{width:number;height:number};
export type Shape='Line'|'Rectangle'|'Ellipse';
export function rectangle(a:Point,b:Point):Rect {return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x)+1,height:Math.abs(a.y-b.y)+1};}
function checkRect(r:Rect,width:number,height:number) {
  if(![r.x,r.y,r.width,r.height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>width||r.y+r.height>height)throw new Error('Selection must fit inside the canvas.');
}
export function shapePoints(shape:Shape,a:Point,b:Point,filled=false):Point[] {
  if(!['Line','Rectangle','Ellipse'].includes(shape)||![a.x,a.y,b.x,b.y].every(n=>Number.isInteger(n)&&n>=0&&n<256))throw new Error('Invalid shape bounds.');
  const result:Point[]=[],r=rectangle(a,b);
  if(shape==='Line') {
    let {x,y}=a;const dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let err=dx+dy;
    for(;;){result.push({x,y});if(x===b.x&&y===b.y)break;const e=err*2;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
  }else{
    const inside=(x:number,y:number)=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height&&(shape==='Rectangle'||((2*x-2*r.x-r.width+1)/r.width)**2+((2*y-2*r.y-r.height+1)/r.height)**2<=1);
    for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(inside(x,y)&&(filled||!inside(x-1,y)||!inside(x+1,y)||!inside(x,y-1)||!inside(x,y+1)))result.push({x,y});
  }
  return result;
}
export interface Selection {layerId:string;frameId:string;canvasWidth:number;canvasHeight:number;rect:Rect;baseline:Uint8ClampedArray}
export type Transform={x:number;y:number;copy:boolean;flipX:boolean;flipY:boolean};
export function captureSelection(doc:PixelDocument,rect:Rect):Selection {
  checkRect(rect,doc.width,doc.height);const layer=activeLayer(doc);if(!layer.visible)throw new Error('Show the selected layer before selecting pixels.');
  return {layerId:layer.id,frameId:doc.activeFrameId,canvasWidth:doc.width,canvasHeight:doc.height,rect:{...rect},baseline:rasterCel(doc,layer).slice()};
}
export function transformSelection(selection:Selection,options:Transform):Uint8ClampedArray {
  const {canvasWidth:w,canvasHeight:h,rect:r,baseline}=selection;
  if(![w,h].every(n=>Number.isInteger(n)&&n>=1&&n<=256)||!(baseline instanceof Uint8ClampedArray)||baseline.length!==w*h*4)throw new Error('Invalid selection.');
  checkRect(r,w,h);checkRect({...r,x:options.x,y:options.y},w,h);
  if(![options.copy,options.flipX,options.flipY].every(v=>typeof v==='boolean'))throw new Error('Invalid selection transform.');
  const output=baseline.slice();
  if(!options.copy)for(let y=r.y;y<r.y+r.height;y++)output.fill(0,(y*w+r.x)*4,(y*w+r.x+r.width)*4);
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
    const sx=r.x+(options.flipX?r.width-1-x:x),sy=r.y+(options.flipY?r.height-1-y:y),from=(sy*w+sx)*4,to=((options.y+y)*w+options.x+x)*4;
    output.set(baseline.subarray(from,from+4),to);
  }
  return output;
}
export const DEFAULT_PALETTE=['#39ff14','#a855f7','#ffd700','#f0e6ff','#1e1033','#ff647c','#ff9b54','#49bfff','#15803d','#6042a6','#a16207','#000000'];
export const MAX_PALETTE_BYTES=16*1024;
export function validatePalette(value:unknown):string[] {
  if(!Array.isArray(value)||value.length<1||value.length>256||!value.every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))throw new Error('A palette needs 1–256 six-digit hex colours.');
  return [...new Set((value as string[]).map(c=>c.toLowerCase()))];
}
export function encodePalette(colors:readonly string[]):string{return JSON.stringify({format:'ezpix-palette',version:1,colors:validatePalette(colors)},null,2);}
export function decodePalette(text:string):string[] {
  if(text.length>MAX_PALETTE_BYTES||new TextEncoder().encode(text).length>MAX_PALETTE_BYTES)throw new Error('Palette exceeds 16 KiB.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Choose an EzPix palette JSON file.');}
  if(!data||data.format!=='ezpix-palette'||data.version!==1)throw new Error('Unsupported palette format.');return validatePalette(data.colors);
}
export function grabPalette(doc:PixelDocument,count=32):string[] {
  if(!Number.isInteger(count)||count<1||count>256)throw new Error('Palette size must be 1–256.');
  const pixels=composite(doc),colors=new Map<string,number>();
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]){const c='#'+[...pixels.subarray(i,i+3)].map(n=>n.toString(16).padStart(2,'0')).join('');colors.set(c,(colors.get(c)??0)+1);}
  if(!colors.size)throw new Error('Draw visible pixels before grabbing colours.');
  return [...colors].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,count).map(([c])=>c);
}
