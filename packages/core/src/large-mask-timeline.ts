import {cloneLayerMask,validateLayerMask,type LargeLayerMask} from './large-layer-mask.js';
import {authorLayerMask,type TiledCoverageEdit} from './large-mask-authoring.js';
import type {LargeLayer,LargeProject} from './large-canvas.js';

/** A missing cel is explicitly null. Non-null object identity represents a link. */
export type LargeMaskTimelineEdit = {kind:'animate'|'static'|'unlink'}
 | {kind:'link';frameId:string}
 | {kind:'copy-range';from:number;to:number;linked:boolean}
 | {kind:'clear-range'|'tween';from:number;to:number}
 | {kind:'edit-range';from:number;to:number;edit:TiledCoverageEdit};
export const LARGE_COVERAGE_BYTES=8*1024*1024;
export function largeFrameMask(layer:LargeLayer,frameId:string){return layer.maskCels?layer.maskCels[frameId]??undefined:layer.mask;}
export function largeHasMasks(layer:LargeLayer){return !!layer.mask||!!layer.maskCels;}
export function largeLayerMasks(layer:LargeLayer){return layer.maskCels?Object.values(layer.maskCels).filter((m):m is LargeLayerMask=>m!==null):layer.mask?[layer.mask]:[];}
export function cloneMaskCels(cels:Record<string,LargeLayerMask|null>){const seen=new Map<LargeLayerMask,LargeLayerMask>();return Object.fromEntries(Object.entries(cels).map(([id,m])=>{if(m&&!seen.has(m))seen.set(m,cloneLayerMask(m,false));return [id,m?seen.get(m)!:null];}));}
export function largeCoverageAllocation(d:LargeProject){let bytes=0,references=0;for(const l of d.layers){const masks=new Set<LargeLayerMask>();if(l.mask&&l.maskCels)throw Error('Choose static or animated masks.');if(l.maskCels&&(Object.keys(l.maskCels).length!==d.frames.length||d.frames.some(f=>!Object.hasOwn(l.maskCels!,f.id)||l.maskCels![f.id]===undefined)))throw Error('Every frame needs an explicit mask cel.');for(const m of largeLayerMasks(l)){validateLayerMask(m,d.width,d.height);masks.add(m);references++;}bytes+=[...masks].reduce((n,m)=>n+m.coverage.byteLength,0);}if(bytes>LARGE_COVERAGE_BYTES||references>256)throw Error('Saved coverage exceeds 8 MiB / 256 references.');return {bytes,references};}
export function replaceFrameMask(layer:LargeLayer,frameId:string,next?:LargeLayerMask){if(!layer.maskCels){if(next)layer.mask=next;else delete layer.mask;return;}const old=layer.maskCels[frameId];for(const id of Object.keys(layer.maskCels))if(id===frameId||old&&layer.maskCels[id]===old)layer.maskCels[id]=next??null;}
export function editMaskTimeline(d:LargeProject,l:LargeLayer,edit:LargeMaskTimelineEdit){
 const active=d.activeFrameId,current=largeFrameMask(l,active);
 if(edit?.kind==='animate'){if(l.maskCels)return;l.maskCels=Object.fromEntries(d.frames.map(f=>[f.id,l.mask??null]));delete l.mask;return;}
 if(edit?.kind==='static'){if(!l.maskCels)return;delete l.maskCels;if(current)l.mask=current;return;}
 if(!l.maskCels)throw Error('Enable animated masks first.');
 if(edit?.kind==='unlink'){if(current&&Object.values(l.maskCels).filter(m=>m===current).length>1)l.maskCels[active]=cloneLayerMask(current,false);return;}
 if(edit?.kind==='link'){if(!d.frames.some(f=>f.id===edit.frameId))throw Error('Source mask frame is missing.');l.maskCels[active]=l.maskCels[edit.frameId];return;}
 if(!edit||!['copy-range','clear-range','edit-range','tween'].includes(edit.kind))throw Error('Unknown mask timeline operation.');
 const range=edit as Extract<LargeMaskTimelineEdit,{from:number}>;
 if(!Number.isInteger(range.from)||!Number.isInteger(range.to)||range.from<0||range.to<range.from||range.to>=d.frames.length)throw Error('Use an ordered frame range.');
 const frames=d.frames.slice(range.from,range.to+1);
 if(edit.kind==='tween'){
  const first=largeFrameMask(l,frames[0].id),last=largeFrameMask(l,frames.at(-1)!.id);
  if(frames.length<3||!first||!last||first.enabled!==last.enabled||JSON.stringify([first.rect.x,first.rect.y,first.rect.width,first.rect.height])!==JSON.stringify([last.rect.x,last.rect.y,last.rect.width,last.rect.height]))throw Error('Tween needs three frames and matching endpoint windows/enabled flags.');
  if(first.coverage.length*(frames.length-2)>LARGE_COVERAGE_BYTES)throw Error('Tween coverage exceeds 8 MiB.');
  const total=frames.slice(0,-1).reduce((n,f)=>n+f.duration,0);let time=0;
  for(let i=1;i<frames.length-1;i++){time+=frames[i-1].duration;const t=time/total,m=cloneLayerMask(first);m.outside=Math.round(first.outside+(last.outside-first.outside)*t);m.coverage.forEach((v,j)=>m.coverage[j]=Math.round(v+(last.coverage[j]-v)*t));l.maskCels[frames[i].id]=m;}return;
 }
 const generated=new Map<LargeLayerMask,LargeLayerMask>();let work=0;
 for(const f of frames){
  if(edit.kind==='clear-range')l.maskCels[f.id]=null;
  else if(edit.kind==='copy-range'){if(typeof edit.linked!=='boolean')throw Error('Choose linked or independent coverage.');l.maskCels[f.id]=current?(edit.linked?current:cloneLayerMask(current,false)):null;}
  else if(edit.kind==='edit-range'){const m=largeFrameMask(l,f.id);if(!m)throw Error('Every target frame needs saved coverage.');if(!generated.has(m)){if((work+=m.coverage.length)>LARGE_COVERAGE_BYTES)throw Error('Range work exceeds 8 MiB.');generated.set(m,authorLayerMask(m,edit.edit));}l.maskCels[f.id]=generated.get(m)!;}
 }
}
