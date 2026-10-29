import {editingPixels,editingPalette,editingInk} from './editing-policy.js';
import {checkCelBudget,composite,copyLayer,makeLayer,validatePaletteSlots,type PixelDocument} from './document.js';
import {groupAncestors} from './groups.js';
const gray=(r:number,g:number,b:number)=>Math.floor((299*r+587*g+114*b+500)/1000);
const grayHex=(c:string)=>{const n=gray(parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5),16));return '#'+n.toString(16).padStart(2,'0').repeat(3);};
/** Internal draft mutation only. Full RGBA bytes remain editable; this is not a persistent storage mode. */
export function sourceGrayscale(doc:PixelDocument){if(doc.layers.some(l=>l.tilemap))throw Error('Rasterize tilemap layers before changing source colour policy.');
 for(const l of doc.layers){const changed=Object.values(l.cels).some(p=>p.some((v,i)=>i%4<3&&v!==gray(p[i-i%4],p[i-i%4+1],p[i-i%4+2])))||!!l.text&&l.text.color.slice(0,3).some(v=>v!==gray(...l.text!.color.slice(0,3) as [number,number,number]));if(changed&&(l.locked||groupAncestors(doc,l.groupId).some(g=>g.locked)))throw new Error('Unlock every source layer and parent that needs conversion.');}
 const palette=doc.palette.map(grayHex);if(doc.paletteOrganisation?.locked.some(i=>palette[i]!==doc.palette[i]))throw new Error('Unlock coloured palette slots before converting source colours.');
 for(const l of doc.layers){const seen=new Map<Uint8ClampedArray,Uint8ClampedArray>();for(const id of Object.keys(l.cels)){const src=l.cels[id];let p=seen.get(src);if(!p){p=src.slice();for(let i=0;i<p.length;i+=4){const n=gray(p[i],p[i+1],p[i+2]);p[i]=p[i+1]=p[i+2]=n;}seen.set(src,p);}l.cels[id]=p;}if(l.text){const c=l.text.color,n=gray(c[0],c[1],c[2]);l.text={...l.text,color:[n,n,n,c[3]]};}}
 doc.palette=palette;delete doc.outputMode;
}
/** Source is a decoded detached project. Source histories and group context never cross documents. */
export function transferDocument(target:PixelDocument,source:PixelDocument,destination:'layer'|'frames'|'palette'|'reference'){
 const sourceName=source.name.trim().slice(0,80)||'Transferred artwork';
 if(destination==='palette'){const next=validatePaletteSlots([...target.palette,...new Set(editingPalette(target,source.palette).filter(c=>!target.palette.includes(c)))]);target.palette=next;return;}
 if(destination==='reference'){let n=1;while(target.references.some(r=>r.id===`reference-${n}`))n++;const r={id:`reference-${n}`,name:sourceName,width:source.width,height:source.height,pixels:composite(source)};target.references=[...target.references,r];target.activeReferenceId=r.id;return;}
 if(!['layer','frames'].includes(destination))throw new Error('Choose layer, frames, palette or reference transfer.');
 if(target.width!==source.width||target.height!==source.height)throw new Error('Layer/frame transfers require matching canvas dimensions.');
 if(target.outputMode)throw new Error('Return target document output to RGBA before transferring artwork.');
 let n=1;while(target.layers.some(l=>l.id===`layer-${n}`))n++;const id=`layer-${n}`;
 if(destination==='layer'){
  if(source.outputMode)throw new Error('Use flattened frames or return source output to RGBA for raw layer transfer.');
  if(target.frames.length!==source.frames.length)throw new Error('Raw layer transfer requires equal frame counts.');
  const l=source.layers.find(l=>l.id===source.activeLayerId)!;if(l.adjustment)throw new Error('Adjustment layers cannot move independently of their backdrop.');
  if(l.tilemap)throw new Error('Rasterize a tilemap before raw layer transfer, or transfer flattened frames/reference. Save EzPix to retain editable shared tiles.');
  if(l.groupId)throw new Error('Ungroup the source layer or transfer flattened frames to preserve group context.');
  checkCelBudget(target.width,target.height,target.layers.length+1,target.frames.length);
  const seen=new Map<Uint8ClampedArray,Uint8ClampedArray>(),cels:Record<string,Uint8ClampedArray>={};source.frames.forEach((f,i)=>{const p=l.cels[f.id];if(!seen.has(p))seen.set(p,editingPixels(target,p));cels[target.frames[i].id]=seen.get(p)!;});
  const layer=makeLayer(target,id,l.name,l.visible,cels,l);layer.groupId=null;if(layer.mask)layer.mask={...layer.mask,values:layer.mask.values.slice()};if(layer.text)layer.text={...layer.text,color:editingInk(target,layer.text.color)};target.layers.push(layer);target.activeLayerId=id;return;
 }
 checkCelBudget(target.width,target.height,target.layers.length+1,target.frames.length+source.frames.length);
 const old=target.frames.slice(),frames=old.slice(),cels:Record<string,Uint8ClampedArray>=Object.fromEntries(old.map(f=>[f.id,new Uint8ClampedArray(0)]));
 for(const f of source.frames){let k=1;while(frames.some(v=>v.id===`frame-${k}`))k++;const frame={id:`frame-${k}`,duration:f.duration};frames.push(frame);cels[frame.id]=editingPixels(target,composite(source,f.id));}
 target.frames=frames;target.layers=target.layers.map(l=>{const copy=copyLayer(target,l);for(const f of frames.slice(old.length))copy.cels[f.id]=new Uint8ClampedArray(0);return copy;});target.layers.push(makeLayer(target,id,sourceName,true,cels));target.activeLayerId=id;target.activeFrameId=frames[old.length].id;
}
