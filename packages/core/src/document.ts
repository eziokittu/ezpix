import {validateReferences,validateEncodedReferences,type ReferenceImage} from './references.js';
import {validateTags,type AnimationTag} from './animation.js';
import {validateGroups,groupedComposite,type LayerGroup} from './groups.js';
import { validateRaster, validateRecipe, type Raster, type Recipe } from './conversion.js';
import { DEFAULT_PALETTE, validatePalette } from './toolkit.js';
export const ENGINE_VERSION = '0.32.0';
export const MAX_SIZE = 256, MAX_LAYERS = 16, MAX_FRAMES=32, MAX_CEL_BYTES=4*1024*1024, MAX_PROJECT_BYTES = 24 * 1024 * 1024;
export const MIN_FRAME_DURATION=20,MAX_FRAME_DURATION=5000;
export type RGBA = readonly [number, number, number, number];
export interface Frame {id:string;duration:number}
export interface Layer { id: string; name: string; visible: boolean; locked:boolean; opacity:number; groupId:string|null; cels:Record<string,Uint8ClampedArray>;readonly pixels: Uint8ClampedArray }
export interface PixelDocument {
  width: number; height: number; name: string; activeLayerId: string;activeFrameId:string; palette:string[];
  conversion?: { source?: Raster; recipe: Recipe };
  /** Bottom to top. Layer metadata is global; explicit cels may link within a layer. */
  layers: Layer[];
  groups:LayerGroup[];
  frames: Frame[];
  tags: AnimationTag[];
  references:ReferenceImage[];activeReferenceId:string|null;
  /** Compatibility adapter for single-layer converters: the selected layer's cel. */
  readonly cel: { layerId: string; frameId: string; pixels: Uint8ClampedArray };
}
export function checkCelBudget(width:number,height:number,layers:number,frames:number) {
  if(!Number.isInteger(layers)||layers<1||layers>MAX_LAYERS||!Number.isInteger(frames)||frames<1||frames>MAX_FRAMES)throw new Error('Projects support 1–16 layers and 1–32 frames.');
  if(width*height*layers*frames*4>MAX_CEL_BYTES)throw new Error('Cel pixels exceed the 4 MiB project budget. Remove frames/layers or use a smaller canvas.');
}
export function validateDuration(duration:number) {if(!Number.isInteger(duration)||duration<MIN_FRAME_DURATION||duration>MAX_FRAME_DURATION)throw new Error('Frame duration must be 20–5000 whole milliseconds.');}
export function makeLayer(doc:PixelDocument,id:string,name:string,visible:boolean,cels:Record<string,Uint8ClampedArray>,properties:{locked?:boolean;opacity?:number;groupId?:string|null}={}):Layer {
  const layer:Layer={id,name,visible,locked:properties.locked??false,opacity:properties.opacity??255,groupId:properties.groupId??null,cels,get pixels(){return ensureCel(doc,this,doc.activeFrameId);}};Object.defineProperty(layer,'pixels',{enumerable:false});return layer;
}
/** Empty slots own zero bytes; this explicit mutable adapter allocates on demand. */
export function ensureCel(doc:PixelDocument,layer:Layer,frameId=doc.activeFrameId):Uint8ClampedArray {
  const pixels=layer.cels[frameId];if(!pixels)throw new Error('Cel is missing.');
  if(!pixels.length){const next=new Uint8ClampedArray(doc.width*doc.height*4);for(const id of Object.keys(layer.cels))if(layer.cels[id]===pixels)layer.cels[id]=next;}
  return layer.cels[frameId];
}
/** Read a full raster without attaching an empty raster to the document. */
export function rasterCel(doc:PixelDocument,layer:Layer,frameId=doc.activeFrameId):Uint8ClampedArray {
  const pixels=layer.cels[frameId];if(!pixels)throw new Error('Cel is missing.');return pixels.length?pixels:new Uint8ClampedArray(doc.width*doc.height*4);
}
export function compactCel(layer:Layer,frameId:string){const p=layer.cels[frameId];if(p.length&&!p.some(v=>v!==0)){const empty=new Uint8ClampedArray(0);for(const id of Object.keys(layer.cels))if(layer.cels[id]===p)layer.cels[id]=empty;}}
export function linkedFrames(doc:PixelDocument,layer:Layer,frameId=doc.activeFrameId){return doc.frames.filter(f=>layer.cels[f.id]===layer.cels[frameId]).map(f=>f.id);}
export function hasLinkedCels(doc:PixelDocument){return doc.layers.some(l=>new Set(Object.values(l.cels)).size<doc.frames.length);}
export function celAllocation(doc:PixelDocument){const buffers=new Set(doc.layers.flatMap(l=>Object.values(l.cels)));return {bytes:[...buffers].reduce((n,p)=>n+p.byteLength,0),denseBytes:doc.width*doc.height*doc.layers.length*doc.frames.length*4,empty:doc.layers.reduce((n,l)=>n+Object.values(l.cels).filter(p=>!p.length).length,0)};}
export function copyLayer(doc:PixelDocument,layer:Layer):Layer {return makeLayer(doc,layer.id,layer.name,layer.visible,{...layer.cels},layer);}
export function activeLayer(doc: PixelDocument): Layer {
  const layer = doc.layers.find(l => l.id === doc.activeLayerId);
  if (!layer) throw new Error('Selected layer is missing.');
  return layer;
}
export function createDocument(width = 64, height = 64, name = 'Untitled'): PixelDocument {
  if (![width, height].every(n => Number.isInteger(n) && n >= 1 && n <= MAX_SIZE)) throw new Error('Canvas dimensions must be whole numbers from 1 to 256.');
  const doc:PixelDocument={ width, height, name: name.slice(0,80), activeLayerId:'layer-1',activeFrameId:'frame-1',palette:[...DEFAULT_PALETTE],
    layers:[],groups:[],tags:[],references:[],activeReferenceId:null,
    frames:[{id:'frame-1',duration:100}],
    get cel() { const layer=activeLayer(this); return {layerId:layer.id,frameId:this.activeFrameId,pixels:layer.pixels}; }
  };
  Object.defineProperty(doc,'cel',{enumerable:false});
  doc.layers=[makeLayer(doc,'layer-1','Artwork',true,{'frame-1':new Uint8ClampedArray(0)})];return doc;
}
/** Straight RGBA source-over. Round once after all visible layers are blended. */
export function composite(doc: PixelDocument,frameId=doc.activeFrameId): Uint8ClampedArray {
  if(!doc.frames.some(f=>f.id===frameId))throw new Error('Frame is missing.');
  if(doc.groups.length)return groupedComposite(doc,frameId);
  const visible=doc.layers.filter(l=>l.visible);
  if(visible.length===1&&visible[0].opacity===255){const output=rasterCel(doc,visible[0],frameId).slice();for(let p=0;p<output.length;p+=4)if(!output[p+3]){output[p]=0;output[p+1]=0;output[p+2]=0;}return output;}
  const output=new Uint8ClampedArray(doc.width*doc.height*4);
  for(let p=0;p<output.length;p+=4) {
    let r=0,g=0,b=0,a=0;
    for(const layer of visible) {
      const q=layer.cels[frameId];if(!q.length)continue;const sa=q[p+3]/255*layer.opacity/255,remain=1-sa;
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
function encodeCels(doc:PixelDocument,layer:Layer){const seen=new Map<Uint8ClampedArray,string>();return doc.frames.map(f=>{const pixels=layer.cels[f.id];if(!(pixels instanceof Uint8ClampedArray)||pixels.length!==0&&pixels.length!==doc.width*doc.height*4)throw new Error('Invalid cel raster.');const link=seen.get(pixels);if(link)return {frameId:f.id,link};seen.set(pixels,f.id);return pixels.some(v=>v!==0)?{frameId:f.id,rgba:base64(pixels)}:{frameId:f.id,empty:true};});}
function decodeCels(cels:{frameId:string;rgba?:string;empty?:boolean;link?:string}[],length:number){const out:Record<string,Uint8ClampedArray>={};for(const c of cels)out[c.frameId]=c.link?out[c.link]:c.empty?new Uint8ClampedArray(0):rgba(c.rgba,length);return out;}
export function encodeProject(doc: PixelDocument, includeSource=true): string {
  validateGroups(doc);validateTags(doc);validateReferences(doc);
  const c=doc.conversion;
  const conversion=c?{recipe:c.recipe,source:includeSource&&c.source?{width:c.source.width,height:c.source.height,rgba:base64(c.source.pixels)}:undefined}:undefined;
  checkCelBudget(doc.width,doc.height,doc.layers.length,doc.frames.length);
  const text=JSON.stringify({format:'ezpix',version:10,references:doc.references.map(r=>({id:r.id,name:r.name,width:r.width,height:r.height,rgba:base64(r.pixels)})),activeReferenceId:doc.activeReferenceId,tags:doc.tags,groups:doc.groups,engine:ENGINE_VERSION,width:doc.width,height:doc.height,name:doc.name,activeLayerId:doc.activeLayerId,activeFrameId:doc.activeFrameId,frames:doc.frames,palette:validatePalette(doc.palette),
    layers:doc.layers.map(l=>({id:l.id,name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,groupId:l.groupId,cels:encodeCels(doc,l)})),conversion});
  if(new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Project exceeds 24 MiB. Omit the source to save a smaller file.');
  return text;
}
export function decodeProject(text:string): PixelDocument {
  if(text.length>MAX_PROJECT_BYTES||new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Project is too large (24 MiB maximum).');
  let data;try{data=JSON.parse(text);}catch{throw new Error('This is not a readable EzPix project.');}
  if(!data||data.format!=='ezpix'||![1,2,3,4,5,6,7,8,9,10].includes(data.version))throw new Error('Unsupported EzPix project version.');
  if(typeof data.name!=='string'||data.name.length>80)throw new Error('Invalid project name.');
  if(typeof data.width!=='number'||typeof data.height!=='number')throw new Error('Missing canvas dimensions.');
  const doc=createDocument(data.width,data.height,data.name),length=doc.width*doc.height*4;
  if(data.version>=10)validateEncodedReferences(data.references,data.activeReferenceId);
  if(data.version>=3) {
    if(data.palette!==undefined)doc.palette=validatePalette(data.palette);
    if(!Array.isArray(data.layers)||data.layers.length<1||data.layers.length>MAX_LAYERS)throw new Error('Projects require 1–16 layers.');
    if(data.version>=4){
      if(!Array.isArray(data.frames)||data.frames.length<1||data.frames.length>MAX_FRAMES)throw new Error('Projects require 1–32 frames.');
      checkCelBudget(doc.width,doc.height,data.layers.length,data.frames.length);
      const frameIds=new Set<string>();
      for(const f of data.frames){if(!f||typeof f.id!=='string'||!/^frame-[1-9][0-9]{0,8}$/.test(f.id)||frameIds.has(f.id))throw new Error('Invalid frame data.');validateDuration(f.duration);frameIds.add(f.id);}
      if(!frameIds.has(data.activeFrameId))throw new Error('Invalid selected frame.');
      doc.frames=data.frames.map((f:Frame)=>({id:f.id,duration:f.duration}));doc.activeFrameId=data.activeFrameId;
    }
    if(data.version>=7){doc.tags=data.tags;validateTags(doc);}
    const ids=new Set<string>();
    // Validate all layer metadata and encoded sizes before allocating layer buffers.
    for(const l of data.layers) {
      if(!l||typeof l.id!=='string'||!/^layer-[1-9][0-9]{0,8}$/.test(l.id)||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>80||typeof l.visible!=='boolean')throw new Error('Invalid layer data.');
      if(data.version===3){if(typeof l.rgba!=='string'||l.rgba.length!==4*Math.ceil(length/3))throw new Error('Invalid layer data.');}
      else {
        if(!Array.isArray(l.cels)||l.cels.length!==doc.frames.length)throw new Error('Missing or excessive cels.');
        const celIds=new Set<string>(),concrete=new Set<string>();for(const cel of l.cels){
          if(!cel||!doc.frames.some(f=>f.id===cel.frameId)||celIds.has(cel.frameId))throw new Error('Invalid cel data.');
          if(data.version>=8&&cel.empty===true){if(cel.rgba!==undefined||cel.link!==undefined)throw new Error('Ambiguous empty cel.');}
          else if(data.version>=9&&typeof cel.link==='string'){if(cel.rgba!==undefined||cel.empty!==undefined||!concrete.has(cel.link)||doc.frames.findIndex(f=>f.id===cel.link)>=doc.frames.findIndex(f=>f.id===cel.frameId))throw new Error('Invalid linked cel target.');}
          else if(cel.empty!==undefined||cel.link!==undefined||typeof cel.rgba!=='string'||cel.rgba.length!==4*Math.ceil(length/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(cel.rgba))throw new Error('Invalid cel data.');
          celIds.add(cel.frameId);if(cel.link===undefined)concrete.add(cel.frameId);
        }
      }
      if(data.version>=5&&(typeof l.locked!=='boolean'||!Number.isInteger(l.opacity)||l.opacity<0||l.opacity>255))throw new Error('Invalid layer lock/opacity.');
      ids.add(l.id);
    }
    if(data.version>=6){doc.groups=data.groups;validateGroups({...doc,layers:data.layers});}
    if(!ids.has(data.activeLayerId))throw new Error('Invalid selected layer.');
    doc.layers=data.layers.map((l:{id:string;name:string;visible:boolean;locked?:boolean;opacity?:number;groupId?:string|null;rgba:string;cels:{frameId:string;rgba:string;empty?:boolean;link?:string}[]})=>makeLayer(doc,l.id,l.name,l.visible,data.version===3?{'frame-1':rgba(l.rgba,length)}:decodeCels(l.cels,length),data.version>=5?{locked:l.locked,opacity:l.opacity,groupId:data.version>=6?l.groupId:null}:{}));doc.activeLayerId=data.activeLayerId;
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
  if(data.version>=10){doc.references=data.references.map((r:{id:string;name:string;width:number;height:number;rgba:string})=>({id:r.id,name:r.name,width:r.width,height:r.height,pixels:rgba(r.rgba,r.width*r.height*4)}));doc.activeReferenceId=data.activeReferenceId;}
  if(data.version<8)for(const l of doc.layers)for(const f of doc.frames)compactCel(l,f.id);
  return doc;
}
