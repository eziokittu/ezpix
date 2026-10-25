// Sparse single-surface workspace. Dense animation documents retain their own limits.
export const LARGE_MAX=10240, TILE_SIZE=64, LARGE_TILE_LIMIT=1024;
export type LargeProject={kind:'ezpix-tiled';version:1;width:number;height:number;name:string;background:number[];tiles:Map<string,Uint8ClampedArray>};
export function createLargeCanvas(width:number,height:number,name='Untitled',background=[0,0,0,0]):LargeProject{
 if(![width,height].every(n=>Number.isInteger(n)&&n>=1&&n<=LARGE_MAX)||!Array.isArray(background)||background.length!==4||!background.every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw new Error('Canvas dimensions must be 1-10240px; use valid RGBA.');
 return {kind:'ezpix-tiled',version:1,width,height,name:String(name).slice(0,80),background:[...background],tiles:new Map()};
}
export class LargeCanvasEditor{
 document:LargeProject;private undoStack:Map<string,Uint8ClampedArray|null>[]=[];private redoStack:Map<string,Uint8ClampedArray|null>[]=[];private pending=new Map<string,Uint8ClampedArray|null>();
 constructor(document:LargeProject){this.document=document;}
 paint(x:number,y:number,rgba:number[],size=1){const d=this.document;if(![x,y,size].every(Number.isInteger)||size<1||size>64||rgba.length!==4||!rgba.every(n=>Number.isInteger(n)&&n>=0&&n<=255))throw new Error('Invalid brush.');
 const a=Math.floor((size-1)/2);for(let py=Math.max(0,y-a);py<Math.min(d.height,y-a+size);py++)for(let px=Math.max(0,x-a);px<Math.min(d.width,x-a+size);px++){
 const key=Math.floor(px/64)+','+Math.floor(py/64);let tile=d.tiles.get(key);if(!tile){if(rgba.every((c,i)=>c===d.background[i]))continue;if(d.tiles.size>=LARGE_TILE_LIMIT)throw new Error('Painted tile budget reached (16 MiB). Save your project before continuing.');}
 if(!this.pending.has(key))this.pending.set(key,tile?.slice()??null);
 if(!tile){tile=new Uint8ClampedArray(64*64*4);if(d.background.some(n=>n))for(let i=0;i<tile.length;i+=4)tile.set(d.background,i);d.tiles.set(key,tile);}tile.set(rgba,((py%64)*64+px%64)*4);
 }}
 commit(){if(!this.pending.size)return false;this.undoStack.push(this.pending);this.pending=new Map();this.redoStack=[];while(this.undoStack.length>32||this.undoStack.reduce((n,s)=>n+s.size*16384,0)>16*1024*1024)this.undoStack.shift();return true;}
 private swap(from:Map<string,Uint8ClampedArray|null>[],to:Map<string,Uint8ClampedArray|null>[]){const snapshot=from.pop();if(!snapshot)return false;const inverse=new Map<string,Uint8ClampedArray|null>();for(const [key,tile] of snapshot){inverse.set(key,this.document.tiles.get(key)?.slice()??null);if(tile)this.document.tiles.set(key,tile);else this.document.tiles.delete(key);}to.push(inverse);return true;}
 undo(){this.commit();return this.swap(this.undoStack,this.redoStack);}redo(){if(this.pending.size){this.commit();return false;}return this.swap(this.redoStack,this.undoStack);}
 row(y:number){const d=this.document,out=new Uint8Array(d.width*4);if(d.background.some(n=>n))for(let i=0;i<out.length;i+=4)out.set(d.background,i);for(let x=0;x<d.width;x+=64){const tile=d.tiles.get(Math.floor(x/64)+','+Math.floor(y/64));if(tile)out.set(tile.subarray((y%64)*256,(y%64)*256+Math.min(64,d.width-x)*4),x*4);}return out;}
}
export function encodeLargeProject(d:LargeProject){return JSON.stringify({...d,tiles:[...d.tiles].map(([key,pixels])=>[key,btoa(Array.from(pixels,n=>String.fromCharCode(n)).join(''))])});}
export function decodeLargeProject(text:string):LargeProject{
 if(typeof text!=='string'||text.length>24*1024*1024)throw new Error('Tiled project exceeds 24 MiB.');const raw=JSON.parse(text);if(raw.kind!=='ezpix-tiled'||raw.version!==1||!Array.isArray(raw.tiles)||raw.tiles.length>LARGE_TILE_LIMIT||typeof raw.name!=='string')throw new Error('Unsupported tiled project.');const d=createLargeCanvas(raw.width,raw.height,raw.name,raw.background);
 for(const pair of raw.tiles){if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||typeof pair[1]!=='string'||pair[1].length!==21848||!/^\d{1,3},\d{1,3}$/.test(pair[0]))throw new Error('Invalid tile.');const [x,y]=pair[0].split(',').map(Number);if(x*64>=d.width||y*64>=d.height||d.tiles.has(pair[0])||pair[0]!==x+','+y)throw new Error('Invalid tile position.');const bytes=atob(pair[1]);if(bytes.length!==16384)throw new Error('Invalid tile data.');d.tiles.set(pair[0],Uint8ClampedArray.from(bytes,c=>c.charCodeAt(0)));}return d;
}
// Stream scanlines through deflate; never construct a full 400 MiB RGBA buffer.
export async function exportLargePng(d:LargeProject):Promise<Blob>{
 const editor=new LargeCanvasEditor(d),header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,d.width);view.setUint32(4,d.height);header[8]=8;header[9]=6;
 function chunk(type:string,data:Uint8Array){const out=new Uint8Array(data.length+12),v=new DataView(out.buffer);v.setUint32(0,data.length);out.set([...type].map(c=>c.charCodeAt(0)),4);out.set(data,8);let crc=0xffffffff;for(const b of out.subarray(4,-4)){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}v.setUint32(out.length-4,(crc^0xffffffff)>>>0);return out;}
 let y=0;const input=new ReadableStream<Uint8Array<ArrayBuffer>>({pull(controller){if(y===d.height){controller.close();return;}const row=new Uint8Array(d.width*4+1);row.set(editor.row(y++),1);controller.enqueue(row);}}),reader=input.pipeThrough(new CompressionStream('deflate')).getReader(),parts:BlobPart[]=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header)];
 while(true){const {done,value}=await reader.read();if(done)break;parts.push(chunk('IDAT',value));}parts.push(chunk('IEND',new Uint8Array()));return new Blob(parts,{type:'image/png'});
}

