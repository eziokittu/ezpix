import type {Selection,Transform,Rect} from './toolkit.js';
import {permuteRaster,rotatedSize} from './raster-transform.js';
export type SelectionMaskOperation={kind:'rectangle'|'ellipse'|'diamond'|'invert'|'grow'|'shrink'|'border'|'empty'|'mirror-x'|'mirror-y'|'turn-half'|'shift-left'|'shift-right'|'shift-up'|'shift-down'}|{kind:'union'|'subtract'|'intersect'|'xor';rect:Rect};
/** A transient local binary mask. Undefined means the entire original rectangle. */
export function validateSelectionMask(selection:Pick<Selection,'rect'|'mask'>){
 const {width,height}=selection.rect;
 if(![width,height].every(n=>Number.isInteger(n)&&n>=1&&n<=256))throw new Error('Invalid mask bounds.');
 if(selection.mask!==undefined&&(!(selection.mask instanceof Uint8Array)||selection.mask.length!==width*height||!selection.mask.every(n=>n===0||n===1)))throw new Error('Selection mask must contain one binary byte per source pixel.');
}
export function selectionMaskCount(selection:Pick<Selection,'rect'|'mask'>){validateSelectionMask(selection);return selection.mask?selection.mask.reduce((a,b)=>a+b,0):selection.rect.width*selection.rect.height;}
/** Validate before copying; plans keep this private and expose defensive copies. */
export function copySelectionMask(rect:Rect,mask?:Uint8Array){validateSelectionMask({rect,mask});return mask?.slice();}
/** Inner Manhattan band. Distance to an unselected cell or outside is one at the boundary. */
export function innerSelectionMask(rect:Rect,mask:Uint8Array|undefined,thickness:number):Uint8Array{
 validateSelectionMask({rect,mask});if(!Number.isInteger(thickness)||thickness<1||thickness>256)throw new Error('Stroke thickness must be a whole number from 1 to 256.');
 const {width:w,height:h}=rect,distance=new Uint16Array(w*h),out=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;distance[i]=mask&&!mask[i]?0:Math.min(x+1,y+1,w-x,h-y);if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y)distance[i]=Math.min(distance[i],distance[i-w]+1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y+1<h)distance[i]=Math.min(distance[i],distance[i+w]+1);out[i]=+(distance[i]>0&&distance[i]<=thickness);}
 return out;
}
/** Shape edges use pixel centers, inclusive integer inequalities. Morphology uses four neighbours, outside=0. */
export function editSelectionMask(selection:Selection,operation:SelectionMaskOperation):Selection{
 validateSelectionMask(selection);const {width:w,height:h}=selection.rect,n=w*h;
 if(!operation||!['rectangle','ellipse','diamond','invert','grow','shrink','border','union','subtract','intersect','xor','empty','mirror-x','mirror-y','turn-half','shift-left','shift-right','shift-up','shift-down'].includes(operation.kind))throw new Error('Unknown selection mask operation.');
 let rect:Rect|undefined;
 if(['union','subtract','intersect','xor'].includes(operation.kind)){rect=('rect' in operation)?operation.rect:undefined;if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>w||rect.y+rect.height>h)throw new Error('Mask operand must fit inside the original selection bounds.');}
 const source=selection.mask??new Uint8Array(n).fill(1),out=new Uint8Array(n),at=(x:number,y:number)=>x>=0&&y>=0&&x<w&&y<h?source[y*w+x]:0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,a=source[i],dx=2*x+1-w,dy=2*y+1-h;
  switch(operation.kind){
   case 'empty':out[i]=0;break;
   case 'mirror-x':out[i]=at(w-1-x,y);break;
   case 'mirror-y':out[i]=at(x,h-1-y);break;
   case 'turn-half':out[i]=at(w-1-x,h-1-y);break;
   case 'shift-left':out[i]=at(x+1,y);break;
   case 'shift-right':out[i]=at(x-1,y);break;
   case 'shift-up':out[i]=at(x,y+1);break;
   case 'shift-down':out[i]=at(x,y-1);break;
   case 'rectangle':out[i]=1;break;
   case 'ellipse':out[i]=+(dx*dx*h*h+dy*dy*w*w<=w*w*h*h);break;
   case 'diamond':out[i]=+(Math.abs(dx)*h+Math.abs(dy)*w<=w*h);break;
   case 'invert':out[i]=1-a;break;
   case 'grow':out[i]=+(a||at(x-1,y)||at(x+1,y)||at(x,y-1)||at(x,y+1));break;
   case 'shrink':out[i]=+(a&&at(x-1,y)&&at(x+1,y)&&at(x,y-1)&&at(x,y+1));break;
   case 'border':out[i]=+(a&&!(at(x-1,y)&&at(x+1,y)&&at(x,y-1)&&at(x,y+1)));break;
   default:{const b=+(x>=rect!.x&&y>=rect!.y&&x<rect!.x+rect!.width&&y<rect!.y+rect!.height);out[i]=operation.kind==='union'?+(a||b):operation.kind==='subtract'?+(a&&!b):operation.kind==='intersect'?+(a&&b):a^b;}
  }
 }
 return {...selection,rect:{...selection.rect},mask:out.every(v=>v===1)?undefined:out};
}
/** Exactly the same inverse mapping as RGBA; no interpolation of membership. */
export function transformSelectionMask(selection:Selection,options:Transform):Uint8Array|undefined{
 validateSelectionMask(selection);if(!selection.mask)return undefined;
 const {width:w,height:h}=selection.rect,size=rotatedSize(w,h,options.rotation??0),ow=options.width??size.width,oh=options.height??size.height;
 if(![ow,oh].every(n=>Number.isInteger(n)&&n>=1&&n<=256)||![options.flipX,options.flipY].every(v=>typeof v==='boolean'))throw new Error('Invalid mask transform.');
 return new Uint8Array(permuteRaster(selection.mask,w,h,ow,oh,options.rotation??0,options.flipX,options.flipY,1));
}
