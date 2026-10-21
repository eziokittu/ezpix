import { composite, MAX_FRAMES, createDocument, makeLayer, checkCelBudget, validateDuration, type PixelDocument } from './document.js';
import {validateRaster, type Raster} from './conversion.js';

export const MAX_SHEET_PIXELS=4*1024*1024, MAX_SHEET_SIZE=4096, MAX_SHEET_JSON_BYTES=64*1024;
export interface SheetOptions {columns:number;scale:number;padding:number;spacing:number}
export interface SheetFrame {id:string;x:number;y:number;width:number;height:number;duration:number}
export interface SheetMetadata {format:'ezpix-sheet';version:1;image:string;width:number;height:number;sourceWidth:number;sourceHeight:number;scale:number;frames:SheetFrame[]}
function integer(value:number,min:number,max:number) {return Number.isInteger(value)&&value>=min&&value<=max;}
export function sheetLayout(doc:PixelDocument,options:SheetOptions):SheetMetadata {
  const {columns,scale,padding,spacing}=options;
  if(!integer(doc.width,1,256)||!integer(doc.height,1,256)||!integer(doc.frames.length,1,MAX_FRAMES)||!integer(columns,1,doc.frames.length)||!integer(scale,1,8)||!integer(padding,0,32)||!integer(spacing,0,32))throw new Error('Sheet needs 1-256 source pixels per axis, 1-32 columns, scale 1-8 and padding/spacing 0-32. Columns cannot exceed frame count.');
  const rows=Math.ceil(doc.frames.length/columns),width=(2*padding+columns*doc.width+(columns-1)*spacing)*scale,height=(2*padding+rows*doc.height+(rows-1)*spacing)*scale;
  if(width>MAX_SHEET_SIZE||height>MAX_SHEET_SIZE||width*height>MAX_SHEET_PIXELS)throw new Error('Sheet exceeds 4096 pixels per axis or 4 megapixels. Reduce scale, spacing or change columns.');
  return {format:'ezpix-sheet',version:1,image:'artwork-sheet.png',width,height,sourceWidth:doc.width,sourceHeight:doc.height,scale,frames:doc.frames.map((f,i)=>({id:f.id,x:(padding+i%columns*(doc.width+spacing))*scale,y:(padding+Math.floor(i/columns)*(doc.height+spacing))*scale,width:doc.width*scale,height:doc.height*scale,duration:f.duration}))};
}
/** Untrimmed row-major cells, transparent gutters, exact integer nearest scaling. */
export function exportSheet(doc:PixelDocument,options:SheetOptions):{raster:Raster;metadata:SheetMetadata} {
  const metadata=sheetLayout(doc,options),pixels=new Uint8ClampedArray(metadata.width*metadata.height*4),scale=options.scale;
  metadata.frames.forEach(f=>{const source=composite(doc,f.id);for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const p=(Math.floor(y/scale)*doc.width+Math.floor(x/scale))*4;const d=((f.y+y)*metadata.width+f.x+x)*4;pixels[d]=source[p];pixels[d+1]=source[p+1];pixels[d+2]=source[p+2];pixels[d+3]=source[p+3];}});
  return {raster:{width:metadata.width,height:metadata.height,pixels},metadata};
}
/** Adjacent-frame ghosts only; edges do not wrap. Never part of document data. */
export function onionSkin(doc:PixelDocument,opacity=30):Uint8ClampedArray {
  if(!integer(opacity,0,100))throw new Error('Onion opacity must be 0-100.');
  const output=new Uint8ClampedArray(doc.width*doc.height*4),index=doc.frames.findIndex(f=>f.id===doc.activeFrameId);
  for(const [i,color] of [[index-1,[255,80,100]],[index+1,[70,170,255]]] as const){
    if(i<0||i>=doc.frames.length)continue;
    const source=composite(doc,doc.frames[i].id);
    for(let p=0;p<output.length;p+=4){const a=source[p+3]/255*opacity/100,b=output[p+3]/255*(1-a),total=a+b;if(!total)continue;for(let c=0;c<3;c++)output[p+c]=Math.round((color[c]*a+output[p+c]*b)/total);output[p+3]=Math.round(total*255);}
  }
  return output;
}

