import type {LargeRect} from './large-canvas.js';

export interface LargeMask {rect:LargeRect;bits:Uint8Array}
export type LargeMaskCombine='replace'|'add'|'subtract'|'intersect'|'xor';
export const MASK_PIXELS=1024*1024;
function checkRect(r:LargeRect,width=10240,height=10240){if(!r||![r.x,r.y,r.width,r.height,width,height].every(Number.isInteger)||r.x<0||r.y<0||r.width<1||r.height<1||r.x+r.width>width||r.y+r.height>height||r.width*r.height>MASK_PIXELS)throw Error('Use a binary selection inside the canvas, up to one megapixel.');}
export function validateLargeMask(mask:LargeMask,width=10240,height=10240):void{
 const r=mask?.rect;
 checkRect(r,width,height);if(!(mask.bits instanceof Uint8Array)||mask.bits.length!==r.width*r.height||mask.bits.some(v=>v>1))throw Error('Use binary selection bytes matching its bounds.');
}
export function cloneLargeMask(mask:LargeMask):LargeMask{validateLargeMask(mask);return{rect:{...mask.rect},bits:Uint8Array.from(mask.bits)};}
export function largeMaskShape(rect:LargeRect,shape:'rectangle'|'ellipse'|'diamond'|'polygon',points:{x:number;y:number}[]=[]):LargeMask{
 // Validate the rectangle before allocating its plane.
 checkRect(rect);if(!['rectangle','ellipse','diamond','polygon'].includes(shape))throw Error('Unknown selection shape.');
 if(shape==='polygon'&&(!Array.isArray(points)||points.length<3||points.length>256||points.some(p=>!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=rect.width||p.y>=rect.height)||points.length*rect.width*rect.height>32*MASK_PIXELS))throw Error('Use 3-256 local polygon points within 32 million edge visits.');
 const {width:w,height:h}=rect,bits=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=(x+.5-w/2)/(w/2),ny=(y+.5-h/2)/(h/2);let inside=shape==='rectangle'||shape==='ellipse'&&nx*nx+ny*ny<=1||shape==='diamond'&&Math.abs(nx)+Math.abs(ny)<=1;if(shape==='polygon'){inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y+.5)!==(b.y>y+.5)&&x+.5<(b.x-a.x)*(y+.5-a.y)/(b.y-a.y)+a.x)inside=!inside;}}bits[y*w+x]=inside?1:0;}
 return {rect:{...rect},bits};
}

