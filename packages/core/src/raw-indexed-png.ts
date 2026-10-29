import {pngChunk,decodeNativePngData} from './native-png.js';
import {concat,deflate} from './native-utils.js';
export const RAW_INDEXED_PNG_BYTES=5*1024*1024;
export const RAW_INDEXED_PNG_PIXELS=1048576;
/** PNG has an ordered slot table, but no designated editor clear-slot field. */
export interface RawIndexedRaster {width:number;height:number;palette:number[][];indices:Uint8Array}
export function copyRawIndexedRaster(input:RawIndexedRaster):RawIndexedRaster {
 if(!input||![input.width,input.height].every(n=>Number.isInteger(n)&&n>=1&&n<=10240)||input.width*input.height>RAW_INDEXED_PNG_PIXELS)throw Error('Raw indexed PNG window must fit 10240px axes and one megapixel.');
 if(!Array.isArray(input.palette)||input.palette.length<1||input.palette.length>256||Array.from(input.palette).some(p=>!Array.isArray(p)||p.length!==4||Array.from(p).some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('Raw indexed PNG needs 1-256 complete RGBA palette entries.');
 if(!(input.indices instanceof Uint8Array)||input.indices.length!==input.width*input.height||input.indices.some(i=>i>=input.palette.length))throw Error('Invalid raw indexed PNG slot plane.');
 return {width:input.width,height:input.height,palette:input.palette.map(p=>[...p]),indices:input.indices.slice()};
}
export async function encodeRawIndexedPng(input:RawIndexedRaster):Promise<Uint8Array>{
 const c=copyRawIndexedRaster(input),header=new Uint8Array(13),v=new DataView(header.buffer);v.setUint32(0,c.width);v.setUint32(4,c.height);header[8]=8;header[9]=3;
 const rows=new Uint8Array((c.width+1)*c.height);for(let y=0;y<c.height;y++)rows.set(c.indices.subarray(y*c.width,(y+1)*c.width),y*(c.width+1)+1);
 const output=concat([Uint8Array.of(137,80,78,71,13,10,26,10),pngChunk('IHDR',header),pngChunk('PLTE',Uint8Array.from(c.palette.flatMap(p=>p.slice(0,3)))),pngChunk('tRNS',Uint8Array.from(c.palette.map(p=>p[3]))),pngChunk('IDAT',await deflate(rows)),pngChunk('IEND',new Uint8Array())]);
 if(output.length>RAW_INDEXED_PNG_BYTES)throw Error('Raw indexed PNG exceeds 5 MiB.');return output;
}
export async function decodeRawIndexedPng(input:Uint8Array):Promise<RawIndexedRaster>{
 if(!(input instanceof Uint8Array)||input.length<33||input.length>RAW_INDEXED_PNG_BYTES)throw Error('Raw indexed PNG needs 33 bytes to 5 MiB.');
 const bytes=input.slice(),v=new DataView(bytes.buffer);if(![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)||bytes[24]!==8||bytes[25]!==3)throw Error('Raw indexed PNG requires non-interlaced 8-bit palette storage.');
 const width=v.getUint32(16),height=v.getUint32(20);if(width<1||height<1||width>10240||height>10240||width*height>RAW_INDEXED_PNG_PIXELS)throw Error('Raw indexed PNG window must fit 10240px axes and one megapixel.');
 const decoded=await decodeNativePngData(bytes,width,height);if(!decoded.palette||!decoded.indices)throw Error('Raw indexed PNG needs a complete palette and slot plane.');
 return copyRawIndexedRaster({width,height,palette:Array.from({length:decoded.palette.length/3},(_,i)=>[...decoded.palette!.subarray(i*3,i*3+3),decoded.alpha?.[i]??255]),indices:decoded.indices});
}
