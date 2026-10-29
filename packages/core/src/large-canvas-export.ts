import {writeNativeZip} from './native-zip.js';
import {LARGE_MAX,largeCompositeTile,cloneLargeProject,validateLargeProject,type LargeProject} from './large-canvas.js';
// Stream scanlines through deflate; never construct a full 400 MiB RGBA buffer.
export async function exportLargePng(source:LargeProject,frameId=source.activeFrameId):Promise<Blob>{
 const d=cloneLargeProject(source);d.activeFrameId=frameId;validateLargeProject(d);
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,d.width);view.setUint32(4,d.height);header[8]=8;header[9]=6;
 function chunk(type:string,data:Uint8Array){const out=new Uint8Array(data.length+12),v=new DataView(out.buffer);v.setUint32(0,data.length);out.set([...type].map(c=>c.charCodeAt(0)),4);out.set(data,8);let crc=0xffffffff;for(const b of out.subarray(4,-4)){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}v.setUint32(out.length-4,(crc^0xffffffff)>>>0);return out;}
 let y=0,band=-1;const cache=new Map<number,Uint8ClampedArray>();function rowBytes(){const current=Math.floor(y/64);if(current!==band){band=current;cache.clear();}const out=new Uint8Array(d.width*4);for(let x=0;x<d.width;x+=64){const tx=x/64;if(!cache.has(tx))cache.set(tx,largeCompositeTile(d,tx,band));out.set(cache.get(tx)!.subarray((y%64)*256,(y%64)*256+Math.min(64,d.width-x)*4),x*4);}y++;return out;}
 const input=new ReadableStream<Uint8Array<ArrayBuffer>>({pull(controller){if(y===d.height){controller.close();return;}const row=new Uint8Array(d.width*4+1);row.set(rowBytes(),1);controller.enqueue(row);}}),reader=input.pipeThrough(new CompressionStream('deflate')).getReader(),parts:BlobPart[]=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header)];
 let total=0;while(true){const {done,value}=await reader.read();if(done)break;if((total+=value.length)>24*1024*1024){await reader.cancel();throw Error('PNG output exceeds 24 MiB.');}parts.push(chunk('IDAT',value));}parts.push(chunk('IEND',new Uint8Array()));return new Blob(parts,{type:'image/png'});
}

export function largeShape(kind:'line'|'rectangle'|'ellipse',a:{x:number;y:number},b:{x:number;y:number}){
 if(!['line','rectangle','ellipse'].includes(kind)||![a.x,a.y,b.x,b.y].every(n=>Number.isInteger(n)&&n>=0&&n<LARGE_MAX))throw new Error('Invalid large shape.');const out:{x:number;y:number}[]=[];
 if(kind==='line'){let {x,y}=a;const dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let error=dx+dy;for(;;){out.push({x,y});if(x===b.x&&y===b.y)break;const e=2*error;if(e>=dy){error+=dy;x+=sx;}if(e<=dx){error+=dx;y+=sy;}}return out;}
 const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
 if(kind==='rectangle'){for(let x=x0;x<=x1;x++)out.push({x,y:y0},{x,y:y1});for(let y=y0+1;y<y1;y++)out.push({x:x0,y},{x:x1,y});return out;}
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2;if(!rx||!ry)return largeShape('line',a,b);
 for(let x=x0;x<=x1;x++){const d=ry*Math.sqrt(Math.max(0,1-((x-cx)/rx)**2));out.push({x,y:Math.round(cy-d)},{x,y:Math.round(cy+d)});}for(let y=y0;y<=y1;y++){const d=rx*Math.sqrt(Math.max(0,1-((y-cy)/ry)**2));out.push({x:Math.round(cx-d),y},{x:Math.round(cx+d),y});}return out;
}

export async function exportLargeFrames(source:LargeProject):Promise<Blob>{
 if(source.width*source.height*source.frames.length>16*1024*1024)throw Error('Animation ZIP is limited to 16 megapixels across all frames. Export a selected PNG or crop the canvas.');
 const d=cloneLargeProject(source),files=new Map<string,Uint8Array>();let total=0;for(let i=0;i<d.frames.length;i++){const pixels=new Uint8Array(await(await exportLargePng(d,d.frames[i].id)).arrayBuffer());if((total+=pixels.length)>15*1024*1024)throw Error('Animation ZIP exceeds 15 MiB of PNG files.');files.set(`frame-${String(i+1).padStart(3,'0')}.png`,pixels);}
 files.set('animation.json',new TextEncoder().encode(JSON.stringify({format:'ezpix-tiled-frames',version:1,width:d.width,height:d.height,frames:d.frames.map((f,i)=>({file:`frame-${String(i+1).padStart(3,'0')}.png`,duration:f.duration}))})));return new Blob([new Uint8Array(writeNativeZip(files))],{type:'application/zip'});
}
