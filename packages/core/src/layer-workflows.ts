import {encodeProject,copyLayer,rasterCel,type PixelDocument,type Layer} from './document.js';
import {layerEditable} from './groups.js';
import {validateLayerRendering,renderLayerPixels,type LiveEffect} from './layer-render.js';
import {copyCoverage,editCoverage,paintCoverage,type Coverage,type CoverageEdit,type CoverageBrush} from './coverage.js';
export type LayerWorkflow=
 |{kind:'mask';layerId:string;source:'white'|'black'|'alpha'|'coverage'|'current';coverage?:Coverage;edit?:CoverageEdit;brush?:CoverageBrush}
 |{kind:'mask-state';layerId:string;action:'enable'|'disable'|'remove'|'bake'}
 |{kind:'mask-transform';layerId:string;dx:number;dy:number;flipX:boolean;flipY:boolean;rotation:0|90|180|270}
 |{kind:'effects';layerId:string;effects:LiveEffect[]}
 |{kind:'bake-effects';layerId:string}
 |{kind:'cel-transfer';layers:string[];from:number;to:number;targetLayer:number;targetFrame:number;move:boolean;rect:{x:number;y:number;width:number;height:number};x:number;y:number}
 |{kind:'hold';layers:string[];from:number;to:number;action:'hold'|'unlink'|'clear'};