export function largeMaskCombine(a:LargeMask,b:LargeMask,mode:LargeMaskCombine):LargeMask{
 validateLargeMask(a);validateLargeMask(b);if(!['replace','add','subtract','intersect','xor'].includes(mode))throw Error('Unknown mask combination.');if(mode==='replace')return cloneLargeMask(b);
 const r=mode==='add'||mode==='xor'?{x:Math.min(a.rect.x,b.rect.x),y:Math.min(a.rect.y,b.rect.y),width:0,height:0}:{...a.rect};if(mode==='add'||mode==='xor'){r.width=Math.max(a.rect.x+a.rect.width,b.rect.x+b.rect.width)-r.x;r.height=Math.max(a.rect.y+a.rect.height,b.rect.y+b.rect.height)-r.y;}checkRect(r);
 const out:LargeMask={rect:r,bits:new Uint8Array(r.width*r.height)},at=(m:LargeMask,x:number,y:number)=>x>=m.rect.x&&y>=m.rect.y&&x<m.rect.x+m.rect.width&&y<m.rect.y+m.rect.height?m.bits[(y-m.rect.y)*m.rect.width+x-m.rect.x]:0;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){const av=at(a,x+r.x,y+r.y),bv=at(b,x+r.x,y+r.y);out.bits[y*r.width+x]=mode==='add'?av|bv:mode==='subtract'?av&Number(!bv):mode==='intersect'?av&bv:av^bv;}return out;
}
export function largeMaskMorph(mask:LargeMask,operation:'invert'|'grow'|'shrink'|'edge',radius=1):LargeMask{
 validateLargeMask(mask);if(!['invert','grow','shrink','edge'].includes(operation)||!Number.isInteger(radius)||radius<1||radius>16)throw Error('Use a mask radius from 1 to 16.');
 const out=cloneLargeMask(mask),{width:w,height:h}=mask.rect;let bits=out.bits;
 if(operation==='invert'){bits.forEach((v,i)=>bits[i]=1-v);return out;}
 for(let step=0;step<radius;step++){const next=new Uint8Array(bits.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,v=[bits[i],x?bits[i-1]:0,x+1<w?bits[i+1]:0,y?bits[i-w]:0,y+1<h?bits[i+w]:0];next[i]=operation==='grow'?Number(v.some(Boolean)):Number(v.every(Boolean));}bits=next;}
 out.bits=operation==='edge'?mask.bits.map((v,i)=>v&&!bits[i]?1:0):bits;return out;
}
function flood(bits:Uint8Array,w:number,h:number,seeds:number[],eligible:(i:number)=>boolean,eight=false){const queue=new Int32Array(bits.length);let head=0,tail=0;for(const i of seeds)if(!bits[i]&&eligible(i)){bits[i]=1;queue[tail++]=i;}while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||!eight&&Math.abs(dx)+Math.abs(dy)!==1)continue;const nx=x+dx,ny=y+dy,n=ny*w+nx;if(nx>=0&&ny>=0&&nx<w&&ny<h&&!bits[n]&&eligible(n)){bits[n]=1;queue[tail++]=n;}}}return bits;}
export function largeMaskComponent(mask:LargeMask,x:number,y:number,holes=false):LargeMask{
 validateLargeMask(mask);const {width:w,height:h}=mask.rect;if(!holes&&(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=w||y>=h))throw Error('Pick a component inside the selection window.');const out=cloneLargeMask(mask),seen=new Uint8Array(w*h);
 if(holes){const seeds:number[]=[];for(let i=0;i<w;i++)seeds.push(i,(h-1)*w+i);for(let j=0;j<h;j++)seeds.push(j*w,j*w+w-1);flood(seen,w,h,seeds,i=>!mask.bits[i]);out.bits=mask.bits.map((v,i)=>v||!seen[i]?1:0);}else out.bits=flood(seen,w,h,[y*w+x],i=>!!mask.bits[i]);return out;
}
export function largeMaskWand(rect:LargeRect,pixels:Uint8ClampedArray,x:number,y:number,tolerance=0,mode:'four'|'eight'|'global'='four'):LargeMask{
 checkRect(rect);if(!(pixels instanceof Uint8ClampedArray)||pixels.length!==rect.width*rect.height*4||![x,y,tolerance].every(Number.isInteger)||x<0||y<0||x>=rect.width||y>=rect.height||tolerance<0||tolerance>255||!['four','eight','global'].includes(mode))throw Error('Invalid bounded wand settings.');
 const seed=(y*rect.width+x)*4,eligible=(i:number)=>[0,1,2,3].every(k=>Math.abs(pixels[i*4+k]-pixels[seed+k])<=tolerance),bits=new Uint8Array(rect.width*rect.height);if(mode==='global')bits.forEach((_,i)=>bits[i]=Number(eligible(i)));else flood(bits,rect.width,rect.height,[y*rect.width+x],eligible,mode==='eight');return{rect:{...rect},bits};
}
export function encodeLargeMask(mask:LargeMask){validateLargeMask(mask);const runs:number[]=[];let value=0,count=0;for(const bit of mask.bits){if(bit===value)count++;else{runs.push(count);value=bit;count=1;}}runs.push(count);const text=JSON.stringify({kind:'ezpix-selection',version:1,rect:mask.rect,runs});if(text.length>3*MASK_PIXELS)throw Error('Selection file exceeds 3 MiB.');return text;}
export function decodeLargeMask(text:string):LargeMask{
 if(typeof text!=='string'||text.length>3*MASK_PIXELS)throw Error('Selection file exceeds 3 MiB.');const v=JSON.parse(text);if(v?.kind!=='ezpix-selection'||v.version!==1)throw Error('Unknown selection format.');checkRect(v.rect);const length=v.rect.width*v.rect.height;if(!Array.isArray(v.runs)||v.runs.length>length+1)throw Error('Invalid selection runs.');let total=0;for(let i=0;i<v.runs.length;i++){const n=v.runs[i];if(!Number.isInteger(n)||n<0||i>0&&n===0||n>length-total)throw Error('Invalid selection runs.');total+=n;}if(total!==length)throw Error('Selection runs must match bounds.');const bits=new Uint8Array(length);let offset=0;v.runs.forEach((n:number,i:number)=>{if(i%2)bits.fill(1,offset,offset+n);offset+=n;});return{rect:{...v.rect},bits};
}
export class LargeSelection{
 private value:LargeMask|null=null;private undo: (LargeMask|null)[]=[];private redo:(LargeMask|null)[]=[];private slots=new Map<number,LargeMask>();private version=0;
 get revision(){return this.version;}
 get current(){return this.value?cloneLargeMask(this.value):null;}get canUndo(){return this.undo.length>0;}get canRedo(){return this.redo.length>0;}
 set(mask:LargeMask|null){const next=mask?cloneLargeMask(mask):null;if((next?encodeLargeMask(next):'')===(this.value?encodeLargeMask(this.value):''))return false;this.undo.push(this.value);if(this.undo.length>16)this.undo.shift();this.value=next;this.redo=[];this.version++;return true;}
 undoSelection(){if(!this.undo.length)return false;this.redo.push(this.value);this.value=this.undo.pop()!;this.version++;return true;}
 redoSelection(){if(!this.redo.length)return false;this.undo.push(this.value);this.value=this.redo.pop()!;this.version++;return true;}
 save(slot:number){if(!Number.isInteger(slot)||slot<1||slot>4||!this.value)throw Error('Select membership and a slot from 1 to 4.');this.slots.set(slot,cloneLargeMask(this.value));}
 load(slot:number){if(!Number.isInteger(slot)||slot<1||slot>4||!this.slots.has(slot))throw Error('Selection slot is empty.');return this.set(this.slots.get(slot)!);}
}


