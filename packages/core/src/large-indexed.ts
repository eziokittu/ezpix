import {cloneLargeProject,createLargeCanvas,type LargeProject,type LargeLayer,type LargeRect,type TileCel} from './large-canvas.js';
import {validateLargeMask,type LargeMask} from './large-mask.js';

export interface LargeIndexedMode {palette:number[][];transparentIndex:number}
export type LargeIndexedEdit = {kind:'to-indexed'|'to-rgba'}
 | {kind:'palette-set';index:number;color:number[]}
 | {kind:'palette-add';color:number[]}
 | {kind:'palette-remove';index:number}
 | {kind:'palette-reorder';mapping:number[]}
 | {kind:'background-index';index:number}
 | {kind:'index-fill'|'index-clear'|'index-stroke';rect:LargeRect;index:number;size?:number;mask?:LargeMask};
export function validateLargeIndexed(d:LargeProject){
 const mode=d.indexed;if(!mode){if(d.layers.some(l=>l.backgroundIndex!==undefined))throw Error('Index backgrounds require indexed mode.');return;}
 if(!Array.isArray(mode.palette)||mode.palette.length<1||mode.palette.length>256||Array.from(mode.palette).some(c=>!Array.isArray(c)||c.length!==4||Array.from(c).some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('Use 1-256 RGBA palette entries.');
 if(!Number.isInteger(mode.transparentIndex)||mode.transparentIndex<0||mode.transparentIndex>=mode.palette.length||mode.palette[mode.transparentIndex][3]!==0)throw Error('Designate a palette slot with zero alpha as transparent.');
 for(const l of d.layers){if(!Number.isInteger(l.backgroundIndex)||!mode.palette[l.backgroundIndex!])throw Error('Invalid indexed background.');if(l.background.some(v=>v!==0))throw Error('Indexed projects use slot backgrounds, not RGBA backgrounds.');}
}
export function largeIndexColor(d:LargeProject,index:number):number[]{const c=d.indexed?.palette[index];if(!Number.isInteger(index)||index<0||!c||index>=d.indexed!.palette.length)throw Error('Choose a valid palette slot.');return c;}
export function largeBackgroundIndex(d:LargeProject,l:LargeLayer,x:number,y:number){if(!d.indexed)throw Error('Use an indexed project.');const r=l.backgroundBounds;return x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height?l.backgroundIndex!:d.indexed.transparentIndex;}
export function largeRawIndex(d:LargeProject,l:LargeLayer,frame:string,x:number,y:number){if(!d.indexed)throw Error('Use an indexed project.');if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=d.width||y>=d.height||!l.cels[frame])throw Error('Choose an index pixel inside an existing frame.');const p=l.cels[frame].get(Math.floor(x/64)+','+Math.floor(y/64));return p?p[(y%64)*64+x%64]:largeBackgroundIndex(d,l,x,y);}
export function createLargeIndexed(width:number,height:number,palette:number[][],transparentIndex:number,backgroundIndex=transparentIndex,name='Indexed artwork'){
 const d=createLargeCanvas(width,height,name);d.indexed={palette:palette.map(c=>[...c]),transparentIndex};d.layers[0].backgroundIndex=backgroundIndex;validateLargeIndexed(d);return d;
}
function mapTiles(d:LargeProject,transform:(p:Uint8ClampedArray)=>Uint8ClampedArray){
 const seen=new Map<Uint8ClampedArray,Uint8ClampedArray>(),cels=new Set<TileCel>();
 for(const l of d.layers)for(const f of d.frames){const c=l.cels[f.id];if(cels.has(c))continue;cels.add(c);for(const [key,p]of [...c].sort(([a],[b])=>a.localeCompare(b))){if(!seen.has(p))seen.set(p,transform(p));c.set(key,seen.get(p)!);}}
}
function checkedColor(color:number[]){if(!Array.isArray(color)||color.length!==4||Array.from(color).some(v=>!Number.isInteger(v)||v<0||v>255))throw Error('Use four RGBA palette bytes.');return [...color];}
export function changeLargeIndexed(d:LargeProject,edit:LargeIndexedEdit){
 if(edit?.kind==='to-indexed'){
  if(d.indexed)return;const palette:number[][]=[[0,0,0,0]],slots=new Map<string,number>([['0,0,0,0',0]]),slot=(color:number[])=>{const key=color.join(',');let i=slots.get(key);if(i===undefined){if(palette.length===256)throw Error('Exact indexed conversion exceeds 256 RGBA entries. Reduce colours first.');i=palette.length;palette.push([...color]);slots.set(key,i);}return i;};
  for(const l of d.layers){l.backgroundIndex=slot(l.background);l.background=[0,0,0,0];}
  mapTiles(d,p=>{const out=new Uint8ClampedArray(4096);for(let i=0;i<4096;i++)out[i]=slot([...p.subarray(i*4,i*4+4)]);return out;});d.indexed={palette,transparentIndex:0};return;
 }
 if(edit?.kind==='to-rgba'){
  if(d.indexed&&d.indexed.palette[d.indexed.transparentIndex].some(v=>v!==0)&&d.layers.some(l=>l.backgroundBounds.x!==0||l.backgroundBounds.y!==0||l.backgroundBounds.width!==d.width||l.backgroundBounds.height!==d.height))throw Error('RGBA conversion cannot retain hidden RGB in implicit transparent padding. Keep indexed storage or use the reviewed dense bridge within its bounds.');
  if(!d.indexed)return;mapTiles(d,p=>{const out=new Uint8ClampedArray(16384);p.forEach((v,i)=>out.set(largeIndexColor(d,v),i*4));return out;});for(const l of d.layers){l.background=[...largeIndexColor(d,l.backgroundIndex!)];delete l.backgroundIndex;}delete d.indexed;return;
 }
 if(!d.indexed)throw Error('Convert to indexed mode first.');const mode=d.indexed;
 if(edit?.kind==='background-index'){largeIndexColor(d,edit.index);const l=d.layers.find(l=>l.id===d.activeLayerId);if(!l)throw Error('Selected layer is missing.');l.backgroundIndex=edit.index;return;}
 if(edit?.kind==='palette-set'){largeIndexColor(d,edit.index);const c=checkedColor(edit.color);if(edit.index===mode.transparentIndex&&c[3]!==0)throw Error('The transparent slot must keep zero alpha.');mode.palette[edit.index]=c;return;}
 if(edit?.kind==='palette-add'){if(mode.palette.length===256)throw Error('Keep at most 256 palette slots.');mode.palette.push(checkedColor(edit.color));return;}
 if(edit?.kind==='palette-reorder'){
  const m=edit.mapping;if(!Array.isArray(m)||m.length!==mode.palette.length||new Set(m).size!==m.length||m.some(v=>!Number.isInteger(v)||v<0||v>=m.length))throw Error('Supply a complete slot permutation.');
  const palette:number[][]=[];mode.palette.forEach((c,i)=>palette[m[i]]=[...c]);mapTiles(d,p=>Uint8ClampedArray.from(p,v=>m[v]));for(const l of d.layers)l.backgroundIndex=m[l.backgroundIndex!];mode.transparentIndex=m[mode.transparentIndex];mode.palette=palette;return;
 }
 if(edit?.kind==='palette-remove'){
  largeIndexColor(d,edit.index);if(mode.palette.length===1||edit.index===mode.transparentIndex||d.layers.some(l=>l.backgroundIndex===edit.index||[...new Set(Object.values(l.cels))].some(c=>[...c.values()].some(p=>p.includes(edit.index)))))throw Error('Remove only an unused, non-transparent slot.');
  mapTiles(d,p=>Uint8ClampedArray.from(p,v=>v>edit.index?v-1:v));for(const l of d.layers)if(l.backgroundIndex!>edit.index)l.backgroundIndex!--;if(mode.transparentIndex>edit.index)mode.transparentIndex--;mode.palette.splice(edit.index,1);return;
 }
 throw Error('Unknown indexed project operation.');
}
export function indexedGeometry(d:LargeProject,width:number,height:number,dx:number,dy:number){
 const source=cloneLargeProject(d);let allocated=0;
 for(let li=0;li<d.layers.length;li++){const l=d.layers[li],old=source.layers[li],r=old.backgroundBounds,x=Math.max(0,Math.min(width,r.x+dx)),y=Math.max(0,Math.min(height,r.y+dy)),right=Math.max(x,Math.min(width,r.x+r.width+dx)),bottom=Math.max(y,Math.min(height,r.y+r.height+dy));l.backgroundBounds={x,y,width:right-x,height:bottom-y};const seen=new Map<TileCel,TileCel>();
  for(const f of d.frames){const cel=old.cels[f.id];if(seen.has(cel)){l.cels[f.id]=seen.get(cel)!;continue;}const next:TileCel=new Map();seen.set(cel,next);
   for(const [key,p]of cel){const [tx,ty]=key.split(',').map(Number);for(let py=0;py<64;py++)for(let px=0;px<64;px++){const sx=tx*64+px,sy=ty*64+py,nx=sx+dx,ny=sy+dy,value=p[py*64+px];if(sx>=source.width||sy>=source.height||nx<0||ny<0||nx>=width||ny>=height||value===largeBackgroundIndex(source,old,sx,sy))continue;const k=Math.floor(nx/64)+','+Math.floor(ny/64);let tile=next.get(k);if(!tile){if(++allocated>1024)throw Error('Indexed geometry exceeds 1024 tiles.');tile=new Uint8ClampedArray(4096);for(let iy=0;iy<64;iy++)for(let ix=0;ix<64;ix++)tile[iy*64+ix]=largeBackgroundIndex(d,l,Math.floor(nx/64)*64+ix,Math.floor(ny/64)*64+iy);next.set(k,tile);}tile[(ny%64)*64+nx%64]=value;}}
   l.cels[f.id]=next;
  }
 }d.width=width;d.height=height;
}
/** Exact slot wand; RGBA equality, tolerance and duplicate colours never merge slots. */
export function largeIndexWand(d:LargeProject,l:LargeLayer,frame:string,rect:LargeRect,x:number,y:number,mode:'four'|'eight'|'global'):LargeMask{
 if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>d.width||rect.y+rect.height>d.height||rect.width*rect.height>1048576)throw Error('Use a bounded index selection window up to one megapixel.');
 const bits=new Uint8Array(rect.width*rect.height),out={rect:{...rect},bits};validateLargeMask(out,d.width,d.height);if(!['four','eight','global'].includes(mode)||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=rect.width||y>=rect.height)throw Error('Use a seed inside the selection window.');const target=largeRawIndex(d,l,frame,rect.x+x,rect.y+y),matches=(i:number)=>largeRawIndex(d,l,frame,rect.x+i%rect.width,rect.y+Math.floor(i/rect.width))===target;
 if(mode==='global'){for(let i=0;i<bits.length;i++)if(matches(i))bits[i]=1;return out;}const visited=new Uint8Array(bits.length),queue=[y*rect.width+x];visited[queue[0]]=1;
 for(let head=0;head<queue.length;head++){const i=queue[head];if(!matches(i))continue;bits[i]=1;const px=i%rect.width,py=Math.floor(i/rect.width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||mode==='four'&&dx&&dy)continue;const nx=px+dx,ny=py+dy,j=ny*rect.width+nx;if(nx>=0&&ny>=0&&nx<rect.width&&ny<rect.height&&!visited[j]){visited[j]=1;queue.push(j);}}}return out;
}
