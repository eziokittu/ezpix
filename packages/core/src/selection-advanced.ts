import type {Selection,Point} from './toolkit.js';
import {validateSelectionMask} from './selection-mask.js';
import {encodeNativePng,decodeNativePng} from './native-png.js';
export type MaskCombine='replace'|'union'|'subtract'|'intersect'|'xor';
export type AdvancedMaskOperation=
 |{kind:'wand'|'colour';seed:Point;tolerance:number;channels:'rgba'|'rgb';connectivity:4|8}
 |{kind:'alpha';min:number;max:number}
 |{kind:'polygon'|'lasso';points:Point[]}
 |{kind:'brush';points:Point[];size:number;shape:'square'|'round';erase:boolean}
 |{kind:'shape';shape:'rectangle'|'ellipse'|'diamond';x:number;y:number;width:number;height:number}
 |{kind:'morphology';mode:'grow'|'shrink'|'border'|'open'|'close';radius:number;connectivity:4|8}
 |{kind:'holes';connectivity:4|8}
 |{kind:'components';mode:'largest'|'seed'|'size';seed:Point;min:number;max:number;connectivity:4|8};
const integer=(n:number,min:number,max:number)=>Number.isInteger(n)&&n>=min&&n<=max;
function check(s:Selection){validateSelectionMask(s);const {canvasWidth:w,canvasHeight:h,rect:r}=s;if(![w,h].every(n=>integer(n,1,256))||![r.x,r.y].every(n=>integer(n,0,255))||r.x+r.width>w||r.y+r.height>h||!(s.baseline instanceof Uint8ClampedArray)||s.baseline.length!==w*h*4)throw new Error('Invalid selection source.');}
function point(p:Point,w:number,h:number){if(!p||!integer(p.x,0,w-1)||!integer(p.y,0,h-1))throw new Error('Points must be whole pixels inside the selection.');}
function neighbours(i:number,w:number,h:number,c:4|8,visit:(j:number)=>void){const x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&(c===8||!dx||!dy)&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)visit(i+dy*w+dx);}
function connectivity(c:number){if(c!==4&&c!==8)throw new Error('Connectivity must be 4 or 8.');}
/** O(N) component enumeration, each pixel queued at most once. */
function components(mask:Uint8Array,w:number,h:number,c:4|8){const seen=new Uint8Array(mask.length),queue=new Uint32Array(mask.length),groups:number[][]=[];for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;let a=0,b=1;queue[0]=start;seen[start]=1;const group:number[]=[];while(a<b){const i=queue[a++];group.push(i);neighbours(i,w,h,c,j=>{if(mask[j]&&!seen[j]){seen[j]=1;queue[b++]=j;}});}groups.push(group);}return groups;}
function morph(src:Uint8Array,w:number,h:number,r:number,c:4|8,grow:boolean){
 // Exact L1/L-infinity distance, with the exterior included as zero for erosion.
 const distance=new Uint16Array(src.length),inf=65535;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;distance[i]=(grow?src[i]:!src[i])?0:grow?inf:Math.min(x+1,y+1,w-x,h-y);if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y){distance[i]=Math.min(distance[i],distance[i-w]+1);if(c===8){if(x)distance[i]=Math.min(distance[i],distance[i-w-1]+1);if(x+1<w)distance[i]=Math.min(distance[i],distance[i-w+1]+1);}}}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x+1<w)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y+1<h){distance[i]=Math.min(distance[i],distance[i+w]+1);if(c===8){if(x)distance[i]=Math.min(distance[i],distance[i+w-1]+1);if(x+1<w)distance[i]=Math.min(distance[i],distance[i+w+1]+1);}}}
 return Uint8Array.from(distance,d=>+(grow?d<=r:d>r));
}
export function combineSelectionMask(s:Selection,operand:Uint8Array,combine:MaskCombine='replace'):Selection{
 check(s);validateSelectionMask({rect:s.rect,mask:operand});if(!['replace','union','subtract','intersect','xor'].includes(combine))throw new Error('Unknown mask combination.');
 const out=operand.map((b,i)=>{const a=s.mask?.[i]??1;return combine==='replace'?b:combine==='union'?+(a||b):combine==='subtract'?+(a&&!b):combine==='intersect'?+(a&&b):a^b;});
 return {...s,rect:{...s.rect},mask:out.every(v=>v===1)?undefined:out};
}
/** Source coordinates are local; tolerance is max absolute encoded-byte difference from seed. */
export function advancedSelectionMask(s:Selection,op:AdvancedMaskOperation,combine:MaskCombine='replace'):Selection{
 check(s);const {width:w,height:h}=s.rect,n=w*h,src=s.mask??new Uint8Array(n).fill(1);let out=new Uint8Array(n);
 if(!op||!['wand','colour','alpha','polygon','lasso','brush','shape','morphology','holes','components'].includes(op.kind))throw new Error('Unknown advanced selection operation.');
 const raw=(i:number)=>((Math.floor(i/w)+s.rect.y)*s.canvasWidth+i%w+s.rect.x)*4;
 switch(op.kind){
 case 'wand':case 'colour':{
  point(op.seed,w,h);connectivity(op.connectivity);if(!integer(op.tolerance,0,255)||!['rgb','rgba'].includes(op.channels))throw new Error('Choose RGB/RGBA and whole tolerance 0-255.');
  const seed=op.seed.y*w+op.seed.x,a=raw(seed),matches=(i:number)=>{const b=raw(i);for(let k=0;k<(op.channels==='rgba'?4:3);k++)if(Math.abs(s.baseline[a+k]-s.baseline[b+k])>op.tolerance)return false;return true;};
  if(op.kind==='colour'){for(let i=0;i<n;i++)out[i]=+matches(i);}else{const queue=new Uint32Array(n),seen=new Uint8Array(n);let head=0,tail=1;queue[0]=seed;seen[seed]=1;while(head<tail){const i=queue[head++];out[i]=1;neighbours(i,w,h,op.connectivity,j=>{if(!seen[j]){seen[j]=1;if(matches(j))queue[tail++]=j;}});}}
  break;
 }
 case 'alpha':if(!integer(op.min,0,255)||!integer(op.max,op.min,255))throw new Error('Alpha range must be ordered whole bytes 0-255.');for(let i=0;i<n;i++){const a=s.baseline[raw(i)+3];out[i]=+(a>=op.min&&a<=op.max);}break;
 case 'polygon':case 'lasso':{
  if(!Array.isArray(op.points)||op.points.length<3||op.points.length>4096||op.points.length*n>16*1024*1024)throw new Error('A closed path needs 3-4096 points within the 16M sample budget.');op.points.forEach(p=>point(p,w,h));
  // Even-odd polygon at pixel centers; vertices are pixel centers. Boundary included.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let inside=false,boundary=false;for(let j=0,k=op.points.length-1;j<op.points.length;k=j++){const a=op.points[k],b=op.points[j],cross=(x-a.x)*(b.y-a.y)-(y-a.y)*(b.x-a.x);if(cross===0&&x>=Math.min(a.x,b.x)&&x<=Math.max(a.x,b.x)&&y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y)){boundary=true;break;}if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}out[y*w+x]=+(inside||boundary);}break;
 }
 case 'brush':{
  if(!Array.isArray(op.points)||!op.points.length||op.points.length>4096||!integer(op.size,1,64)||!['square','round'].includes(op.shape)||typeof op.erase!=='boolean')throw new Error('Brush needs 1-4096 points and size 1-64.');op.points.forEach(p=>point(p,w,h));out=src.slice();
  const stamps=op.points.reduce((a,p,i)=>a+(i?Math.max(Math.abs(p.x-op.points[i-1].x),Math.abs(p.y-op.points[i-1].y))+1:1),0);if(stamps*op.size**2>16*1024*1024)throw new Error('Brush exceeds the 16M stamp-pixel budget.');
  const stamp=(x:number,y:number)=>{const lo=-Math.floor((op.size-1)/2),hi=lo+op.size-1;for(let dy=lo;dy<=hi;dy++)for(let dx=lo;dx<=hi;dx++){if(op.shape==='round'&&(2*dx-lo-hi)**2+(2*dy-lo-hi)**2>op.size**2)continue;if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)out[(y+dy)*w+x+dx]=+!op.erase;}};
  stamp(op.points[0].x,op.points[0].y);for(let j=1;j<op.points.length;j++){let {x,y}=op.points[j-1];const b=op.points[j],dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let err=dx+dy;for(;;){stamp(x,y);if(x===b.x&&y===b.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}}break;
 }
 case 'shape':{
  if(!['rectangle','ellipse','diamond'].includes(op.shape)||!integer(op.x,0,w-1)||!integer(op.y,0,h-1)||!integer(op.width,1,w-op.x)||!integer(op.height,1,h-op.y))throw new Error('Shape bounds must fit inside selection.');for(let y=op.y;y<op.y+op.height;y++)for(let x=op.x;x<op.x+op.width;x++){const dx=2*(x-op.x)+1-op.width,dy=2*(y-op.y)+1-op.height;out[y*w+x]=+(op.shape==='rectangle'||(op.shape==='ellipse'?dx*dx*op.height**2+dy*dy*op.width**2<=op.width**2*op.height**2:Math.abs(dx)*op.height+Math.abs(dy)*op.width<=op.width*op.height));}break;
 }
 case 'morphology':{
  connectivity(op.connectivity);if(!integer(op.radius,1,256)||!['grow','shrink','border','open','close'].includes(op.mode))throw new Error('Morphology needs radius 1-256 and a valid mode.');const step=(m:Uint8Array,g:boolean)=>morph(m,w,h,op.radius,op.connectivity,g),inner=op.mode==='border'?step(src,false):undefined;out=op.mode==='grow'?step(src,true):op.mode==='shrink'?step(src,false):op.mode==='border'?src.map((v,i)=>+(v&&!inner![i])):op.mode==='open'?step(step(src,false),true):step(step(src,true),false);break;
 }
 case 'holes':{
  connectivity(op.connectivity);out=src.slice();for(const g of components(src.map(v=>1-v),w,h,op.connectivity))if(!g.some(i=>i%w===0||i%w===w-1||i<w||i>=n-w))for(const i of g)out[i]=1;break;
 }
 case 'components':{
  connectivity(op.connectivity);point(op.seed,w,h);if(!['largest','seed','size'].includes(op.mode)||!integer(op.min,1,n)||!integer(op.max,op.min,n))throw new Error('Component size range must fit selection.');const groups=components(src,w,h,op.connectivity),largest=groups.reduce<number[]>((a,b)=>b.length>a.length?b:a,[]),seed=op.seed.y*w+op.seed.x;for(const g of groups)if(op.mode==='largest'?g===largest:op.mode==='seed'?g.includes(seed):g.length>=op.min&&g.length<=op.max)for(const i of g)out[i]=1;break;
 }
 }
 return combineSelectionMask(s,out,combine);
}
export function selectionMaskBounds(s:Selection){check(s);const w=s.rect.width,h=s.rect.height;let x=w,y=h,right=-1,bottom=-1;for(let i=0;i<w*h;i++)if(!s.mask||s.mask[i]){x=Math.min(x,i%w);y=Math.min(y,Math.floor(i/w));right=Math.max(right,i%w);bottom=Math.max(bottom,Math.floor(i/w));}return right<0?null:{x:s.rect.x+x,y:s.rect.y+y,width:right-x+1,height:bottom-y+1};}
export function tightenSelectionMask(s:Selection):Selection{const rect=selectionMaskBounds(s);if(!rect)throw new Error('Empty membership has no tight bounds.');const mask=new Uint8Array(rect.width*rect.height);for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++)mask[y*rect.width+x]=s.mask?.[(y+rect.y-s.rect.y)*s.rect.width+x+rect.x-s.rect.x]??1;return {...s,rect,mask:mask.every(v=>v===1)?undefined:mask};}
/** Session-local, dimensions-bound mask history and four reusable slots, no artwork. */
export class SelectionMaskSession{
 private undo:Uint8Array[]=[];private redo:Uint8Array[]=[];private slots=new Map<number,{name:string;width:number;height:number;mask:Uint8Array}>();
 constructor(readonly width:number,readonly height:number){if(![width,height].every(n=>integer(n,1,256)))throw new Error('Invalid session dimensions.');}
 private copy(m?:Uint8Array){validateSelectionMask({rect:{x:0,y:0,width:this.width,height:this.height},mask:m});return m?.slice()??new Uint8Array(this.width*this.height).fill(1);}
 record(before:Uint8Array|undefined,after:Uint8Array|undefined){const a=this.copy(before),b=this.copy(after);if(a.every((v,i)=>v===b[i]))return false;this.undo.push(a);if(this.undo.length>32)this.undo.shift();this.redo=[];return true;}
 back(current?:Uint8Array){const c=this.copy(current),m=this.undo.pop();if(m)this.redo.push(c);return m;}
 forward(current?:Uint8Array){const c=this.copy(current),m=this.redo.pop();if(m)this.undo.push(c);return m;}
 get canUndo(){return this.undo.length>0;}get canRedo(){return this.redo.length>0;}
 save(slot:number,name:string,mask?:Uint8Array){if(!integer(slot,1,4)||typeof name!=='string'||!name.trim()||name.trim().length>80)throw new Error('Choose slot 1-4 and name 1-80 characters.');this.slots.set(slot,{name:name.trim(),width:this.width,height:this.height,mask:this.copy(mask)});}
 load(slot:number){const value=this.slots.get(slot);if(!value)throw new Error('Mask slot is empty.');return {...value,mask:value.mask.slice()};}
}
export class SelectionMaskLibrary{
 private slots=new Map<number,{name:string;width:number;height:number;mask:Uint8Array}>();
 save(slot:number,name:string,s:Selection){check(s);if(!integer(slot,1,4)||typeof name!=='string'||!name.trim()||name.trim().length>80)throw new Error('Choose slot 1-4 and name 1-80 characters.');this.slots.set(slot,{name:name.trim(),width:s.rect.width,height:s.rect.height,mask:s.mask?.slice()??new Uint8Array(s.rect.width*s.rect.height).fill(1)});}
 load(slot:number,s:Selection,combine:MaskCombine='replace'){check(s);const v=this.slots.get(slot);if(!v)throw new Error('Mask slot is empty.');if(v.width!==s.rect.width||v.height!==s.rect.height)throw new Error('Saved mask dimensions must match current bounds.');return combineSelectionMask(s,v.mask,combine);}
 clear(slot:number){this.slots.delete(slot);}
 names(){return [...this.slots].map(([slot,v])=>({slot,name:v.name,width:v.width,height:v.height}));}
}
export async function exportSelectionMaskPng(s:Selection){check(s);const p=new Uint8ClampedArray(s.rect.width*s.rect.height*4);for(let i=0;i<p.length/4;i++)p.set([s.mask?.[i]??1?255:0,s.mask?.[i]??1?255:0,s.mask?.[i]??1?255:0,255],i*4);return encodeNativePng(s.rect.width,s.rect.height,p);}
export async function importSelectionMaskPng(s:Selection,bytes:Uint8Array,combine:MaskCombine='replace'){check(s);if(!(bytes instanceof Uint8Array)||bytes.length>1024*1024)throw new Error('Mask PNG exceeds 1 MiB.');const raw=await decodeNativePng(bytes,s.rect.width,s.rect.height),mask=new Uint8Array(s.rect.width*s.rect.height);for(let i=0;i<mask.length;i++){const a=i*4,v=raw[a];if((v!==0&&v!==255)||raw[a+1]!==v||raw[a+2]!==v||raw[a+3]!==255)throw new Error('Mask PNG must be opaque black/white at exact selection dimensions.');mask[i]=+(v===255);}return combineSelectionMask(s,mask,combine);}