export interface LayerWorkflowPlan {readonly baseline:string;readonly changed:boolean;readonly historyBytes:number;readonly preview:Uint8ClampedArray}
type State={options:LayerWorkflow;layers:Layer[]};
const plans=new WeakMap<LayerWorkflowPlan,State>();
const integer=(v:number,a:number,b:number)=>{if(!Number.isInteger(v)||v<a||v>b)throw new Error(`Use whole numbers from ${a} to ${b}.`);};
function selected(doc:PixelDocument,ids:string[],metadata=false){if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw new Error('Choose distinct artwork layers.');return ids.map(id=>{const l=doc.layers.find(l=>l.id===id);if(!l||!layerEditable(doc,metadata?{...l,text:undefined,adjustment:undefined}:l))throw new Error('Show and unlock every target layer and group.');return l;});}
export function layerHistoryBytes(before:Layer[],after:Layer[],extra=0){const buffers=new Set([...before,...after].flatMap(l=>[...Object.values(l.cels),...(l.mask?[l.mask.values]:[])]));return [...buffers].reduce((n,p)=>n+p.byteLength,0)+(before.length+after.length)*2048+extra;}
/** Immutable-source edits: linked peers outside a cel range never change. */
export function prepareLayerWorkflow(doc:PixelDocument,input:LayerWorkflow,budget=8*1024*1024):LayerWorkflowPlan {
 // Copy all options, including caller-owned typed arrays, before retaining a plan.
 const o=structuredClone(input);if(!o||!['mask','mask-state','mask-transform','effects','bake-effects','cel-transfer','hold'].includes(o.kind))throw new Error('Unknown layer workflow.');
 const layers=doc.layers.map(l=>copyLayer(doc,l));
 if('layerId' in o){const source=selected(doc,[o.layerId],true)[0],l=layers.find(l=>l.id===o.layerId)!;
  if((source.text||source.adjustment)&&(o.kind==='bake-effects'||o.kind==='mask-state'&&o.action==='bake'))throw new Error('Rasterize text or flatten adjustment layers before baking masks/effects.');
  if(o.kind==='mask'){
   if(!['white','black','alpha','coverage','current'].includes(o.source))throw new Error('Choose a mask source.');
   let c:Coverage={width:doc.width,height:doc.height,values:new Uint8Array(doc.width*doc.height)};
   if(o.source==='current'){if(!l.mask)throw new Error('Create a layer mask first.');c.values=new Uint8Array(l.mask.values);}
   else if(o.source==='white')c.values.fill(255);
   else if(o.source==='alpha'){if(source.text||source.adjustment)throw new Error('Live layers have no raw alpha source. Use a white/black/coverage mask.');const p=rasterCel(doc,source);for(let i=0;i<c.values.length;i++)c.values[i]=p[i*4+3];}
   else if(o.source==='coverage'){if(!o.coverage)throw new Error('Coverage is missing.');c=copyCoverage(o.coverage);if(c.width!==doc.width||c.height!==doc.height)throw new Error('Mask dimensions must match canvas.');}
   if(o.edit)c=editCoverage(c,o.edit);if(o.brush)c=paintCoverage(c,o.brush);l.mask={enabled:l.mask?.enabled??true,values:new Uint8ClampedArray(c.values)};
  }else if(o.kind==='mask-state'){
   if(!l.mask)throw new Error('Create a layer mask first.');
   if(o.action==='remove')delete l.mask;
   else if(o.action==='bake'){
    if(l.effects?.length)throw new Error('Bake live effects before baking the mask.');
    const mapped=new Map<Uint8ClampedArray,Uint8ClampedArray>();for(const f of doc.frames){const old=l.cels[f.id];if(!mapped.has(old))mapped.set(old,renderLayerPixels(l,doc.width,doc.height,f.id));}for(const f of doc.frames)l.cels[f.id]=mapped.get(source.cels[f.id])!;delete l.mask;
   }else if(o.action==='enable'||o.action==='disable')l.mask={...l.mask,enabled:o.action==='enable'};
   else throw new Error('Unknown mask action.');
  }else if(o.kind==='mask-transform'){
   if(!l.mask)throw new Error('Create a layer mask first.');integer(o.dx,-256,256);integer(o.dy,-256,256);if(typeof o.flipX!=='boolean'||typeof o.flipY!=='boolean'||![0,90,180,270].includes(o.rotation))throw new Error('Invalid mask transform.');
   const out=new Uint8ClampedArray(doc.width*doc.height),w=doc.width,h=doc.height;
   // Fixed-canvas pixel-centre inverse sampling, cropped to canvas, zero outside.
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=x+.5-w/2-o.dx,b=y+.5-h/2-o.dy;const turns=o.rotation/90;for(let k=0;k<turns;k++){const t=a;a=b;b=-t;}if(o.flipX)a=-a;if(o.flipY)b=-b;const sx=Math.floor(a+w/2),sy=Math.floor(b+h/2);if(sx>=0&&sx<w&&sy>=0&&sy<h)out[y*w+x]=l.mask.values[sy*w+sx];}l.mask={...l.mask,values:out};
  }else if(o.kind==='effects'){l.effects=o.effects;validateLayerRendering(l,doc.width,doc.height);if(!l.effects.length)delete l.effects;}
  else {if(!l.effects?.length)throw new Error('This layer has no live effects.');const mapped=new Map<Uint8ClampedArray,Uint8ClampedArray>();for(const f of doc.frames){const old=l.cels[f.id];if(!mapped.has(old))mapped.set(old,renderLayerPixels(l,doc.width,doc.height,f.id,false));}for(const f of doc.frames)l.cels[f.id]=mapped.get(source.cels[f.id])!;delete l.effects;}
 }else{
  const source=selected(doc,o.layers);integer(o.from,0,doc.frames.length-1);integer(o.to,o.from,doc.frames.length-1);
  if(o.kind==='hold'){
   if(!['hold','unlink','clear'].includes(o.action))throw new Error('Choose hold, unlink or clear.');
   for(const l of source){const target=layers.find(t=>t.id===l.id)!;for(let f=o.from;f<=o.to;f++)target.cels[doc.frames[f].id]=o.action==='hold'?l.cels[doc.frames[o.from].id]:o.action==='unlink'?l.cels[doc.frames[f].id].slice():new Uint8ClampedArray(0);}
  }else{
   const r=o.rect;integer(r.x,0,doc.width-1);integer(r.y,0,doc.height-1);integer(r.width,1,doc.width-r.x);integer(r.height,1,doc.height-r.y);integer(o.x,0,doc.width-r.width);integer(o.y,0,doc.height-r.height);integer(o.targetLayer,0,doc.layers.length-source.length);integer(o.targetFrame,0,doc.frames.length-(o.to-o.from+1));if(typeof o.move!=='boolean')throw new Error('Move must be Boolean.');
   const targets=doc.layers.slice(o.targetLayer,o.targetLayer+source.length);selected(doc,targets.map(l=>l.id));
   const changed=new Map<string,Uint8ClampedArray>(),get=(id:string,fid:string)=>{const key=id+':'+fid;if(!changed.has(key))changed.set(key,rasterCel(doc,doc.layers.find(l=>l.id===id)!,fid).slice());return changed.get(key)!;};
   if(o.move)for(const l of source)for(let f=o.from;f<=o.to;f++){const p=get(l.id,doc.frames[f].id);for(let y=0;y<r.height;y++)p.fill(0,((r.y+y)*doc.width+r.x)*4,((r.y+y)*doc.width+r.x+r.width)*4);}
   for(let n=0;n<source.length;n++)for(let f=o.from;f<=o.to;f++){const p=get(targets[n].id,doc.frames[o.targetFrame+f-o.from].id),original=rasterCel(doc,source[n],doc.frames[f].id);for(let y=0;y<r.height;y++)p.set(original.subarray(((r.y+y)*doc.width+r.x)*4,((r.y+y)*doc.width+r.x+r.width)*4),((o.y+y)*doc.width+o.x)*4);}
   for(const [key,p] of changed){const [id,fid]=key.split(':');layers.find(l=>l.id===id)!.cels[fid]=p;}
  }
 }
 for(const l of layers)validateLayerRendering(l,doc.width,doc.height);
 const baseline=encodeProject(doc,false),candidate={...doc,layers},changed=encodeProject(candidate,false)!==baseline;
 const historyBytes=layerHistoryBytes(doc.layers,layers,(doc.frames.length+doc.groups.length+doc.tags.length)*512);
 if(changed&&(!Number.isFinite(budget)||historyBytes>budget))throw new Error('Layer workflow exceeds the undo memory budget.');
 const plan=Object.freeze({baseline,changed,historyBytes,get preview(){return composite(candidate);}});plans.set(plan,{options:o,layers});return plan;
}
import {composite} from './document.js';
export function regenerateLayerWorkflow(doc:PixelDocument,plan:LayerWorkflowPlan,budget:number){const state=plans.get(plan);if(!state||plan.baseline!==encodeProject(doc,false))throw new Error('Layer workflow source changed. Prepare again.');const fresh=prepareLayerWorkflow(doc,state.options,budget);return {plan:fresh,layers:plans.get(fresh)!.layers};}
