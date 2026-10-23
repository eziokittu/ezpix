import type {PixelDocument} from './document.js';
import {prepareLayerWorkflow} from './layer-workflows.js';
export interface CelGridRange {firstLayer:number;lastLayer:number;firstFrame:number;lastFrame:number}
export function prepareCelGrid(doc:PixelDocument,range:CelGridRange,target:{layer:number;frame:number}|null,action:'copy'|'move'|'clear'|'unlink'|'hold',budget=8*1024*1024){
 const int=(v:number,a:number,b:number)=>Number.isInteger(v)&&v>=a&&v<=b;
 if(!range||!int(range.firstLayer,0,doc.layers.length-1)||!int(range.lastLayer,range.firstLayer,doc.layers.length-1)||!int(range.firstFrame,0,doc.frames.length-1)||!int(range.lastFrame,range.firstFrame,doc.frames.length-1))throw new Error('Select an in-bounds rectangular layer/frame range.');
 const layers=doc.layers.slice(range.firstLayer,range.lastLayer+1).map(l=>l.id);
 if(['copy','move'].includes(action)){
  if(!target||!int(target.layer,range.lastLayer-range.firstLayer,doc.layers.length-1)||!int(target.frame,0,doc.frames.length-(range.lastFrame-range.firstFrame+1)))throw new Error('The complete destination cel rectangle must fit. Drop its top-left cell inside the grid.');
  return prepareLayerWorkflow(doc,{kind:'cel-transfer',layers,from:range.firstFrame,to:range.lastFrame,targetLayer:target.layer-(range.lastLayer-range.firstLayer),targetFrame:target.frame,move:action==='move',rect:{x:0,y:0,width:doc.width,height:doc.height},x:0,y:0},budget);
 }
 if(!['clear','unlink','hold'].includes(action))throw new Error('Choose a supported cel-grid operation.');
 return prepareLayerWorkflow(doc,{kind:'hold',layers,from:range.firstFrame,to:range.lastFrame,action:action as 'hold'|'unlink'|'clear'},budget);
}
