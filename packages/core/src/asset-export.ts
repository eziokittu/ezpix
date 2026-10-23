import {encodeTga,encodePcx} from './legacy-raster.js';
import {encodeIcon} from './native-icon.js';
import {exportGif} from './native-gif.js';
import {encodeBmp,encodeQoi,encodePixelSvg} from './raster-exchange.js';
import {composite,encodeProject,type PixelDocument} from './document.js';
import {encodeNativePng,pngChunk} from './native-png.js';
import {concat} from './native-utils.js';
import {writeNativeZip} from './native-zip.js';
import {exportSheet,type SheetOptions} from './sheet.js';
export interface AssetExportOptions {format:'apng'|'atlas'|'slices'|'frames'|'gif'|'bmp'|'qoi'|'svg'|'tga'|'pcx'|'ico'|'cur';scale:number;columns:number;padding:number;spacing:number;plays:number;tagId:string|null;hotspotX?:number;hotspotY?:number}
export interface ExportPreset {name:string;options:AssetExportOptions}
export const defaultAssetExport=():AssetExportOptions=>({format:'apng',scale:1,columns:1,padding:0,spacing:0,plays:0,tagId:null});
export function validateAssetOptions(value:unknown):asserts value is AssetExportOptions {options(value as AssetExportOptions);}
function options(input:AssetExportOptions){const o=structuredClone(input);if(!o||Object.keys(o).length<7||Object.keys(o).length>9||Object.keys(o).some(k=>!['format','scale','columns','padding','spacing','plays','tagId','hotspotX','hotspotY'].includes(k))||!['apng','atlas','slices','frames','gif','bmp','qoi','svg','tga','pcx','ico','cur'].includes(o.format)||!Number.isInteger(o.scale)||o.scale<1||o.scale>8||!Number.isInteger(o.columns)||o.columns<1||o.columns>32||![o.padding,o.spacing].every(n=>Number.isInteger(n)&&n>=0&&n<=32)||!Number.isInteger(o.plays)||o.plays<0||o.plays>1000||[o.hotspotX,o.hotspotY].some(n=>n!==undefined&&(!Number.isInteger(n)||n<0||n>255))||o.tagId!==null&&(typeof o.tagId!=='string'||!/^tag-[1-9][0-9]{0,8}$/.test(o.tagId)))throw new Error('Export needs scale 1-8, columns 1-32, padding/spacing 0-32, plays 0-1000, source hotspots 0-255 and a valid range.');return o;}
export function assetFrameOrder(doc:PixelDocument,tagId:string|null){const tag=tagId===null?undefined:doc.tags.find(t=>t.id===tagId);if(tagId!==null&&!tag)throw new Error('Export range no longer exists.');let frames=doc.frames.slice(tag?.from??0,(tag?.to??doc.frames.length-1)+1);if(tag?.mode==='reverse')frames.reverse();if(tag?.mode==='ping-pong'&&frames.length>2)frames=[...frames,...frames.slice(1,-1).reverse()];return {frames,tag};}
function scaleRaster(p:Uint8ClampedArray,w:number,h:number,scale:number){const out=new Uint8ClampedArray(w*h*scale*scale*4);for(let y=0;y<h*scale;y++)for(let x=0;x<w*scale;x++){const i=(Math.floor(y/scale)*w+Math.floor(x/scale))*4;out.set(p.subarray(i,i+4),(y*w*scale+x)*4);}return out;}
/** Full-canvas SOURCE frames, no disposal/delta ambiguity. PNG 3 APNG fcTL/fdAT sequence. */
export async function exportApng(doc:PixelDocument,input:AssetExportOptions){
 const baseline=encodeProject(doc,false),o=options(input),{frames,tag}=assetFrameOrder(doc,o.tagId),w=doc.width*o.scale,h=doc.height*o.scale;
 if(w*h*frames.length*4>16*1024*1024||w*h>1048576)throw new Error('Animated output exceeds one megapixel per frame or 16 MiB decoded frames.');
 let sequence=0;const parts:Uint8Array[]=[];const control=new Uint8Array(8),cv=new DataView(control.buffer);cv.setUint32(0,frames.length);cv.setUint32(4,tag?.mode==='once'?1:o.plays);
 for(let n=0;n<frames.length;n++){const frame=frames[n],png=await encodeNativePng(w,h,scaleRaster(composite(doc,frame.id),doc.width,doc.height,o.scale));if(!n){parts.push(png.subarray(0,33),pngChunk('acTL',control));}
  const c=new Uint8Array(26),v=new DataView(c.buffer);v.setUint32(0,sequence++);v.setUint32(4,w);v.setUint32(8,h);v.setUint16(20,frame.duration);v.setUint16(22,1000);parts.push(pngChunk('fcTL',c));
  let at=33;while(at<png.length){const pv=new DataView(png.buffer,png.byteOffset+at),length=pv.getUint32(0),type=new TextDecoder().decode(png.subarray(at+4,at+8));if(type==='IDAT'){const raw=png.subarray(at+8,at+8+length);if(!n)parts.push(pngChunk('IDAT',raw));else{const f=new Uint8Array(raw.length+4);new DataView(f.buffer).setUint32(0,sequence++);f.set(raw,4);parts.push(pngChunk('fdAT',f));}}at+=length+12;}
 }parts.push(pngChunk('IEND',new Uint8Array()));const bytes=concat(parts);if(bytes.length>8*1024*1024)throw new Error('APNG exceeds the 8 MiB encoded output budget.');if(baseline!==encodeProject(doc,false))throw new Error('Artwork changed during APNG export. Prepare again.');return bytes;
}
const utf8=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v,null,2));
export const ASSET_LOSSES='Exports bake visible composites. Original layers, editable text, masks/effects, hidden pixels, linked edit identity, references, conversion source/recipe and history are omitted. Asset JSON retains timing, tags, slices/pivots and palette organisation.';
export async function exportAssets(doc:PixelDocument,input:AssetExportOptions){
 const o=options(input),baseline=encodeProject(doc,false);const {frames,tag}=assetFrameOrder(doc,o.tagId),files=new Map<string,Uint8Array>();
 const base={format:'ezpix-assets',version:1,origin:'top-left',source:{width:doc.width,height:doc.height},scale:o.scale,palette:doc.palette,paletteOrganisation:doc.paletteOrganisation??null,tags:doc.tags,selectedTag:tag??null,slices:doc.slices??[],losses:ASSET_LOSSES};
 if(['gif','bmp','qoi','svg','tga','pcx','ico','cur'].includes(o.format)){
  if(doc.width*doc.height*o.scale*o.scale>1048576||o.format==='svg'&&doc.width*doc.height*o.scale*o.scale>65536)throw new Error('Image exceeds raster/SVG pixel budget.');
  if(['ico','cur'].includes(o.format)&&(doc.width*o.scale>256||doc.height*o.scale>256))throw new Error('ICO/CUR image dimensions must stay within 256 pixels.');
  if(o.format==='cur'&&((o.hotspotX??0)>=doc.width||(o.hotspotY??0)>=doc.height))throw new Error('Cursor hotspot must lie inside the source canvas.');
  const f=o.tagId?frames[0]:doc.frames.find(f=>f.id===doc.activeFrameId)!,r={width:doc.width*o.scale,height:doc.height*o.scale,pixels:scaleRaster(composite(doc,f.id),doc.width,doc.height,o.scale)};
  const bytes=o.format==='gif'?exportGif(doc,o).bytes:o.format==='bmp'?encodeBmp(r):o.format==='qoi'?encodeQoi(r):o.format==='tga'?encodeTga(r):o.format==='pcx'?encodePcx(r):o.format==='ico'||o.format==='cur'?await encodeIcon(r,o.format,(o.hotspotX??0)*o.scale,(o.hotspotY??0)*o.scale):encodePixelSvg(r);
  files.set(o.format==='gif'?'animation.gif':`image.${o.format}`,bytes);files.set('assets.json',utf8({...base,sourceFrameId:f.id,frames:frames.map(f=>({id:f.id,duration:f.duration}))}));
 }else if(o.format==='apng'){files.set('animation.png',await exportApng(doc,o));files.set('assets.json',utf8({...base,frames:frames.map((f,i)=>({index:i,sourceFrameId:f.id,duration:f.duration}))}));}
 else if(o.format==='atlas'){
  // Atlas is timeline order for stable references; named range playback is encoded separately.
  const sheetOptions:SheetOptions={columns:Math.min(o.columns,doc.frames.length),scale:o.scale,padding:o.padding,spacing:o.spacing};
  const sheet=exportSheet(doc,sheetOptions);if(sheet.raster.width*sheet.raster.height>1048576)throw new Error('Asset atlas exceeds one megapixel. Reduce scale or spacing.');files.set('atlas.png',await encodeNativePng(sheet.raster.width,sheet.raster.height,sheet.raster.pixels));
  files.set('assets.json',utf8({...base,image:'atlas.png',width:sheet.raster.width,height:sheet.raster.height,frames:sheet.metadata.frames.map(f=>({...f,slices:(doc.slices??[]).map(s=>({id:s.id,name:s.name,x:f.x+s.x*o.scale,y:f.y+s.y*o.scale,width:s.width*o.scale,height:s.height*o.scale,pivotX:s.pivotX*o.scale,pivotY:s.pivotY*o.scale}))})),playback:frames.map(f=>f.id)}));
 }else{
  const regions=o.format==='slices'?doc.slices??[]:[{id:'canvas',name:'Canvas',x:0,y:0,width:doc.width,height:doc.height,pivotX:0,pivotY:0}];if(!regions.length)throw new Error('Create at least one sprite slice first.');if(regions.length*doc.frames.length>38)throw new Error('Use at most 38 frame/region images per bundle.');
  const manifest=[];for(let i=0;i<doc.frames.length;i++){const f=doc.frames[i],src=composite(doc,f.id);for(let n=0;n<regions.length;n++){const r=regions[n];if(r.width*r.height*o.scale*o.scale>1048576)throw new Error('Region image exceeds one megapixel.');const p=new Uint8ClampedArray(r.width*r.height*4);for(let y=0;y<r.height;y++)p.set(src.subarray(((r.y+y)*doc.width+r.x)*4,((r.y+y)*doc.width+r.x+r.width)*4),y*r.width*4);const path=`images/region-${n+1}-frame-${i+1}.png`;files.set(path,await encodeNativePng(r.width*o.scale,r.height*o.scale,scaleRaster(p,r.width,r.height,o.scale)));manifest.push({image:path,sourceFrameId:f.id,duration:f.duration,region:r,pivot:{x:r.pivotX*o.scale,y:r.pivotY*o.scale}});}}
  files.set('assets.json',utf8({...base,images:manifest,playback:frames.map(f=>f.id)}));
 }
 if([...files.values()].reduce((n,p)=>n+p.length,0)>8*1024*1024)throw new Error('Asset bundle exceeds 8 MiB.');if(baseline!==encodeProject(doc,false))throw new Error('Artwork changed during asset export. Prepare again.');return files;
}
export function encodeExportPresets(input:ExportPreset[]){return JSON.stringify({format:'ezpix-export-presets',version:1,presets:presets(input)});}
function presets(input:unknown):ExportPreset[]{if(!Array.isArray(input)||input.length>4)throw new Error('Store up to four export presets.');const seen=new Set<string>();return input.map(p=>{if(!p||Object.keys(p).length!==2||typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>80||seen.has(p.name.trim().toLowerCase()))throw new Error('Preset names must be unique, 1-80 characters.');seen.add(p.name.trim().toLowerCase());return {name:p.name.trim(),options:options(p.options)};});}
export function decodeExportPresets(text:string){if(typeof text!=='string'||new TextEncoder().encode(text).length>16384)throw new Error('Preset JSON limit is 16 KiB.');let data;try{data=JSON.parse(text);}catch{throw new Error('Unreadable preset JSON.');}if(data?.format!=='ezpix-export-presets'||data.version!==1||Object.keys(data).length!==3)throw new Error('Unsupported export presets.');return presets(data.presets);}
export async function exportBatch(doc:PixelDocument,input:ExportPreset[]){const selected=presets(input);if(!selected.length)throw new Error('Choose at least one export preset.');const baseline=encodeProject(doc,false),files=new Map<string,Uint8Array>();for(let i=0;i<selected.length;i++){const preset=selected[i],bundle=await exportAssets(doc,preset.options);for(const [path,bytes] of bundle)files.set(`preset-${i+1}/${path}`,bytes);files.set(`preset-${i+1}/preset.json`,utf8(preset));if(files.size>39||[...files.values()].reduce((n,b)=>n+b.length,0)>8*1024*1024)throw new Error('Batch exceeds 40 entries or 8 MiB. Choose fewer images/presets.');}if(baseline!==encodeProject(doc,false))throw new Error('Artwork changed during export. Prepare again.');files.set('batch.json',utf8({format:'ezpix-export-batch',version:1,presets:selected.map((p,i)=>({name:p.name,directory:`preset-${i+1}`}))}));return writeNativeZip(files);}

export async function exportAssetBundle(doc:PixelDocument,input:AssetExportOptions){const files=await exportAssets(doc,input);return {bytes:writeNativeZip(files),files:[...files.keys()]};}
