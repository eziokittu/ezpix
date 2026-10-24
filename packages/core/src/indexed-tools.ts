import {activeLayer,type PixelDocument} from './document.js';
import {layerEditable} from './groups.js';
import {validateIndexedDocument,refreshIndexedCaches} from './indexed-document.js';
import {brushOffsets,type Brush} from './brush.js';
import {drawingPath} from './drawing.js';
import {shapePoints,type Point,type Shape} from './toolkit.js';

export interface IndexedBrush extends Brush {
 slot:number;secondary:number;mode:'paint'|'dither'|'shade';density:number;shadeSteps:number;
 mirrorX:boolean;mirrorY:boolean;wrapX:boolean;wrapY:boolean;alphaLock:boolean;
 pixelPerfect:boolean;stabilization:number;spacing:number;
}
export type IndexedToolOperation=
 |{kind:'indexed-tool';action:'stroke';points:Point[];brush:IndexedBrush;erase:boolean}
 |{kind:'indexed-tool';action:'flood';point:Point;slot:number}
 |{kind:'indexed-tool';action:'shape';shape:Shape;a:Point;b:Point;filled:boolean;slot:number}
 |{kind:'indexed-tool';action:'transform';transform:'flip-x'|'flip-y'|'rotate-180'|'rotate-cw'|'rotate-ccw'|'offset';x:number;y:number;wrap:boolean}
 |{kind:'indexed-tool';action:'remove-slot';slot:number}
 |{kind:'indexed-tool';action:'prune-slots'};
