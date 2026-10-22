import {activeLayer,rasterCel,linkedFrames,encodeProject,createDocument,checkCelBudget,type PixelDocument} from './document.js';
import {layerEditable,layerVisible} from './groups.js';
import {encodeNativePng} from './native-png.js';
import type {Rect} from './toolkit.js';
export type SelectionActionOptions={kind:'clear'}|{kind:'copy-layer'|'cut-layer'|'export-png'|'export-project';name:string};
export interface SelectionActionPlan {
 readonly baseline:string;readonly rect:Readonly<Rect>;readonly options:Readonly<SelectionActionOptions>;
 readonly width:number;readonly height:number;readonly pixels:Uint8ClampedArray;readonly cleared:Uint8ClampedArray;
 readonly preview:Uint8ClampedArray;readonly changed:boolean;readonly linked:number;readonly historyBytes:number;
}
export function prepareSelectionAction(doc:PixelDocument,rect:Rect,options:SelectionActionOptions,historyBudget=8*1024*1024):SelectionActionPlan {
 if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>doc.width||rect.y+rect.height>doc.height)throw new Error('Selection rectangle must fit inside the canvas.');
 if(!options||!['copy-layer','cut-layer','clear','export-png','export-project'].includes(options.kind))throw new Error('Choose a selection action.');
 const settings=Object.freeze(options.kind==='clear'?{kind:'clear' as const}:{kind:options.kind,name:typeof options.name==='string'?options.name.trim():''});
 if(settings.kind!=='clear'&&(!settings.name||settings.name.length>80))throw new Error('Names need 1-80 characters.');
 const layer=activeLayer(doc),exporting=settings.kind==='export-png'||settings.kind==='export-project',structural=settings.kind==='copy-layer'||settings.kind==='cut-layer';
 if(!layerVisible(doc,layer)||!exporting&&!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer and its groups before changing selection artwork.');
 if(structural)checkCelBudget(doc.width,doc.height,doc.layers.length+1,doc.frames.length);
 const r=Object.freeze({x:rect.x,y:rect.y,width:rect.width,height:rect.height}),before=rasterCel(doc,layer),linked=linkedFrames(doc,layer).length;
 let nonzero=false;for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){const i=(y*doc.width+x)*4;if(before[i]||before[i+1]||before[i+2]||before[i+3])nonzero=true;}
 const changed=structural||settings.kind==='clear'&&nonzero;
 const retained=new Set(doc.layers.flatMap(l=>Object.values(l.cels)));
 const historyBytes=exporting?0:structural?[...retained].reduce((n,p)=>n+p.byteLength,0)+doc.width*doc.height*4*(settings.kind==='cut-layer'?2:1)+(2*doc.layers.length+1+2*doc.frames.length+2*doc.groups.length+2*doc.tags.length)*256+2048:3*doc.width*doc.height*4+256+linked*64;
 if(changed&&(!Number.isFinite(historyBudget)||historyBytes>historyBudget))throw new Error('Selection action exceeds the undo memory budget.');
 const width=exporting?r.width:doc.width,height=exporting?r.height:doc.height,pixels=new Uint8ClampedArray(width*height*4),cleared=exporting?new Uint8ClampedArray(0):before.slice();
 for(let y=0;y<r.height;y++){
  const row=before.subarray(((r.y+y)*doc.width+r.x)*4,((r.y+y)*doc.width+r.x+r.width)*4);
  if(settings.kind!=='clear')pixels.set(row,exporting?y*r.width*4:((r.y+y)*doc.width+r.x)*4);
  if(settings.kind==='clear'||settings.kind==='cut-layer')cleared.fill(0,((r.y+y)*doc.width+r.x)*4,((r.y+y)*doc.width+r.x+r.width)*4);
 }
 // Preview isolates copied/exported raw artwork; clear previews the resulting selected cel.
 const preview=settings.kind==='clear'?cleared.slice():pixels.slice();
 for(let i=0;i<preview.length;i+=4)if(!preview[i+3])preview.fill(0,i,i+3);
 return Object.freeze({baseline:encodeProject(doc,false),rect:r,options:settings,width,height,pixels,cleared,preview,changed,linked,historyBytes});
}
/** Download-only, tightly cropped, single-layer/frame project; no source/reference leakage. */
export function selectionProject(doc:PixelDocument,plan:SelectionActionPlan):PixelDocument {
 if(plan.baseline!==encodeProject(doc,false)||plan.options.kind!=='export-project')throw new Error('Selection export source changed or format is invalid. Prepare again.');
 const fresh=prepareSelectionAction(doc,plan.rect,plan.options),output=createDocument(fresh.width,fresh.height,plan.options.name);
 output.palette=doc.palette.slice();output.frames[0].duration=doc.frames.find(f=>f.id===doc.activeFrameId)!.duration;
 output.layers[0].name=activeLayer(doc).name;output.layers[0].cels['frame-1']=fresh.pixels.some(v=>v!==0)?fresh.pixels:new Uint8ClampedArray(0);return output;
}
export async function exportSelectionAction(doc:PixelDocument,plan:SelectionActionPlan){
 if(plan.baseline!==encodeProject(doc,false))throw new Error('Selection export source changed. Prepare again.');
 if(plan.options.kind!=='export-png'&&plan.options.kind!=='export-project')throw new Error('Choose a selection export format.');
 const fresh=prepareSelectionAction(doc,plan.rect,plan.options),png=plan.options.kind==='export-png';
 const bytes=png?await encodeNativePng(fresh.width,fresh.height,fresh.pixels):new TextEncoder().encode(encodeProject(selectionProject(doc,fresh)));
 if(plan.baseline!==encodeProject(doc,false))throw new Error('Selection export source changed during encoding. Prepare again.');
 return {bytes,mime:png?'image/png':'application/json',extension:png?'png':'ezpix'};
}