/** No filename/URL is opened. Unknown sidecar fields are ignored, never copied. */
export function decodeSheetMetadata(text:string):SheetMetadata {
  if(text.length>MAX_SHEET_JSON_BYTES||new TextEncoder().encode(text).length>MAX_SHEET_JSON_BYTES)throw new Error('Sheet JSON exceeds 64 KiB.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('Unreadable sheet JSON.');}
  if(!data||data.format!=='ezpix-sheet'||data.version!==1||data.image!=='artwork-sheet.png')throw new Error('Unsupported sheet JSON. Use EzPix sheet metadata v1.');
  if(!integer(data.width,1,MAX_SHEET_SIZE)||!integer(data.height,1,MAX_SHEET_SIZE)||data.width*data.height>MAX_SHEET_PIXELS||!integer(data.sourceWidth,1,256)||!integer(data.sourceHeight,1,256)||!integer(data.scale,1,8)||!Array.isArray(data.frames)||!integer(data.frames.length,1,MAX_FRAMES))throw new Error('Invalid sheet dimensions, scale or frame count.');
  checkCelBudget(data.sourceWidth,data.sourceHeight,1,data.frames.length);
  const ids=new Set<string>(),frames:SheetFrame[]=[];
  for(const f of data.frames){
    if(!f||typeof f.id!=='string'||!/^frame-[1-9][0-9]{0,8}$/.test(f.id)||ids.has(f.id)||!integer(f.x,0,MAX_SHEET_SIZE)||!integer(f.y,0,MAX_SHEET_SIZE)||f.width!==data.sourceWidth*data.scale||f.height!==data.sourceHeight*data.scale||f.x+f.width>data.width||f.y+f.height>data.height)throw new Error('Invalid sheet frame rectangle or ID.');
    validateDuration(f.duration);
    if(frames.some(r=>f.x<r.x+r.width&&r.x<f.x+f.width&&f.y<r.y+r.height&&r.y<f.y+f.height))throw new Error('Sheet frame rectangles overlap.');
    ids.add(f.id);frames.push({id:f.id,x:f.x,y:f.y,width:f.width,height:f.height,duration:f.duration});
  }
  return {format:'ezpix-sheet',version:1,image:'artwork-sheet.png',width:data.width,height:data.height,sourceWidth:data.sourceWidth,sourceHeight:data.sourceHeight,scale:data.scale,frames};
}
export interface SheetGrid extends SheetOptions {frameWidth:number;frameHeight:number;count:number;duration:number}
export function gridMetadata(source:Pick<Raster,'width'|'height'>,grid:SheetGrid):SheetMetadata {
  validateDuration(grid.duration);
  if(!integer(grid.count,1,MAX_FRAMES))throw new Error('Choose 1-32 frames.');
  checkCelBudget(grid.frameWidth,grid.frameHeight,1,grid.count);
  const doc=createDocument(grid.frameWidth,grid.frameHeight);
  doc.frames=Array.from({length:grid.count},(_,i)=>({id:`frame-${i+1}`,duration:grid.duration}));
  const metadata=sheetLayout(doc,grid);
  if(metadata.width!==source.width||metadata.height!==source.height)throw new Error(`Grid requires an exact ${metadata.width} x ${metadata.height} image. Adjust cell size, count, columns or gutters.`);
  return metadata;
}
/** Flattened independent frames; exact repeated scale blocks prevent silent detail loss. */
export function importSheet(source:Raster,metadata:SheetMetadata):PixelDocument {
  validateRaster(source);
  // Revalidate even when callers supplied an object rather than the JSON reader.
  const m=decodeSheetMetadata(JSON.stringify(metadata));
  if(source.width!==m.width||source.height!==m.height)throw new Error('Sheet JSON dimensions do not match the image.');
  const cels:Record<string,Uint8ClampedArray>={};
  for(const f of m.frames){
    const pixels=new Uint8ClampedArray(m.sourceWidth*m.sourceHeight*4);
    for(let y=0;y<m.sourceHeight;y++)for(let x=0;x<m.sourceWidth;x++){
      const p=((f.y+y*m.scale)*source.width+f.x+x*m.scale)*4,color=source.pixels.subarray(p,p+4);
      for(let yy=0;yy<m.scale;yy++)for(let xx=0;xx<m.scale;xx++){const q=p+(yy*source.width+xx)*4;if(!color.every((v,c)=>v===source.pixels[q+c]))throw new Error('Scaled cells contain varying pixels. Use scale 1 or an exact nearest-scaled PNG.');}
      pixels.set(color,(y*m.sourceWidth+x)*4);
    }
    cels[f.id]=pixels;
  }
  const doc=createDocument(m.sourceWidth,m.sourceHeight,'Imported sprite sheet');doc.frames=m.frames.map(f=>({id:f.id,duration:f.duration}));doc.activeFrameId=doc.frames[0].id;doc.layers=[makeLayer(doc,'layer-1','Artwork',true,cels)];return doc;
}
