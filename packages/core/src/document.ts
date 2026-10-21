import { validateRaster, validateRecipe, type Raster, type Recipe } from './conversion.js';
import { DEFAULT_PALETTE, validatePalette } from './toolkit.js';
export const ENGINE_VERSION = '0.11.0';
export const MAX_SIZE = 256, MAX_LAYERS = 16, MAX_FRAMES=32, MAX_CEL_BYTES=4*1024*1024, MAX_PROJECT_BYTES = 24 * 1024 * 1024;
export const MIN_FRAME_DURATION=20,MAX_FRAME_DURATION=5000;
export type RGBA = readonly [number, number, number, number];
export interface Frame {id:string;duration:number}
export interface Layer { id: string; name: string; visible: boolean; cels:Record<string,Uint8ClampedArray>;readonly pixels: Uint8ClampedArray }
export interface PixelDocument {
  width: number; height: number; name: string; activeLayerId: string;activeFrameId:string; palette:string[];
  conversion?: { source?: Raster; recipe: Recipe };
  /** Bottom to top. Layer metadata is global; each frame owns independent cels. */
  layers: Layer[];
  frames: Frame[];
  /** Compatibility adapter for single-layer converters: the selected layer's cel. */
  readonly cel: { layerId: string; frameId: string; pixels: Uint8ClampedArray };
}
export function checkCelBudget(width:number,height:number,layers:number,frames:number) {
  if(!Number.isInteger(layers)||layers<1||layers>MAX_LAYERS||!Number.isInteger(frames)||frames<1||frames>MAX_FRAMES)throw new Error('Projects support 1–16 layers and 1–32 frames.');
  if(width*height*layers*frames*4>MAX_CEL_BYTES)throw new Error('Cel pixels exceed the 4 MiB project budget. Remove frames/layers or use a smaller canvas.');
}
export function validateDuration(duration:number) {if(!Number.isInteger(duration)||duration<MIN_FRAME_DURATION||duration>MAX_FRAME_DURATION)throw new Error('Frame duration must be 20–5000 whole milliseconds.');}
export function makeLayer(doc:PixelDocument,id:string,name:string,visible:boolean,cels:Record<string,Uint8ClampedArray>):Layer {
  return {id,name,visible,cels,get pixels(){return this.cels[doc.activeFrameId];}};
}
export function copyLayer(doc:PixelDocument,layer:Layer):Layer {return makeLayer(doc,layer.id,layer.name,layer.visible,{...layer.cels});}
export function activeLayer(doc: PixelDocument): Layer {
  const layer = doc.layers.find(l => l.id === doc.activeLayerId);
  if (!layer) throw new Error('Selected layer is missing.');
  return layer;
}
export function createDocument(width = 64, height = 64, name = 'Untitled'): PixelDocument {
  if (![width, height].every(n => Number.isInteger(n) && n >= 1 && n <= MAX_SIZE)) throw new Error('Canvas dimensions must be whole numbers from 1 to 256.');
  const doc:PixelDocument={ width, height, name: name.slice(0,80), activeLayerId:'layer-1',activeFrameId:'frame-1',palette:[...DEFAULT_PALETTE],
    layers:[],
    frames:[{id:'frame-1',duration:100}],
    get cel() { const layer=activeLayer(this); return {layerId:layer.id,frameId:this.activeFrameId,pixels:layer.pixels}; }
  };
  doc.layers=[makeLayer(doc,'layer-1','Artwork',true,{'frame-1':new Uint8ClampedArray(width*height*4)})];return doc;
}
/** Straight RGBA source-over. Round once after all visible layers are blended. */
export function composite(doc: PixelDocument,frameId=doc.activeFrameId): Uint8ClampedArray {
  if(!doc.frames.some(f=>f.id===frameId))throw new Error('Frame is missing.');
  const visible=doc.layers.filter(l=>l.visible);
  if(visible.length===1){const output=visible[0].cels[frameId].slice();for(let p=0;p<output.length;p+=4)if(!output[p+3]){output[p]=0;output[p+1]=0;output[p+2]=0;}return output;}
  const output=new Uint8ClampedArray(doc.width*doc.height*4);
  for(let p=0;p<output.length;p+=4) {
    let r=0,g=0,b=0,a=0;
    for(const layer of visible) {
      const q=layer.cels[frameId],sa=q[p+3]/255,remain=1-sa;
      r=q[p]*sa+r*remain;g=q[p+1]*sa+g*remain;b=q[p+2]*sa+b*remain;a=sa+a*remain;
    }
    if(a){output[p]=Math.round(r/a);output[p+1]=Math.round(g/a);output[p+2]=Math.round(b/a);output[p+3]=Math.round(a*255);}
  }
  return output;
}
/** Duration-based looping from a chosen frame, without changing editor state. */
export function frameAtTime(doc:PixelDocument,elapsed:number,startId=doc.activeFrameId):string {
  if(!Number.isFinite(elapsed)||elapsed<0)throw new Error('Invalid playback time.');
  const start=doc.frames.findIndex(f=>f.id===startId);if(start<0)throw new Error('Frame is missing.');
  let time=elapsed%doc.frames.reduce((n,f)=>n+f.duration,0);
  for(let i=0;i<doc.frames.length;i++){const frame=doc.frames[(start+i)%doc.frames.length];if(time<frame.duration)return frame.id;time-=frame.duration;}
  return startId;
}
function base64(pixels: Uint8ClampedArray): string {
  const chunks:string[]=[];
  for(let i=0;i<pixels.length;i+=32768)chunks.push(String.fromCharCode(...pixels.subarray(i,i+32768)));
  return btoa(chunks.join(''));
}
function rgba(value: unknown, length: number): Uint8ClampedArray {
  if(typeof value!=='string'||value.length!==4*Math.ceil(length/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Invalid RGBA data.');
  const bytes=atob(value);if(bytes.length!==length)throw new Error('Invalid RGBA byte count.');
  return Uint8ClampedArray.from(bytes,c=>c.charCodeAt(0));
}
export function encodeProject(doc: PixelDocument, includeSource=true): string {
  const c=doc.conversion;
  const conversion=c?{recipe:c.recipe,source:includeSource&&c.source?{width:c.source.width,height:c.source.height,rgba:base64(c.source.pixels)}:undefined}:undefined;
  checkCelBudget(doc.width,doc.height,doc.layers.length,doc.frames.length);
  const text=JSON.stringify({format:'ezpix',version:4,engine:ENGINE_VERSION,width:doc.width,height:doc.height,name:doc.name,activeLayerId:doc.activeLayerId,activeFrameId:doc.activeFrameId,frames:doc.frames,palette:validatePalette(doc.palette),
    layers:doc.layers.map(l=>({id:l.id,name:l.name,visible:l.visible,cels:doc.frames.map(f=>({frameId:f.id,rgba:base64(l.cels[f.id])}))})),conversion});
  if(new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Project exceeds 24 MiB. Omit the source to save a smaller file.');
  return text;
}
export function decodeProject(text:string): PixelDocument {
  if(text.length>MAX_PROJECT_BYTES||new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Project is too large (24 MiB maximum).');
  let data;try{data=JSON.parse(text);}catch{throw new Error('This is not a readable EzPix project.');}
  if(!data||data.format!=='ezpix'||![1,2,3,4].includes(data.version))throw new Error('Unsupported EzPix project version.');
  if(typeof data.name!=='string'||data.name.length>80)throw new Error('Invalid project name.');
  if(typeof data.width!=='number'||typeof data.height!=='number')throw new Error('Missing canvas dimensions.');
  const doc=createDocument(data.width,data.height,data.name),length=doc.width*doc.height*4;
  if(data.version>=3) {
    if(data.palette!==undefined)doc.palette=validatePalette(data.palette);
    if(!Array.isArray(data.layers)||data.layers.length<1||data.layers.length>MAX_LAYERS)throw new Error('Projects require 1–16 layers.');
    if(data.version===4){
      if(!Array.isArray(data.frames)||data.frames.length<1||data.frames.length>MAX_FRAMES)throw new Error('Projects require 1–32 frames.');
      checkCelBudget(doc.width,doc.height,data.layers.length,data.frames.length);
      const frameIds=new Set<string>();
      for(const f of data.frames){if(!f||typeof f.id!=='string'||!/^frame-[1-9][0-9]{0,8}$/.test(f.id)||frameIds.has(f.id))throw new Error('Invalid frame data.');validateDuration(f.duration);frameIds.add(f.id);}
      if(!frameIds.has(data.activeFrameId))throw new Error('Invalid selected frame.');
      doc.frames=data.frames.map((f:Frame)=>({id:f.id,duration:f.duration}));doc.activeFrameId=data.activeFrameId;
    }
    const ids=new Set<string>();
    // Validate all layer metadata and encoded sizes before allocating layer buffers.
    for(const l of data.layers) {
      if(!l||typeof l.id!=='string'||!/^layer-[1-9][0-9]{0,8}$/.test(l.id)||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>80||typeof l.visible!=='boolean')throw new Error('Invalid layer data.');
      if(data.version===3){if(typeof l.rgba!=='string'||l.rgba.length!==4*Math.ceil(length/3))throw new Error('Invalid layer data.');}
      else {
        if(!Array.isArray(l.cels)||l.cels.length!==doc.frames.length)throw new Error('Missing or excessive cels.');
        const celIds=new Set<string>();for(const cel of l.cels){if(!cel||!doc.frames.some(f=>f.id===cel.frameId)||celIds.has(cel.frameId)||typeof cel.rgba!=='string'||cel.rgba.length!==4*Math.ceil(length/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(cel.rgba))throw new Error('Invalid cel data.');celIds.add(cel.frameId);}
      }
      ids.add(l.id);
    }
    if(!ids.has(data.activeLayerId))throw new Error('Invalid selected layer.');
    doc.layers=data.layers.map((l:{id:string;name:string;visible:boolean;rgba:string;cels:{frameId:string;rgba:string}[]})=>makeLayer(doc,l.id,l.name,l.visible,data.version===3?{'frame-1':rgba(l.rgba,length)}:Object.fromEntries(l.cels.map(c=>[c.frameId,rgba(c.rgba,length)]))));doc.activeLayerId=data.activeLayerId;
  } else {
    if(!Array.isArray(data.pixels)||data.pixels.length!==length||!data.pixels.every((v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=255))throw new Error('Invalid pixel data.');
    doc.cel.pixels.set(data.pixels);
  }
  if(data.version>=2&&data.conversion!==undefined) {
    const c=data.conversion;validateRecipe(c?.recipe);let source:Raster|undefined;
    if(c.source!==undefined) {
      const s=c.source;
      if(!s||!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<1||s.height<1||s.width*s.height>4*1024*1024)throw new Error('Invalid retained source.');
      source={width:s.width,height:s.height,pixels:rgba(s.rgba,s.width*s.height*4)};validateRaster(source);validateRecipe(c.recipe,source);
    }
    if(c.recipe.width!==doc.width||c.recipe.height!==doc.height)throw new Error('Recipe dimensions do not match artwork.');
    doc.conversion={recipe:c.recipe,...(source?{source}:{})};
  }
  return doc;
}
