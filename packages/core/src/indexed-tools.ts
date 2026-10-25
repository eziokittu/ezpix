import {copyIndexedCel,type IndexedCel} from './indexed-cel.js';
import {activeLayer,type PixelDocument} from './document.js';
import {layerEditable} from './groups.js';
import {validateIndexedDocument,refreshIndexedCaches} from './indexed-document.js';
import {brushOffsets,type Brush} from './brush.js';
import {drawingPath,type DrawingPoint} from './drawing.js';
import {shapePoints,type Point,type Shape} from './toolkit.js';

export interface IndexedPressure {size:boolean;density:boolean;minimum:number;curve:'linear'|'soft'|'firm'}
export interface IndexedBrush extends Brush {
 slot:number;secondary:number;mode:'paint'|'dither'|'shade'|'replace'|'ramp'|'spray'|'stamp';density:number;shadeSteps:number;
 mirrorX:boolean;mirrorY:boolean;wrapX:boolean;wrapY:boolean;alphaLock:boolean;
 pixelPerfect:boolean;stabilization:number;spacing:number;
 pressure?:IndexedPressure;originX?:number;originY?:number;replaceSlot?:number;ramp?:number[];rampWrap?:boolean;seed?:number;stamp?:IndexedCel;stampTransparent?:boolean;
}
export type IndexedToolOperation=
 |{kind:'indexed-tool';action:'stroke';points:DrawingPoint[];brush:IndexedBrush;erase:boolean}
 |{kind:'indexed-tool';action:'flood';point:Point;slot:number;connectivity?:4|8;global?:boolean}
 |{kind:'indexed-tool';action:'shape';shape:Shape;a:Point;b:Point;filled:boolean;slot:number;size?:number;tip?:'square'|'circle'}
 |{kind:'indexed-tool';action:'transform';transform:'flip-x'|'flip-y'|'rotate-180'|'rotate-cw'|'rotate-ccw'|'offset';x:number;y:number;wrap:boolean}
 |{kind:'indexed-tool';action:'remove-slot';slot:number}
 |{kind:'indexed-tool';action:'prune-slots'};
