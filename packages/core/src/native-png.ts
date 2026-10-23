// Independent bounded PNG subset for Piskel strips: no browser alpha rounding.
import {concat,deflate,inflate,fail,boundedBytes} from './native-utils.js';
const signature=Uint8Array.of(137,80,78,71,13,10,26,10);
export function crc32(b:Uint8Array){let c=0xffffffff;for(const byte of b){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type:string,data:Uint8Array){const out=new Uint8Array(data.length+12),v=new DataView(out.buffer);v.setUint32(0,data.length);out.set(new TextEncoder().encode(type),4);out.set(data,8);v.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;}
export async function encodeNativePng(width:number,height:number,pixels:Uint8ClampedArray){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1048576||pixels.length!==width*height*4)fail('PNG raster exceeds native budget.');
 const header=new Uint8Array(13),v=new DataView(header.buffer);v.setUint32(0,width);v.setUint32(4,height);header[8]=8;header[9]=6;
 const rows=new Uint8Array((width*4+1)*height);for(let y=0;y<height;y++)rows.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
 return concat([signature,chunk('IHDR',header),chunk('IDAT',await deflate(rows)),chunk('IEND',new Uint8Array())]);
}
export async function decodeNativePng(bytes:Uint8Array,width:number,height:number){
 boundedBytes(bytes);if(!signature.every((v,i)=>bytes[i]===v))fail('Embedded image must be PNG.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),parts:Uint8Array[]=[];
 let at=8,color=-1,palette:Uint8Array|undefined,alpha:Uint8Array|undefined,ended=false,idat=false,afterIdat=false,count=0;
 while(at+12<=bytes.length){if(++count>4096)fail('Too many PNG chunks.');const n=view.getUint32(at),end=at+n+12;if(end>bytes.length)fail('Truncated PNG chunk.');const type=new TextDecoder().decode(bytes.subarray(at+4,at+8)),data=bytes.subarray(at+8,end-4);if(crc32(bytes.subarray(at+4,end-4))!==view.getUint32(end-4))fail('PNG checksum mismatch.');
  if(count===1&&type!=='IHDR')fail('PNG header must be first.');
  if(type==='IHDR'){if(count!==1||n!==13)fail('Invalid PNG header.');const h=new DataView(data.buffer,data.byteOffset,data.byteLength);if(h.getUint32(0)!==width||h.getUint32(4)!==height||width*height>1048576||width<1||height<1)fail('PNG dimensions do not match the Piskel layout.');color=data[9];if(data[8]!==8||![2,3,6].includes(color)||data[10]||data[11]||data[12])fail('Piskel PNG needs non-interlaced 8-bit RGB/RGBA/indexed pixels.');}
  else if(type==='PLTE'){if(idat||palette||n<3||n>768||n%3)fail('Invalid PNG palette.');palette=data;}
  else if(type==='tRNS'){if(idat||alpha||color!==3||!palette||n>palette.length/3)fail('Unsupported PNG transparency.');alpha=data;}
  else if(type==='IDAT'){if(afterIdat)fail('PNG image chunks must be consecutive.');idat=true;parts.push(data);}
  else if(type==='IEND'){if(n||!idat||end!==bytes.length)fail('Invalid PNG ending.');ended=true;break;}
  else{if(idat)afterIdat=true;if(!['sRGB','gAMA','pHYs','tEXt','iTXt','zTXt','cHRM'].includes(type))fail(`Unsupported PNG chunk ${type}.`);if(['gAMA','cHRM'].includes(type))fail('Custom PNG colour profiles are not supported.');}
  at=end;
 }
 if(!ended||color===3&&!palette)fail('Incomplete PNG.');const channels=color===6?4:color===2?3:1,stride=width*channels,raw=await inflate(concat(parts),(stride+1)*height),scan=new Uint8Array(stride*height);
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)fail('Invalid PNG row filter.');for(let x=0;x<stride;x++){const a=x>=channels?scan[y*stride+x-channels]:0,b=y?scan[(y-1)*stride+x]:0,c=y&&x>=channels?scan[(y-1)*stride+x-channels]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predict=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;scan[y*stride+x]=(raw[y*(stride+1)+1+x]+predict)&255;}}
 const pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++){if(color===3){const p=scan[i];if(p>=palette!.length/3)fail('PNG palette index out of bounds.');pixels.set([palette![p*3],palette![p*3+1],palette![p*3+2],alpha?.[p]??255],i*4);}else pixels.set([scan[i*channels],scan[i*channels+1],scan[i*channels+2],channels===4?scan[i*channels+3]:255],i*4);}return pixels;
}

export {chunk as pngChunk};
