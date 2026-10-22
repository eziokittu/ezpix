import {copySelectionMask,innerSelectionMask} from './selection-mask.js';
import {activeLayer,rasterCel,linkedFrames,encodeProject,composite,type PixelDocument,type RGBA} from './document.js';
import {layerEditable} from './groups.js';
import type {Rect} from './toolkit.js';

export type SelectionPaintOptions={kind:'fill';color:RGBA}|{kind:'stroke';color:RGBA;thickness:number};
export interface SelectionPaintPlan {
 readonly mask?:Uint8Array;readonly baseline:string;readonly rect:Readonly<Rect>;readonly options:Readonly<SelectionPaintOptions>;
 readonly pixels:Uint8ClampedArray;readonly preview:Uint8ClampedArray;
 readonly changedPixels:number;readonly linked:number;readonly historyBytes:number;
}
/** Replaces full RGBA inside the original rectangle. Strokes are inset square bands. */
export function prepareSelectionPaint(doc:PixelDocument,rect:Rect,options:SelectionPaintOptions,historyBudget=8*1024*1024,mask?:Uint8Array):SelectionPaintPlan {
 if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>doc.width||rect.y+rect.height>doc.height)throw new Error('Selection rectangle must fit inside the canvas.');
 if(!options||!['fill','stroke'].includes(options.kind)||!Array.isArray(options.color)||options.color.length!==4||!Array.from(options.color).every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw new Error('Choose four whole RGBA values from 0 to 255.');
 if(options.kind==='stroke'&&(!Number.isInteger(options.thickness)||options.thickness<1||options.thickness>256))throw new Error('Stroke thickness must be a whole number from 1 to 256.');
 const layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer and its groups before painting a selection.');
 const r=Object.freeze({x:rect.x,y:rect.y,width:rect.width,height:rect.height}),color=Object.freeze([...options.color]) as unknown as RGBA,settings=Object.freeze(options.kind==='fill'?{kind:'fill' as const,color}:{kind:'stroke' as const,color,thickness:options.thickness});
 const inputMask=copySelectionMask(r,mask);
 const before=rasterCel(doc,layer),linked=linkedFrames(doc,layer).length;
 const paintedMask=settings.kind==='stroke'?innerSelectionMask(r,inputMask,settings.thickness):inputMask;
 const included=(x:number,y:number)=>!paintedMask||!!paintedMask[y*r.width+x];
 let changedPixels=0;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(included(x,y)){const i=((r.y+y)*doc.width+r.x+x)*4;if(color.some((v,c)=>before[i+c]!==v))changedPixels++;}
 const historyBytes=3*doc.width*doc.height*4+256+linked*64;
 if(changedPixels&&(!Number.isFinite(historyBudget)||historyBytes>historyBudget))throw new Error('Selection paint exceeds the undo memory budget.');
 const pixels=before.slice();
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)if(included(x,y))pixels.set(color,((r.y+y)*doc.width+r.x+x)*4);
 const preview=composite({...doc,layers:doc.layers.map(l=>l.id===layer.id?{...l,cels:{...l.cels,[doc.activeFrameId]:pixels}}:l)});
 return Object.freeze({get mask(){return inputMask?.slice();},baseline:encodeProject(doc,false),rect:r,options:settings,pixels,preview,changedPixels,linked,historyBytes});
}
