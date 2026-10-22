import {activeLayer,rasterCel,linkedFrames,encodeProject,composite,type PixelDocument,type RGBA} from './document.js';
import {layerEditable} from './groups.js';
import type {Rect} from './toolkit.js';
export type SelectionEffectOptions=
 |{kind:'gradient'|'dither-gradient';start:RGBA;end:RGBA;axis:'horizontal'|'vertical'}
 |{kind:'radial';start:RGBA;end:RGBA}
 |{kind:'checker';start:RGBA;end:RGBA;cellWidth:number;cellHeight:number}
 |{kind:'replace';match:RGBA;color:RGBA}
 |{kind:'grayscale'}|{kind:'invert'}
 |{kind:'alpha';percent:number};
export interface SelectionEffectPlan {readonly baseline:string;readonly rect:Readonly<Rect>;readonly options:Readonly<SelectionEffectOptions>;readonly pixels:Uint8ClampedArray;readonly preview:Uint8ClampedArray;readonly changedPixels:number;readonly linked:number;readonly historyBytes:number}
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function color(value:RGBA):RGBA {if(!Array.isArray(value)||value.length!==4||!Array.from(value).every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw new Error('RGBA needs four whole bytes from 0 to 255.');return Object.freeze([...value]) as unknown as RGBA;}
function settings(o:SelectionEffectOptions):Readonly<SelectionEffectOptions>{
 if(!o)throw new Error('Choose a selection operation.');
 if(o.kind==='grayscale'||o.kind==='invert')return Object.freeze({kind:o.kind});
 if(o.kind==='alpha'){if(!Number.isInteger(o.percent)||o.percent<0||o.percent>200)throw new Error('Alpha scale must be a whole percent from 0 to 200.');return Object.freeze({kind:o.kind,percent:o.percent});}
 if(o.kind==='replace')return Object.freeze({kind:o.kind,match:color(o.match),color:color(o.color)});
 if(o.kind==='gradient'||o.kind==='dither-gradient'){if(!['horizontal','vertical'].includes(o.axis))throw new Error('Choose a horizontal or vertical gradient.');return Object.freeze({kind:o.kind,start:color(o.start),end:color(o.end),axis:o.axis});}
 if(o.kind==='radial')return Object.freeze({kind:o.kind,start:color(o.start),end:color(o.end)});
 if(o.kind==='checker'){if(![o.cellWidth,o.cellHeight].every(n=>Number.isInteger(n)&&n>=1&&n<=256))throw new Error('Checker cell dimensions must be whole pixels from 1 to 256.');return Object.freeze({kind:o.kind,start:color(o.start),end:color(o.end),cellWidth:o.cellWidth,cellHeight:o.cellHeight});}
 throw new Error('Unknown selection operation.');
}
/** All arithmetic stays exact below 2^53 within 256px bounds. Encoded RGBA, nearest ties up. */
export function prepareSelectionEffect(doc:PixelDocument,rect:Rect,options:SelectionEffectOptions,historyBudget=8*1024*1024):SelectionEffectPlan {
 if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>doc.width||rect.y+rect.height>doc.height)throw new Error('Selection rectangle must fit inside the canvas.');
 const o=settings(options),r=Object.freeze({x:rect.x,y:rect.y,width:rect.width,height:rect.height}),layer=activeLayer(doc);
 if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer and its groups before applying a selection operation.');
 const before=rasterCel(doc,layer),linked=linkedFrames(doc,layer).length;
 const sample=(x:number,y:number,i:number):RGBA=>{
  const p=[before[i],before[i+1],before[i+2],before[i+3]] as const;
  if(o.kind==='invert')return [255-p[0],255-p[1],255-p[2],p[3]];
  if(o.kind==='grayscale'){const v=Math.floor((77*p[0]+150*p[1]+29*p[2]+128)/256);return [v,v,v,p[3]];}
  if(o.kind==='alpha')return [p[0],p[1],p[2],Math.min(255,Math.floor((p[3]*o.percent+50)/100))];
  if(o.kind==='replace')return o.match.every((v,c)=>v===p[c])?o.color:p;
  if(o.kind==='checker')return (Math.floor(x/o.cellWidth)+Math.floor(y/o.cellHeight))%2?o.end:o.start;
  let numerator:number,denominator:number;
  if(o.kind==='radial'){
   const a=Math.max(1,r.width-1),b=Math.max(1,r.height-1),dx=2*x-(r.width-1),dy=2*y-(r.height-1);
   denominator=a*a*b*b;numerator=Math.min(denominator,dx*dx*b*b+dy*dy*a*a);
  }else{const span=(o.axis==='horizontal'?r.width:r.height)-1;denominator=Math.max(1,span);numerator=span?(o.axis==='horizontal'?x:y):0;}
  if(o.kind==='dither-gradient')return numerator===0?o.start:numerator===denominator?o.end:32*numerator>=(2*BAYER[(y%4)*4+x%4]+1)*denominator?o.end:o.start;
  return o.start.map((v,c)=>Math.floor((2*(v*(denominator-numerator)+o.end[c]*numerator)+denominator)/(2*denominator))) as unknown as RGBA;
 };
 let changedPixels=0;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=((r.y+y)*doc.width+r.x+x)*4;if(sample(x,y,i).some((v,c)=>v!==before[i+c]))changedPixels++;}
 const historyBytes=3*doc.width*doc.height*4+256+linked*64;
 if(changedPixels&&(!Number.isFinite(historyBudget)||historyBytes>historyBudget))throw new Error('Selection operation exceeds the undo memory budget.');
 const pixels=before.slice();for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const i=((r.y+y)*doc.width+r.x+x)*4;pixels.set(sample(x,y,i),i);}
 const preview=composite({...doc,layers:doc.layers.map(l=>l.id===layer.id?{...l,cels:{...l.cels,[doc.activeFrameId]:pixels}}:l)});
 return Object.freeze({baseline:encodeProject(doc,false),rect:r,options:o,pixels,preview,changedPixels,linked,historyBytes});
}
