import {activeLayer,rasterCel,linkedFrames,encodeProject,decodeProject,createDocument,makeLayer,copyLayer,checkCelBudget,composite,type PixelDocument} from './document.js';
import {layerEditable} from './groups.js';
import {copySelectionMask} from './selection-mask.js';
export interface SelectionPasteOptions {sourceMode:'selection'|'project';frameId:string;layerId:string;destination:'new-layer'|'cel';x:number;y:number;name:string}
export interface SelectionPastePlan {readonly baseline:string;readonly source:string;readonly mask?:Uint8Array;readonly options:Readonly<SelectionPasteOptions>;readonly pixels:Uint8ClampedArray;readonly preview:Uint8ClampedArray;readonly changed:boolean;readonly linked:number;readonly historyBytes:number}
/** Raw source layer/frame only. No source palette, opacity, groups, timing, references or recipe is imported. */
export function prepareSelectionPaste(target:PixelDocument,source:PixelDocument,options:SelectionPasteOptions,historyBudget=8*1024*1024,mask?:Uint8Array):SelectionPastePlan {
 if(!options||!['selection','project'].includes(options.sourceMode)||!['new-layer','cel'].includes(options.destination)||![options.x,options.y].every(Number.isInteger))throw new Error('Choose a source, destination and whole-pixel position.');
 if(options.sourceMode==='selection'&&(source.layers.length!==1||source.frames.length!==1))throw new Error('Selection projects must have exactly one layer and frame. Choose project mode for a larger project.');
 const sourceLayer=source.layers.find(l=>l.id===options.layerId);if(!sourceLayer||!source.frames.some(f=>f.id===options.frameId))throw new Error('Choose a valid source layer and frame.');
 if(options.x<0||options.y<0||options.x+source.width>target.width||options.y+source.height>target.height)throw new Error('The complete source must fit inside the destination canvas. No pixels are clipped.');
 if(typeof options.name!=='string'||!options.name.trim()||options.name.trim().length>80)throw new Error('Paste names need 1-80 characters.');
 const members=copySelectionMask({x:0,y:0,width:source.width,height:source.height},mask);
 const layer=activeLayer(target);if(!layerEditable(target,layer))throw new Error('Show and unlock the destination layer and its groups before pasting.');
 const settings=Object.freeze({sourceMode:options.sourceMode,frameId:options.frameId,layerId:options.layerId,destination:options.destination,x:options.x,y:options.y,name:options.name.trim()});
 if(settings.destination==='new-layer')checkCelBudget(target.width,target.height,target.layers.length+1,target.frames.length);
 const raw=rasterCel(source,sourceLayer,settings.frameId),before=rasterCel(target,layer),linked=settings.destination==='cel'?linkedFrames(target,layer).length:1;
 let changed=settings.destination==='new-layer';
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){if(members&&!members[y*source.width+x])continue;const a=(y*source.width+x)*4,b=((y+settings.y)*target.width+x+settings.x)*4;for(let c=0;c<4;c++)if(raw[a+c]!==before[b+c])changed=true;}
 const retained=new Set(target.layers.flatMap(l=>Object.values(l.cels))),historyBytes=settings.destination==='cel'?3*target.width*target.height*4+256+linked*64:[...retained].reduce((n,p)=>n+p.byteLength,0)+target.width*target.height*4+(2*target.layers.length+1+2*target.frames.length+2*target.groups.length+2*target.tags.length)*256+2048;
 if(changed&&(!Number.isFinite(historyBudget)||historyBytes>historyBudget))throw new Error('Paste exceeds the undo memory budget.');
 const pixels=settings.destination==='cel'?before.slice():new Uint8ClampedArray(target.width*target.height*4);
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){if(members&&!members[y*source.width+x])continue;const a=(y*source.width+x)*4,b=((y+settings.y)*target.width+x+settings.x)*4;pixels.set(raw.subarray(a,a+4),b);}
 const extracted=createDocument(source.width,source.height,source.name);extracted.layers[0].name=sourceLayer.name;extracted.frames[0].duration=source.frames.find(f=>f.id===settings.frameId)!.duration;extracted.layers[0].cels['frame-1']=raw.some(v=>v!==0)?raw.slice():new Uint8ClampedArray(0);extracted.palette=source.palette.slice();
 let layers=target.layers.map(l=>copyLayer(target,l));
 if(settings.destination==='cel')layers.find(l=>l.id===layer.id)!.cels[target.activeFrameId]=pixels;
 else{let n=1;while(target.layers.some(l=>l.id===`layer-${n}`))n++;layers.splice(layers.findIndex(l=>l.id===layer.id)+1,0,makeLayer(target,`layer-${n}`,settings.name,true,Object.fromEntries(target.frames.map(f=>[f.id,f.id===target.activeFrameId?pixels:new Uint8ClampedArray(0)])),{groupId:layer.groupId}));}
 return Object.freeze({baseline:encodeProject(target,false),source:encodeProject(extracted,false),get mask(){return members?.slice();},options:settings,pixels,preview:composite({...target,layers}),changed,linked,historyBytes});
}
/** Snapshot contains only the reviewed raw layer/frame; original source mutations cannot inject pixels. */
export function regenerateSelectionPaste(target:PixelDocument,plan:SelectionPastePlan,historyBudget:number){
 if(!plan||plan.baseline!==encodeProject(target,false))throw new Error('Paste destination changed. Prepare again.');
 const source=decodeProject(plan.source);return prepareSelectionPaste(target,source,{...plan.options,sourceMode:'selection',frameId:source.activeFrameId,layerId:source.activeLayerId},historyBudget,plan.mask);
}
