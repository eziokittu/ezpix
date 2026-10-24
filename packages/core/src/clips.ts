import {checkCelBudget,composite,createDocument,decodeProject,encodeProject,makeLayer,type PixelDocument} from './document.js';
import {MAX_TAGS} from './animation.js';
export const MAX_CLIP_BYTES=6*1024*1024,MAX_LIBRARY_CLIPS=4,MAX_LIBRARY_BYTES=12*1024*1024;
export interface ClipEntry {id:string;text:string;savedAt:number}
export function decodeClip(text:string):PixelDocument {
 if(typeof text!=='string'||text.length>MAX_CLIP_BYTES||new TextEncoder().encode(text).length>MAX_CLIP_BYTES)throw new Error('Clip file exceeds 6 MiB.');
 let data;try{data=JSON.parse(text);}catch{throw new Error('This is not a readable EzPix clip.');}
 const p=data?.project,l=p?.layers?.[0];
 if(data?.format!=='ezpix-clip'||data.version!==1||p?.format!=='ezpix'||![10,11,12,13,14,15,16].includes(p.version)||!Array.isArray(p.layers)||p.layers.length!==1||!Array.isArray(p.groups)||p.groups.length||!Array.isArray(p.references)||p.references.length||p.activeReferenceId!==null||p.indexed!==undefined||p.editingMode!==undefined||p.outputMode!==undefined||p.paletteOrganisation!==undefined||p.slices!==undefined||p.conversion!==undefined||!Array.isArray(p.tags)||p.tags.length>1||!l||l.visible!==true||l.locked!==false||l.opacity!==255||(p.version>=11&&l.blendMode!=='normal')||l.text!==undefined||l.adjustment!==undefined||l.mask!==undefined||l.effects!==undefined||l.groupId!==null||!Array.isArray(l.cels)||l.cels.some((c:{link?:unknown})=>!c||c.link!==undefined))throw new Error('Unsupported clip: use a flattened EzPix clip v1 without references or sources.');
 const doc=decodeProject(JSON.stringify(p));if(!doc.name.trim()||doc.tags.some(t=>t.from!==0||t.to!==doc.frames.length-1))throw new Error('Clip tags must cover the complete clip.');return doc;
}
export function captureClip(source:PixelDocument,tagId?:string,name=source.name){
 const tag=tagId?source.tags.find(t=>t.id===tagId):undefined;if(tagId&&!tag)throw new Error('Clip range is missing.');const clean=name.trim();if(!clean||clean.length>80)throw new Error('Clip names need 1-80 characters.');
 const frames=source.frames.slice(tag?.from??0,(tag?.to??source.frames.length-1)+1);checkCelBudget(source.width,source.height,1,frames.length);const doc=createDocument(source.width,source.height,clean);doc.frames=frames.map((f,i)=>({id:`frame-${i+1}`,duration:f.duration}));doc.activeFrameId='frame-1';doc.palette=source.palette.slice();
 doc.layers=[makeLayer(doc,'layer-1',clean,true,Object.fromEntries(frames.map((f,i)=>{const p=composite(source,f.id);return [`frame-${i+1}`,p.some(v=>v!==0)?p:new Uint8ClampedArray(0)];})))];
 if(tag)doc.tags=[{id:'tag-1',name:tag.name,from:0,to:frames.length-1,mode:tag.mode}];
 const text=JSON.stringify({format:'ezpix-clip',version:1,project:JSON.parse(encodeProject(doc,false))});if(new TextEncoder().encode(text).length>MAX_CLIP_BYTES)throw new Error('Clip exceeds 6 MiB.');
 const warnings=['Clip keeps visible frame composites. Original layers/groups, hidden pixels and linked editing identity are omitted.'];if(source.indexed)warnings.push('Indexed slot identity/storage is baked into the visible clip. Keep an EzPix project or raw indexed cel file.');if(source.outputMode)warnings.push('Document output is baked into the clip; editable source colours and output mode are omitted.');if(source.paletteOrganisation||source.slices?.length)warnings.push('Palette groups/locks and slice/pivot metadata are omitted. Asset bundles retain them.');if(source.conversion||source.references.length)warnings.push('Conversion sources and reference images are omitted.');if(source.tags.length&&!tag)warnings.push('All-frame clip omits named ranges; choose a range to retain its name and playback mode.');
 return {text,document:doc,warnings};
}
export function clipAppendPlan(target:PixelDocument,text:string){const clip=decodeClip(text);if(clip.width!==target.width||clip.height!==target.height)throw new Error('Clip dimensions must match this canvas. Open the clip as a new document instead.');checkCelBudget(target.width,target.height,target.layers.length+1,target.frames.length+clip.frames.length);if(clip.tags.length&&target.tags.length>=MAX_TAGS)throw new Error('Clip tag exceeds the 16-tag budget. Remove a tag before appending.');return clip;}
/** Validate browser-local records as untrusted input; no invalid entry is silently removed. */
export function validateClipLibrary(entries:unknown):asserts entries is ClipEntry[]{
 if(!Array.isArray(entries)||entries.length>MAX_LIBRARY_CLIPS)throw new Error('Clip library supports at most four clips.');const ids=new Set<string>();let bytes=0;
 for(const e of entries){if(!e||typeof e.id!=='string'||!/^[a-z0-9-]{1,80}$/i.test(e.id)||ids.has(e.id)||typeof e.text!=='string'||!Number.isSafeInteger(e.savedAt)||e.savedAt<0)throw new Error('Invalid clip library record.');ids.add(e.id);if(e.text.length>MAX_CLIP_BYTES)throw new Error('Stored clip exceeds 6 MiB.');bytes+=new TextEncoder().encode(e.text).length;if(bytes>MAX_LIBRARY_BYTES)throw new Error('Clip library exceeds its 12 MiB budget.');}
 for(const e of entries)decodeClip(e.text);
}
