import {activeLayer,rasterCel,linkedFrames,encodeProject,composite,type PixelDocument,type RGBA} from './document.js';
import {layerEditable} from './groups.js';
import {brushOffsets,type BrushShape} from './brush.js';
import {encodeNativePng,decodeNativePng} from './native-png.js';
import {validateSelectionMask} from './selection-mask.js';
import type {Point,Selection} from './toolkit.js';
export interface DrawingPoint extends Point {pressure?:number}
export interface BrushDynamics {size:boolean;opacity:boolean;minimum:number;curve:'linear'|'soft'|'firm'}
export interface DrawingStamp {width:number;height:number;pixels:Uint8ClampedArray}
export interface DrawingOptions {dynamics?:BrushDynamics;mode:'paint'|'dither'|'spray'|'shade'|'blur'|'sharpen';primary:RGBA;secondary:RGBA;size:number;shape:BrushShape;blend:'replace'|'over';alphaLock:boolean;pixelPerfect:boolean;stabilization:number;spacing:number;wrapX:boolean;wrapY:boolean;mirrorX:boolean;mirrorY:boolean;density:number;seed:number;shadeSteps:number;stamp?:DrawingStamp;stampMode:'rgba'|'mask';stampTransparent:boolean}
export interface DrawingPlan {readonly baseline:string;readonly path:readonly Readonly<DrawingPoint>[];readonly options:Readonly<DrawingOptions>;readonly pixels:Uint8ClampedArray;readonly preview:Uint8ClampedArray;readonly changedPixels:number;readonly historyBytes:number;readonly linked:number}
const whole=(n:number,a:number,b:number)=>Number.isInteger(n)&&n>=a&&n<=b;
function rgba(c:RGBA){if(!Array.isArray(c)||c.length!==4||!c.every(n=>whole(n,0,255)))throw new Error('Drawing colours need four whole bytes.');return Object.freeze([...c]) as unknown as RGBA;}
export function copyDrawingStamp(s:DrawingStamp):DrawingStamp{if(!s||!whole(s.width,1,32)||!whole(s.height,1,32)||!(s.pixels instanceof Uint8ClampedArray)||s.pixels.length!==s.width*s.height*4)throw new Error('Custom stamps need 1-32 pixels per axis and exact RGBA.');return {width:s.width,height:s.height,pixels:s.pixels.slice()};}
export function defaultDrawingOptions(primary:RGBA=[57,255,20,255],secondary:RGBA=[0,0,0,255]):DrawingOptions{return {mode:'paint',primary:[...primary],secondary:[...secondary],size:1,shape:'square',blend:'replace',alphaLock:false,pixelPerfect:false,stabilization:0,spacing:1,wrapX:false,wrapY:false,mirrorX:false,mirrorY:false,density:50,seed:1,shadeSteps:1,stampMode:'mask',stampTransparent:false};}
export function validateDrawingOptions(o:DrawingOptions):Readonly<DrawingOptions>{
 if(!o||!['paint','dither','spray','shade','blur','sharpen'].includes(o.mode)||!['replace','over'].includes(o.blend)||!['rgba','mask'].includes(o.stampMode)||!whole(o.stabilization,0,16)||!whole(o.spacing,1,32)||!whole(o.density,0,100)||!whole(o.seed,0,0xffffffff)||!whole(o.shadeSteps,-16,16)||![o.alphaLock,o.pixelPerfect,o.wrapX,o.wrapY,o.mirrorX,o.mirrorY,o.stampTransparent].every(v=>typeof v==='boolean'))throw new Error('Invalid advanced drawing settings.');
 if(o.dynamics&&(![o.dynamics.size,o.dynamics.opacity].every(v=>typeof v==='boolean')||!whole(o.dynamics.minimum,0,100)||!['linear','soft','firm'].includes(o.dynamics.curve)))throw new Error('Invalid pressure dynamics.');
 if(o.dynamics&&(o.dynamics.size||o.dynamics.opacity)&&!['paint','dither','spray'].includes(o.mode))throw new Error('Pressure dynamics support paint, dither and spray.');
 brushOffsets(o);const stamp=o.stamp?copyDrawingStamp(o.stamp):undefined,privatePixels=stamp?.pixels;
 return Object.freeze({...o,dynamics:o.dynamics?Object.freeze({...o.dynamics}):undefined,primary:rgba(o.primary),secondary:rgba(o.secondary),stamp:stamp?Object.freeze({width:stamp.width,height:stamp.height,get pixels(){return privatePixels!.slice();}}):undefined});
}
/** Integer moving-average stabilizer, connected Bresenham sampling, corner cleanup, then spacing. */
export function drawingPath(path:readonly DrawingPoint[],w:number,h:number,options:Pick<DrawingOptions,'stabilization'|'pixelPerfect'|'spacing'>):DrawingPoint[]{
 if(!whole(w,1,256)||!whole(h,1,256)||!Array.isArray(path)||!path.length||path.length>4096||!path.every(p=>p&&whole(p.x,0,w-1)&&whole(p.y,0,h-1)&&(p.pressure===undefined||Number.isFinite(p.pressure)&&p.pressure>=0&&p.pressure<=1))||!whole(options.stabilization,0,16)||!whole(options.spacing,1,32)||typeof options.pixelPerfect!=='boolean')throw new Error('Stroke needs 1-4096 whole-pixel anchors inside the canvas.');
 const pressured=path.some(p=>p.pressure!==undefined),filtered:DrawingPoint[]=[],window:DrawingPoint[]=[];let sumX=0,sumY=0;
 for(const p of path){window.push(p);sumX+=p.x;sumY+=p.y;if(window.length>options.stabilization+1){const old=window.shift()!;sumX-=old.x;sumY-=old.y;}const q={x:Math.floor(sumX/window.length+.5),y:Math.floor(sumY/window.length+.5),...(pressured?{pressure:window.reduce((a,p)=>a+(p.pressure??1),0)/window.length}:{})};if(!filtered.length||q.x!==filtered[filtered.length-1].x||q.y!==filtered[filtered.length-1].y||q.pressure!==filtered[filtered.length-1].pressure)filtered.push(q);}
 const connected:DrawingPoint[]=[];
 for(let j=0;j<filtered.length;j++){const a=filtered[Math.max(0,j-1)],b=filtered[j];let {x,y}=a;const dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let err=dx+dy;for(;;){const last=connected[connected.length-1];if(!last||last.x!==x||last.y!==y)connected.push({x,y,...(pressured?{pressure:(a.pressure??1)+((b.pressure??1)-(a.pressure??1))*(Math.max(dx,-dy)?Math.max(Math.abs(x-a.x),Math.abs(y-a.y))/Math.max(dx,-dy):1)}:{})});else if(pressured&&dx===0&&dy===0)last.pressure=b.pressure;if(connected.length>65536)throw new Error('Stroke exceeds 65536 connected samples.');if(x===b.x&&y===b.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}}
 const clean:DrawingPoint[]=[];for(const p of connected){if(options.pixelPerfect&&clean.length>=2){const a=clean[clean.length-2],b=clean[clean.length-1];if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1&&Math.abs(b.x-p.x)+Math.abs(b.y-p.y)===1&&Math.abs(a.x-p.x)===1&&Math.abs(a.y-p.y)===1)clean.pop();}clean.push(p);}
 return clean.filter((_,i)=>i%options.spacing===0||i===clean.length-1);
}
/** Straight encoded-RGBA source-over with exact integer rounding and alpha-zero identity. */
export function compositeDrawingPixel(dst:RGBA,src:RGBA,blend:'replace'|'over',alphaLock=false):RGBA{
 rgba(dst);rgba(src);if(!['replace','over'].includes(blend)||typeof alphaLock!=='boolean')throw new Error('Invalid drawing composition.');if(alphaLock&&dst[3]===0)return [...dst];let out:[number,number,number,number];
 if(blend==='replace')out=[...src];else if(src[3]===0)out=[...dst];else{const den=src[3]*255+dst[3]*(255-src[3]);out=[0,0,0,Math.floor((den+127)/255)];for(let c=0;c<3;c++)out[c]=Math.floor((src[c]*src[3]*255+dst[c]*dst[3]*(255-src[3])+Math.floor(den/2))/den);}
 if(alphaLock)out[3]=dst[3];return out;
}
const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function hash(x:number,y:number,anchor:number,seed:number){let n=(seed^Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b)^Math.imul(anchor+1,0xc2b2ae35))>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;}
export function prepareDrawing(doc:PixelDocument,path:readonly DrawingPoint[],options:DrawingOptions,historyBudget=8*1024*1024):DrawingPlan{
 const o=validateDrawingOptions(options),anchors=drawingPath(path,doc.width,doc.height,o),layer=activeLayer(doc);if(!layerEditable(doc,layer))throw new Error('Show and unlock the selected layer and groups before drawing.');
 const stamp=o.stamp?copyDrawingStamp(o.stamp):undefined,offsets=stamp?Array.from({length:stamp.width*stamp.height},(_,i)=>({x:i%stamp.width-Math.floor((stamp.width-1)/2),y:Math.floor(i/stamp.width)-Math.floor((stamp.height-1)/2),index:i})):brushOffsets(o).map(p=>({...p,index:0}));
 if(anchors.length*offsets.length*(o.mirrorX?2:1)*(o.mirrorY?2:1)>8*1024*1024)throw new Error('Stroke exceeds the 8M footprint-visit budget.');
 const w=doc.width,h=doc.height,before=rasterCel(doc,layer),pixels=before.slice(),visited=new Uint8Array(w*h),palette=doc.palette.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]),wrap=(v:number,n:number)=>(v%n+n)%n;
 const sample=(x:number,y:number)=>{const a=((o.wrapY?wrap(y,h):Math.max(0,Math.min(h-1,y)))*w+(o.wrapX?wrap(x,w):Math.max(0,Math.min(w-1,x))))*4;return [...before.subarray(a,a+4)] as unknown as RGBA;};
 let changedPixels=0;
 anchors.forEach((p,anchor)=>{const pressure=p.pressure??1,curve=o.dynamics?.curve==='soft'?Math.sqrt(pressure):o.dynamics?.curve==='firm'?pressure*pressure:pressure,factor=o.dynamics?(o.dynamics.minimum+(100-o.dynamics.minimum)*curve)/100:1,dabs=o.dynamics?.size&&!stamp?brushOffsets({...o,size:Math.max(1,Math.floor(o.size*factor+.5))}).map(v=>({...v,index:0})):offsets;if(factor===0&&o.dynamics?.opacity)return;for(const offset of dabs){let x=p.x+offset.x,y=p.y+offset.y;if(o.wrapX)x=wrap(x,w);if(o.wrapY)y=wrap(y,h);if(x<0||x>=w||y<0||y>=h)continue;
  const st=stamp?[...stamp.pixels.subarray(offset.index*4,offset.index*4+4)] as unknown as RGBA:undefined;if(st&&!o.stampTransparent&&st[3]===0)continue;
  for(const px of o.mirrorX?[x,w-1-x]:[x])for(const py of o.mirrorY?[y,h-1-y]:[y]){const index=py*w+px,i=index*4;if(visited[index])continue;if(o.mode==='spray'&&hash(px,py,anchor,o.seed)%100>=o.density)continue;visited[index]=1;const dst=[...before.subarray(i,i+4)] as unknown as RGBA;let ink:[number,number,number,number]=[...o.primary];
   if(o.mode==='dither')ink=[...(bayer[(py%4)*4+px%4]*100<o.density*16?o.primary:o.secondary)];
   if(st){if(o.stampMode==='rgba')ink=[...st];else ink[3]=Math.floor((ink[3]*st[3]+127)/255);}
   if(o.mode==='shade'){if(!dst[3]||o.shadeSteps===0)continue;let best=0,distance=Infinity;palette.forEach((c,j)=>{const d=c.reduce((a,v,k)=>a+(v-dst[k])**2,0);if(d<distance){distance=d;best=j;}});const c=palette[Math.max(0,Math.min(palette.length-1,best+o.shadeSteps))];ink=[c[0],c[1],c[2],dst[3]];}
   if(o.mode==='blur'){let sumA=0;const sum=[0,0,0];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const s=sample(px+dx,py+dy);sumA+=s[3];for(let k=0;k<3;k++)sum[k]+=s[k]*s[3];}ink=[dst[0],dst[1],dst[2],Math.floor((sumA+4)/9)];if(sumA)for(let k=0;k<3;k++)ink[k]=Math.floor((sum[k]+Math.floor(sumA/2))/sumA);}
   if(o.mode==='sharpen'){const ns=[sample(px-1,py),sample(px+1,py),sample(px,py-1),sample(px,py+1)];ink=[...dst];for(let k=0;k<3;k++)ink[k]=Math.max(0,Math.min(255,5*dst[k]-ns.reduce((a,c)=>a+c[k],0)));}
   if(o.dynamics?.opacity)ink[3]=Math.floor(ink[3]*factor+.5);
   const next=[...compositeDrawingPixel(dst,ink,o.blend,o.alphaLock)];if(o.mode==='shade'||o.mode==='sharpen')next[3]=dst[3];if(next.some((v,k)=>v!==dst[k])){pixels.set(next,i);changedPixels++;}
  }
 }});
 const linked=linkedFrames(doc,layer).length,historyBytes=3*pixels.byteLength+256+64*linked;if(changedPixels&&(!Number.isFinite(historyBudget)||historyBytes>historyBudget))throw new Error('Drawing exceeds the undo memory budget.');
 const preview=composite({...doc,layers:doc.layers.map(l=>l.id===layer.id?{...l,cels:{...l.cels,[doc.activeFrameId]:pixels}}:l)});
 return Object.freeze({baseline:encodeProject(doc,false),path:Object.freeze(path.map(p=>Object.freeze({...p}))),options:o,pixels,preview,changedPixels,historyBytes,linked});
}
export function selectionDrawingStamp(s:Selection):DrawingStamp{validateSelectionMask(s);if(s.rect.width>32||s.rect.height>32||!(s.baseline instanceof Uint8ClampedArray)||s.baseline.length!==s.canvasWidth*s.canvasHeight*4||!whole(s.rect.x,0,s.canvasWidth-s.rect.width)||!whole(s.rect.y,0,s.canvasHeight-s.rect.height))throw new Error('Select a region at most 32 by 32 for a custom stamp.');const pixels=new Uint8ClampedArray(s.rect.width*s.rect.height*4);for(let y=0;y<s.rect.height;y++)for(let x=0;x<s.rect.width;x++)if(!s.mask||s.mask[y*s.rect.width+x]){const i=((y+s.rect.y)*s.canvasWidth+x+s.rect.x)*4;pixels.set(s.baseline.subarray(i,i+4),(y*s.rect.width+x)*4);}return {width:s.rect.width,height:s.rect.height,pixels};}
export async function exportDrawingStamp(s:DrawingStamp){const copy=copyDrawingStamp(s);return encodeNativePng(copy.width,copy.height,copy.pixels);}
export async function importDrawingStamp(bytes:Uint8Array){if(!(bytes instanceof Uint8Array)||bytes.length<33||bytes.length>256*1024)throw new Error('Stamp PNG must be at most 256 KiB.');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=v.getUint32(16),h=v.getUint32(20);if(!whole(w,1,32)||!whole(h,1,32))throw new Error('Stamp PNG dimensions must be 1-32 pixels.');return {width:w,height:h,pixels:await decodeNativePng(bytes,w,h)};}
export class DrawingStampLibrary{
 private slots=new Map<number,{name:string;stamp:DrawingStamp}>();
 save(slot:number,name:string,stamp:DrawingStamp){if(!whole(slot,1,4)||typeof name!=='string'||!name.trim()||name.trim().length>80)throw new Error('Choose stamp slot 1-4 and name 1-80 characters.');this.slots.set(slot,{name:name.trim(),stamp:copyDrawingStamp(stamp)});}
 load(slot:number){const v=this.slots.get(slot);if(!v)throw new Error('Stamp slot is empty.');return {name:v.name,stamp:copyDrawingStamp(v.stamp)};}
 clear(slot:number){this.slots.delete(slot);}names(){return [...this.slots].map(([slot,v])=>({slot,name:v.name}));}
}