export function defaultIndexedBrush(slot=0,secondary=0):IndexedBrush{return {slot,secondary,size:1,shape:'square',mode:'paint',density:50,shadeSteps:1,mirrorX:false,mirrorY:false,wrapX:false,wrapY:false,alphaLock:false,pixelPerfect:false,stabilization:0,spacing:1};}
/** Original slot table is part of the stamp, never inferred from expanded RGBA. */
export function copyIndexedStamp(doc:PixelDocument,input:IndexedCel):IndexedCel {
 const stamp=copyIndexedCel(input);if(!doc.indexed||stamp.width>32||stamp.height>32)throw new Error('Indexed stamps need indexed storage and 1-32 pixels per axis.');
 if(JSON.stringify(stamp.palette)!==JSON.stringify(doc.indexed.palette)||stamp.transparentIndex!==doc.indexed.transparentIndex)throw new Error('Indexed stamp requires the identical ordered slot table and transparent role. Capture or import again after palette changes.');return stamp;
}
/** Integer hash anchored to the destination coordinate; no randomness or stroke-order dependence. */
function spraySample(index:number,seed:number){let n=(Math.imul(index+1,0x9e3779b1)^seed)>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
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
  const b=o.brush;slot(b.slot);slot(b.secondary);if(typeof o.erase!=='boolean'||!['paint','dither','shade','replace','ramp','spray','stamp'].includes(b.mode)||![b.mirrorX,b.mirrorY,b.wrapX,b.wrapY,b.alphaLock,b.pixelPerfect].every(n=>typeof n==='boolean')||!Number.isInteger(b.density)||b.density<0||b.density>100||!Number.isInteger(b.shadeSteps)||b.shadeSteps< -16||b.shadeSteps>16)throw new Error('Invalid indexed brush settings.');
  const whole=(n:number,a:number,z:number)=>Number.isInteger(n)&&n>=a&&n<=z;
  if(!whole(b.originX??0,-256,256)||!whole(b.originY??0,-256,256)||!whole(b.seed??1,0,0xffffffff)||b.rampWrap!==undefined&&typeof b.rampWrap!=='boolean'||b.stampTransparent!==undefined&&typeof b.stampTransparent!=='boolean')throw new Error('Invalid indexed origin, seed or brush flags.');
  if(b.mode==='replace')slot(b.replaceSlot??-1);
  if(b.mode==='ramp'){if(!Array.isArray(b.ramp)||b.ramp.length<1||b.ramp.length>256||new Set(b.ramp).size!==b.ramp.length)throw new Error('Indexed ramp needs 1-256 distinct existing slots in order.');b.ramp.forEach(slot);}
  const pressure=b.pressure;if(pressure===null||pressure!==undefined&&typeof pressure!=='object')throw new Error('Invalid indexed pressure settings.');if(pressure&&(![pressure.size,pressure.density].every(v=>typeof v==='boolean')||!whole(pressure.minimum,0,100)||!['linear','soft','firm'].includes(pressure.curve)))throw new Error('Invalid indexed pressure settings.');
  if(pressure&&(pressure.size||pressure.density)&&(!['paint','dither','spray'].includes(b.mode)||pressure.density&&!['dither','spray'].includes(b.mode)))throw new Error('Indexed pressure size supports paint/dither/spray; density supports dither/spray only.');
  const anchors=drawingPath(o.points,w,h,b),tip=brushOffsets(b),stamp=b.mode==='stamp'?copyIndexedStamp(doc,b.stamp!):undefined;
  const offsets=stamp?Array.from({length:stamp.width*stamp.height},(_,i)=>({x:i%stamp.width-Math.floor((stamp.width-1)/2),y:Math.floor(i/stamp.width)-Math.floor((stamp.height-1)/2),index:i})):tip.map(p=>({...p,index:0}));
  if(anchors.length*offsets.length*(b.mirrorX?2:1)*(b.mirrorY?2:1)>8*1024*1024)throw new Error('Indexed stroke exceeds the 8M footprint-visit budget.');
  if(o.erase&&v.transparentIndex===null)throw new Error('Add a transparent indexed slot before erasing.');const visited=new Uint8Array(w*h),matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  for(const p of anchors){
   const input=p.pressure??1,curve=pressure?.curve==='soft'?Math.sqrt(input):pressure?.curve==='firm'?input*input:input,factor=pressure?(pressure.minimum+(100-pressure.minimum)*curve)/100:1;
   const density=pressure?.density?Math.floor(b.density*factor+.5):b.density,dabs=pressure?.size?brushOffsets({...b,size:Math.max(1,Math.floor(b.size*factor+.5))}).map(d=>({...d,index:0})):offsets;
   for(const d of dabs){
   if(stamp&&!b.stampTransparent&&stamp.indices[d.index]===stamp.transparentIndex)continue;
   let x=p.x+d.x,y=p.y+d.y;if(b.wrapX)x=wrap(x,w);if(b.wrapY)y=wrap(y,h);if(x<0||y<0||x>=w||y>=h)continue;
   for(const px of b.mirrorX?[x,w-1-x]:[x])for(const py of b.mirrorY?[y,h-1-y]:[y]){
    const i=py*w+px;if(visited[i])continue;visited[i]=1;const old=before[i];if(b.alphaLock&&old===v.transparentIndex)continue;
    if(b.mode==='spray'&&spraySample(i,b.seed??1)%100>=density)continue;
    let next:number;
    if(o.erase)next=v.transparentIndex!;
    else if(stamp)next=stamp.indices[d.index];
    else if(b.mode==='replace'){if(old!==b.replaceSlot)continue;next=b.slot;}
    else if(b.mode==='ramp'){const at=b.ramp!.indexOf(old);if(at<0)continue;const to=at+b.shadeSteps;next=b.ramp![b.rampWrap?wrap(to,b.ramp!.length):Math.max(0,Math.min(b.ramp!.length-1,to))];}
    else if(b.mode==='dither')next=matrix[wrap(py-(b.originY??0),4)*4+wrap(px-(b.originX??0),4)]*100<density*16?b.slot:b.secondary;
    else if(b.mode==='shade'){if(old===v.transparentIndex)continue;next=Math.max(0,Math.min(v.palette.length-1,old+b.shadeSteps));}
    else next=b.slot;
    if(b.alphaLock&&v.palette[next][3]!==v.palette[old][3])continue;pixels[i]=next;
   }
  }}
 }else if(o.action==='flood'){
  point(o.point);slot(o.slot);const connectivity=o.connectivity??4,global=o.global??false;if(![4,8].includes(connectivity)||typeof global!=='boolean')throw new Error('Indexed fill requires four/eight connectivity and a Boolean global flag.');
  const start=o.point.y*w+o.point.x,target=before[start];if(target!==o.slot){
   if(global){for(let i=0;i<pixels.length;i++)if(before[i]===target)pixels[i]=o.slot;}
   else{const queue=[start];pixels[start]=o.slot;for(let at=0;at<queue.length;at++){const i=queue[at],x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||connectivity===4&&dx&&dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(pixels[n]===target){pixels[n]=o.slot;queue.push(n);}}}}
  }
 }else if(o.action==='shape'){
  point(o.a);point(o.b);slot(o.slot);if(typeof o.filled!=='boolean')throw new Error('Shape fill must be Boolean.');const offsets=o.filled?[{x:0,y:0}]:brushOffsets({size:o.size??1,shape:o.tip??'square'});for(const p of shapePoints(o.shape,o.a,o.b,o.filled))for(const d of offsets){const x=p.x+d.x,y=p.y+d.y;if(x>=0&&y>=0&&x<w&&y<h)pixels[y*w+x]=o.slot;}
 }else if(o.action==='transform'){
  if(!['flip-x','flip-y','rotate-180','rotate-cw','rotate-ccw','offset'].includes(o.transform)||typeof o.wrap!=='boolean'||![o.x,o.y].every(n=>Number.isInteger(n)&&n>=-256&&n<=256))throw new Error('Invalid indexed cel transform.');
  if(['rotate-cw','rotate-ccw'].includes(o.transform)&&w!==h)throw new Error('Quarter-turn indexed cel rotation requires a square canvas.');if(o.transform==='offset'&&!o.wrap&&v.transparentIndex===null)throw new Error('Non-wrapped offset needs a transparent slot.');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sx=x,sy=y;if(o.transform==='flip-x')sx=w-1-x;else if(o.transform==='flip-y')sy=h-1-y;else if(o.transform==='rotate-180'){sx=w-1-x;sy=h-1-y;}else if(o.transform==='rotate-cw'){sx=y;sy=h-1-x;}else if(o.transform==='rotate-ccw'){sx=w-1-y;sy=x;}else{sx=x-o.x;sy=y-o.y;if(o.wrap){sx=wrap(sx,w);sy=wrap(sy,h);}}pixels[y*w+x]=sx<0||sy<0||sx>=w||sy>=h?v.transparentIndex!:before[sy*w+sx];}
 }else throw new Error('Unknown indexed tool.');
 for(const id of Object.keys(c))if(c[id]===before)c[id]=pixels;refreshIndexedCaches(doc);
}