export function defaultIndexedBrush(slot=0,secondary=0):IndexedBrush{return {slot,secondary,size:1,shape:'square',mode:'paint',density:50,shadeSteps:1,mirrorX:false,mirrorY:false,wrapX:false,wrapY:false,alphaLock:false,pixelPerfect:false,stabilization:0,spacing:1};}
export function indexedSlotUsage(doc:PixelDocument){validateIndexedDocument(doc);if(!doc.indexed)throw new Error('Enter indexed storage first.');const counts=new Array<number>(doc.indexed.palette.length).fill(0),seen=new Set<Uint8Array>();for(const c of Object.values(doc.indexed.cels))for(const p of Object.values(c))if(!seen.has(p)){seen.add(p);for(const i of p)counts[i]++;}return counts;}
/** Mutates only a private authored draft. Index identity, rather than expanded RGBA, determines changes. */
export function indexedToolOperation(doc:PixelDocument,o:IndexedToolOperation){
 validateIndexedDocument(doc);const v=doc.indexed;if(!v)throw new Error('Enter indexed storage first.');
 const slot=(n:number)=>{if(!Number.isInteger(n)||n<0||n>=v.palette.length)throw new Error('Choose an existing indexed slot.');return n;};
 const point=(p:Point)=>{if(!p||![p.x,p.y].every(Number.isInteger)||p.x<0||p.y<0||p.x>=doc.width||p.y>=doc.height)throw new Error('Indexed points must fit inside the canvas.');};
 if(o.action==='remove-slot'||o.action==='prune-slots'){
  const counts=indexedSlotUsage(doc);if(o.action==='remove-slot'){slot(o.slot);if(counts[o.slot])throw new Error('Only an unused indexed slot can be removed.');}
  const order=v.palette.map((_,i)=>i).filter(i=>o.action==='remove-slot'?i!==o.slot:counts[i]>0||i===v.transparentIndex);
  if(!order.length)throw new Error('Keep at least one indexed slot.');const inverse=v.palette.map((_,i)=>order.indexOf(i));
  for(const c of Object.values(v.cels)){const seen=new Map<Uint8Array,Uint8Array>();for(const id of Object.keys(c)){const p=c[id];if(!seen.has(p))seen.set(p,p.map(i=>inverse[i]));c[id]=seen.get(p)!;}}
  v.palette=order.map(i=>v.palette[i]);v.transparentIndex=v.transparentIndex===null||!order.includes(v.transparentIndex)?null:inverse[v.transparentIndex];refreshIndexedCaches(doc);return;
 }
 const layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the indexed layer and its parents.');
 const c=v.cels[layer.id],before=c[doc.activeFrameId],pixels=new Uint8Array(before),w=doc.width,h=doc.height,wrap=(n:number,size:number)=>(n%size+size)%size;
 if(o.action==='stroke'){
  const b=o.brush;slot(b.slot);slot(b.secondary);if(typeof o.erase!=='boolean'||!['paint','dither','shade'].includes(b.mode)||![b.mirrorX,b.mirrorY,b.wrapX,b.wrapY,b.alphaLock,b.pixelPerfect].every(n=>typeof n==='boolean')||!Number.isInteger(b.density)||b.density<0||b.density>100||!Number.isInteger(b.shadeSteps)||b.shadeSteps< -16||b.shadeSteps>16)throw new Error('Invalid indexed brush settings.');
  const anchors=drawingPath(o.points,w,h,b),offsets=brushOffsets(b);if(anchors.length*offsets.length*(b.mirrorX?2:1)*(b.mirrorY?2:1)>8*1024*1024)throw new Error('Indexed stroke exceeds the 8M footprint-visit budget.');
  if(o.erase&&v.transparentIndex===null)throw new Error('Add a transparent indexed slot before erasing.');const visited=new Uint8Array(w*h),matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  for(const p of anchors)for(const d of offsets){let x=p.x+d.x,y=p.y+d.y;if(b.wrapX)x=wrap(x,w);if(b.wrapY)y=wrap(y,h);if(x<0||y<0||x>=w||y>=h)continue;for(const px of b.mirrorX?[x,w-1-x]:[x])for(const py of b.mirrorY?[y,h-1-y]:[y]){const i=py*w+px;if(visited[i])continue;visited[i]=1;const old=before[i];if(b.alphaLock&&old===v.transparentIndex)continue;let next=o.erase?v.transparentIndex!:b.mode==='dither'?(matrix[(py%4)*4+px%4]*100<b.density*16?b.slot:b.secondary):b.mode==='shade'?Math.max(0,Math.min(v.palette.length-1,old+b.shadeSteps)):b.slot;if(b.mode==='shade'&&old===v.transparentIndex&&!o.erase)continue;if(b.alphaLock&&v.palette[next][3]!==v.palette[old][3])continue;pixels[i]=next;}}
 }else if(o.action==='flood'){
  point(o.point);slot(o.slot);const start=o.point.y*w+o.point.x,target=before[start];if(target!==o.slot){const queue=[start];pixels[start]=o.slot;for(let at=0;at<queue.length;at++){const i=queue[at];for(const n of [i%w?i-1:-1,i%w<w-1?i+1:-1,i>=w?i-w:-1,i<w*(h-1)?i+w:-1])if(n>=0&&pixels[n]===target){pixels[n]=o.slot;queue.push(n);}}}
 }else if(o.action==='shape'){
  point(o.a);point(o.b);slot(o.slot);if(typeof o.filled!=='boolean')throw new Error('Shape fill must be Boolean.');for(const p of shapePoints(o.shape,o.a,o.b,o.filled))pixels[p.y*w+p.x]=o.slot;
 }else if(o.action==='transform'){
  if(!['flip-x','flip-y','rotate-180','rotate-cw','rotate-ccw','offset'].includes(o.transform)||typeof o.wrap!=='boolean'||![o.x,o.y].every(n=>Number.isInteger(n)&&n>=-256&&n<=256))throw new Error('Invalid indexed cel transform.');
  if(['rotate-cw','rotate-ccw'].includes(o.transform)&&w!==h)throw new Error('Quarter-turn indexed cel rotation requires a square canvas.');if(o.transform==='offset'&&!o.wrap&&v.transparentIndex===null)throw new Error('Non-wrapped offset needs a transparent slot.');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sx=x,sy=y;if(o.transform==='flip-x')sx=w-1-x;else if(o.transform==='flip-y')sy=h-1-y;else if(o.transform==='rotate-180'){sx=w-1-x;sy=h-1-y;}else if(o.transform==='rotate-cw'){sx=y;sy=h-1-x;}else if(o.transform==='rotate-ccw'){sx=w-1-y;sy=x;}else{sx=x-o.x;sy=y-o.y;if(o.wrap){sx=wrap(sx,w);sy=wrap(sy,h);}}pixels[y*w+x]=sx<0||sy<0||sx>=w||sy>=h?v.transparentIndex!:before[sy*w+sx];}
 }else throw new Error('Unknown indexed tool.');
 for(const id of Object.keys(c))if(c[id]===before)c[id]=pixels;refreshIndexedCaches(doc);
}