export function largeShape(kind:'line'|'rectangle'|'ellipse',a:{x:number;y:number},b:{x:number;y:number}){
 if(!['line','rectangle','ellipse'].includes(kind)||![a.x,a.y,b.x,b.y].every(n=>Number.isInteger(n)&&n>=0&&n<LARGE_MAX))throw new Error('Invalid large shape.');const out:{x:number;y:number}[]=[];
 if(kind==='line'){let {x,y}=a;const dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let error=dx+dy;for(;;){out.push({x,y});if(x===b.x&&y===b.y)break;const e=2*error;if(e>=dy){error+=dy;x+=sx;}if(e<=dx){error+=dx;y+=sy;}}return out;}
 const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
 if(kind==='rectangle'){for(let x=x0;x<=x1;x++)out.push({x,y:y0},{x,y:y1});for(let y=y0+1;y<y1;y++)out.push({x:x0,y},{x:x1,y});return out;}
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2;if(!rx||!ry)return largeShape('line',a,b);
 for(let x=x0;x<=x1;x++){const d=ry*Math.sqrt(Math.max(0,1-((x-cx)/rx)**2));out.push({x,y:Math.round(cy-d)},{x,y:Math.round(cy+d)});}for(let y=y0;y<=y1;y++){const d=rx*Math.sqrt(Math.max(0,1-((y-cy)/ry)**2));out.push({x:Math.round(cx-d),y},{x:Math.round(cx+d),y});}return out;
}
